<?php

class CorrelacionGralRepo
{
    private $db;
    private $dbComercial;

    public function __construct($db, $dbComercial)
    {
        $this->db = $db;
        $this->dbComercial = $dbComercial ?: $db;
    }

    public function getFiltros(): array
    {
        $sqlLineas = "SELECT DISTINCT TRIM(tline) AS valor FROM sale WHERE tline IS NOT NULL AND TRIM(tline) <> '' ORDER BY valor";
        $sqlTdocs = "SELECT DISTINCT TRIM(tdoc) AS valor FROM sale WHERE tdoc IS NOT NULL AND TRIM(tdoc) <> '' ORDER BY valor";
        $sqlZonas = "SELECT DISTINCT TRIM(corp.zonacomer) AS valor FROM sale s LEFT JOIN ccte c ON c.codigo = s.tprocli LEFT JOIN ccte corp ON corp.codigo = c.ruc WHERE corp.zonacomer IS NOT NULL AND TRIM(corp.zonacomer) <> '' ORDER BY valor";
        $sqlRutas = "SELECT DISTINCT TRIM(corp.rutacomer) AS valor FROM sale s LEFT JOIN ccte c ON c.codigo = s.tprocli LEFT JOIN ccte corp ON corp.codigo = c.ruc WHERE corp.rutacomer IS NOT NULL AND TRIM(corp.rutacomer) <> '' ORDER BY valor";
        $sqlPlacas = "SELECT DISTINCT TRIM(placa) AS valor FROM sale WHERE placa IS NOT NULL AND TRIM(placa) <> '' ORDER BY valor";

        return [
            'lineas' => $this->valores($sqlLineas),
            'tdocs' => $this->valores($sqlTdocs),
            'zonas' => $this->valores($sqlZonas),
            'rutas' => $this->valores($sqlRutas),
            'placas' => $this->valores($sqlPlacas),
            'linea_default' => '601',
            'tdoc_default' => ['01', '03']
        ];
    }

    public function getVentas(array $filtros, int $limit = 100, int $offset = 0): array
    {
        $where = ["s.tfecfac BETWEEN :f_ini AND :f_fin"];
        $params = [
            ':f_ini' => $filtros['fecha_inicio'],
            ':f_fin' => $filtros['fecha_fin']
        ];
        $this->agregarFiltro($where, $params, 's.tline', $filtros['linea'] ?? '', 'linea');
        $this->agregarLista($where, $params, 's.tdoc', $filtros['tdocs'] ?? [], 'tdoc');
        $this->agregarLista($where, $params, 'corp.zonacomer', $filtros['zonas'] ?? [], 'zona');
        $this->agregarLista($where, $params, 'corp.rutacomer', $filtros['rutas'] ?? [], 'ruta');
        $this->agregarLista($where, $params, 's.placa', $filtros['placas'] ?? [], 'placa');

        $sql = "SELECT SQL_CALC_FOUND_ROWS
                    DATE_FORMAT(s.tfecfac, '%Y-%m-%d') AS fecha,
                    TRIM(s.placa) AS placa,
                    DATE_FORMAT(s.tdate, '%Y-%m-%d') AS fecha_registro,
                    MIN(s.ttime) AS hora_min,
                    MAX(s.ttime) AS hora_max,
                    TRIM(corp.codigo) AS cod_corporativo,
                    TRIM(corp.nombre) AS nom_corporativo,
                    TRIM(s.tprocli) AS cod_cliente,
                    TRIM(c.nombre) AS nom_cliente,
                    TRIM(CAST(s.tnumfac AS CHAR)) AS nro_doc,
                    TRIM(s.tdoc) AS tdoc,
                    TRIM(s.tcodigo) AS codigo,
                    SUM(s.tcantid) AS cantidad,
                    SUM(s.tespeci) AS peso
                FROM sale s
                LEFT JOIN ccte c ON c.codigo = s.tprocli
                LEFT JOIN ccte corp ON corp.codigo = c.ruc
                WHERE " . implode(' AND ', $where) . "
                GROUP BY DATE_FORMAT(s.tfecfac, '%Y-%m-%d'), TRIM(s.placa), DATE_FORMAT(s.tdate, '%Y-%m-%d'), TRIM(corp.codigo), TRIM(corp.nombre), TRIM(s.tprocli), TRIM(c.nombre), TRIM(CAST(s.tnumfac AS CHAR)), TRIM(s.tdoc), TRIM(s.tcodigo)
                ORDER BY fecha ASC, placa ASC, fecha_registro ASC, hora_min ASC, cod_corporativo ASC, cod_cliente ASC, nro_doc ASC, codigo ASC";

        return $this->paginar($this->db, $sql, $params, true, $limit, $offset);
    }

