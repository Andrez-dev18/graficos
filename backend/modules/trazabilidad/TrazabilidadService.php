<?php

require_once __DIR__ . '/trazabilidad_lib.php';

class TrazabilidadService
{
    private $db;

    public function __construct($db = null)
    {
        $this->db = trz_conectar($db);
    }

    public function setConnection($db)
    {
        $this->db = trz_conectar($db);
    }

    private function getDb()
    {
        if ($this->db !== null) {
            return $this->db;
        }
        $this->db = trz_conectar();
        return $this->db;
    }

    /**
     * Catálogo de granjas (6xx y 8xx)
     */
    public function getGranjas()
    {
        $db = $this->getDb();
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

        $data = [];
        $codigosVistos = [];
        try {
            $stmt = $db->query($sql);
            if ($stmt) {
                while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
                    $codigo = trim((string)($row['codigo'] ?? ''));
                    if ($codigo === '') {
                        continue;
                    }
                    $codigosVistos[$codigo] = true;
                    $data[] = [
                        'codigo'  => $codigo,
                        'nombre'  => trim((string)($row['nombre'] ?? $codigo)),
                        'zona'    => trim((string)($row['zona'] ?? '')),
                        'subzona' => trim((string)($row['subzona'] ?? ''))
                    ];
                }
            }
        } catch (Exception $e) {
            // Error handling
        }

        $sql8 = "
            SELECT g.codigo, COALESCE(NULLIF(g.nombre, ''), g.codigo) AS nombre
            FROM (
                SELECT LEFT(TRIM(tcencos), 3) AS codigo, MAX(TRIM(tnomcen)) AS nombre
                FROM regcencosgalpones
                WHERE TRIM(tcencos) <> ''
                  AND LEFT(TRIM(tcencos), 3) LIKE '8%'
                  AND LEFT(TRIM(tcencos), 3) REGEXP '^[0-9]+$'
                GROUP BY LEFT(TRIM(tcencos), 3)
            ) AS g
            ORDER BY g.codigo
        ";
        try {
            $stmt8 = $db->query($sql8);
            if ($stmt8) {
                while ($row = $stmt8->fetch(PDO::FETCH_ASSOC)) {
                    $codigo = str_pad(trim((string)($row['codigo'] ?? '')), 3, '0', STR_PAD_LEFT);
                    if ($codigo === '' || isset($codigosVistos[$codigo])) {
                        continue;
                    }
                    $codigosVistos[$codigo] = true;
                    $nombre = trim((string)($row['nombre'] ?? $codigo));
                    if ($codigo === '800' && $nombre === '800') {
                        $nombre = 'JEM';
                    }
                    $data[] = [
                        'codigo'  => $codigo,
                        'nombre'  => $nombre,
                        'zona'    => '',
                        'subzona' => ''
                    ];
                }
            }
        } catch (Exception $e) {
            // Error handling
        }

        usort($data, static function ($a, $b) {
            return strcmp((string)$a['codigo'], (string)$b['codigo']);
        });

