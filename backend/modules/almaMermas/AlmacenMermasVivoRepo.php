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
