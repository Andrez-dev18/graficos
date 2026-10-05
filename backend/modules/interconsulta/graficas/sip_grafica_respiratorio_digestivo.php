<?php

declare(strict_types=1);

require_once __DIR__ . '/sip_grafica_eval_lib.php';
require_once __DIR__ . '/sip_grafica_std_lib.php';

const SIP_GRAFICA_TK_RESPIRATORIO = 'SANIDAD_EVALUACION_DE_PROCESO_RESPIRATORIO_EN_GRANJA';
const SIP_GRAFICA_TK_DIGESTIVO = 'SANIDAD_EVALUACION_DE_HECES_EN_GRANJA';

if (!function_exists('sip_grafica_respiratorio_digestivo_tipos')) {
    /** @return list<string> */
    function sip_grafica_respiratorio_digestivo_tipos(): array
    {
        return ['respiratorio', 'digestivo'];
    }
}

if (!function_exists('sip_grafica_respiratorio_digestivo_cfg')) {
    /**
     * @return array<string,mixed>|null
     */
    function sip_grafica_respiratorio_digestivo_cfg(string $tipo): ?array
    {
        static $map = [
            'respiratorio' => [
                'tipo' => 'respiratorio',
                'label' => 'Evaluación respiratoria',
                'tareaKey' => SIP_GRAFICA_TK_RESPIRATORIO,
                'unidadDefault' => '%',
                'metricas' => ['estornudo', 'ronquera'],
            ],
            'digestivo' => [
                'tipo' => 'digestivo',
                'label' => 'Evaluación digestiva',
                'tareaKey' => SIP_GRAFICA_TK_DIGESTIVO,
                'unidadDefault' => '%',
                'metricas' => ['A', 'P', 'S', 'R'],
            ],
        ];

        return $map[strtolower(trim($tipo))] ?? null;
    }
}

if (!function_exists('sip_grafica_es_respiratorio_digestivo')) {
    function sip_grafica_es_respiratorio_digestivo(string $tipo): bool
    {
        return sip_grafica_respiratorio_digestivo_cfg($tipo) !== null;
    }
}

if (!function_exists('sip_grafica_rd_det_rows')) {
    /**
     * @return list<array<string,mixed>>
     */
    function sip_grafica_rd_det_rows(
        mysqli $conn,
        string $granja3,
        string $campania3,
        string $galBind,
        string $galBind2,
        string $tareaKey
    ): array {
        $sql = "SELECT d.`edadDia`, d.`parametroKey`, d.`valor`, d.`estandarJson`
                FROM `san_fact_historia_clinica_det` d
                INNER JOIN `san_fact_historia_clinica_cab` c ON c.`id` = d.`cabId`
                WHERE LPAD(LEFT(TRIM(c.`granja`),3),3,'0') = ?
                  AND TRIM(c.`campania`) = ?
                  AND (
                       TRIM(CAST(c.`galpon` AS CHAR)) = ?
                       OR CAST(TRIM(CAST(c.`galpon` AS CHAR)) AS UNSIGNED) = CAST(? AS UNSIGNED)
                  )
                  AND TRIM(d.`tareaKey`) = ?
                ORDER BY d.`edadDia` ASC, d.`parametroKey` ASC";
        $st = $conn->prepare($sql);
        if (!$st) {
            return [];
        }
        $st->bind_param('sssss', $granja3, $campania3, $galBind, $galBind2, $tareaKey);
        $st->execute();
        $rs = $st->get_result();
        $rows = [];
        while ($rs && ($r = $rs->fetch_assoc())) {
            $rows[] = $r;
        }
        $st->close();

        return $rows;
    }
}

if (!function_exists('sip_grafica_rd_group_by_edad')) {
    /**
     * @param list<array<string,mixed>> $rows
     * @return array<int, list<array<string,mixed>>>
     */
    function sip_grafica_rd_group_by_edad(array $rows): array
    {
        $byEdad = [];
        foreach ($rows as $r) {
            $ed = (int) ($r['edadDia'] ?? 0);
            if ($ed <= 0) {
                continue;
            }
            $byEdad[$ed][] = $r;
        }
        ksort($byEdad, SORT_NUMERIC);

        return $byEdad;
    }
}