    public function getPlacasVentas(array $filtros): array
    {
        $where = ["s.tfecfac BETWEEN :f_ini AND :f_fin"];
        $params = [
            ':f_ini' => $filtros['fecha_inicio'],
            ':f_fin' => $filtros['fecha_fin']
        ];
        $this->agregarFiltro($where, $params, 's.tline', $filtros['linea'] ?? '', 'linea');
        $this->agregarLista($where, $params, 's.tdoc', $filtros['tdocs'] ?? [], 'tdoc');
        $this->agregarLista($where, $params, 'corp.zonacomer', $filtros['zonas'] ?? [], 'zona');
        $this->agregarLista($where, $params, 'corp.rutacomer', $filtros['rutas'] ?? [], 'ruta');

        $sql = "SELECT DISTINCT TRIM(s.placa) AS placa
                FROM sale s
                LEFT JOIN ccte c ON c.codigo = s.tprocli
                LEFT JOIN ccte corp ON corp.codigo = c.ruc
                WHERE " . implode(' AND ', $where) . "
                  AND s.placa IS NOT NULL AND TRIM(s.placa) <> ''
                ORDER BY placa";

        $filas = $this->ejecutar($this->db, $sql, $params, true);
        return array_values(array_filter(array_map(function($f) { return trim((string)($f['placa'] ?? '')); }, $filas)));
    }

    public function getTransportes(array $filtros, int $limit = 100, int $offset = 0, int $maxLimit = 200): array
    {
        $where = [];
        $params = [];
        $placaNorm = "CONCAT(LEFT(TRIM(t.placa), 3), RIGHT(TRIM(t.placa), 3))";
        $this->agregarFechaSeleccionada($where, $params, 't.tfecfac', $filtros, 'fecha');
        $this->agregarLista($where, $params, $placaNorm, $this->placasSeleccionadas($filtros), 'placa_t');

        $sql = "SELECT SQL_CALC_FOUND_ROWS
                    DATE_FORMAT(t.tfecfac, '%Y-%m-%d') AS fecha,
                    {$placaNorm} AS placa,
                    DATE_FORMAT(t.fechahoraentrada, '%Y-%m-%d %H:%i:%s') AS fecha_entrada,
                    DATE_FORMAT(t.fechahorasalida, '%Y-%m-%d %H:%i:%s') AS fecha_salida,
                    TRIM(c.zonacomer) AS zona,
                    TRIM(c.rutacomer) AS ruta,
                    TRIM(c.secuencia) AS secuencia,
                    TRIM(c.ruc) AS cod_corporativo,
                    TRIM(corp.nombre) AS nom_corporativo,
                    TRIM(c.codigo) AS cod_cliente,
                    TRIM(c.nombre) AS nom_cliente,
                    TRIM(t.nombre) AS geocerca,
                    SUM((TIMESTAMPDIFF(SECOND, t.fechahorasalida, t.fechahoraentrada) * -1)) AS duracion_seg
                FROM transportes t
                LEFT JOIN ccte c ON c.codigo = t.cliente
                LEFT JOIN ccte corp ON corp.codigo = c.ruc
                WHERE " . ($where ? implode(' AND ', $where) : '1=1') . "
                GROUP BY DATE_FORMAT(t.tfecfac, '%Y-%m-%d'), {$placaNorm}, t.fechahoraentrada, t.fechahorasalida, TRIM(c.zonacomer), TRIM(c.rutacomer), TRIM(c.secuencia), TRIM(c.ruc), TRIM(corp.nombre), TRIM(c.codigo), TRIM(c.nombre), TRIM(t.nombre)
                ORDER BY fecha ASC, placa ASC, fecha_entrada ASC";

        return $this->paginar($this->db, $sql, $params, true, $limit, $offset, $maxLimit);
    }

    public function getAgcausal(array $filtros, int $limit = 100, int $offset = 0, int $maxLimit = 200): array
    {
        $where = [];
        $params = [];
        $this->agregarFechaSeleccionada($where, $params, 'fechaproceso', $filtros, 'fecha');
        $this->agregarLista($where, $params, "REPLACE(TRIM(placa), '-', '')", $this->placasSeleccionadas($filtros), 'placa_a', true);

        $sql = "SELECT SQL_CALC_FOUND_ROWS
                    DATE_FORMAT(fechaproceso, '%Y-%m-%d') AS fecha,
                    TRIM(cliente) AS cliente,
                    TRIM(placa) AS placa,
                    TRIM(area) AS area,
                    TRIM(codigoconta) AS codigoconta,
                    TRIM(causatipo) AS causatipo,
                    DATE_FORMAT(fecharegistro, '%Y-%m-%d') AS fecha_registro,
                    TRIM(horaregistro) AS hora_registro,
                    TRIM(descripcion) AS descripcion
                FROM dmagentescausalesmermas
                WHERE " . ($where ? implode(' AND ', $where) : '1=1') . "
                ORDER BY fecha ASC, cliente ASC, placa ASC, area ASC, codigoconta ASC, causaTipo ASC, fecha_registro ASC, hora_registro ASC";

        return $this->paginar($this->dbComercial, $sql, $params, false, $limit, $offset, $maxLimit);
    }

