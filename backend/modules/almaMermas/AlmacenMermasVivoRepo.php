<?php

class AlmacenMermasVivoRepo
{
    private $conn;

    public function __construct($db)
    {
        $this->conn = $db;
    }

    /**
     * Consulta Porcentaje de Merma Diaria por Fecha de Proceso / Cliente / Placa
     */
    public function getPorcMermaProcesoDiaClientePlaca(array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');
        $dato        = trim($filtros['dato'] ?? 'TODO');

        $params = [
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin
        ];

        $where = [
            "fechaproceso BETWEEN :f_ini AND :f_fin",
            "cliente IS NOT NULL AND cliente != ''",
            "placa IS NOT NULL AND TRIM(placa) != ''"
        ];

        $groupBy = "fechaproceso, TRIM(cliente), TRIM(placa)";
        $selectDato = "'TODO' AS dato";

        if (!empty($dato) && strtoupper($dato) !== 'TODO') {
            $where[] = "TRIM(dato) = :dato";
            $params[':dato'] = $dato;
            $selectDato = "MAX(TRIM(dato)) AS dato";
        }

        $whereStr = implode(' AND ', $where);

        $sql = "SELECT 
                    fechaproceso,
                    TRIM(cliente) AS cliente,
                    TRIM(placa) AS placa,
                    {$selectDato},
                    ROUND(COALESCE(SUM(entrada), 0), 2) AS total_entrada,
                    -- Las 8 métricas porcentuales de la matriz de Tableau
                    ROUND(COALESCE((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatotal,
                    ROUND(COALESCE((SUM(mermaalmacenaje) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermaalmacenaje,
                    ROUND(COALESCE((SUM(mermamuertodistribucion) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermamuertodistribucion,
                    ROUND(COALESCE((SUM(mermamuertotransporte) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermamuertotransporte,
                    ROUND(COALESCE((SUM(mermanoapto) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermanoapto,
                    ROUND(COALESCE((SUM(mermatransporte) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatransporte,
                    ROUND(COALESCE((SUM(mermatransbenemanual) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatransbenemanual,
                    ROUND(COALESCE((SUM(mermatransbenemecani) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatransbenemecani,
                    -- Valores absolutos
                    ROUND(COALESCE(SUM(mermatotal), 0), 2) AS sum_mermatotal,
                    ROUND(COALESCE(SUM(mermatransporte), 0), 2) AS sum_mermatransporte,
                    ROUND(COALESCE(SUM(mermamuertotransporte), 0), 2) AS sum_mermamuertotransporte,
                    ROUND(COALESCE(SUM(mermatransbenemecani), 0), 2) AS sum_mermatransbenemecani
                FROM dmmermas
                WHERE {$whereStr}
                GROUP BY {$groupBy}
                ORDER BY fechaproceso ASC, cliente ASC, placa ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Consulta Porcentaje de Merma Diaria por Fecha de Proceso y Cliente (sin desglose de placa)
     */
    public function getPorcMermaProcesoDiaCliente(array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');
        $dato        = trim($filtros['dato'] ?? 'TODO');

        $params = [
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin
        ];

        $where = [
            "fechaproceso BETWEEN :f_ini AND :f_fin",
            "cliente IS NOT NULL AND cliente != ''"
        ];

        $groupBy = "fechaproceso, TRIM(cliente)";
        $selectDato = "'TODO' AS dato";

        if (!empty($dato) && strtoupper($dato) !== 'TODO') {
            $where[] = "TRIM(dato) = :dato";
            $params[':dato'] = $dato;
            $selectDato = "MAX(TRIM(dato)) AS dato";
        }

        $whereStr = implode(' AND ', $where);

        $sql = "SELECT 
                    fechaproceso,
                    TRIM(cliente) AS cliente,
                    {$selectDato},
                    ROUND(COALESCE(SUM(entrada), 0), 2) AS total_entrada,
                    -- Las 8 métricas porcentuales de la matriz de Tableau
                    ROUND(COALESCE((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatotal,
                    ROUND(COALESCE((SUM(mermaalmacenaje) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermaalmacenaje,
                    ROUND(COALESCE((SUM(mermamuertodistribucion) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermamuertodistribucion,
                    ROUND(COALESCE((SUM(mermamuertotransporte) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermamuertotransporte,
                    ROUND(COALESCE((SUM(mermanoapto) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermanoapto,
                    ROUND(COALESCE((SUM(mermatransporte) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatransporte,
                    ROUND(COALESCE((SUM(mermatransbenemanual) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatransbenemanual,
                    ROUND(COALESCE((SUM(mermatransbenemecani) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatransbenemecani,
                    -- Valores absolutos
                    ROUND(COALESCE(SUM(mermatotal), 0), 2) AS sum_mermatotal,
                    ROUND(COALESCE(SUM(mermatransporte), 0), 2) AS sum_mermatransporte,
                    ROUND(COALESCE(SUM(mermamuertotransporte), 0), 2) AS sum_mermamuertotransporte,
                    ROUND(COALESCE(SUM(mermatransbenemecani), 0), 2) AS sum_mermatransbenemecani
                FROM dmmermas
                WHERE {$whereStr}
                GROUP BY {$groupBy}
                ORDER BY fechaproceso ASC, cliente ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Consulta Porcentaje de Merma Diaria por Fecha de Proceso, Cliente y Zona (con Objetivo y Desvío)
     */
    public function getPorcMermaProcesoDiaClienteZona(array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');
        $dato        = trim($filtros['dato'] ?? 'TODO');

        $params = [
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin
        ];

        $where = [
            "fechaproceso BETWEEN :f_ini AND :f_fin",
            "cliente IS NOT NULL AND cliente != ''"
        ];

        $groupBy = "fechaproceso, COALESCE(TRIM(zonaorigen), ''), TRIM(cliente)";
        $selectDato = "'TODO' AS dato";

        if (!empty($dato) && strtoupper($dato) !== 'TODO') {
            $where[] = "TRIM(dato) = :dato";
            $params[':dato'] = $dato;
            $selectDato = "MAX(TRIM(dato)) AS dato";
        }

        $whereStr = implode(' AND ', $where);

        $sql = "SELECT 
                    fechaproceso,
                    COALESCE(TRIM(zonaorigen), '') AS zonaorigen,
                    TRIM(cliente) AS cliente,
                    {$selectDato},
                    ROUND(AVG(COALESCE(objetivo, 0)) * 100, 2) AS avg_objetivo,
                    ROUND(COALESCE(SUM(entrada), 0), 2) AS total_entrada,
                    ROUND(COALESCE((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS pct_mermatotal,
                    -- Desvío vs Objetivo: ((SUM(mermatotal)/SUM(entrada)) - AVG(objetivo)) / AVG(objetivo) * 100
                    ROUND(
                        COALESCE(
                            (
                                ((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) - AVG(objetivo)) 
                                / NULLIF(AVG(objetivo), 0)
                            ) * 100, 
                            0
                        ), 
                        2
                    ) AS pct_variacion,
                    -- Valores absolutos de mermas
                    ROUND(COALESCE(SUM(mermatotal), 0), 2) AS sum_mermatotal,
                    ROUND(COALESCE(SUM(mermaalmacenaje), 0), 2) AS sum_mermaalmacenaje,
                    ROUND(COALESCE(SUM(mermamuertodistribucion), 0), 2) AS sum_mermamuertodistribucion,
                    ROUND(COALESCE(SUM(mermamuertotransporte), 0), 2) AS sum_mermamuertotransporte,
                    ROUND(COALESCE(SUM(mermanoapto), 0), 2) AS sum_mermanoapto,
                    ROUND(COALESCE(SUM(mermatransporte), 0), 2) AS sum_mermatransporte,
                    ROUND(COALESCE(SUM(mermatransbenemanual), 0), 2) AS sum_mermatransbenemanual,
                    ROUND(COALESCE(SUM(mermatransbenemecani), 0), 2) AS sum_mermatransbenemecani
                FROM dmmermas
                WHERE {$whereStr}
                GROUP BY {$groupBy}
                ORDER BY fechaproceso ASC, zonaorigen ASC, cliente ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Consulta el Maestro: Merma de Proceso, Placa, Objetivo (DashPrueba1)
     */
    public function getMermaProcesoPlacaObjetivo(array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');
        $dato        = trim($filtros['dato'] ?? 'Valor');
        $placaFiltro = trim($filtros['placa'] ?? 'TODO');

        if (empty($dato) || strtoupper($dato) === 'TODO') {
            $dato = 'Valor';
        }

        $params = [
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin,
            ':dato'  => $dato
        ];

        $where = [
            "fechaproceso BETWEEN :f_ini AND :f_fin",
            "cliente IS NOT NULL AND TRIM(cliente) != ''",
            "placa IS NOT NULL AND TRIM(placa) != ''",
            "TRIM(dato) = :dato"
        ];

        if (!empty($placaFiltro) && strtoupper($placaFiltro) !== 'TODO') {
            $where[] = "REPLACE(TRIM(placa), '-', '') = :placa_filtro";
            $params[':placa_filtro'] = str_replace('-', '', $placaFiltro);
        }

        $whereStr = implode(' AND ', $where);

        $sql = "SELECT 
                    fechaproceso,
                    COALESCE(NULLIF(TRIM(zonaorigen), ''), 'SIN ZONA') AS zonaorigen,
                    TRIM(cliente) AS cliente,
                    TRIM(placa) AS placa,
                    TRIM(dato) AS dato,
                    ROUND(COALESCE(SUM(entrada), 0), 2) AS total_entrada,
                    ROUND(COALESCE(SUM(mermatotal), 0), 2) AS total_mermatotal,
                    -- 1. Prom. Objetivo % (Barra verde)
                    ROUND(AVG(COALESCE(objetivo, 0)) * 100, 2) AS prom_objetivo,
                    -- 2. Merma Total % (Barra azul: SUM(merma)/SUM(entrada)*100)
                    ROUND((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) * 100, 2) AS pct_mermatotal,
                    -- 3. Semáforo / Variación %: ((SUM(merma)/SUM(entrada)) - AVG(objetivo)) / AVG(objetivo) * 100
                    ROUND(
                        (
                            ((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) - AVG(NULLIF(objetivo, 0))) 
                            / AVG(NULLIF(objetivo, 0))
                        ) * 100
                    , 2) AS variacion_pct
                FROM dmmermas
                WHERE {$whereStr}
                GROUP BY fechaproceso, zonaorigen, cliente, placa, dato
                ORDER BY fechaproceso ASC, zonaorigen ASC, cliente ASC, placa ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Consulta el porcentaje de merma agregado por día o por mes
     */
    public function getPorcMermaLinea(array $filtros, string $granularidad, bool $forzarPeso = false): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');
        $dato        = trim($filtros['dato'] ?? 'TODO');

        $params = [
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin
        ];

        $where = [
            "fechaproceso BETWEEN :f_ini AND :f_fin",
            "fechaproceso IS NOT NULL"
        ];

        if ($forzarPeso) {
            $where[] = "TRIM(dato) = 'Peso'";
        } elseif (!empty($dato) && strtoupper($dato) !== 'TODO') {
            $where[] = "TRIM(dato) = :dato";
            $params[':dato'] = $dato;
        }

        $formato = $granularidad === 'mes' ? '%Y-%m' : '%Y-%m-%d';
        $whereStr = implode(' AND ', $where);

        $sql = "SELECT 
                    DATE_FORMAT(fechaproceso, '{$formato}') AS periodo,
                    ROUND(COALESCE((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS valor
                FROM dmmermas
                WHERE {$whereStr}
                GROUP BY DATE_FORMAT(fechaproceso, '{$formato}')
                ORDER BY periodo ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Consulta el porcentaje de merma diario agrupado por cliente
     */
    public function getPorcMermaDiariaCliente(array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');

        $sql = "SELECT 
                    DATE_FORMAT(fechaproceso, '%Y-%m-%d') AS periodo,
                    TRIM(cliente) AS cliente,
                    ROUND(COALESCE((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS valor
                FROM dmmermas
                WHERE fechaproceso BETWEEN :f_ini AND :f_fin
                  AND fechaproceso IS NOT NULL
                  AND TRIM(dato) = 'Peso'
                  AND cliente IS NOT NULL
                  AND TRIM(cliente) <> ''
                GROUP BY DATE_FORMAT(fechaproceso, '%Y-%m-%d'), TRIM(cliente)
                ORDER BY cliente ASC, periodo ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute([
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Consulta el porcentaje de merma diario agrupado por cliente y placa
     */
    public function getPorcMermaDiariaClientePlaca(array $filtros): array
    {
        $fechaInicio = $filtros['fecha_inicio'] ?? date('Y-m-d');
        $fechaFin    = $filtros['fecha_fin'] ?? date('Y-m-d');
        $cliente     = trim($filtros['cliente'] ?? 'TODO');
        $placa       = trim($filtros['placa'] ?? 'TODO');

        $params = [
            ':f_ini' => $fechaInicio,
            ':f_fin' => $fechaFin
        ];

        $where = [
            "fechaproceso BETWEEN :f_ini AND :f_fin",
            "fechaproceso IS NOT NULL",
            "TRIM(dato) = 'Peso'",
            "cliente IS NOT NULL AND TRIM(cliente) <> ''",
            "placa IS NOT NULL AND TRIM(placa) <> ''"
        ];

        if (!empty($cliente) && strtoupper($cliente) !== 'TODO') {
            $where[] = "TRIM(cliente) = :cliente";
            $params[':cliente'] = $cliente;
        }

        if (!empty($placa) && strtoupper($placa) !== 'TODO') {
            $where[] = "TRIM(placa) = :placa";
            $params[':placa'] = $placa;
        }

        $whereStr = implode(' AND ', $where);

        $sql = "SELECT 
                    DATE_FORMAT(fechaproceso, '%Y-%m-%d') AS periodo,
                    TRIM(cliente) AS cliente,
                    TRIM(placa) AS placa,
                    ROUND(COALESCE((SUM(mermatotal) / NULLIF(SUM(entrada), 0)) * 100, 0), 2) AS valor
                FROM dmmermas
                WHERE {$whereStr}
                GROUP BY DATE_FORMAT(fechaproceso, '%Y-%m-%d'), TRIM(cliente), TRIM(placa)
                ORDER BY cliente ASC, placa ASC, periodo ASC";

        $stmt = $this->conn->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene las opciones de cliente y placa para los filtros del módulo
     */
    public function getFiltrosClientesPlacas(): array
    {
        $clientes = [];
        $sqlClientes = "SELECT DISTINCT TRIM(cliente) AS nombre
                        FROM dmmermas
                        WHERE cliente IS NOT NULL AND TRIM(cliente) <> ''
                        ORDER BY nombre ASC";
        foreach ($this->conn->query($sqlClientes)->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $clientes[] = ['value' => $nombre, 'label' => $nombre];
            }
        }

        $placas = [];
        $sqlPlacas = "SELECT DISTINCT TRIM(placa) AS nombre
                      FROM dmmermas
                      WHERE placa IS NOT NULL AND TRIM(placa) <> ''
                      ORDER BY nombre ASC";
        foreach ($this->conn->query($sqlPlacas)->fetchAll(PDO::FETCH_ASSOC) as $fila) {
            $nombre = trim((string)($fila['nombre'] ?? ''));
            if ($nombre !== '') {
                $placas[] = ['value' => $nombre, 'label' => $nombre];
            }
        }

        return [
            'clientes' => $clientes,
            'placas'   => $placas
        ];
    }

    /**
     * Consulta Hoja de Ruta y Agentes Causales para la placa y fecha seleccionadas
     */
    public function getDetallePlacaRutaCausales(array $filtros): array
    {
        $fecha = $filtros['fechaproceso'] ?? date('Y-m-d');
        $placaParam = trim($filtros['placa'] ?? 'TODO');
        $filtrarPlaca = (!empty($placaParam) && strtoupper($placaParam) !== 'TODO');
        $placaLimpia = str_replace('-', '', $placaParam);

        // 1. Hoja de Ruta
        $paramsRuta = [
            ':f1' => $fecha,
            ':f2' => $fecha
        ];
        $whereRuta = ["(fechaproceso = :f1 OR fecha = :f2)"];

        if ($filtrarPlaca) {
            $whereRuta[] = "REPLACE(TRIM(placa), '-', '') = :placa_clean1";
            $paramsRuta[':placa_clean1'] = $placaLimpia;
        }

        $sqlRuta = "SELECT 
                        TRIM(placa) AS placa,
                        ROUND(COALESCE(numeroruta, 0)) AS numeroruta,
                        fecha,
                        hora,
                        TRIM(evento) AS evento,
                        TRIM(localizacion) AS localizacion,
                        TRIM(arearesponsable) AS arearesponsable
                    FROM dmruta
                    WHERE " . implode(' AND ', $whereRuta) . "
                    ORDER BY placa ASC, hora ASC";

        $stmtRuta = $this->conn->prepare($sqlRuta);
        $stmtRuta->execute($paramsRuta);
        $ruta = $stmtRuta->fetchAll(PDO::FETCH_ASSOC);

        // 2. Agentes Causales
        $paramsCausales = [':f_causa' => $fecha];
        $whereCausales = ["fechaproceso = :f_causa"];

        if ($filtrarPlaca) {
            $whereCausales[] = "REPLACE(TRIM(placa), '-', '') = :placa_clean2";
            $paramsCausales[':placa_clean2'] = $placaLimpia;
        }

        $sqlCausales = "SELECT 
                            fechaproceso,
                            TRIM(cliente) AS cliente,
                            TRIM(placa) AS placa,
                            TRIM(area) AS area,
                            TRIM(codigoconta) AS codigoconta,
                            TRIM(causatipo) AS causatipo,
                            fecharegistro,
                            horaregistro,
                            TRIM(descripcion) AS descripcion
                        FROM dmagentescausalesmermas
                        WHERE " . implode(' AND ', $whereCausales) . "
                        ORDER BY cliente ASC, placa ASC, fecharegistro ASC, horaregistro ASC";

        $stmtCausales = $this->conn->prepare($sqlCausales);
        $stmtCausales->execute($paramsCausales);
        $causales = $stmtCausales->fetchAll(PDO::FETCH_ASSOC);

        return [
            'ruta'     => $ruta,
            'causales' => $causales
        ];
    }
}
