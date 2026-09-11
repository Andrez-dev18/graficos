<?php

class CostosDias2Repo
{
    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Obtiene la matriz horizontal de costos por Granja, Mes y Galpón
     */
    public function getMatrizGalpones(array $filtros): array
    {
        $params = [];
        $where = ["1=1"];

        // 1. Filtro de Período Normal (tanio + tmes)
        if (!empty($filtros['periodo_ini']) && !empty($filtros['periodo_fin'])) {
            $where[] = "CONCAT(tanio, LPAD(tmes, 2, '0')) BETWEEN :periodo_ini AND :periodo_fin";
            $params[':periodo_ini'] = $filtros['periodo_ini'];
            $params[':periodo_fin'] = $filtros['periodo_fin'];
        } elseif (!empty($filtros['periodo_ini'])) {
            $where[] = "CONCAT(tanio, LPAD(tmes, 2, '0')) >= :periodo_ini";
            $params[':periodo_ini'] = $filtros['periodo_ini'];
        }

        // 2. Filtro por Fecha de Liquidación (tfec_liquidacion)
        if (!empty($filtros['fecha_liq_ini']) && !empty($filtros['fecha_liq_fin'])) {
            $where[] = "tfec_liquidacion BETWEEN :fecha_liq_ini AND :fecha_liq_fin";
            $params[':fecha_liq_ini'] = $filtros['fecha_liq_ini'];
            $params[':fecha_liq_fin'] = $filtros['fecha_liq_fin'];
        } elseif (!empty($filtros['fecha_liq_ini'])) {
            $where[] = "tfec_liquidacion >= :fecha_liq_ini";
            $params[':fecha_liq_ini'] = $filtros['fecha_liq_ini'];
        } elseif (!empty($filtros['fecha_liq_fin'])) {
            $where[] = "tfec_liquidacion <= :fecha_liq_fin";
            $params[':fecha_liq_fin'] = $filtros['fecha_liq_fin'];
        }

        // 3. Filtro por Granjas / Centros de Costo (tcencos o tnomcen)
        if (!empty($filtros['granjas'])) {
            $granjas = is_array($filtros['granjas']) ? $filtros['granjas'] : [$filtros['granjas']];
            $granjas = array_values(array_filter($granjas));
            if (!empty($granjas)) {
                $placeholders = [];
                foreach ($granjas as $i => $g) {
                    $ph = ":grj_" . $i;
                    $placeholders[] = $ph;
                    $params[$ph] = $g;
                }
                $where[] = "(tcencos IN (" . implode(',', $placeholders) . ") OR tnomcen IN (" . implode(',', $placeholders) . "))";
            }
        }

        // 4. Filtro por Campañas (tcampana)
        if (!empty($filtros['campanas'])) {
            $campanas = is_array($filtros['campanas']) ? $filtros['campanas'] : [$filtros['campanas']];
            $campanas = array_values(array_filter($campanas));
            if (!empty($campanas)) {
                $placeholders = [];
                foreach ($campanas as $i => $c) {
                    $ph = ":cmp_" . $i;
                    $placeholders[] = $ph;
                    $params[$ph] = $c;
                }
                $where[] = "tcampana IN (" . implode(',', $placeholders) . ")";
            }
        }

        // 5. Filtro por Galpones (tcodint)
        if (!empty($filtros['galpones'])) {
            $galpones = is_array($filtros['galpones']) ? $filtros['galpones'] : [$filtros['galpones']];
            $galpones = array_values(array_filter($galpones));
            if (!empty($galpones)) {
                $placeholders = [];
                foreach ($galpones as $i => $gp) {
                    $ph = ":glp_" . $i;
                    $placeholders[] = $ph;
                    $params[$ph] = $gp;
                }
                $where[] = "tcodint IN (" . implode(',', $placeholders) . ")";
            }
        }

        // 6. Filtro por tuser si aplica
        if (!empty($filtros['tuser'])) {
            $where[] = "tuser = :tuser";
            $params[':tuser'] = $filtros['tuser'];
        }

        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT 
                tnomcen,
                tcencos,
                tanio,
                tuser,
                tmes,
                tnomMes,
                tcodint AS galpon,
                SUM(timporte) AS valor,
                SUM(tpes_ventaglp) AS peso_glp,
                (SUM(timporte) / NULLIF(SUM(tpes_ventaglp), 0)) AS cu_glp
            FROM dmcostofamilia
            WHERE {$whereSql}
            GROUP BY tnomcen, tcencos, tanio, tuser, tmes, tnomMes, tcodint
            ORDER BY tnomcen ASC, CAST(tcencos AS UNSIGNED) ASC, tanio ASC, CAST(tmes AS UNSIGNED) ASC, CAST(tcodint AS UNSIGNED) ASC
        ";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Obtiene los catálogos y rangos disponibles para los filtros de la interfaz
     */
    public function getFiltrosDisponibles(array $filtros = []): array
    {
        // 1. Catálogo de Granjas (Centros de Costo)
        $sqlGranjas = "
            SELECT DISTINCT 
                tcencos, 
                tnomcen, 
                tgranja
            FROM dmcostofamilia 
            WHERE tnomcen IS NOT NULL AND tnomcen != ''
            ORDER BY tnomcen ASC, tcencos ASC
        ";
        $stmtGranjas = $this->db->query($sqlGranjas);
        $granjas = $stmtGranjas->fetchAll(PDO::FETCH_ASSOC);

        // 2. Catálogo de Campañas y Granja Campaña
        $sqlCampanas = "
            SELECT DISTINCT 
                tcampana,
                tnomcen,
                tcencos,
                CONCAT(tnomcen, ' C', tcampana) AS granja_campana
            FROM dmcostofamilia 
            WHERE tcampana IS NOT NULL AND tcampana != ''
            ORDER BY tnomcen ASC, CAST(tcampana AS UNSIGNED) DESC
        ";
        $stmtCampanas = $this->db->query($sqlCampanas);
        $campanas = $stmtCampanas->fetchAll(PDO::FETCH_ASSOC);

        // 3. Catálogo de Galpones
        $sqlGalpones = "
            SELECT DISTINCT 
                tcodint AS galpon
            FROM dmcostofamilia 
            WHERE tcodint IS NOT NULL AND tcodint != ''
            ORDER BY CAST(tcodint AS UNSIGNED) ASC
        ";
        $stmtGalpones = $this->db->query($sqlGalpones);
        $galpones = array_column($stmtGalpones->fetchAll(PDO::FETCH_ASSOC), 'galpon');

        // 4. Rangos de Fecha de Liquidación
        $sqlRangoLiq = "
            SELECT 
                MIN(tfec_liquidacion) AS min_fecha_liq, 
                MAX(tfec_liquidacion) AS max_fecha_liq 
            FROM dmcostofamilia 
            WHERE tfec_liquidacion > '1900-01-01'
        ";
        $rangoLiq = $this->db->query($sqlRangoLiq)->fetch(PDO::FETCH_ASSOC);

        // 5. Rangos de Período Normal
        $sqlRangoPeriodo = "
            SELECT 
                MIN(CONCAT(tanio, '-', LPAD(tmes, 2, '0'), '-01')) AS min_periodo,
                MAX(LAST_DAY(CONCAT(tanio, '-', LPAD(tmes, 2, '0'), '-01'))) AS max_periodo
            FROM dmcostofamilia
            WHERE tanio != '' AND tmes != ''
        ";
        $rangoPeriodo = $this->db->query($sqlRangoPeriodo)->fetch(PDO::FETCH_ASSOC);

        return [
            'granjas'          => $granjas,
            'campanas'         => $campanas,
            'galpones'         => $galpones,
            'rangoLiquidacion' => $rangoLiq,
            'rangoPeriodo'     => $rangoPeriodo
        ];
    }
}
