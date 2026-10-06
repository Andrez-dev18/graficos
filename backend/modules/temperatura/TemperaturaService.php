<?php
/**
 * Servicio de Temperatura y Datalogger para CoreBI.
 * Compatible al 100% con la API y estructura de Sanidad.
 */

require_once __DIR__ . '/temperatura_lib.php';

class TemperaturaService
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = san_temp_conectar($db);
    }

    public function setConnection($db)
    {
        $this->db = san_temp_conectar($db);
    }

    private function getDb()
    {
        if ($this->db !== null) {
            return $this->db;
        }
        $this->db = san_temp_conectar();
        return $this->db;
    }

    public function getUploadLimits()
    {
        return [
            'success' => true,
            'upload_max_filesize' => ini_get('upload_max_filesize'),
            'post_max_size' => ini_get('post_max_size'),
            'max_file_uploads' => ini_get('max_file_uploads'),
        ];
    }

    public function getGranjas()
    {
        $conn = $this->getDb();
        $data = [];

        $hasPiDim = san_temp_tabla_existe($conn, 'pi_dim_detalles') && san_temp_tabla_existe($conn, 'regcencosgalpones');

        if ($hasPiDim) {
            $sql = "
                SELECT d.codigo,
                       COALESCE(NULLIF(r.nombre, ''), d.codigo) AS nombre,
                       COALESCE(NULLIF(zs.zona, ''), '') AS zona,
                       COALESCE(NULLIF(zs.subzona, ''), '') AS subzona
                FROM (
                    SELECT DISTINCT TRIM(id_granja) AS codigo
                    FROM pi_dim_detalles
                    WHERE TRIM(id_granja) <> ''
                      AND (TRIM(id_granja) LIKE '6%' OR TRIM(id_granja) LIKE '8%')
                      AND TRIM(id_granja) REGEXP '^[0-9]+$'
                      AND TRIM(id_granja) NOT IN ('624', '640', '641')
                ) AS d
                LEFT JOIN (
                    SELECT LEFT(TRIM(tcencos), 3) AS codigo, MAX(TRIM(tnomcen)) AS nombre
                    FROM regcencosgalpones
                    WHERE TRIM(tcencos) <> ''
                      AND (LEFT(TRIM(tcencos), 3) LIKE '6%' OR LEFT(TRIM(tcencos), 3) LIKE '8%')
                      AND LEFT(TRIM(tcencos), 3) REGEXP '^[0-9]+$'
                    GROUP BY LEFT(TRIM(tcencos), 3)
                ) AS r ON r.codigo = d.codigo
                LEFT JOIN (
                    SELECT
                        TRIM(det.id_granja) AS codigo,
                        MAX(CASE WHEN UPPER(TRIM(car.nombre)) = 'ZONA' THEN TRIM(det.dato) END) AS zona,
                        MAX(CASE WHEN UPPER(TRIM(car.nombre)) = 'SUBZONA' THEN TRIM(det.dato) END) AS subzona
                    FROM pi_dim_detalles det
                    INNER JOIN pi_dim_caracteristicas car ON car.id = det.id_caracteristica
                    WHERE TRIM(det.id_granja) <> ''
                      AND (TRIM(det.id_granja) LIKE '6%' OR TRIM(det.id_granja) LIKE '8%')
                      AND TRIM(det.id_granja) REGEXP '^[0-9]+$'
                      AND UPPER(TRIM(car.nombre)) IN ('ZONA', 'SUBZONA')
                    GROUP BY TRIM(det.id_granja)
                ) AS zs ON zs.codigo = d.codigo
                ORDER BY d.codigo
            ";
            try {
                $stmt = $conn->query($sql);
                $codigosVistos = [];
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $codigo = trim((string)($row['codigo'] ?? ''));
                    if ($codigo === '') continue;
                    $codigosVistos[$codigo] = true;
                    $data[] = [
                        'codigo' => $codigo,
                        'nombre' => trim((string)($row['nombre'] ?? $codigo)),
                        'zona' => trim((string)($row['zona'] ?? '')),
                        'subzona' => trim((string)($row['subzona'] ?? ''))
                    ];
                }

                $sql8 = "
                    SELECT LEFT(TRIM(tcencos), 3) AS codigo, COALESCE(NULLIF(MAX(TRIM(tnomcen)), ''), LEFT(TRIM(tcencos), 3)) AS nombre
                    FROM regcencosgalpones
                    WHERE TRIM(tcencos) <> ''
                      AND LEFT(TRIM(tcencos), 3) LIKE '8%'
                      AND LEFT(TRIM(tcencos), 3) REGEXP '^[0-9]+$'
                    GROUP BY LEFT(TRIM(tcencos), 3)
                    ORDER BY codigo
                ";
                $stmt8 = $conn->query($sql8);
                while ($row8 = $stmt8->fetch(PDO::FETCH_ASSOC)) {
                    $codigo = str_pad(trim((string)($row8['codigo'] ?? '')), 3, '0', STR_PAD_LEFT);
                    if ($codigo === '' || isset($codigosVistos[$codigo])) continue;
                    $codigosVistos[$codigo] = true;
                    $nombre = trim((string)($row8['nombre'] ?? $codigo));
                    if ($codigo === '800' && $nombre === '800') $nombre = 'JEM';
                    $data[] = [
                        'codigo' => $codigo,
                        'nombre' => $nombre,
                        'zona' => '',
                        'subzona' => ''
                    ];
                }
            } catch (Exception $e) {}
        }

        if (empty($data)) {
            $sql = "SELECT DISTINCT `codGranja` AS codigo, MAX(`nomGranja`) AS nombre, MAX(`zona`) AS zona, MAX(`subZona`) AS subzona FROM `san_temp_hum_cab` WHERE TRIM(IFNULL(`codGranja`,'')) <> '' GROUP BY `codGranja` ORDER BY `codGranja`";
            try {
                $stmt = $conn->query($sql);
                while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $c = trim((string)$r['codigo']);
                    $n = trim((string)($r['nombre'] ?? 'Granja ' . $c));
                    $data[] = ['codigo' => $c, 'nombre' => $n, 'zona' => trim((string)($r['zona'] ?? '')), 'subzona' => trim((string)($r['subzona'] ?? ''))];
                }
            } catch (Exception $e) {}
        }

        usort($data, function ($a, $b) { return strcmp($a['codigo'], $b['codigo']); });
        return ['success' => true, 'data' => $data];
    }

    public function listGroups($params = [])
    {
        $conn = $this->getDb();

        $filterGranja = trim((string)($params['granja'] ?? $params['codGranja'] ?? ''));
        $filterCampania = trim((string)($params['campania'] ?? ''));
        $filterFechaInicio = trim((string)($params['fechaInicio'] ?? $params['fechaDesde'] ?? ''));
        $filterFechaFin = trim((string)($params['fechaFin'] ?? $params['fechaHasta'] ?? ''));

        $where = ["1=1"];
        $bind = [];

        $tipoParam = isset($params['tipo']) ? strtoupper(trim((string)$params['tipo'])) : '';
        if ($tipoParam !== '' && $tipoParam !== 'TODOS' && $tipoParam !== 'ENTRE_MESES' && $tipoParam !== 'POR_MES' && $tipoParam !== 'ENTRE_FECHAS' && $tipoParam !== 'POR_FECHA') {
            $where[] = "UPPER(TRIM(IFNULL(c.`tipo`,''))) = ?";
            $bind[] = $tipoParam;
        } else {
            $where[] = "UPPER(TRIM(IFNULL(c.`tipo`,''))) = 'TEMPERATURA'";
        }

        if ($filterGranja !== '') {
            $where[] = "TRIM(IFNULL(c.`codGranja`,'')) = ?";
            $bind[] = $filterGranja;
        }
        if ($filterCampania !== '') {
            $where[] = "TRIM(IFNULL(d.`campania`,'')) = ?";
            $bind[] = $filterCampania;
        }
        if ($filterFechaInicio !== '') {
            $where[] = "d.`fecha_hora` >= ?";
            $bind[] = $filterFechaInicio . ' 00:00:00';
        }
        if ($filterFechaFin !== '') {
            $where[] = "d.`fecha_hora` <= ?";
            $bind[] = $filterFechaFin . ' 23:59:59';
        }

        $whereSql = implode(" AND ", $where);

        $sql = "SELECT c.`id`,
                       MAX(c.`usuarioRegistro`) AS `usuarioRegistro`,
                       MAX(TRIM(c.`codGranja`)) AS `codGranja`,
                       MAX(TRIM(c.`codGranja`)) AS `id_granja`,
                       MAX(TRIM(c.`nomGranja`)) AS `nomGranja`,
                       MAX(TRIM(c.`nomGranja`)) AS `nom_granja`,
                       MAX(TRIM(c.`zona`)) AS `zona`,
                       MAX(TRIM(c.`subZona`)) AS `subZona`,
                       MAX(TRIM(c.`subZona`)) AS `subzona_resumen`,
                       MAX(d.`codGalpon`) AS `codGalpon`,
                       MAX(CASE WHEN TRIM(IFNULL(d.`campania`,'')) <> '' THEN TRIM(d.`campania`) END) AS `campania`,
                       GROUP_CONCAT(DISTINCT TRIM(d.`codGalpon`) ORDER BY TRIM(d.`codGalpon`) SEPARATOR ', ') AS `galpones_lista`,
                       MAX(c.`fechaDesde`) AS `fechaDesdeOut`,
                       MAX(c.`fechaHasta`) AS `fechaHastaOut`,
                       MAX(c.`fechaDesde`) AS `fecha_inicio`,
                       MAX(c.`fechaHasta`) AS `fecha_fin`,
                       MAX(c.`fechaHoraRegistro`) AS `fechaHoraRegistro`,
                       MAX(c.`tipo`) AS `tipo`,
                       MAX(c.`tipo`) AS `cab_tipo`,
                       COUNT(d.`id`) AS `totalLecturas`,
                       COUNT(d.`id`) AS `total_lecturas`,
                       MIN(d.`fecha_hora`) AS `primeraLectura`,
                       MAX(d.`fecha_hora`) AS `ultimaLectura`,
                       MIN(d.`fecha_hora`) AS `min_fecha`,
                       MAX(d.`fecha_hora`) AS `max_fecha`,
                       ROUND(AVG(CASE WHEN UPPER(TRIM(IFNULL(c.`tipo`,''))) = 'TEMPERATURA' OR UPPER(TRIM(IFNULL(c.`tipo`,''))) = 'AMBOS' THEN d.`valor` END), 2) AS `promedio_temperatura`,
                       ROUND(AVG(CASE WHEN UPPER(TRIM(IFNULL(c.`tipo`,''))) = 'HUMEDAD' THEN d.`valor` END), 2) AS `promedio_humedad`
                FROM `san_temp_hum_cab` c
                LEFT JOIN `san_temp_hum_det` d ON d.`idCab` = c.`id`
                WHERE {$whereSql}
                GROUP BY c.`id`
                ORDER BY MAX(c.`fechaHoraRegistro`) DESC
                LIMIT 500";

        try {
            $stmt = $conn->prepare($sql);
            $stmt->execute($bind);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return [
                'success' => true,
                'data' => $rows,
                'hasContextColumns' => true,
                'hasCabZona' => true,
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage(), 'data' => []];
        }
    }

    public function getConsultaMeta($params = [])
    {
        $conn = $this->getDb();
        $granjas = [];
        $campaniasPorGranja = [];
        $galponesPorGranja = [];

        try {
            $sqlG = "SELECT DISTINCT c.`codGranja` FROM `san_temp_hum_cab` c WHERE TRIM(IFNULL(c.`codGranja`,'')) <> '' ORDER BY c.`codGranja`";
            $stmtG = $conn->query($sqlG);
            while ($r = $stmtG->fetch(PDO::FETCH_ASSOC)) {
                $g = trim((string)$r['codGranja']);
                $granjas[] = $g;
                $campaniasPorGranja[$g] = [];
                $galponesPorGranja[$g] = [];
            }

            $sqlC = "SELECT DISTINCT c.`codGranja`, d.`campania` FROM `san_temp_hum_cab` c INNER JOIN `san_temp_hum_det` d ON d.`idCab` = c.`id` WHERE TRIM(IFNULL(d.`campania`,'')) <> '' ORDER BY d.`campania`";
            $stmtC = $conn->query($sqlC);
            while ($r = $stmtC->fetch(PDO::FETCH_ASSOC)) {
                $g = trim((string)$r['codGranja']);
                $c = trim((string)$r['campania']);
                if (isset($campaniasPorGranja[$g]) && !in_array($c, $campaniasPorGranja[$g], true)) {
                    $campaniasPorGranja[$g][] = $c;
                }
            }

            $sqlGlp = "SELECT DISTINCT c.`codGranja`, d.`codGalpon` FROM `san_temp_hum_cab` c INNER JOIN `san_temp_hum_det` d ON d.`idCab` = c.`id` WHERE TRIM(IFNULL(d.`codGalpon`,'')) <> '' AND d.`codGalpon` <> '0' ORDER BY d.`codGalpon`";
            $stmtGlp = $conn->query($sqlGlp);
            while ($r = $stmtGlp->fetch(PDO::FETCH_ASSOC)) {
                $g = trim((string)$r['codGranja']);
                $gl = trim((string)$r['codGalpon']);
                if (isset($galponesPorGranja[$g]) && !in_array($gl, $galponesPorGranja[$g], true)) {
                    $galponesPorGranja[$g][] = $gl;
                }
            }
        } catch (Exception $e) {}

        return [
            'success' => true,
            'hasContextColumns' => true,
            'hasDetCampania' => true,
            'granjas' => $granjas,
            'campaniasPorGranja' => $campaniasPorGranja,
            'galponesPorGranja' => $galponesPorGranja,
        ];
    }

    public function getConsultaCampaniasPeriodo($params = [])
    {
        $conn = $this->getDb();
        $cg = trim((string)($params['codGranja'] ?? ''));
        $fd = trim((string)($params['fechaDesde'] ?? ''));
        $fh = trim((string)($params['fechaHasta'] ?? ''));

        if ($cg === '' || $fd === '' || $fh === '') {
            return ['success' => false, 'message' => 'Complete granja y rango de fechas.', 'campanias' => []];
        }

        $sql = "SELECT DISTINCT d.`campania`
                FROM `san_temp_hum_cab` c
                INNER JOIN `san_temp_hum_det` d ON d.`idCab` = c.`id`
                WHERE c.`codGranja` = ? AND TRIM(IFNULL(d.`campania`,'')) <> ''
                  AND (
                    (c.`fechaDesde` BETWEEN ? AND ?) OR (c.`fechaHasta` BETWEEN ? AND ?)
                    OR (? BETWEEN c.`fechaDesde` AND c.`fechaHasta`)
                  )
                ORDER BY d.`campania` ASC";
        try {
            $stmt = $conn->prepare($sql);
            $stmt->execute([$cg, $fd, $fh, $fd]);
            $campanias = $stmt->fetchAll(PDO::FETCH_COLUMN);
            return ['success' => true, 'campanias' => array_values($campanias)];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage(), 'campanias' => []];
        }
    }

    public function getConsultaDatos($params = [])
    {
        $conn = $this->getDb();
        $idCabPost = isset($params['idCab']) ? (int)$params['idCab'] : 0;
        $cg = trim((string)($params['codGranja'] ?? ''));
        $gp = trim((string)($params['codGalpon'] ?? ''));
        $campF = strval($params['campania'] ?? '');
        $fd = trim((string)($params['fechaDesde'] ?? ''));
        $fh = trim((string)($params['fechaHasta'] ?? ''));

        $where = [];
        $bind = [];

        if ($idCabPost > 0) {
            $idsCab = san_temp_ids_cab_grupo_consulta($conn, $idCabPost);
            if (!empty($idsCab)) {
                $inP = implode(',', array_fill(0, count($idsCab), '?'));
                $where[] = "c.`id` IN ({$inP})";
                foreach ($idsCab as $idItem) {
                    $bind[] = $idItem;
                }
            } else {
                $where[] = "c.`id` = ?";
                $bind[] = $idCabPost;
            }
        } else {
            if ($cg !== '') {
                $where[] = "c.`codGranja` = ?";
                $bind[] = $cg;
            }
            if ($campF !== '') {
                $where[] = "d.`campania` = ?";
                $bind[] = $campF;
            }
            if ($fd !== '' && $fh !== '') {
                $where[] = "((c.`fechaDesde` BETWEEN ? AND ?) OR (c.`fechaHasta` BETWEEN ? AND ?) OR (? BETWEEN c.`fechaDesde` AND c.`fechaHasta`))";
                $bind[] = $fd; $bind[] = $fh; $bind[] = $fd; $bind[] = $fh; $bind[] = $fd;
            }
        }

        if ($gp !== '') {
            $where[] = "d.`codGalpon` = ?";
            $bind[] = $gp;
        }

        $whereSql = !empty($where) ? ("WHERE " . implode(" AND ", $where)) : "";

        $sql = "SELECT d.`id`, d.`idCab`, d.`fecha_hora`, d.`valor`, d.`codGalpon`, d.`sexo`, d.`corral`, d.`campania`,
                       c.`codGranja`, c.`nomGranja`, c.`zona`, c.`subZona`, c.`tipo`
                FROM `san_temp_hum_det` d
                INNER JOIN `san_temp_hum_cab` c ON c.`id` = d.`idCab`
                {$whereSql}
                ORDER BY d.`fecha_hora` ASC
                LIMIT 50000";

        try {
            $stmt = $conn->prepare($sql);
            $stmt->execute($bind);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Estructurar datasets por corral y serie idéntico a Sanidad
            $porSexoCorralTemp = [
                'MACHO' => ['1' => [], '2' => []],
                'HEMBRA' => ['1' => [], '2' => []],
                'EXTERNO' => ['1' => []],
                'OTROS' => ['1' => []],
                'OTRO' => ['1' => []],
                'macho' => ['c1' => [], 'c2' => [], '1' => [], '2' => []],
                'hembra' => ['c1' => [], 'c2' => [], '1' => [], '2' => []],
                'externo' => ['c1' => [], '1' => []],
                'otros' => ['c1' => [], '1' => []],
                'otro' => ['c1' => [], '1' => []],
            ];
            $porSexoCorralHum = $porSexoCorralTemp;
            $norm = [];
            $meta = [
                'codGranja' => $cg,
                'nomGranja' => '',
                'campania' => $campF,
                'codGalpon' => $gp,
                'zona' => '',
                'subZona' => '',
                'fechaDesde' => $fd,
                'fechaHasta' => $fh,
            ];

            foreach ($rows as $r) {
                $fh = $r['fecha_hora'];
                $v = ($r['valor'] !== null && $r['valor'] !== '') ? (float)$r['valor'] : null;
                $tTipo = strtoupper(trim((string)($r['tipo'] ?? 'TEMPERATURA')));
                $isHum = ($tTipo === 'HUMEDAD');
                $sxRaw = strtoupper(trim((string)($r['sexo'] ?? '')));
                $crRaw = trim((string)($r['corral'] ?? ''));
                $crInt = (int)$crRaw;

                $meta['codGranja'] = $r['codGranja'] ?: $meta['codGranja'];
                $meta['nomGranja'] = $r['nomGranja'] ?: $meta['nomGranja'];
                $meta['campania']  = $r['campania'] ?: $meta['campania'];
                $meta['codGalpon'] = $r['codGalpon'] ?: $meta['codGalpon'];
                $meta['zona']      = $r['zona'] ?: $meta['zona'];
                $meta['subZona']   = $r['subZona'] ?: $meta['subZona'];

                $normRow = [
                    'id' => $r['id'],
                    'idCab' => $r['idCab'],
                    'fecha_hora' => $fh,
                    'valor' => $v,
                    'campania' => $r['campania'],
                    'codGalpon' => $r['codGalpon'],
                    'sexo' => $r['sexo'],
                    'corral' => $r['corral'],
                    'tipo' => $r['tipo'],
                    'codGranja' => $r['codGranja'],
                    'nomGranja' => $r['nomGranja']
                ];
                $norm[] = $normRow;

                if ($v !== null) {
                    $sxOk = ($sxRaw === 'MACHO' || $sxRaw === 'HEMBRA') && $crInt >= 1 && $crInt <= 2;
                    $sxExt = ($sxRaw === 'EXTERNO');

                    if ($sxOk || $sxExt) {
                        $sxKey = $sxExt ? 'EXTERNO' : $sxRaw;
                        $crKey = $sxExt ? '1' : (string)$crInt;
                    } else {
                        $sxKey = 'OTROS';
                        $crKey = '1';
                    }

                    if ($isHum) {
                        $porSexoCorralHum[$sxKey][$crKey][] = $normRow;
                        $porSexoCorralHum[strtolower($sxKey)][$crKey][] = $normRow;
                        $porSexoCorralHum[strtolower($sxKey)]['c' . $crKey][] = $normRow;
                    } else {
                        $porSexoCorralTemp[$sxKey][$crKey][] = $normRow;
                        $porSexoCorralTemp[strtolower($sxKey)][$crKey][] = $normRow;
                        $porSexoCorralTemp[strtolower($sxKey)]['c' . $crKey][] = $normRow;
                    }
                }
            }

            return [
                'success' => true,
                'data' => $norm,
                'porCorral' => [],
                'porSexoCorral' => $porSexoCorralTemp,
                'porSexoCorralTemp' => $porSexoCorralTemp,
                'porSexoCorralHum' => $porSexoCorralHum,
                'meta' => $meta,
                'truncated' => false,
                'hasCampaniaDet' => true,
                'hasCabZonaSubZona' => true,
                'hasSexoCorralCab' => true,
            ];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function listGroupDetail($params = [])
    {
        $conn = $this->getDb();
        $idCab = isset($params['idCab']) ? (int)$params['idCab'] : 0;
        if ($idCab <= 0) {
            return ['success' => false, 'message' => 'idCab no válido'];
        }

        $sql = "SELECT d.* FROM `san_temp_hum_det` d WHERE d.`idCab` = ? ORDER BY d.`fecha_hora` ASC LIMIT 5000";
        try {
            $stmt = $conn->prepare($sql);
            $stmt->execute([$idCab]);
            $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
            return ['success' => true, 'data' => $rows];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function actualizarGalpon($params = [])
    {
        $conn = $this->getDb();
        $idCab = isset($params['idCab']) ? (int)$params['idCab'] : 0;
        $nuevo = trim((string)($params['codGalpon'] ?? ''));
        if ($idCab <= 0) {
            return ['success' => false, 'message' => 'idCab no válido'];
        }

        $sql = "UPDATE `san_temp_hum_det` SET `codGalpon` = ? WHERE `idCab` = ?";
        try {
            $stmt = $conn->prepare($sql);
            $stmt->execute([$nuevo, $idCab]);
            return ['success' => true, 'message' => 'Galpón actualizado correctamente.'];
        } catch (Exception $e) {
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }

    public function deleteGroup($params = [])
    {
        $conn = $this->getDb();
        $idCab = isset($params['idCab']) ? (int)$params['idCab'] : 0;
        if ($idCab <= 0) {
            return ['success' => false, 'message' => 'idCab no válido'];
        }

        try {
            $conn->beginTransaction();
            $stmtDet = $conn->prepare("DELETE FROM `san_temp_hum_det` WHERE `idCab` = ?");
            $stmtDet->execute([$idCab]);

            $stmtCab = $conn->prepare("DELETE FROM `san_temp_hum_cab` WHERE `id` = ?");
            $stmtCab->execute([$idCab]);

            $conn->commit();
            return ['success' => true, 'message' => 'Registro eliminado correctamente.'];
        } catch (Exception $e) {
            if ($conn->inTransaction()) $conn->rollBack();
            return ['success' => false, 'message' => $e->getMessage()];
        }
    }
}