if (!function_exists('sip_grafica_rd_valor')) {
    function sip_grafica_rd_valor(?float $valor): ?float
    {
        if ($valor === null || sip_grafica_is_nan($valor) || !is_finite($valor)) {
            return null;
        }

        return $valor;
    }
}

if (!function_exists('sip_grafica_respiratorio_slot_por_pk')) {
    function sip_grafica_respiratorio_slot_por_pk(string $parametroKey): string
    {
        $pk = strtoupper(trim($parametroKey));
        if ($pk === 'RONQUERA') {
            return 'ronquera';
        }
        if ($pk === 'ESTORNUDO') {
            return 'estornudo';
        }

        return '';
    }
}

if (!function_exists('sip_grafica_respiratorio_parse_celda')) {
    /**
     * @return array{estornudo:?float,ronquera:?float}
     */
    function sip_grafica_respiratorio_parse_celda($raw): array
    {
        $empty = ['estornudo' => null, 'ronquera' => null];
        if ($raw === null || $raw === '') {
            return $empty;
        }
        $s = is_string($raw) ? trim($raw) : '';
        if ($s === '' || $s === '—') {
            return $empty;
        }
        if ($s !== '' && $s[0] === '{') {
            $obj = @json_decode(str_replace(['&quot;', '&#34;'], '"', $s), true);
            if (is_array($obj) && ($obj['format'] ?? '') === 'eva_respiratorio_mh_v1') {
                return [
                    'estornudo' => sip_grafica_to_num($obj['estornudo'] ?? null),
                    'ronquera' => sip_grafica_to_num($obj['ronquera'] ?? null),
                ];
            }
        }
        if (preg_match('/(?:Estorn|ESTORN)[\w]*\.?\s*:?\s*(\d+(?:\.\d+)?)/i', $s, $mEst)) {
            $empty['estornudo'] = sip_grafica_to_num($mEst[1]);
        }
        if (preg_match('/(?:Ronq|RONQ)[\w]*\.?\s*:?\s*(\d+(?:\.\d+)?)/i', $s, $mRon)) {
            $empty['ronquera'] = sip_grafica_to_num($mRon[1]);
        }
        if ($empty['estornudo'] !== null || $empty['ronquera'] !== null) {
            return $empty;
        }

        $n = sip_grafica_to_num($raw);

        return ['estornudo' => $n, 'ronquera' => $n];
    }
}