    public function getMermas(array $filtros, int $limit = 100, int $offset = 0, int $maxLimit = 200): array
    {
        $where = ["TRIM(dato) = 'Peso'", "TRIM(zonaorigen) IN ('JOYA', 'MOLLENDO')"];
        $params = [];
        $this->agregarFechaSeleccionada($where, $params, 'fechaproceso', $filtros, 'fecha');
        $this->agregarLista($where, $params, "REPLACE(TRIM(placa), '-', '')", $this->placasSeleccionadas($filtros), 'placa_m', true);

        $sql = "SELECT SQL_CALC_FOUND_ROWS
                    DATE_FORMAT(fechaproceso, '%Y-%m-%d') AS fecha,
                    COALESCE(NULLIF(TRIM(zonaorigen), ''), 'SIN ZONA') AS zonaorigen,
                    TRIM(cliente) AS cliente,
                    TRIM(placa) AS placa,
                    TRIM(codigo) AS codigo,
                    ROUND(AVG(COALESCE(objetivo, 0)) * 100, 2) AS objetivo,
                    ROUND((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) * 100, 2) AS real_pct,
                    ROUND(((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) - AVG(COALESCE(objetivo, 0))) * 100, 2) AS dif,
                    ROUND(SUM(entrada), 2) AS entrada,
                    ROUND(SUM(mermatotal), 2) AS mermatotal
                FROM dmmermas
                WHERE " . implode(' AND ', $where) . "
                GROUP BY DATE_FORMAT(fechaproceso, '%Y-%m-%d'), COALESCE(NULLIF(TRIM(zonaorigen), ''), 'SIN ZONA'), TRIM(cliente), TRIM(placa), TRIM(codigo)
                ORDER BY fecha ASC, zonaorigen ASC, cliente ASC, placa ASC, codigo ASC";

        return $this->paginar($this->dbComercial, $sql, $params, false, $limit, $offset, $maxLimit);
    }

    private function valores(string $sql): array
    {
        $filas = $this->ejecutar($this->db, $sql, [], true);
        return array_values(array_filter(array_map(function($f) { return trim((string)($f['valor'] ?? '')); }, $filas)));
    }

    private function agregarFiltro(array &$where, array &$params, string $campo, string $valor, string $nombre): void
    {
        $valor = trim($valor);
        if ($valor === '' || strtoupper($valor) === 'TODO') return;
        $where[] = "$campo = :$nombre";
        $params[":$nombre"] = $valor;
    }

    private function agregarLista(array &$where, array &$params, string $campo, array $valores, string $nombre, bool $normalizar = false): void
    {
        $valores = array_values(array_filter(array_map('trim', $valores), function($v) { return $v !== '' && strtoupper($v) !== 'TODO'; }));
        if (!$valores) return;

        $ph = [];
        foreach ($valores as $i => $valor) {
            $key = ":{$nombre}_{$i}";
            $ph[] = $key;
            $params[$key] = $normalizar ? str_replace('-', '', $valor) : $valor;
        }
        $where[] = "$campo IN (" . implode(',', $ph) . ")";
    }

    private function agregarFechaSeleccionada(array &$where, array &$params, string $campo, array $filtros, string $prefijo): void
    {
        $seleccion = trim((string)($filtros['seleccion_fecha'] ?? ''));
        if ($seleccion !== '') {
            $where[] = "$campo = :{$prefijo}_sel";
            $params[":{$prefijo}_sel"] = $seleccion;
            return;
        }

        $where[] = "$campo BETWEEN :{$prefijo}_ini AND :{$prefijo}_fin";
        $params[":{$prefijo}_ini"] = $filtros['fecha_inicio'];
        $params[":{$prefijo}_fin"] = $filtros['fecha_fin'];
    }

    private function placasSeleccionadas(array $filtros): array
    {
        $seleccion = trim((string)($filtros['seleccion_placa'] ?? ''));
        if ($seleccion !== '') return [$seleccion];
        return $filtros['placas'] ?? [];
    }

    private function ejecutar($conn, string $sql, array $params, bool $principal): array
    {
        $stmt = $this->preparar($conn, $sql, $principal);
        $stmt->execute($params);
        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private function paginar($conn, string $sql, array $params, bool $principal, int $limit, int $offset, int $maxLimit = 200): array
    {
        $maxLimit = max(1, $maxLimit);
        $limit = max(1, min($maxLimit, $limit));
        $offset = max(0, $offset);
        $sqlPag = $sql . " LIMIT {$limit} OFFSET {$offset}";

        $stmt = $this->preparar($conn, $sqlPag, $principal);
        $stmt->execute($params);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $stmtTotal = $this->preparar($conn, 'SELECT FOUND_ROWS()', $principal);
        $stmtTotal->execute();

        return [
            'rows'  => $rows,
            'total' => (int)$stmtTotal->fetchColumn()
        ];
    }

    private function preparar($conn, string $sql, bool $principal)
    {
        return ($principal && $conn instanceof SmartPDO)
            ? $conn->prepareNative('principal', $sql)
            : $conn->prepare($sql);
    }
}
