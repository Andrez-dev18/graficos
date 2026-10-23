<?php

require_once __DIR__ . '/ParticipacionMercadoDiariaHandler.php';

class EvolucionPrecioHandler
{
    public static function obtenerFiltros(PDO $db): array
    {
        $sqlRango = "
            SELECT 
                MIN(a.fecha) AS fecha_min,
                MAX(a.fecha) AS fecha_max
            FROM com_db_ingre_emp_lima a
            WHERE a.fecha IS NOT NULL
        ";
        $rango = $db->query($sqlRango)->fetch(PDO::FETCH_ASSOC) ?: [];

        $fechaMin = $rango['fecha_min'] ?? null;
        $fechaMax = $rango['fecha_max'] ?? null;

        $sqlEmpresas = "
            SELECT DISTINCT 
                TRIM(e.nombre) AS nombre
            FROM com_db_ingre_emp_lima a
            INNER JOIN com_empresa e ON a.empresa = e.codigo
            WHERE e.nombre IS NOT NULL 
              AND TRIM(e.nombre) <> ''
            ORDER BY nombre ASC
        ";
        $stmtEmpresas = $db->query($sqlEmpresas);
        $empresas = [];

        foreach ($stmtEmpresas->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $empresas[] = [
                    'id'    => $nombre,
                    'label' => $nombre
                ];
            }
        }

        $empresasDefault = array_column($empresas, 'id');

        $fechaInicioDefault = null;
        $fechaFinDefault = null;

        if ($fechaMax) {
            $fechaFinDefault = $fechaMax;
            $maxDt = new DateTimeImmutable($fechaMax);
            $inicioDt = $maxDt->modify('-2 months')->modify('first day of this month');
            $fechaInicioDefault = $inicioDt->format('Y-m-d');
            if ($fechaMin && $fechaInicioDefault < $fechaMin) {
                $fechaInicioDefault = $fechaMin;
            }
        }

        return [
            'tipo_grafico'          => 'EvolucionPrecio',
            'titulo'                => 'Evolucion de Precios por Empresa',
            'fecha_min'             => $fechaMin,
            'fecha_max'             => $fechaMax,
            'fecha_inicio_default'  => $fechaInicioDefault,
            'fecha_fin_default'     => $fechaFinDefault,
            'empresas'              => $empresas,
            'empresas_default'      => $empresasDefault
        ];
    }

    public static function handle(PDO $db, array $filtros): array
    {
        $opciones = self::obtenerFiltros($db);

        $fechaInicio = ParticipacionMercadoDiariaHandler::resolverFecha(
            $filtros['fecha_inicio'] ?? '',
            (string)($opciones['fecha_inicio_default'] ?? $opciones['fecha_min'] ?? '')
        );
        $fechaFin = ParticipacionMercadoDiariaHandler::resolverFecha(
            $filtros['fecha_fin'] ?? '',
            (string)($opciones['fecha_fin_default'] ?? $opciones['fecha_max'] ?? '')
        );

        if ($fechaInicio > $fechaFin) {
            throw new InvalidArgumentException('La fecha inicial no puede ser mayor que la fecha final.');
        }

        $empresasSeleccionadas = ParticipacionMercadoDiariaHandler::normalizarSeleccion(
            array_key_exists('empresas', $filtros) ? $filtros['empresas'] : $opciones['empresas_default'],
            $opciones['empresas']
        );

        $fechas = self::construirFechas($fechaInicio, $fechaFin);

        $respuestaBase = [
            'tipo_grafico'    => 'EvolucionPrecio',
            'titulo'          => 'Evolucion de Precios por Empresa',
            'subtitulo'       => 'Día de fecha',
            'fecha_inicio'    => $fechaInicio,
            'fecha_fin'       => $fechaFin,
            'fechas'          => $fechas,
            'series'          => [],
            'total_registros' => 0
        ];

        if (empty($empresasSeleccionadas) || empty($fechas)) {
            return $respuestaBase;
        }

        $placeholders = implode(',', array_fill(0, count($empresasSeleccionadas), '?'));

        $sql = "
            SELECT
                DATE(a.fecha) AS fecha,
                TRIM(e.nombre) AS empresa,
                AVG(a.precio_granja) AS precio_granja
            FROM com_db_ingre_emp_lima a
            INNER JOIN com_empresa e ON a.empresa = e.codigo
            WHERE a.fecha >= ?
              AND a.fecha <= ?
              AND TRIM(e.nombre) IN ($placeholders)
            GROUP BY DATE(a.fecha), TRIM(e.nombre)
            ORDER BY fecha ASC, empresa ASC
        ";

        $params = array_merge([$fechaInicio, $fechaFin], $empresasSeleccionadas);
        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $filas = $stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($filas)) {
            return $respuestaBase;
        }

        $porFecha = [];
        $diasConMercado = [];
        $empresasConDatos = [];

        foreach ($filas as $fila) {
            $fecha = (string)($fila['fecha'] ?? '');
            $empresa = trim((string)($fila['empresa'] ?? ''));
            $precio = (float)($fila['precio_granja'] ?? 0);

            if ($fecha === '' || $empresa === '') {
                continue;
            }

            if (!isset($porFecha[$fecha])) {
                $porFecha[$fecha] = [];
            }

            $porFecha[$fecha][$empresa] = $precio;
            $diasConMercado[$fecha] = true;
            $empresasConDatos[$empresa] = true;
        }

        $ordenEmpresas = array_values(array_filter($empresasSeleccionadas, function ($item) use ($empresasConDatos) {
            return isset($empresasConDatos[$item]);
        }));

        $series = [];
        foreach ($ordenEmpresas as $empresa) {
            $valores = [];

            foreach ($fechas as $fechaObj) {
                $fechaKey = $fechaObj['fecha'];
                $precio = $porFecha[$fechaKey][$empresa] ?? null;

                if ($precio === null) {
                    $valores[] = isset($diasConMercado[$fechaKey]) ? 0.0 : null;
                } else {
                    $valores[] = round((float)$precio, 3);
                }
            }

            $series[] = [
                'empresa' => $empresa,
                'label'   => $empresa,
                'valores' => $valores
            ];
        }

        $respuestaBase['series'] = $series;
        $respuestaBase['total_registros'] = count($filas);

        return $respuestaBase;
    }

    private static function construirFechas(string $fechaInicio, string $fechaFin): array
    {
        $inicio = new DateTimeImmutable($fechaInicio);
        $fin = new DateTimeImmutable($fechaFin);
        $cursor = $inicio;
        $fechas = [];

        while ($cursor <= $fin) {
            $fechas[] = [
                'fecha' => $cursor->format('Y-m-d'),
                'label' => $cursor->format('Y/m/d')
            ];
            $cursor = $cursor->modify('+1 day');
        }

        return $fechas;
    }
}