if (!function_exists('sip_grafica_respiratorio_linea')) {
    /**
     * @param array{granja:string,campania:string,galpon:string} $opts
     * @return array<string,mixed>
     */
    function sip_grafica_respiratorio_linea(mysqli $conn, array $opts): array
    {
        $cfg = sip_grafica_respiratorio_digestivo_cfg('respiratorio');
        if ($cfg === null) {
            return ['success' => false, 'message' => 'Tipo no soportado'];
        }

        $granja = trim((string) ($opts['granja'] ?? ''));
        $campania = trim((string) ($opts['campania'] ?? ''));
        $galpon = trim((string) ($opts['galpon'] ?? ''));
        if ($granja === '' || $campania === '' || $galpon === '') {
            return ['success' => false, 'message' => 'Faltan parametros: granja, campania, galpon'];
        }

        [$granja3, $campania3, $galBind, $galBind2] = sip_grafica_normalize_granja_campania($granja, $campania, $galpon);
        $tk = (string) $cfg['tareaKey'];

        $rows = sip_grafica_rd_det_rows($conn, $granja3, $campania3, $galBind, $galBind2, $tk);
        if ($rows === []) {
            return ['success' => false, 'message' => 'Sin datos para esa combinacion'];
        }

        $fechaInicio = sip_grafica_fecha_inicio_cab($conn, $granja3, $campania3, $galBind, $galBind2);
        $byEdad = sip_grafica_rd_group_by_edad($rows);
        $dataPorDia = [];

        foreach ($byEdad as $ed => $rowsEd) {
            $estM = null;
            $estH = null;
            $ronM = null;
            $ronH = null;

            foreach ($rowsEd as $r) {
                $slot = sip_grafica_respiratorio_slot_por_pk((string) ($r['parametroKey'] ?? ''));
                if ($slot === '') {
                    continue;
                }
                $parsed = sip_grafica_parse_valor_mh($r['valor'] ?? null, 0);
                if ($parsed['esMh']) {
                    if ($slot === 'estornudo') {
                        $estM = $parsed['m'];
                        $estH = $parsed['h'];
                    } else {
                        $ronM = $parsed['m'];
                        $ronH = $parsed['h'];
                    }
                    continue;
                }
                $celda = sip_grafica_respiratorio_parse_celda($r['valor'] ?? null);
                if ($slot === 'estornudo') {
                    $estM = $celda['estornudo'];
                    $estH = $celda['estornudo'];
                } else {
                    $ronM = $celda['ronquera'];
                    $ronH = $celda['ronquera'];
                }
            }

            $dataPorDia[] = [
                'dia' => $ed,
                'fecha' => sip_grafica_fecha_por_dia($fechaInicio, $ed),
                'estornudo' => [
                    'macho' => ['valor' => sip_grafica_rd_valor($estM)],
                    'hembra' => ['valor' => sip_grafica_rd_valor($estH)],
                ],
                'ronquera' => [
                    'macho' => ['valor' => sip_grafica_rd_valor($ronM)],
                    'hembra' => ['valor' => sip_grafica_rd_valor($ronH)],
                ],
            ];
        }

        return [
            'success' => true,
            'tipo' => 'respiratorio',
            'nombre' => (string) $cfg['label'],
            'metricas' => ['estornudo', 'ronquera'],
            'dataPorDia' => $dataPorDia,
            'unidad' => (string) $cfg['unidadDefault'],
            'esMh' => true,
            'tareaKey' => $tk,
            'franjas' => sip_grafica_std_franja_meta_por_slots(
                $conn,
                $tk,
                ['estornudo' => 'ESTORNUDO', 'ronquera' => 'RONQUERA'],
                $granja3,
                $galBind !== '' ? $galBind : $galBind2
            ),
        ];
    }
}

if (!function_exists('sip_grafica_digestivo_slot_por_pk')) {
    function sip_grafica_digestivo_slot_por_pk(string $parametroKey): string
    {
        static $map = [
            'HECES_ANARANJADAS' => 'A',
            'HECES_PASTOSAS' => 'P',
            'HECES_SUELTAS' => 'S',
            'HECES_ROJAS' => 'R',
        ];
        $pk = strtoupper(trim($parametroKey));

        return $map[$pk] ?? '';
    }
}

if (!function_exists('sip_grafica_digestivo_parse_celda')) {
    /**
     * @return array{A:?float,P:?float,S:?float,R:?float}
     */
    function sip_grafica_digestivo_parse_celda($raw): array
    {
        $empty = ['A' => null, 'P' => null, 'S' => null, 'R' => null];
        if ($raw === null || $raw === '') {
            return $empty;
        }
        $s = is_string($raw) ? trim($raw) : '';
        if ($s === '' || $s === '—') {
            return $empty;
        }
        if ($s !== '' && $s[0] === '{') {
            $obj = @json_decode(str_replace(['&quot;', '&#34;'], '"', $s), true);
            if (is_array($obj) && ($obj['format'] ?? '') === 'digestivo_heces_v1' && is_array($obj['slots'] ?? null)) {
                foreach (['A', 'P', 'S', 'R'] as $slot) {
                    $empty[$slot] = sip_grafica_to_num($obj['slots'][$slot] ?? null);
                }

                return $empty;
            }
        }
        if (preg_match_all('/\b([APSR])\s*:\s*(\d+(?:\.\d+)?)/i', $s, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $m) {
                $empty[strtoupper($m[1])] = sip_grafica_to_num($m[2]);
            }
            if ($empty['A'] !== null || $empty['P'] !== null || $empty['S'] !== null || $empty['R'] !== null) {
                return $empty;
            }
        }
        $n = sip_grafica_to_num($raw);
        if ($n !== null) {
            return ['A' => $n, 'P' => $n, 'S' => $n, 'R' => $n];
        }

        return $empty;
    }
}

