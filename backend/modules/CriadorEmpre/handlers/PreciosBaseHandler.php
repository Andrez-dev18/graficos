<?php

require_once __DIR__ . '/CantidadesTablaHandler.php';

class PreciosBaseHandler
{
    public const TIPO = 'Pollo bebe';
    public const PRECIO_MIN = 0.01;
    public const PRECIO_MAX = 4.6;

    private const PROVINCIAS = [
        'CAMANA',
        'LA JOYA',
        'MOLLENDO',
        'PEDREGAL',
        'TACNA'
    ];

    public static function obtenerFiltros(PDO $db): array
    {
        $provincias = [];
        foreach (self::PROVINCIAS as $provincia) {
            $provincias[] = [
                'id'    => $provincia,
                'label' => $provincia
            ];
        }

        $expresion = self::expresionNombreCorregido();
        $placeholdersProvincias = implode(',', array_fill(0, count(self::PROVINCIAS), '?'));

        $sqlProveedores = "
            SELECT DISTINCT {$expresion} AS nombre_corregido
            FROM com_db_criador_emprendedor a
            INNER JOIN com_tipo_emprendedor t ON a.tipo = t.codigo
            INNER JOIN com_proveedor p ON a.proveedor = p.codigo
            INNER JOIN com_provincia pr ON a.provincia = pr.codigo
            WHERE t.nombre = ?
              AND pr.nombre IN ($placeholdersProvincias)
              AND a.precio > 0
              AND p.nombre IS NOT NULL
              AND TRIM(p.nombre) <> ''
            ORDER BY nombre_corregido ASC
        ";

        $stmt = $db->prepare($sqlProveedores);
        $stmt->execute(array_merge([self::TIPO], self::PROVINCIAS));

        $proveedores = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre_corregido'] ?? ''));
            if ($nombre !== '') {
                $proveedores[] = [
                    'id'    => $nombre,
                    'label' => $nombre
                ];
            }
        }

        $sqlRango = "
            SELECT MIN(a.fecha) AS fecha_min, MAX(a.fecha) AS fecha_max
            FROM com_db_criador_emprendedor a
            INNER JOIN com_tipo_emprendedor t ON a.tipo = t.codigo
            INNER JOIN com_provincia pr ON a.provincia = pr.codigo
            WHERE t.nombre = ?
              AND pr.nombre IN ($placeholdersProvincias)
              AND a.precio > 0
        ";

        $stmt = $db->prepare($sqlRango);
        $stmt->execute(array_merge([self::TIPO], self::PROVINCIAS));
        $rango = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'tipo'                   => self::TIPO,
            'titulo'                 => 'Precio de Proveedores de Pollo BB',
            'provincias'             => $provincias,
            'proveedores'            => $proveedores,
            'proveedores_default'    => array_column($proveedores, 'id'),
            'fecha_min'              => $rango['fecha_min'] ?? null,
            'fecha_max'              => $rango['fecha_max'] ?? null,
            'precio_min'             => self::PRECIO_MIN,
            'precio_max'             => self::PRECIO_MAX
        ];
    }

    public static function obtenerDatos(PDO $db, array $filtros, bool $incluirProvincia = false): array
    {
        $opciones = self::obtenerFiltros($db);

        $fechaInicio = CantidadesTablaHandler::resolverFecha(
            $filtros['fecha_inicio'] ?? '',
            (string)($opciones['fecha_min'] ?? '')
        );
        $fechaFin = CantidadesTablaHandler::resolverFecha(
            $filtros['fecha_fin'] ?? '',
            (string)($opciones['fecha_max'] ?? '')
        );

        if ($fechaInicio > $fechaFin) {
            throw new InvalidArgumentException('La fecha inicial no puede ser mayor que la fecha final.');
        }

        $provincias = CantidadesTablaHandler::normalizarSeleccion(
            array_key_exists('provincias', $filtros) ? $filtros['provincias'] : $opciones['provincias'],
            $opciones['provincias']
        );
        $proveedores = CantidadesTablaHandler::normalizarSeleccion(
            array_key_exists('proveedores', $filtros) ? $filtros['proveedores'] : $opciones['proveedores_default'],
            $opciones['proveedores']
        );

        $respuesta = [
            'fecha_inicio' => $fechaInicio,
            'fecha_fin'    => $fechaFin,
            'filas'        => [],
            'opciones'     => $opciones
        ];

        if (empty($provincias) || empty($proveedores)) {
            return $respuesta;
        }

        $expresion = self::expresionNombreCorregido();
        $placeholdersProvincias = implode(',', array_fill(0, count($provincias), '?'));
        $placeholdersProveedores = implode(',', array_fill(0, count($proveedores), '?'));

        $selectProvincia = $incluirProvincia ? "TRIM(pr.nombre) AS provincia," : '';
        $groupProvincia = $incluirProvincia ? "TRIM(pr.nombre)," : '';
        $orderProvincia = $incluirProvincia ? "provincia ASC, " : '';

        $sql = "
            SELECT
                {$selectProvincia}
                YEAR(a.fecha) AS anio,
                WEEK(a.fecha, 1) AS semana,
                {$expresion} AS nombre_corregido,
                AVG(CASE WHEN a.precio > 0 THEN a.precio END) AS precio,
                SUM(CASE WHEN a.precio > 0 THEN a.precio END) AS suma_precio,
                SUM(CASE WHEN a.precio > 0 THEN 1 ELSE 0 END) AS conteo
            FROM com_db_criador_emprendedor a
            INNER JOIN com_tipo_emprendedor t ON a.tipo = t.codigo
            INNER JOIN com_proveedor p ON a.proveedor = p.codigo
            INNER JOIN com_provincia pr ON a.provincia = pr.codigo
            WHERE a.fecha >= ?
              AND a.fecha <= ?
              AND t.nombre = ?
              AND pr.nombre IN ($placeholdersProvincias)
              AND {$expresion} IN ($placeholdersProveedores)
            GROUP BY {$groupProvincia} YEAR(a.fecha), WEEK(a.fecha, 1), {$expresion}
            HAVING AVG(CASE WHEN a.precio > 0 THEN a.precio END) BETWEEN ? AND ?
            ORDER BY {$orderProvincia} anio ASC, semana ASC, nombre_corregido ASC
        ";

        $params = array_merge(
            [$fechaInicio, $fechaFin, self::TIPO],
            $provincias,
            $proveedores,
            [self::PRECIO_MIN, self::PRECIO_MAX]
        );

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $respuesta['filas'] = $stmt->fetchAll(PDO::FETCH_ASSOC);

        return $respuesta;
    }

    private static function expresionNombreCorregido(): string
    {
        return "CASE WHEN LEFT(TRIM(p.nombre), 3) = 'San' THEN 'San Fernando' ELSE TRIM(p.nombre) END";
    }
}
