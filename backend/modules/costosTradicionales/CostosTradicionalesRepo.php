<?php

class CostosTradicionalesRepo
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Obtiene los registros generales de la tabla costomen (CP01 y CP02)
     */
    public function getCostosPorPeriodo(string $fechaInicio, string $fechaFin): array
    {
        $sql = "
            SELECT 
                fecha,
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                costoavi,
                pollo_ini,
                saca_und,
                saca_kilos,
                pesoprom,
                ica,
                edadventa,
                mortalidad,
                ganancia,
                calimento,
                costoalim,
                (costoavi / NULLIF(saca_kilos, 0)) AS costo_unitario,
                (costoavi / NULLIF(saca_kilos, 0)) AS costo_produccion_kg,
                (costoalim / NULLIF(saca_kilos, 0)) AS costo_alimentacion_kg,
                ((mortalidad / NULLIF(pollo_ini, 0)) * 100) AS mortalidad_porc
            FROM costomen
            WHERE fecha >= :fecha_ini 
              AND fecha <= LAST_DAY(:fecha_fin)
            ORDER BY fecha ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene los costos agrupados por Zona y Mes desde costomenzona (CP03)
     */
    public function getCostosPorZona(string $fechaInicio, string $fechaFin, ?string $zona = null): array
    {
        $params = [
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $whereZona = "";
        if (!empty($zona) && strtoupper($zona) !== 'TODOS' && strtoupper($zona) !== '(TODO)') {
            $whereZona = " AND zona = :zona ";
            $params[':zona'] = $zona;
        }

        $sql = "
            SELECT 
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                zona,
                SUM(valoavi) AS sum_valoavi,
                SUM(pesoavi) AS sum_pesoavi,
                (SUM(valoavi) / NULLIF(SUM(pesoavi), 0)) AS costo_promedio_zona
            FROM costomenzona
            WHERE fecha >= :fecha_ini 
              AND fecha <= LAST_DAY(:fecha_fin)
              {$whereZona}
            GROUP BY mes_key, anio, mes_num, zona
            ORDER BY mes_key ASC, zona ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene los datos consolidados por Mes para la gráfica de CP04 (Costo por Kg vs Costo Alim)
     */
    public function getCostosCP04Grafica(string $fechaInicio, string $fechaFin, ?string $zona = null): array
    {
        $params = [
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $whereZona = "";
        if (!empty($zona) && strtoupper($zona) !== 'TODOS' && strtoupper($zona) !== '(TODO)') {
            $whereZona = " AND zona = :zona ";
            $params[':zona'] = $zona;
        }

        $sql = "
            SELECT 
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                SUM(valimento) AS sum_valimento,
                SUM(saca_kilos) AS sum_saca_kilos,
                SUM(valoavi) AS sum_valoavi,
                SUM(pesoavi) AS sum_pesoavi,
                (SUM(valimento) / NULLIF(SUM(saca_kilos), 0)) AS costo_alimentacion,
                (SUM(valoavi) / NULLIF(SUM(pesoavi), 0)) AS costo_produccion
            FROM costomenzona
            WHERE fecha >= :fecha_ini 
              AND fecha <= LAST_DAY(:fecha_fin)
              {$whereZona}
            GROUP BY mes_key, anio, mes_num
            ORDER BY mes_key ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene el detalle por Centro de Costo (cencos) y Mes para la tabla de CP04
     */
    public function getCostosCP04Detalle(string $fechaInicio, string $fechaFin, ?string $zona = null): array
    {
        $params = [
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $whereZona = "";
        if (!empty($zona) && strtoupper($zona) !== 'TODOS' && strtoupper($zona) !== '(TODO)') {
            $whereZona = " AND zona = :zona ";
            $params[':zona'] = $zona;
        }

        $sql = "
            SELECT 
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                cencos,
                nomcencos,
                SUM(valimento) AS val_alim,
                SUM(saca_kilos) AS saca_kg,
                (SUM(valimento) / NULLIF(SUM(saca_kilos), 0)) AS costo_alim,
                SUM(valoavi) AS val_avi,
                SUM(pesoavi) AS peso_avi,
                (SUM(valoavi) / NULLIF(SUM(pesoavi), 0)) AS costo_kg
            FROM costomenzona
            WHERE fecha >= :fecha_ini 
              AND fecha <= LAST_DAY(:fecha_fin)
              {$whereZona}
            GROUP BY mes_key, anio, mes_num, cencos, nomcencos
            ORDER BY mes_key ASC, cencos ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene la lista de zonas únicas registradas
     */
    public function getZonasDisponibles(): array
    {
        $sql = "SELECT DISTINCT zona FROM costomenzona WHERE zona IS NOT NULL AND zona != '' ORDER BY zona ASC";
        $stmt = $this->db->query($sql);
        return $stmt->fetchAll(PDO::FETCH_COLUMN);
    }

    /**
     * Obtiene los datos consolidados por Mes para la gráfica de CP05 MortVsPeso (%Mortalidad vs PesoProm)
     */
    public function getCostosCP05MortVsPesoGrafica(string $fechaInicio, string $fechaFin, ?string $zona = null): array
    {
        $params = [
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $whereZona = "";
        if (!empty($zona) && strtoupper($zona) !== 'TODOS' && strtoupper($zona) !== '(TODO)') {
            $whereZona = " AND zona = :zona ";
            $params[':zona'] = $zona;
        }

        $sql = "
            SELECT 
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                SUM(mortalidad) AS sum_mortalidad,
                SUM(pollo_ini) AS sum_pollo_ini,
                SUM(pesoavi) AS sum_pesoavi,
                SUM(cantavi) AS sum_cantavi,
                ((SUM(mortalidad) / NULLIF(SUM(pollo_ini), 0)) * 100) AS mortalidad_porc,
                (SUM(pesoavi) / NULLIF(SUM(cantavi), 0)) AS peso_promedio
            FROM costomenzona
            WHERE fecha >= :fecha_ini 
              AND fecha <= LAST_DAY(:fecha_fin)
              {$whereZona}
            GROUP BY mes_key, anio, mes_num
            ORDER BY mes_key ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene el detalle por Centro de Costo (cencos) y Mes para la tabla de CP05 MortVsPeso
     */
    public function getCostosCP05MortVsPesoDetalle(string $fechaInicio, string $fechaFin, ?string $zona = null): array
    {
        $params = [
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $whereZona = "";
        if (!empty($zona) && strtoupper($zona) !== 'TODOS' && strtoupper($zona) !== '(TODO)') {
            $whereZona = " AND zona = :zona ";
            $params[':zona'] = $zona;
        }

        $sql = "
            SELECT 
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                cencos,
                nomcencos,
                SUM(mortalidad) AS pollos_muertos,
                SUM(pollo_ini) AS pollos_inicial,
                ((SUM(mortalidad) / NULLIF(SUM(pollo_ini), 0)) * 100) AS mortalidad_porc,
                SUM(pesoavi) AS peso_avicola,
                SUM(cantavi) AS cantidad_avicola,
                (SUM(pesoavi) / NULLIF(SUM(cantavi), 0)) AS peso_promedio
            FROM costomenzona
            WHERE fecha >= :fecha_ini 
              AND fecha <= LAST_DAY(:fecha_fin)
              {$whereZona}
            GROUP BY mes_key, anio, mes_num, cencos, nomcencos
            ORDER BY mes_key ASC, cencos ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene el costo de producción de alimento balanceado (PU = valoalim / pesoalim) por Mes (CP07)
     */
    public function getCostosProduccionAlimentoBalanceado(string $fechaInicio, string $fechaFin): array
    {
        $sql = "
            SELECT 
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                SUM(valoalim) AS sum_valoalim,
                SUM(pesoalim) AS sum_pesoalim,
                (SUM(valoalim) / NULLIF(SUM(pesoalim), 0)) AS pu
            FROM costomenali
            WHERE fecha >= :fecha_ini 
              AND fecha <= LAST_DAY(:fecha_fin)
            GROUP BY mes_key, anio, mes_num
            ORDER BY mes_key ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene el detalle de costos de insumos por Item y Mes desde costomenalidet (CP07)
     */
    public function getCostoInsumosDetalle(string $fechaInicio, string $fechaFin, array $items = []): array
    {
        $params = [
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $whereItems = "";
        // Filtrar solo si se pasaron items y no es un comodín de todos
        $filteredItems = array_filter($items, function($item) {
            $val = strtoupper(trim((string)$item));
            return !empty($val) && $val !== 'TODOS' && $val !== '(TODO)' && $val !== 'ALL';
        });

        if (!empty($filteredItems)) {
            $placeholdersCod = [];
            $placeholdersNom = [];
            foreach (array_values($filteredItems) as $idx => $code) {
                $pCod = ":itcod_" . $idx;
                $pNom = ":itnom_" . $idx;
                $placeholdersCod[] = $pCod;
                $placeholdersNom[] = $pNom;
                $params[$pCod] = trim($code);
                $params[$pNom] = trim($code);
            }
            $whereItems = " AND (codigo IN (" . implode(',', $placeholdersCod) . ") OR nomcodigo IN (" . implode(',', $placeholdersNom) . ")) ";
        }

        $sql = "
            SELECT 
                codigo,
                nomcodigo,
                CONCAT(codigo, ' ', nomcodigo) AS item_label,
                DATE_FORMAT(fecha, '%Y-%m') AS mes_key,
                DATE_FORMAT(fecha, '%Y') AS anio,
                DATE_FORMAT(fecha, '%m') AS mes_num,
                SUM(valor) AS sum_valor,
                SUM(peso) AS sum_peso,
                (SUM(valor) / NULLIF(SUM(peso), 0)) AS costo_unitario
            FROM costomenalidet
            WHERE fecha >= :fecha_ini 
              AND fecha <= LAST_DAY(:fecha_fin)
              {$whereItems}
            GROUP BY codigo, nomcodigo, mes_key, anio, mes_num
            ORDER BY codigo ASC, mes_key ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene el catálogo de insumos disponibles en el rango de fechas seleccionado (CP07)
     */
    public function getInsumosDisponibles(string $fechaInicio, string $fechaFin): array
    {
        $sql = "
            SELECT DISTINCT 
                codigo,
                nomcodigo,
                CONCAT(codigo, ' ', nomcodigo) AS item_label
            FROM costomenalidet
            WHERE fecha >= :fecha_ini 
              AND fecha <= LAST_DAY(:fecha_fin)
            ORDER BY codigo ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute([
            ':fecha_ini' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
}