        return ['success' => true, 'data' => $data];
    }

    /**
     * Origen de aves (EXTERNO / TRASPATIO)
     */
    public function getOrigenAves($tipo = '')
    {
        $tipoUpper = strtoupper(trim((string)$tipo));
        $tiposValidos = ['EXTERNO', 'TRASPATIO'];
        if (!in_array($tipoUpper, $tiposValidos, true)) {
            return ['success' => true, 'data' => []];
        }

        $db = $this->getDb();
        $stmt = $db->prepare('SELECT codigo, tipo, zona, nombre FROM san_dim_procedencia WHERE tipo = ? ORDER BY codigo');
        if (!$stmt) {
            return ['success' => false, 'error' => 'Error preparando consulta'];
        }

        $stmt->execute([$tipoUpper]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $data = [];
        foreach ($rows as $row) {
            $data[] = [
                'codigo' => (string)($row['codigo'] ?? ''),
                'tipo'   => (string)($row['tipo'] ?? ''),
                'zona'   => (string)($row['zona'] ?? ''),
                'nombre' => (string)($row['nombre'] ?? ''),
            ];
        }

        return ['success' => true, 'data' => $data];
    }

    /**
     * Tipos de muestra disponibles
     */
    public function getTiposMuestra()
    {
        $db = $this->getDb();
        $sql = "
            SELECT DISTINCT tm.codigo, tm.nombre
            FROM san_dim_tipo_muestra tm
            INNER JOIN san_dim_paquete p             ON tm.codigo  = p.tipoMuestra
            INNER JOIN san_dim_analisis_paquete ap   ON p.codigo   = ap.paquete
            INNER JOIN san_fact_resultado_analisis r ON ap.analisis = r.analisis_codigo
            ORDER BY tm.nombre ASC
        ";

        $stmt = $db->query($sql);
        if (!$stmt) {
            return ['success' => false, 'error' => 'Error en consulta'];
        }

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);
        $items = [];
        foreach ($rows as $row) {
            $items[] = [
                'codigo' => (string)($row['codigo'] ?? ''),
                'nombre' => (string)($row['nombre'] ?? '')
            ];
        }

        return ['success' => true, 'items' => $items];
    }

    /**
     * Lista de análisis para los filtros dinámicos
     */
    public function getAnalisisFiltro(array $params = [])
    {
        $db = $this->getDb();
        $rawInicio = $params['fechaInicio'] ?? '';
        $rawFin    = $params['fechaFin']    ?? '';

        $defaultInicio = date('Y-01-01', strtotime('-1 year'));
        $defaultFin    = date('Y-12-31');

        $fechaInicio = trz_parse_fecha((string)$rawInicio) ?? $defaultInicio;
        $fechaFin    = trz_parse_fecha((string)$rawFin)    ?? $defaultFin;

        $items = trz_lista_analisis_filtro($db, $fechaInicio, $fechaFin, $params);

        return ['success' => true, 'items' => $items];
    }

    /**
     * Detalle mensual por análisis y valor de resultado (Tab 1: Detalle)
     */
    public function getAnalisisDetalle(array $params = [])
    {
        $db = $this->getDb();
        $rawInicio = $params['fechaInicio'] ?? '';
        $rawFin    = $params['fechaFin']    ?? '';

        $defaultInicio = date('Y-01-01', strtotime('-1 year'));
        $defaultFin    = date('Y-12-31');

        $fechaInicio = trz_parse_fecha((string)$rawInicio) ?? $defaultInicio;
        $fechaFin    = trz_parse_fecha((string)$rawFin)    ?? $defaultFin;

        $origenFiltro = trz_filtro_origen($params);
        $tipoFiltro   = trz_filtro_tipo_muestra($params);
        $exclAgua     = trz_filtros_exclusion_agua($db);

        $bindVals = array_merge([$fechaInicio, $fechaFin], $origenFiltro['params'], $tipoFiltro['params']);

        $sql = "
            SELECT
                MIN(analisis_codigo)                                                   AS analisis_codigo,
                analisis_nombre,
                DATE_FORMAT(fecToma, '%Y-%m')                                          AS mes,
                CASE
                    WHEN resultado IS NULL OR TRIM(resultado) = '' THEN '(Sin resultado)'
                    ELSE UPPER(TRIM(resultado))
                END                                                                   AS resultado,
                COUNT(*)                                                               AS cantidad
            FROM san_fact_resultado_analisis
            WHERE fecToma BETWEEN ? AND ?
              AND fecToma IS NOT NULL
              AND analisis_nombre IS NOT NULL
              AND TRIM(analisis_nombre) != ''
              {$exclAgua['cod']}
              {$exclAgua['nom']}
              {$origenFiltro['sql']}
              {$tipoFiltro['sql']}
            GROUP BY analisis_nombre, mes, resultado
            ORDER BY analisis_nombre ASC, mes ASC, resultado ASC
        ";

        $stmt = $db->prepare($sql);
        if (!$stmt) {
            return ['success' => false, 'error' => 'Error preparando consulta'];
        }

        $stmt->execute($bindVals);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $rawRows = [];
        $mesSet  = [];
        $analSet = [];

        foreach ($rows as $row) {
            $cod = (string)($row['analisis_codigo'] ?? '');
            $nom = (string)($row['analisis_nombre'] ?? '');
            $mes = (string)($row['mes'] ?? '');
            $res = (string)($row['resultado'] ?? '(Sin resultado)');
            $cnt = (int)($row['cantidad'] ?? 0);

            $mesSet[$mes] = true;
            if (!isset($analSet[$nom])) {
                $analSet[$nom] = $cod;
            }
            $rawRows[] = ['nom' => $nom, 'mes' => $mes, 'resultado' => $res, 'cantidad' => $cnt];
        }

        $meses = trz_meses($mesSet, $fechaInicio, $fechaFin);

        $idx = [];
        foreach ($rawRows as $r) {
            $idx[$r['nom']][$r['mes']][$r['resultado']] = $r['cantidad'];
        }

        $resultadosPorNom = [];
        foreach ($rawRows as $r) {
            $resultadosPorNom[$r['nom']][$r['resultado']] = true;
        }

        $analisisOut = [];
        foreach ($analSet as $nom => $cod) {
            $resKeys = array_keys($resultadosPorNom[$nom] ?? []);
            sort($resKeys, SORT_STRING | SORT_FLAG_CASE);

            $resultadosArr = [];
            foreach ($resKeys as $resLabel) {
                $data = [];
                foreach ($meses as $mes) {
                    $data[] = (int)($idx[$nom][$mes][$resLabel] ?? 0);
                }
                $resultadosArr[] = ['resultado' => $resLabel, 'data' => $data];
            }
            $analisisOut[] = ['cod' => (string)$cod, 'nom' => $nom, 'resultados' => $resultadosArr];
        }

        usort($analisisOut, static function ($a, $b) {
            return strcasecmp((string)$a['nom'], (string)$b['nom']);
        });

        return [
            'success'   => true,
            'meses'     => $meses,
            'etiquetas' => trz_etiquetas($meses),
            'analisis'  => $analisisOut,
        ];
    }

    /**
     * Top CodRef (Granja/Camp/Galpón) con casos positivos (Tab 2: CodRef)
     */
    public function getAnalisisCodref(array $params = [])
    {
        $db = $this->getDb();
        $rawInicio = $params['fechaInicio'] ?? '';
        $rawFin    = $params['fechaFin']    ?? '';

        $defaultInicio = date('Y-01-01', strtotime('-1 year'));
        $defaultFin    = date('Y-12-31');

        $fechaInicio = trz_parse_fecha((string)$rawInicio) ?? $defaultInicio;
        $fechaFin    = trz_parse_fecha((string)$rawFin)    ?? $defaultFin;

        $origenFiltro = trz_filtro_origen($params);
        $tipoFiltro   = trz_filtro_tipo_muestra($params);
        $exclAgua     = trz_filtros_exclusion_agua($db);

        $bindVals = array_merge([$fechaInicio, $fechaFin], $origenFiltro['params'], $tipoFiltro['params']);

        $sql = "
            SELECT
                MIN(analisis_codigo) AS analisis_codigo,
                analisis_nombre,
                DATE_FORMAT(fecToma, '%Y-%m') AS mes,
                UPPER(TRIM(resultado)) AS resultado,
                TRIM(codRef) AS cod_ref,
                COUNT(*) AS casos
            FROM san_fact_resultado_analisis
            WHERE fecToma BETWEEN ? AND ?
              AND fecToma IS NOT NULL
              AND analisis_nombre IS NOT NULL
              AND TRIM(analisis_nombre) != ''
              AND TRIM(codRef) != ''
              AND NOT (resultado IS NULL OR TRIM(resultado) = '')
              AND UPPER(TRIM(resultado)) NOT IN ('(SIN RESULTADO)', 'SIN RESULTADO', 'NEGATIVO')
              {$exclAgua['cod']}
              {$exclAgua['nom']}
              {$origenFiltro['sql']}
              {$tipoFiltro['sql']}
            GROUP BY analisis_nombre, DATE_FORMAT(fecToma, '%Y-%m'), UPPER(TRIM(resultado)), TRIM(codRef)
            HAVING casos > 0
        ";

        $stmt = $db->prepare($sql);
        if (!$stmt) {
            return ['success' => false, 'error' => 'Error preparando consulta'];
        }

        $stmt->execute($bindVals);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $mesSet  = [];
        $analSet = [];
        $idx     = [];

        foreach ($rows as $row) {
            $nom = (string)($row['analisis_nombre'] ?? '');
            $mes = (string)($row['mes'] ?? '');
            $res = strtoupper(trim((string)($row['resultado'] ?? '')));
            if ($res === '') {
                $res = '(SIN RESULTADO)';
            }
            $ref = preg_replace('/\s+/', '', (string)($row['cod_ref'] ?? ''));
            $cnt = (int)($row['casos'] ?? 0);

            if ($nom === '' || $mes === '' || $ref === '' || $cnt <= 0) {
                continue;
            }

            $mesSet[$mes] = true;
            if (!isset($analSet[$nom])) {
                $analSet[$nom] = (string)($row['analisis_codigo'] ?? '');
            }
            if (!isset($idx[$nom][$res][$ref][$mes])) {
                $idx[$nom][$res][$ref][$mes] = 0;
            }
            $idx[$nom][$res][$ref][$mes] += $cnt;
        }

        $meses = trz_meses($mesSet, $fechaInicio, $fechaFin);
        $topRefsPerResultado = 5;

        $analisisOut = [];
        $granjaMap = trz_granja_abrev_map();

        foreach ($analSet as $nom => $cod) {
            $resBlocks = [];
            $porRes    = $idx[$nom] ?? [];

            foreach ($porRes as $resKey => $porRef) {
                $ranked = [];
                foreach ($porRef as $ref => $porMes) {
                    $total = array_sum($porMes);
                    if ($total <= 0) {
                        continue;
                    }
                    $ranked[] = ['ref' => $ref, 'porMes' => $porMes, 'total' => $total];
                }
                usort($ranked, static function ($a, $b) {
                    return $b['total'] <=> $a['total'] ?: strcmp((string)$a['ref'], (string)$b['ref']);
                });
                $ranked = array_slice($ranked, 0, $topRefsPerResultado);

                $refs = [];
                foreach ($ranked as $r) {
                    $data = [];
                    foreach ($meses as $mes) {
                        $data[] = (int)($r['porMes'][$mes] ?? 0);
                    }

                    $t = (string)($r['ref'] ?? '');
                    $g3 = strlen($t) >= 3 ? substr($t, 0, 3) : '';
                    $abrev = $granjaMap[$g3] ?? '';
                    $label = $abrev !== '' ? ($abrev . ' · ' . $t) : $t;

                    $refs[] = [
                        'codRef' => $t,
                        'label'  => $label,
                        'granja' => $g3,
                        'data'   => $data,
                        'total'  => $r['total'],
                    ];
                }

                if ($refs !== []) {
                    $resBlocks[] = [
                        'resultado' => $resKey,
                        'refs'      => $refs,
                    ];
                }
            }

            usort($resBlocks, static function ($a, $b) {
                $ta = 0;
                $tb = 0;
                foreach ($a['refs'] as $refRow) {
                    $ta += (int)($refRow['total'] ?? 0);
                }
                foreach ($b['refs'] as $refRow) {
                    $tb += (int)($refRow['total'] ?? 0);
                }
                return $tb <=> $ta ?: strcasecmp((string)$a['resultado'], (string)$b['resultado']);
            });

            $analisisOut[] = [
                'cod'        => (string)$cod,
                'nom'        => $nom,
                'resultados' => $resBlocks,
            ];
        }

        usort($analisisOut, static function ($a, $b) {
            return strcasecmp((string)$a['nom'], (string)$b['nom']);
        });

        return [
            'success'   => true,
            'meses'     => $meses,
            'etiquetas' => trz_etiquetas($meses),
            'analisis'  => $analisisOut,
            'formato'   => [
                'digitos8'  => 'GGG·CCC·BB (granja·campaña·galpón)',
                'digitos10' => 'GGG·CCC·BB·EE (+ edad)',
            ],
        ];
    }

    /**
     * Serie mensual / Evolución de positivos y tasas (Tab 3: Período)
     */
    public function getAnalisisPeriodo(array $params = [])
    {
        $db = $this->getDb();
        $rawInicio = $params['fechaInicio'] ?? '';
        $rawFin    = $params['fechaFin']    ?? '';

        $defaultInicio = date('Y-01-01', strtotime('-1 year'));
        $defaultFin    = date('Y-12-31');

        $fechaInicio = trz_parse_fecha((string)$rawInicio) ?? $defaultInicio;
        $fechaFin    = trz_parse_fecha((string)$rawFin)    ?? $defaultFin;

        $origenFiltro = trz_filtro_origen($params);
        $tipoFiltro   = trz_filtro_tipo_muestra($params);
        $exclAgua     = trz_filtros_exclusion_agua($db);

        $bindVals = array_merge([$fechaInicio, $fechaFin], $origenFiltro['params'], $tipoFiltro['params']);

        $sql = "
            SELECT
                MIN(analisis_codigo)                                                   AS analisis_codigo,
                analisis_nombre,
                DATE_FORMAT(fecToma, '%Y-%m')                                          AS mes,
                COUNT(*)                                                               AS total_registrados,
                SUM(CASE
                    WHEN resultado IS NULL OR TRIM(resultado) = '' THEN 0
                    WHEN UPPER(TRIM(resultado)) IN ('(SIN RESULTADO)', 'SIN RESULTADO') THEN 0
                    ELSE 1
                END)                                                                   AS total,
                SUM(CASE
                    WHEN resultado IS NULL OR TRIM(resultado) = '' THEN 0
                    WHEN UPPER(TRIM(resultado)) IN ('(SIN RESULTADO)', 'SIN RESULTADO') THEN 0
                    WHEN UPPER(TRIM(resultado)) = 'NEGATIVO' THEN 0
                    ELSE 1
                END)                                                                   AS positivos
            FROM san_fact_resultado_analisis
            WHERE fecToma BETWEEN ? AND ?
              AND fecToma IS NOT NULL
              AND analisis_nombre IS NOT NULL
              AND TRIM(analisis_nombre) != ''
              {$exclAgua['cod']}
              {$exclAgua['nom']}
              {$origenFiltro['sql']}
              {$tipoFiltro['sql']}
            GROUP BY analisis_nombre, mes
            ORDER BY mes ASC, analisis_nombre ASC
        ";

        $stmt = $db->prepare($sql);
        if (!$stmt) {
            return ['success' => false, 'error' => 'Error preparando consulta'];
        }

        $stmt->execute($bindVals);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $rawRows = [];
        $mesSet  = [];
        $analSet = [];

        foreach ($rows as $row) {
            $cod         = (string)($row['analisis_codigo'] ?? '');
            $nom         = (string)($row['analisis_nombre'] ?? '');
            $mes         = (string)($row['mes'] ?? '');
            $total       = (int)($row['total'] ?? 0);
            $positivos   = (int)($row['positivos'] ?? 0);
            $registrados = (int)($row['total_registrados'] ?? 0);

            $mesSet[$mes] = true;
            if (!isset($analSet[$nom])) {
                $analSet[$nom] = $cod;
            }
            $rawRows[] = [
                'nom'         => $nom,
                'mes'         => $mes,
                'total'       => $total,
                'positivos'   => $positivos,
                'registrados' => $registrados,
            ];
        }

        $meses = trz_meses($mesSet, $fechaInicio, $fechaFin);

        $idx = [];
        foreach ($rawRows as $r) {
            $idx[$r['nom']][$r['mes']] = [
                'total'       => $r['total'],
                'positivos'   => $r['positivos'],
                'registrados' => $r['registrados'],
            ];
        }

        $analisis = [];
        foreach ($analSet as $nom => $cod) {
            $data        = [];
            $pct         = [];
            $totales     = [];
            $registrados = [];
            foreach ($meses as $mes) {
                $entry       = $idx[$nom][$mes] ?? ['total' => 0, 'positivos' => 0, 'registrados' => 0];
                $pos         = $entry['positivos'];
                $tot         = $entry['total'];
                $reg         = $entry['registrados'];
                $data[]      = $pos;
                $totales[]   = $tot;
                $registrados[] = $reg;
                $pct[]       = $tot > 0 ? (int)round($pos / $tot * 100) : 0;
            }
            $analisis[] = [
                'cod'         => (string)$cod,
                'nom'         => $nom,
                'data'        => $data,
                'totales'     => $totales,
                'pct'         => $pct,
                'registrados' => $registrados,
            ];
        }

        $analisis = array_values(array_filter($analisis, static function ($a) {
            return array_sum($a['data']) > 0;
        }));

        usort($analisis, static function ($a, $b) {
            return strcasecmp((string)$a['nom'], (string)$b['nom']);
        });

        return [
            'success'   => true,
            'meses'     => $meses,
            'etiquetas' => trz_etiquetas($meses),
            'analisis'  => $analisis,
        ];
    }

    /**
     * Resumen de Porcentaje y paquetes (Tab 4: Porcentaje)
     */
    public function getAnalisisPorcentaje(array $params = [])
    {
        $db = $this->getDb();
        $hoy          = new DateTime();
        $mesActual    = (int)$hoy->format('m');
        $anioActual   = (int)$hoy->format('Y');
        $anioAnterior = $anioActual - 1;

        $defaultInicio = sprintf('%04d-%02d-01', $anioAnterior, $mesActual);
        $ultimoDiaFin  = (int)$hoy->format('t');
        $defaultFin    = sprintf('%04d-%02d-%02d', $anioActual, $mesActual, $ultimoDiaFin);

        $rawInicio = $params['fechaInicio'] ?? '';
        $rawFin    = $params['fechaFin']    ?? '';

        $fechaInicio = trz_parse_fecha((string)$rawInicio) ?? $defaultInicio;
        $fechaFin    = trz_parse_fecha((string)$rawFin)    ?? $defaultFin;

        $origenFiltro = trz_filtro_origen($params);
        $tipoFiltro   = trz_filtro_tipo_muestra($params);
        $exclAgua     = trz_filtros_exclusion_agua($db);

        $bindVals = array_merge([$fechaInicio, $fechaFin], $origenFiltro['params'], $tipoFiltro['params']);

        $sql = "
            SELECT
                MIN(analisis_codigo)                                                   AS analisis_codigo,
                analisis_nombre,
                DATE_FORMAT(fecToma, '%Y-%m')                                          AS mes,
                COUNT(*)                                                               AS total_registrados,
                SUM(CASE
                    WHEN resultado IS NULL OR TRIM(resultado) = '' THEN 0
                    WHEN UPPER(TRIM(resultado)) IN ('(SIN RESULTADO)', 'SIN RESULTADO') THEN 0
                    ELSE 1
                END)                                                                   AS total,
                SUM(CASE
                    WHEN resultado IS NULL OR TRIM(resultado) = '' THEN 0
                    WHEN UPPER(TRIM(resultado)) IN ('(SIN RESULTADO)', 'SIN RESULTADO') THEN 0
                    WHEN UPPER(TRIM(resultado)) = 'NEGATIVO' THEN 0
                    ELSE 1
                END)                                                                   AS positivos
            FROM san_fact_resultado_analisis
            WHERE fecToma BETWEEN ? AND ?
              AND fecToma IS NOT NULL
              AND analisis_nombre IS NOT NULL
              AND TRIM(analisis_nombre) != ''
              {$exclAgua['cod']}
              {$exclAgua['nom']}
              {$origenFiltro['sql']}
              {$tipoFiltro['sql']}
            GROUP BY analisis_nombre, DATE_FORMAT(fecToma, '%Y-%m')
            ORDER BY analisis_nombre ASC, mes ASC
        ";

        $stmt = $db->prepare($sql);
        if (!$stmt) {
            return ['success' => false, 'error' => 'Error preparando consulta'];
        }

        $stmt->execute($bindVals);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

        $mesSet = [];
        $totalResultados = 0;
        $idxMes = [];
        $aggr   = [];

        foreach ($rows as $row) {
            $nom  = (string)($row['analisis_nombre'] ?? '');
            $mes  = (string)($row['mes'] ?? '');
            if ($nom === '' || $mes === '') {
                continue;
            }

            $cod   = (string)($row['analisis_codigo'] ?? '');
            $total = (int)($row['total'] ?? 0);
            $pos   = (int)($row['positivos'] ?? 0);
            $reg   = (int)($row['total_registrados'] ?? 0);

            $mesSet[$mes] = true;
            $totalResultados += $total;

            $idxMes[$nom][$mes] = [
                'total'       => $total,
                'positivos'   => $pos,
                'registrados' => $reg,
            ];

            if (!isset($aggr[$nom])) {
                $aggr[$nom] = ['cod' => '', 'total' => 0, 'positivos' => 0, 'registrados' => 0];
            }
            if ($cod !== '' && ($aggr[$nom]['cod'] === '' || strcmp($cod, $aggr[$nom]['cod']) < 0)) {
                $aggr[$nom]['cod'] = $cod;
            }
            $aggr[$nom]['total']       += $total;
            $aggr[$nom]['positivos']   += $pos;
            $aggr[$nom]['registrados'] += $reg;
        }

        $pkgMap = [];
        try {
            $stmtPkg = $db->query("
                SELECT ap.analisis,
                       MIN(p.codigo) AS paquete_codigo,
                       MIN(p.nombre) AS paquete_nombre
                FROM san_dim_analisis_paquete ap
                INNER JOIN san_dim_paquete p ON ap.paquete = p.codigo
                GROUP BY ap.analisis
            ");
            if ($stmtPkg) {
                while ($row = $stmtPkg->fetch(PDO::FETCH_ASSOC)) {
                    $pkgMap[(string)$row['analisis']] = [
                        (string)($row['paquete_codigo'] ?? ''),
                        (string)($row['paquete_nombre'] ?? ''),
                    ];
                }
            }
        } catch (Exception $e) {
            // Fallback
        }

        $meses = trz_meses($mesSet, $fechaInicio, $fechaFin);
        $etiquetasMeses = trz_etiquetas($meses);

        $items = [];
        foreach ($aggr as $nom => $a) {
            $tot = $a['total'];
            $pos = $a['positivos'];
            $reg = $a['registrados'];
            $pct = $tot > 0 ? (int)round($pos / $tot * 100) : 0;

            $items[] = [
                'cod'               => $a['cod'],
                'nom'               => $nom,
                'total'             => $tot,
                'totalRegistrados'  => $reg,
                'positivos'         => $pos,
                'porcentaje'        => $pct,
                'paquete'           => $pkgMap[$a['cod']][0] ?? '',
                'paqueteNom'        => $pkgMap[$a['cod']][1] ?? '',
            ];
        }

        $items = array_values(array_filter($items, static function ($row) {
            return ($row['positivos'] ?? 0) > 0;
        }));

        usort($items, static function ($a, $b) {
            return strcasecmp((string)$a['nom'], (string)$b['nom']);
        });

        foreach ($items as &$itRow) {
            $nomItem = $itRow['nom'] ?? '';
            $tArr = [];
            $pArr = [];
            $rArr = [];
            foreach ($meses as $mKey) {
                $cell = $idxMes[$nomItem][$mKey] ?? ['total' => 0, 'positivos' => 0, 'registrados' => 0];
                $tArr[] = (int)($cell['total'] ?? 0);
                $pArr[] = (int)($cell['positivos'] ?? 0);
                $rArr[] = (int)($cell['registrados'] ?? 0);
            }
            $itRow['totalesMes']     = $tArr;
            $itRow['positivosMes']   = $pArr;
            $itRow['registradosMes'] = $rArr;
        }
        unset($itRow);

        $mesesEs = [
            '01' => 'ene', '02' => 'feb', '03' => 'mar', '04' => 'abr', '05' => 'may',
            '06' => 'jun', '07' => 'jul', '08' => 'ago', '09' => 'set', '10' => 'oct',
            '11' => 'nov', '12' => 'dic'
        ];
        $partsI = explode('-', $fechaInicio);
        $partsF = explode('-', $fechaFin);
        $periodoLabel = ($mesesEs[$partsI[1]] ?? $partsI[1]) . ' ' . $partsI[0]
            . ' – '
            . ($mesesEs[$partsF[1]] ?? $partsF[1]) . ' ' . $partsF[0];

        return [
            'success'          => true,
            'totalResultados'  => $totalResultados,
            'totalSolicitudes' => $totalResultados,
            'periodoLabel'     => $periodoLabel,
            'fechaInicio'      => $fechaInicio,
            'fechaFin'         => $fechaFin,
            'meses'            => $meses,
            'etiquetas'        => $etiquetasMeses,
            'items'            => $items,
        ];
    }

    /**
     * Reporte tabular pivote de resultados completos
     */
    public function getReporteResultados(array $params = [])
    {
        $db = $this->getDb();
        $rawInicio = $params['fechaInicio'] ?? '';
        $rawFin    = $params['fechaFin']    ?? '';

        $defaultInicio = date('Y-01-01', strtotime('-1 year'));
        $defaultFin    = date('Y-12-31');

        $fechaInicio = trz_parse_fecha((string)$rawInicio) ?? $defaultInicio;
        $fechaFin    = trz_parse_fecha((string)$rawFin)    ?? $defaultFin;

        $data = trz_reporte_resultados_data($db, $fechaInicio, $fechaFin, false, $params);
        $data['success'] = !isset($data['error']);
        return $data;
    }

    /**
     * Reporte tabular pivote de las 6 enfermedades principales
     */
    public function getReporteEnfermedades(array $params = [])
    {
        $db = $this->getDb();
        $rawInicio = $params['fechaInicio'] ?? '';
        $rawFin    = $params['fechaFin']    ?? '';

        $defaultInicio = date('Y-01-01', strtotime('-1 year'));
        $defaultFin    = date('Y-12-31');

        $fechaInicio = trz_parse_fecha((string)$rawInicio) ?? $defaultInicio;
        $fechaFin    = trz_parse_fecha((string)$rawFin)    ?? $defaultFin;

        $data = trz_reporte_resultados_data($db, $fechaInicio, $fechaFin, true, $params);
        $data['success'] = !isset($data['error']);
        return $data;
    }
}
