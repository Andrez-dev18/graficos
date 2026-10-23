<?php

class TiendasMercadosHandler
{
    public static function obtenerFiltros(PDO $db): array
    {
        $rango = $db->query(
            "SELECT MIN(fecha) AS fecha_min, MAX(fecha) AS fecha_max
             FROM com_db_mercado_det"
        )->fetch(PDO::FETCH_ASSOC) ?: [];

        $provincias = [];
        $sqlProvincias = "
            SELECT DISTINCT TRIM(p.nombre) AS nombre
            FROM com_db_mercado_det d
            INNER JOIN com_mercado m ON d.mercado = m.codigo
            INNER JOIN com_provincia p ON m.provincia = p.codigo
            WHERE p.nombre IS NOT NULL AND TRIM(p.nombre) <> ''
            ORDER BY nombre ASC
        ";
        foreach ($db->query($sqlProvincias)->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $provincias[] = ['id' => $nombre, 'label' => $nombre];
            }
        }

        $tipos = [];
        $sqlTipos = "
            SELECT DISTINCT TRIM(tipoEstablecimiento) AS nombre
            FROM com_db_mercado_det
            WHERE tipoEstablecimiento IS NOT NULL AND TRIM(tipoEstablecimiento) <> ''
            ORDER BY nombre ASC
        ";
        foreach ($db->query($sqlTipos)->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $tipos[] = ['id' => $nombre, 'label' => $nombre];
            }
        }

        $tamanios = [];
        $sqlTamanios = "
            SELECT DISTINCT TRIM(tamanio) AS nombre
            FROM com_db_mercado_det
            WHERE tamanio IS NOT NULL AND TRIM(tamanio) <> ''
            ORDER BY nombre ASC
        ";
        foreach ($db->query($sqlTamanios)->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $tamanios[] = ['id' => $nombre, 'label' => $nombre];
            }
        }

        return [
            'fecha_min'            => $rango['fecha_min'] ?? null,
            'fecha_max'            => $rango['fecha_max'] ?? null,
            'fecha_inicio_default' => $rango['fecha_min'] ?? null,
            'fecha_fin_default'    => $rango['fecha_max'] ?? null,
            'provincias'           => $provincias,
            'provincias_default'   => array_column($provincias, 'id'),
            'tipos_establecimiento' => $tipos,
            'tamanios'             => $tamanios
        ];
    }

    public static function handle(PDO $db, array $filtros, string $tipoGrafico = 'DashGral'): array
    {
        $opciones = self::obtenerFiltros($db);

        $fechaInicio = self::resolverFecha(
            $filtros['fecha_inicio'] ?? '',
            (string)($opciones['fecha_min'] ?? '')
        );
        $fechaFin = self::resolverFecha(
            $filtros['fecha_fin'] ?? '',
            (string)($opciones['fecha_max'] ?? '')
        );

        if ($fechaInicio > $fechaFin) {
            throw new InvalidArgumentException('La fecha inicial no puede ser mayor que la fecha final.');
        }

        $provincias = self::normalizarSeleccion(
            array_key_exists('provincias', $filtros) ? $filtros['provincias'] : $opciones['provincias_default'],
            $opciones['provincias']
        );

        $respuesta = [
            'tipo_grafico'    => $tipoGrafico,
            'titulo'          => 'Tiendas y Mercados',
            'fecha_inicio'    => $fechaInicio,
            'fecha_fin'       => $fechaFin,
            'filas'           => [],
            'totales'         => [
                'general'              => 0,
                'por_provincia'        => [],
                'por_provincia_tipo'   => []
            ],
            'tipos'           => $opciones['tipos_establecimiento'],
            'tamanios'        => $opciones['tamanios'],
            'total_registros' => 0
        ];

        if (empty($provincias)) {
            return $respuesta;
        }

        $placeholders = implode(',', array_fill(0, count($provincias), '?'));

        $sql = "
            SELECT
                TRIM(p.nombre) AS provincia,
                TRIM(d.tipoEstablecimiento) AS tipo,
                TRIM(d.tamanio) AS tamanio,
                SUM(d.cantidad) AS cantidad
            FROM com_db_mercado_det d
            INNER JOIN com_mercado m ON d.mercado = m.codigo
            INNER JOIN com_provincia p ON m.provincia = p.codigo
            WHERE d.fecha >= ?
              AND d.fecha <= ?
              AND TRIM(p.nombre) IN ($placeholders)
            GROUP BY TRIM(p.nombre), TRIM(d.tipoEstablecimiento), TRIM(d.tamanio)
            ORDER BY provincia ASC, tipo ASC, tamanio ASC
        ";

        $params = array_merge([$fechaInicio, $fechaFin], $provincias);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $totalGeneral = 0;
        $porProvincia = [];
        $porProvinciaTipo = [];
        $filasRespuesta = [];

        foreach ($filas as $fila) {
            $provincia = trim((string)($fila['provincia'] ?? ''));
            $tipo = trim((string)($fila['tipo'] ?? ''));
            $tamanio = trim((string)($fila['tamanio'] ?? ''));
            $cantidad = (int)($fila['cantidad'] ?? 0);

            if ($provincia === '' || $tipo === '' || $tamanio === '') {
                continue;
            }

            $filasRespuesta[] = [
                'provincia' => $provincia,
                'tipo'      => $tipo,
                'tamanio'   => $tamanio,
                'cantidad'  => $cantidad
            ];

            $totalGeneral += $cantidad;
            $porProvincia[$provincia] = ($porProvincia[$provincia] ?? 0) + $cantidad;

            $key = $provincia . '||' . $tipo;
            $porProvinciaTipo[$key] = ($porProvinciaTipo[$key] ?? 0) + $cantidad;
        }

        $respuesta['filas'] = $filasRespuesta;
        $respuesta['totales'] = [
            'general'            => $totalGeneral,
            'por_provincia'      => $porProvincia,
            'por_provincia_tipo' => $porProvinciaTipo
        ];
        $respuesta['total_registros'] = count($filasRespuesta);

        return $respuesta;
    }

    private static function resolverFecha($valor, string $defecto): string
    {
        $valor = trim((string)$valor);

        if ($valor === '') {
            if ($defecto === '') {
                throw new InvalidArgumentException('No hay rango de fechas disponible.');
            }
            return $defecto;
        }

        $fecha = DateTimeImmutable::createFromFormat('!Y-m-d', $valor);
        if (!$fecha || $fecha->format('Y-m-d') !== $valor) {
            throw new InvalidArgumentException('Fecha inválida: ' . $valor);
        }

        return $valor;
    }

    private static function normalizarSeleccion($valor, array $disponibles): array
    {
        if ($valor === null) {
            return [];
        }

        if (is_string($valor)) {
            $valor = explode(',', $valor);
        }

        if (!is_array($valor)) {
            return [];
        }

        $seleccionados = [];
        foreach ($valor as $item) {
            $nombre = trim((string)$item);
            if ($nombre !== '') {
                $seleccionados[$nombre] = true;
            }
        }

        $resultado = [];
        foreach ($disponibles as $opcion) {
            $id = (string)($opcion['id'] ?? '');
            if ($id !== '' && isset($seleccionados[$id])) {
                $resultado[] = $id;
            }
        }

        return $resultado;
    }
}