if (!function_exists('sip_grafica_digestivo_parse_estandar_json')) {
    /**
     * Estándar por slot A/P/S/R desde el estandarJson de EVALUACION_HECES_DIA.
     *
     * @param mixed $raw
     * @return array<string, array{min:?float,max:?float,modoEvaluacion:string,unidades:string}>
     */
    function sip_grafica_digestivo_parse_estandar_json($raw): array
    {
        $out = [];
        if (!is_string($raw)) {
            return $out;
        }
        $s = trim($raw);
        if ($s === '' || $s[0] !== '{') {
            return $out;
        }
        $obj = @json_decode(str_replace(['&quot;', '&#34;'], '"', $s), true);
        $lista = is_array($obj) ? ($obj['digestivoEstandares'] ?? null) : null;
        if (!is_array($lista)) {
            return $out;
        }
        foreach ($lista as $e) {
            if (!is_array($e)) {
                continue;
            }
            $letra = strtoupper(trim((string) ($e['letra'] ?? '')));
            if (!in_array($letra, ['A', 'P', 'S', 'R'], true)) {
                continue;
            }
            $out[$letra] = [
                'min' => sip_grafica_to_num($e['stdMin'] ?? null),
                'max' => sip_grafica_to_num($e['stdMax'] ?? null),
                'modoEvaluacion' => strtolower(trim((string) ($e['modoEvaluacion'] ?? ''))),
                'unidades' => trim((string) ($e['unidades'] ?? '')),
            ];
        }

        return $out;
    }
}

if (!function_exists('sip_grafica_digestivo_std_unificado')) {
    /**
     * Estándar unificado de heces (A/P/S/R comparten min/max).
     *
     * @param array<string, array{min:?float,max:?float,modoEvaluacion:string,unidades:string}> $slots
     * @return array{min:?float,max:?float,modoEvaluacion:string,unidades:string}|null
     */
    function sip_grafica_digestivo_std_unificado(array $slots): ?array
    {
        $min = null;
        $max = null;
        $modo = '';
        $uni = '';
        foreach ($slots as $s) {
            if (!is_array($s)) {
                continue;
            }
            if (($s['min'] ?? null) !== null && ($min === null || (float) $s['min'] < $min)) {
                $min = (float) $s['min'];
            }
            if (($s['max'] ?? null) !== null && ($max === null || (float) $s['max'] > $max)) {
                $max = (float) $s['max'];
            }
            if ($modo === '' && (string) ($s['modoEvaluacion'] ?? '') !== '') {
                $modo = (string) $s['modoEvaluacion'];
            }
            if ($uni === '' && (string) ($s['unidades'] ?? '') !== '') {
                $uni = (string) $s['unidades'];
            }
        }
        if ($min === null && $max === null) {
            return null;
        }

        return ['min' => $min, 'max' => $max, 'modoEvaluacion' => $modo, 'unidades' => $uni];
    }
}

if (!function_exists('sip_grafica_digestivo_linea')) {
    /**
     * @param array{granja:string,campania:string,galpon:string} $opts
     * @return array<string,mixed>
     */
    function sip_grafica_digestivo_linea(mysqli $conn, array $opts): array
    {
        $cfg = sip_grafica_respiratorio_digestivo_cfg('digestivo');
        if ($cfg === null) {
            return ['success' => false, 'message' => 'Tipo no soportado'];
        }

        $granja = trim((string) ($opts['granja'] ?? ''));
        $campania = trim((string) ($opts['campania'] ?? ''));
        $galpon = trim((string) ($opts['galpon'] ?? ''));
        if ($granja === '' || $campania === '' || $galpon === '') {
            return ['success' => false, 'message' => 'Faltan parametros: granja, campania, galpon'];
        }

        [$granja3, $campania3, $galBind, $galBind2] = sip_grafica_normalize_granja_campania($granja, $campania, $galpon);
        $tk = (string) $cfg['tareaKey'];

        $rows = sip_grafica_rd_det_rows($conn, $granja3, $campania3, $galBind, $galBind2, $tk);
        if ($rows === []) {
            return ['success' => false, 'message' => 'Sin datos para esa combinacion'];
        }

        $fechaInicio = sip_grafica_fecha_inicio_cab($conn, $granja3, $campania3, $galBind, $galBind2);
        $byEdad = sip_grafica_rd_group_by_edad($rows);
        $dataPorDia = [];

        $stdSlots = [];
        foreach ($rows as $r) {
            $stdSlots = sip_grafica_digestivo_parse_estandar_json($r['estandarJson'] ?? null);
            if ($stdSlots !== []) {
                break;
            }
        }
        $stdUni = sip_grafica_digestivo_std_unificado($stdSlots);
        $dataEstandar = [];

        foreach ($byEdad as $ed => $rowsEd) {
            $slots = ['A' => null, 'P' => null, 'S' => null, 'R' => null];

            foreach ($rowsEd as $r) {
                $pk = strtoupper(trim((string) ($r['parametroKey'] ?? '')));
                $parsed = sip_grafica_digestivo_parse_celda($r['valor'] ?? null);
                $hasParsed = ($parsed['A'] !== null || $parsed['P'] !== null || $parsed['S'] !== null || $parsed['R'] !== null);
                if ($hasParsed) {
                    foreach (['A', 'P', 'S', 'R'] as $slot) {
                        if ($parsed[$slot] !== null) {
                            $slots[$slot] = $parsed[$slot];
                        }
                    }
                    continue;
                }
                $slotPk = sip_grafica_digestivo_slot_por_pk($pk);
                if ($slotPk !== '') {
                    $n = sip_grafica_to_num($r['valor'] ?? null);
                    if ($n !== null) {
                        $slots[$slotPk] = $n;
                    }
                }
            }

            $diaItem = [
                'dia' => $ed,
                'fecha' => sip_grafica_fecha_por_dia($fechaInicio, $ed),
            ];
            foreach (['A', 'P', 'S', 'R'] as $slot) {
                $diaItem[$slot] = ['valor' => sip_grafica_rd_valor($slots[$slot])];
            }
            $dataPorDia[] = $diaItem;

            if ($stdUni !== null) {
                $dataEstandar[] = [
                    'dia' => $ed,
                    'min' => $stdUni['min'],
                    'max' => $stdUni['max'],
                    'minM' => $stdUni['min'],
                    'maxM' => $stdUni['max'],
                    'minH' => $stdUni['min'],
                    'maxH' => $stdUni['max'],
                ];
            }
        }

        return [
            'success' => true,
            'tipo' => 'digestivo',
            'nombre' => (string) $cfg['label'],
            'metricas' => ['A', 'P', 'S', 'R'],
            'dataPorDia' => $dataPorDia,
            'unidad' => (string) $cfg['unidadDefault'],
            'esMh' => false,
            'tareaKey' => $tk,
            'modoEvaluacion' => $stdUni !== null ? $stdUni['modoEvaluacion'] : '',
            'dataEstandar' => $dataEstandar,
            'heces_estandares' => $stdSlots,
            'franjas' => sip_grafica_std_franja_meta_por_slots(
                $conn,
                $tk,
                [
                    'A' => 'HECES_ANARANJADAS',
                    'P' => 'HECES_PASTOSAS',
                    'S' => 'HECES_SUELTAS',
                    'R' => 'HECES_ROJAS',
                ],
                $granja3,
                $galBind !== '' ? $galBind : $galBind2
            ),
        ];
    }
}
