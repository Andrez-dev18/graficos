<?php
/**
 * Capa única origen/cumplimiento EST2: whitelists estcumpl_*, lectura de valores y merge HC/informes.
 * Metadatos de UI del árbol EST2: función sip_est2_meta_origen_payload() al final de este archivo.
 * Usado por generar_reporte_estandares_necropsia.php, historia clínica, get_est2_meta_origen.php, etc.
 */

require_once __DIR__ . '/sip_estandares_eval_engine.php';
require_once __DIR__ . '/sip_estandares_eval_repository.php';

if (!function_exists('estcumpl_det_columnas')) {
    /**
     * Columnas de origen/cumplimiento en `san_estandares_parametros` (sustituye introspección legacy de det).
     *
     * @return array{tipoParametro:bool,infoOrigen:bool}
     */
    function estcumpl_det_columnas(mysqli $conn): array {
        static $cache = null;
        if ($cache !== null) {
            return $cache;
        }
        if (!function_exists('sip_est2_repo_table_exists')) {
            require_once __DIR__ . '/sip_estandares_tree_repository.php';
        }
        $cache = ['tipoParametro' => false, 'infoOrigen' => false];
        $tbl = 'san_estandares_parametros';
        if (!sip_est2_repo_table_exists($conn, $tbl)) {
            return $cache;
        }
        $cache['tipoParametro'] = sip_est2_repo_col_exists($conn, $tbl, 'tipoParametro');
        $cache['infoOrigen'] = sip_est2_repo_col_exists($conn, $tbl, 'infoOrigen');

        return $cache;
    }
}

if (!function_exists('estcumpl_info_origen_array')) {
    function estcumpl_info_origen_array($raw): array {
        if ($raw === null || $raw === '') {
            return [];
        }
        if (is_array($raw)) {
            return $raw;
        }
        if (is_string($raw)) {
            $t = trim($raw);
            if ($t === '' || $t === 'null') {
                return [];
            }
            $dec = json_decode($t, true);
            return is_array($dec) ? $dec : [];
        }
        return [];
    }
}

if (!function_exists('estcumpl_necropsia_parametro_nombre_desde_nivel_param')) {
    /**
     * Texto parametroNombre (UI y columna parámetro): nivel + parámetro de catálogo con espacio.
     * Ej.: nivel "Indice bursal", param "normal" → "Indice bursal normal" (misma regla que dashboard EST2).
     */
    function estcumpl_necropsia_parametro_nombre_desde_nivel_param(string $nivel, string $param): string
    {
        $n = trim(preg_replace('/\s+/', ' ', $nivel));
        $p = trim(preg_replace('/\s+/', ' ', $param));
        if ($n !== '' && $p !== '') {
            return $n . ' ' . $p;
        }
        return $p !== '' ? $p : $n;
    }
}

if (!function_exists('estcumpl_necropsia_nivel_param_desde_fila')) {
    /**
     * Nivel y valor de parámetro (catálogo JEM) para filas origen necropsias.
     * 1) infoOrigen.nivel + .parametro
     * 2) columna "parametro" con "nivel: param" (legado)
     * 3) parametroNombre "nivel part param" = último token → param, resto → nivel
     * 4) Si $usarTipoComoNivelLegado: tipo + parametro (filas fact antiguas; no usar en contexto
     *    mapa EST2 donde "tipo" es nombre de tarea hoja, no el nivel JEM).
     *
     * @return array{nivelRaw:string,parametroRaw:string}
     */
    function estcumpl_necropsia_nivel_param_desde_fila(
        $infoOrigen,
        string $parametroCol,
        string $tipoCol = '',
        bool $usarTipoComoNivelLegado = false
    ): array {
        $inf = function_exists('estcumpl_info_origen_array') ? estcumpl_info_origen_array($infoOrigen) : [];
        $n = trim((string) ($inf['nivel'] ?? ''));
        $p = trim((string) ($inf['parametro'] ?? ''));
        if ($n !== '' && $p !== '') {
            return ['nivelRaw' => $n, 'parametroRaw' => $p];
        }
        $pc = trim(preg_replace('/\s+/', ' ', $parametroCol));
        if (strpos($pc, ':') !== false) {
            $partes = explode(':', $pc, 2);
            $n2 = trim($partes[0] ?? '');
            $p2 = trim($partes[1] ?? '');
            if ($n2 !== '' && $p2 !== '') {
                return ['nivelRaw' => $n2, 'parametroRaw' => $p2];
            }
        }
        if ($usarTipoComoNivelLegado) {
            $tCol = trim($tipoCol);
            $tipoEsKeySolo = $tCol !== '' && (bool) preg_match('/^[A-Z0-9_]{2,128}$/u', $tCol) && $tCol === strtoupper($tCol);
            if ($tCol !== '' && $pc !== '' && !$tipoEsKeySolo) {
                return ['nivelRaw' => $tCol, 'parametroRaw' => $pc];
            }
        }
        if ($pc !== '') {
            $sp = strrpos($pc, ' ');
            if ($sp !== false && $sp > 0) {
                $cN = trim(substr($pc, 0, $sp));
                $cP = trim(substr($pc, $sp + 1));
                if ($cN !== '' && $cP !== '') {
                    return ['nivelRaw' => $cN, 'parametroRaw' => $cP];
                }
            }
        }
        if ($n !== '' || $p !== '') {
            return ['nivelRaw' => $n, 'parametroRaw' => $p];
        }
        if ($pc !== '') {
            return ['nivelRaw' => '', 'parametroRaw' => $pc];
        }

        return ['nivelRaw' => '', 'parametroRaw' => ''];
    }
}

if (!function_exists('estcumpl_muestras_tp_strip_accents_for_key')) {
    function estcumpl_muestras_tp_strip_accents_for_key(string $key): string
    {
        $key = str_replace(['Ñ', 'ñ'], ['N', 'n'], $key);
        if (function_exists('normalizer_normalize')) {
            $formD = class_exists('Normalizer') ? Normalizer::FORM_D : 4;
            $nf = normalizer_normalize($key, $formD);
            if (is_string($nf)) {
                return preg_replace('/\p{Mn}+/u', '', $nf) ?? $nf;
            }
        }
        return str_replace(
            ['á', 'à', 'ä', 'â', 'ã', 'Á', 'À', 'Ä', 'Â', 'Ã',
             'é', 'è', 'ë', 'ê', 'É', 'È', 'Ë', 'Ê',
             'í', 'ì', 'ï', 'î', 'Í', 'Ì', 'Ï', 'Î',
             'ó', 'ò', 'ö', 'ô', 'õ', 'Ó', 'Ò', 'Ö', 'Ô', 'Õ',
             'ú', 'ù', 'ü', 'û', 'Ú', 'Ù', 'Ü', 'Û',
             'ý', 'ÿ', 'Ý'],
            ['a', 'a', 'a', 'a', 'a', 'A', 'A', 'A', 'A', 'A',
             'e', 'e', 'e', 'e', 'E', 'E', 'E', 'E',
             'i', 'i', 'i', 'i', 'I', 'I', 'I', 'I',
             'o', 'o', 'o', 'o', 'o', 'O', 'O', 'O', 'O', 'O',
             'u', 'u', 'u', 'u', 'U', 'U', 'U', 'U',
             'y', 'y', 'Y'],
            $key
        );
    }
}

if (!function_exists('estcumpl_muestras_tp_clean_key_base')) {
    /** Misma lógica que `est2_tp_clean_key` en guardar_estandares (claves san_dim_*). */
    function estcumpl_muestras_tp_clean_key_base(string $key): string
    {
        $key = strtoupper(trim(estcumpl_muestras_tp_strip_accents_for_key($key)));
        $key = preg_replace('/[^A-Z0-9_]/', '_', $key);
        $key = preg_replace('/_+/', '_', $key);

        return trim((string) $key, '_');
    }
}

if (!function_exists('estcumpl_muestras_sufijo_key_desde_campo_lab')) {
    /**
     * Sufijo de parametroKey según campo lab (resultado cuantitativo).
     * dato → cadena vacía; gmean → TITULOS (prom. JEM); cv → CV; sd → SD; etc.
     */
    function estcumpl_muestras_sufijo_key_desde_campo_lab(string $campoLab): string
    {
        $l = strtolower(trim($campoLab));
        if ($l === '' || $l === 'dato') {
            return '';
        }
        $map = [
            'gmean' => 'TITULOS',
            'cv' => 'CV',
            'sd' => 'SD',
            'count' => 'COUNT',
            'sp' => 'SP',
            'cv_sp' => 'CV_SP',
            'pct_positivos' => 'PCT_POSITIVOS',
            'pct_sospechosos' => 'PCT_SOSPECHOSOS',
            'pct_negativos' => 'PCT_NEGATIVOS',
            'obs' => 'OBS',
        ];
        if (isset($map[$l])) {
            return $map[$l];
        }
        if (preg_match('/^s(\d{1,2})$/', $l, $m)) {
            $n = (int) $m[1];
            if ($n >= 0 && $n <= 24) {
                return 'S' . $n;
            }
        }

        return estcumpl_muestras_tp_clean_key_base($l);
    }
}

if (!function_exists('estcumpl_muestras_parametro_key_desde_analisis_lab')) {
    /**
     * parametroKey = clave del nombre de análisis + sufijo por campo lab (origen muestras / san_dim_analisis).
     * Ej.: Mesofilos + gmean → MESOFILOS_TITULOS; + dato → MESOFILOS.
     */
    function estcumpl_muestras_parametro_key_desde_analisis_lab(string $nomAnalisis, string $campoLab): string
    {
        $base = estcumpl_muestras_tp_clean_key_base($nomAnalisis);
        if ($base === '') {
            return '';
        }
        $suf = estcumpl_muestras_sufijo_key_desde_campo_lab($campoLab);

        return $suf !== '' ? $base . '_' . $suf : $base;
    }
}

if (!function_exists('estcumpl_muestras_parametro_key_desde_tipo_analisis_lab')) {
    /**
     * Identidad estable muestras/hisopado: (ubicación/tipo × análisis × campoLab).
     * Evita colisiones cuando varias filas comparten solo el tipo de muestra (HISOPADO_CORTINAS_…).
     * Ej.: "Hisopado Galpón: Cortinas Laterales" + Mesofilos + dato → HISOPADO_GALPON_CORTINAS_LATERALES_MESOFILOS
     */
    function estcumpl_muestras_parametro_key_desde_tipo_analisis_lab(
        string $nomTipoMuestra,
        string $nomAnalisis,
        string $campoLab
    ): string {
        $tipoKey = estcumpl_muestras_tp_clean_key_base($nomTipoMuestra);
        $anKey = estcumpl_muestras_parametro_key_desde_analisis_lab($nomAnalisis, $campoLab);
        if ($tipoKey === '') {
            return $anKey;
        }
        if ($anKey === '') {
            return $tipoKey;
        }
        if (strcasecmp($tipoKey, $anKey) === 0) {
            return $anKey;
        }
        /* Evitar TIPO_TIPO si el análisis ya está embebido al final. */
        if (substr($tipoKey, -strlen($anKey) - 1) === '_' . $anKey) {
            return $tipoKey;
        }

        return $tipoKey . '_' . $anKey;
    }
}

if (!function_exists('estcumpl_muestras_parametro_nombre_desde_analisis_lab')) {
    /**
     * Texto parametroNombre en columna Parámetro: "Analisis - …" según campo lab (misma regla que dashboard EST2).
     */
    function estcumpl_muestras_parametro_nombre_desde_analisis_lab(string $nomAnalisis, string $campoLab): string
    {
        $na = trim($nomAnalisis);
        if ($na === '') {
            return '';
        }
        $l = strtolower(trim($campoLab));
        if ($l === '' || $l === 'dato') {
            return $na;
        }
        $especiales = [
            'gmean' => 'Titulos',
            'cv' => 'Coeficiente de Variacion',
            'sd' => 'Desviacion estandar',
        ];
        if (isset($especiales[$l])) {
            return $na . ' - ' . $especiales[$l];
        }
        $labels = [
            'count' => 'N (count)',
            'sp' => 'SP',
            'cv_sp' => 'CV SP',
            'pct_positivos' => '% Positivos',
            'pct_sospechosos' => '% SOS',
            'pct_negativos' => '% Negativos',
            'obs' => 'Observación',
        ];
        for ($i = 0; $i <= 24; $i++) {
            $labels['s' . $i] = 'S' . $i;
        }
        $sufLab = $labels[$l] ?? strtoupper($l);

        return $na . ' - ' . $sufLab;
    }
}

if (!function_exists('estcumpl_whitelist_campo_lab')) {
    /** Misma lista conceptual que guardar_estandares.php ($est2CamposComparaLabPerm). */
    function estcumpl_whitelist_campo_lab(): array {
        $a = ['dato', 'gmean', 'cv', 'sd', 'count', 'sp', 'cv_sp', 'pct_positivos', 'pct_sospechosos', 'pct_negativos', 'obs'];
        for ($i = 0; $i <= 24; $i++) {
            $a[] = 's' . $i;
        }
        return $a;
    }
}

if (!function_exists('estcumpl_pollobb_serologia_nom_muestra_variantes')) {
    /**
     * Nombres de muestra en solicitud (san_fact_solicitud_det.nomMuestra) para serología pollo BB.
     * Alineados al árbol de programas y a mapeo_nom_muestra_a_tipo en informes.
     *
     * @return list<string>
     */
    function estcumpl_pollobb_serologia_nom_muestra_variantes(): array {
        return [
            'Resultado serológico de pollo BB',
            'Resultado serologico de pollo BB',
            'Resultado serológico de pollo BB.',
            'Resultado serologico de pollo BB.',
            /** En solicitud muchas filas usan el texto corto (p. ej. paquetes de sueros). */
            'Sueros',
        ];
    }
}

if (!function_exists('estcumpl_pollobb_serologia_tipo_estandar_display')) {
    /** Texto de tipo en detalle de estándar tras mapeo desde solicitud. */
    function estcumpl_pollobb_serologia_tipo_estandar_display(): string {
        return 'Serología pollo BB';
    }
}

if (!function_exists('estcumpl_pollobb_serologia_campo_compara_lab_default')) {
    /**
     * Campo en san_analisis_pollo_bb_adulto recomendado para comparar en filas tipoParametro=muestras
     * cuando infoOrigen no define campoComparaLab (cuantitativo típico).
     */
    function estcumpl_pollobb_serologia_campo_compara_lab_default(): string {
        return 'gmean';
    }
}

if (!function_exists('estcumpl_pollobb_solicitud_es_serologia_bb')) {
    /**
     * Indica si nomMuestra corresponde al proceso de serología pollo BB (no confundir con pollo adulto).
     */
    function estcumpl_pollobb_solicitud_es_serologia_bb(?string $nomMuestra): bool {
        $nom = trim((string) $nomMuestra);
        if ($nom === '') {
            return false;
        }
        foreach (estcumpl_pollobb_serologia_nom_muestra_variantes() as $v) {
            if (strcasecmp($nom, $v) === 0) {
                return true;
            }
        }
        $n = mb_strtolower(rtrim($nom, '.'), 'UTF-8');
        $n = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'],
            ['a', 'e', 'i', 'o', 'u', 'u', 'n'],
            $n
        );
        $n = preg_replace('/\s+/', ' ', $n);
        $n = trim((string) $n);

        return $n === 'resultado serologico de pollo bb' || $n === 'sueros';
    }
}

if (!function_exists('estcumpl_whitelist_campo_necro')) {
    function estcumpl_whitelist_campo_necro(): array {
        return ['tporcentajetotal', 'tporcentaje1', 'tporcentaje2', 'tporcentaje3', 'tporcentaje4', 'tporcentaje5'];
    }
}

if (!function_exists('estcumpl_col_exists')) {
    function estcumpl_col_exists(mysqli $conn, string $tabla, string $col): bool {
        static $cache = [];
        $tablaClean = str_replace(['`', ';'], '', $tabla);
        $colClean   = str_replace(['`', ';'], '', $col);
        if ($tablaClean === '' || $colClean === '') {
            return false;
        }
        $key = $tablaClean . "\0" . $colClean;
        if (array_key_exists($key, $cache)) {
            return $cache[$key];
        }
        $q = @$conn->query("SHOW COLUMNS FROM `{$tablaClean}` LIKE '" . $conn->real_escape_string($colClean) . "'");
        return $cache[$key] = ($q && $q->num_rows > 0);
    }
}

if (!function_exists('estcumpl_stmt_fetch_all_assoc')) {
    /**
     * Filas asociativas de un SELECT ya ejecutado en $st.
     * Sin mysqlnd, get_result() falla: se usa store_result + bind_result.
     * En PHP 8+ bind_result con &$arr['col'] falla; se usan columnas por índice.
     *
     * @return list<array<string,mixed>>
     */
    function estcumpl_stmt_fetch_all_assoc(mysqli_stmt $st): array {
        $rs = @$st->get_result();
        if ($rs instanceof mysqli_result) {
            $out = [];
            while ($row = $rs->fetch_assoc()) {
                $out[] = $row;
            }
            $rs->free();

            return $out;
        }
        if (!$st->store_result()) {
            return [];
        }
        $meta = $st->result_metadata();
        if (!$meta) {
            return [];
        }
        $colNames = [];
        $i = 0;
        while ($field = $meta->fetch_field()) {
            $name = trim((string)($field->name ?? ''));
            if ($name === '') {
                $name = 'col_' . $i;
            }
            $colNames[] = $name;
            $i++;
        }
        $meta->free();
        $n = count($colNames);
        if ($n === 0) {
            return [];
        }
        $rowVals = array_fill(0, $n, null);
        $bindRefs = [];
        for ($j = 0; $j < $n; $j++) {
            $bindRefs[] = &$rowVals[$j];
        }
        if (!call_user_func_array([$st, 'bind_result'], $bindRefs)) {
            return [];
        }
        $out = [];
        while ($st->fetch()) {
            $assoc = [];
            for ($j = 0; $j < $n; $j++) {
                $assoc[$colNames[$j]] = $rowVals[$j];
            }
            $out[] = $assoc;
        }
        $st->free_result();

        return $out;
    }
}

if (!function_exists('estcumpl_param_variants_temperatura_cono')) {
    function estcumpl_param_variants_temperatura_cono(string $parametroEstandarRaw): array {
        $base = mb_strtolower(trim($parametroEstandarRaw), 'UTF-8');
        $base = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'],
            ['a', 'e', 'i', 'o', 'u', 'u', 'n'],
            $base
        );
        $base = preg_replace('/\s+/', ' ', $base);
        $base = trim((string)$base);
        $out = [];
        if ($base !== '') {
            $out[$base] = true;
        }
        foreach (['temperatura de cono', 'temperatura de conos', 'temp. de cono', 'temp de cono'] as $syn) {
            $n = mb_strtolower($syn, 'UTF-8');
            $out[$n] = true;
        }
        return array_keys($out);
    }
}

if (!function_exists('estcumpl_regnocontable_tproceso_permitidos')) {
    /**
     * Alineado a comparativo2_fuentes_util.php (regnocontable).
     *
     * @return list<string>
     */
    function estcumpl_regnocontable_tproceso_permitidos(): array {
        return ['TEMP_CONO', 'RESPIRATORIO', 'DIGESTIVO', 'CLORO', 'COLOR', 'PLAGAS', 'EVA_GORGOJO', 'ACTAENTREGA', 'DESINFECCION', 'DESINFECCION_LD'];
    }
}

if (!function_exists('estcumpl_regnocontable_campo_valor_permitidos')) {
    /**
     * Campos / métricas admitidos en infoOrigen.campoValor (extensible).
     * Métricas plagas_* solo aplican con tproceso=PLAGAS (validar al guardar y en UI).
     */
    function estcumpl_regnocontable_campo_valor_permitidos(): array {
        return [
            'tcantidad',
            'plagas_pct_consumo',
            'plagas_roedores_vivos',
            'plagas_roedores_muertos',
            'gorgojo_prom_larva',
            'gorgojo_prom_adulto',
            'tsexo',
            'tiempo_retiro_guano',
            'tiempo_reuso_cama',
            'tiempo_limpieza_desinfeccion',
            'tiempo_descanso_efectivo',
            'tiempo_descanso_total',
        ];
    }
}

if (!function_exists('estcumpl_param_variants_gorgojo')) {
    /**
     * Variantes de texto para alinear filas de estándar con merge EVA_GORGOJO (prom. larva/adulto).
     *
     * @return list<string>
     */
    function estcumpl_param_variants_gorgojo(string $parametroEstandarRaw): array
    {
        $base = mb_strtolower(trim($parametroEstandarRaw), 'UTF-8');
        $base = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', '°'],
            ['a', 'e', 'i', 'o', 'u', 'u', 'n', ''],
            $base
        );
        $base = preg_replace('/\s+/', ' ', $base);
        $base = trim((string) $base);
        $out = [];
        if ($base !== '') {
            $out[$base] = true;
        }
        foreach (['gorgojo', 'gorgojos', 'evaluacion gorgojos', 'eva gorgojo', 'prom larva', 'prom adulto', 'promedio larva', 'promedio adulto'] as $syn) {
            $out[mb_strtolower($syn, 'UTF-8')] = true;
        }

        return array_keys($out);
    }
}

if (!function_exists('estcumpl_regnocontable_campo_valor_gorgojo_resolve')) {
    /**
     * Resuelve campoValor para EVA_GORGOJO (prom. larva / adulto) desde JSON y textos de fila.
     * Misma regla en merge, mapeo del informe y lectura del PDF para alinear claves de storage.
     *
     * @return string Lowercase: gorgojo_prom_larva | gorgojo_prom_adulto | u otro (p. ej. tcantidad sin inferir).
     */
    function estcumpl_regnocontable_campo_valor_gorgojo_resolve(
        string $campoValorLower,
        string $parametroRaw,
        string $nivelRaw
    ): string {
        $cv = strtolower(trim($campoValorLower));
        if (in_array($cv, ['gorgojo_prom_larva', 'gorgojo_prom_adulto'], true)) {
            return $cv;
        }
        $pr = mb_strtolower(trim($parametroRaw), 'UTF-8');
        $nv = mb_strtolower(trim($nivelRaw), 'UTF-8');
        $blob = $pr . ' ' . $nv;
        if (strpos($blob, 'adulto') !== false) {
            return 'gorgojo_prom_adulto';
        }
        if (strpos($blob, 'larva') !== false) {
            return 'gorgojo_prom_larva';
        }
        if ($cv === 'tcantidad' && (strpos($blob, 'gorgojo') !== false || strpos($blob, 'evaluacion') !== false)) {
            return 'gorgojo_prom_larva';
        }

        return $cv;
    }
}

if (!function_exists('estcumpl_temp_cono_dia_medicion_valido')) {
    /**
     * Día de medición 1–5 (columna ttipo en regnocontable para TEMP_CONO).
     */
    function estcumpl_temp_cono_dia_medicion_valido($v): ?int {
        if ($v === null || $v === '') {
            return null;
        }
        if (is_numeric($v)) {
            $n = (int) $v;

            return ($n >= 1 && $n <= 5) ? $n : null;
        }

        return null;
    }
}

if (!function_exists('estcumpl_temp_cono_dia_medicion_desde_inf')) {
    /**
     * @param array<string,mixed> $inf infoOrigen estándar
     */
    function estcumpl_temp_cono_dia_medicion_desde_inf(array $inf): ?int {
        foreach (['diaMedicion', 'dia_medicion', 'diaCono'] as $k) {
            if (!array_key_exists($k, $inf)) {
                continue;
            }
            $n = estcumpl_temp_cono_dia_medicion_valido($inf[$k]);

            if ($n !== null) {
                return $n;
            }
        }

        return null;
    }
}

if (!function_exists('estcumpl_temp_cono_indice_cono_desde_tsexo')) {
    /**
     * tsexo en regnocontable: cono 1–10 (numérico o letra A–J).
     */
    function estcumpl_temp_cono_indice_cono_desde_tsexo(?string $raw): ?int {
        if ($raw === null) {
            return null;
        }
        $s = strtoupper(trim($raw));
        if ($s === '') {
            return null;
        }
        if (ctype_digit($s)) {
            $n = (int) $s;

            return ($n >= 1 && $n <= 10) ? $n : null;
        }
        if (strlen($s) === 1 && $s >= 'A' && $s <= 'J') {
            return ord($s) - ord('A') + 1;
        }

        return null;
    }
}

if (!function_exists('estcumpl_eval_temp_cono_diez_conos')) {
    /**
     * Evalúa los 10 conos. Resumen: CUMPLE solo si los 10 tienen dato y todos en [stdMin, stdMax].
     * Si falta algún cono → SIN REGISTRO (con detalle por fila para informes).
     *
     * @param array<int,float|int|string> $conosPorIndice claves 1..10
     * @return array{estado:string,valor:?float,texto:string,conos:list<array{indice:int,valor:?float,estado:string}>}
     */
    function estcumpl_eval_temp_cono_diez_conos(array $conosPorIndice, $stdMin, $stdMax): array {
        $conosRows = [];
        $valsNumeric = [];
        $partes = [];
        for ($ci = 1; $ci <= 10; $ci++) {
            $rawV = null;
            if (array_key_exists($ci, $conosPorIndice)) {
                $rawV = $conosPorIndice[$ci];
            } elseif (array_key_exists((string) $ci, $conosPorIndice)) {
                $rawV = $conosPorIndice[(string) $ci];
            }
            if ($rawV === null || (is_string($rawV) && trim($rawV) === '')) {
                $conosRows[] = ['indice' => $ci, 'valor' => null, 'estado' => 'SIN DATO'];
                continue;
            }
            $vi = (float) $rawV;
            $valsNumeric[$ci] = $vi;
            $partes[] = 'C' . $ci . ': ' . rtrim(rtrim(number_format($vi, 2, '.', ''), '0'), '.');
            $okMin = $stdMin === null ? true : ($vi >= (float) $stdMin);
            $okMax = $stdMax === null ? true : ($vi <= (float) $stdMax);
            $conosRows[] = [
                'indice' => $ci,
                'valor' => $vi,
                'estado' => ($okMin && $okMax) ? 'CUMPLE' : 'INCUMPLE',
            ];
        }
        $texto = implode(' · ', $partes);

        if (count($valsNumeric) < 10) {
            return [
                'estado' => 'SIN REGISTRO',
                'valor' => null,
                'texto' => $texto,
                'conos' => $conosRows,
            ];
        }
        $inc = false;
        foreach ($conosRows as $row) {
            if (($row['estado'] ?? '') === 'INCUMPLE') {
                $inc = true;
                break;
            }
        }
        $valorMax = max($valsNumeric);

        return [
            'estado' => $inc ? 'INCUMPLE' : 'CUMPLE',
            'valor' => $valorMax,
            'texto' => $texto,
            'conos' => $conosRows,
        ];
    }
}

if (!function_exists('estcumpl_regnocontable_fecha_expr')) {
    function estcumpl_regnocontable_fecha_expr(mysqli $conn, string $tablaRegno, string $tprocUpper): string {
        if ($tprocUpper === 'TEMP_CONO' || $tprocUpper === 'EVA_GORGOJO' || $tprocUpper === 'DESINFECCION' || $tprocUpper === 'DESINFECCION_LD') {
            if (estcumpl_col_exists($conn, $tablaRegno, 'tfec_ini')) {
                return 'COALESCE(DATE(tfec_ini), DATE(tfectra))';
            }
        }
        return 'DATE(tfectra)';
    }
}

if (!function_exists('estcumpl_regnocontable_inferir_tproceso_std')) {
    /**
     * Si infoOrigen no incluye tproceso (p. ej. filas guardadas antes del metadato o JSON vacío),
     * infiere TEMP_CONO cuando el parámetro del estándar es temperatura de cono(s), alineado a dashboard-estandares2.
     *
     * @param array<string,mixed> $std entrada de motor (nivelRaw, parametroRaw, paramVariants, infoOrigen, tipoParametro)
     */
    function estcumpl_regnocontable_inferir_tproceso_std(array $std): string {
        $inf = estcumpl_info_origen_array($std['infoOrigen'] ?? []);
        $t = strtoupper(trim((string)($inf['tproceso'] ?? '')));
        if ($t !== '' && in_array($t, estcumpl_regnocontable_tproceso_permitidos(), true)) {
            return $t;
        }
        $cv = strtolower(trim((string)($inf['campoValor'] ?? '')));
        if (in_array($cv, ['gorgojo_prom_larva', 'gorgojo_prom_adulto'], true)) {
            return 'EVA_GORGOJO';
        }
        if (in_array($cv, ['plagas_pct_consumo', 'plagas_roedores_vivos', 'plagas_roedores_muertos'], true)) {
            return 'PLAGAS';
        }
        if (in_array($cv, ['tiempo_retiro_guano', 'tiempo_reuso_cama'], true)) {
            return 'DESINFECCION';
        }
        if (in_array($cv, ['tiempo_limpieza_desinfeccion', 'tiempo_descanso_efectivo', 'tiempo_descanso_total'], true)) {
            return 'DESINFECCION_LD';
        }
        $paramRaw = (string)($std['parametroRaw'] ?? '');
        $nivelRaw = (string)($std['nivelRaw'] ?? '');
        $blobSoloParamNivel = mb_strtolower(trim(preg_replace('/\s+/', ' ', $paramRaw . ' ' . $nivelRaw)), 'UTF-8');
        $blobSoloParamNivel = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'],
            ['a', 'e', 'i', 'o', 'u', 'u', 'n'],
            $blobSoloParamNivel
        );
        /** Sinónimos “solo térmicos” que estcumpl_param_variants_temperatura_cono() inyecta siempre: no deben implicar TEMP_CONO si el texto real del parámetro/nivel no lo menciona. */
        $tempConoGenericExact = ['temperatura de cono', 'temperatura de conos', 'temp. de cono', 'temp de cono'];
        $chunks = [];
        if (!empty($std['paramVariants']) && is_array($std['paramVariants'])) {
            foreach ($std['paramVariants'] as $pv) {
                $pvNorm = mb_strtolower(trim(preg_replace('/\s+/', ' ', (string)$pv)), 'UTF-8');
                $pvNorm = str_replace(
                    ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'],
                    ['a', 'e', 'i', 'o', 'u', 'u', 'n'],
                    $pvNorm
                );
                if (in_array($pvNorm, $tempConoGenericExact, true)) {
                    $enTextoReal = false;
                    foreach ($tempConoGenericExact as $syn) {
                        if (strpos($blobSoloParamNivel, $syn) !== false) {
                            $enTextoReal = true;
                            break;
                        }
                    }
                    if (!$enTextoReal) {
                        continue;
                    }
                }
                $chunks[] = (string)$pv;
            }
        }
        $chunks[] = $paramRaw;
        $chunks[] = $nivelRaw;
        $blob = mb_strtolower(trim(preg_replace('/\s+/', ' ', implode(' ', $chunks))), 'UTF-8');
        $blob = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'],
            ['a', 'e', 'i', 'o', 'u', 'u', 'n'],
            $blob
        );
        if ($blob === '') {
            return '';
        }
        if (strpos($blob, 'gorgojo') !== false) {
            return 'EVA_GORGOJO';
        }
        foreach (['temperatura de cono', 'temperatura de conos', 'temp. de cono', 'temp de cono'] as $syn) {
            if (strpos($blob, $syn) !== false) {
                return 'TEMP_CONO';
            }
        }
        $tieneCono = strpos($blob, 'cono') !== false;
        $tieneTemp = strpos($blob, 'temperatura') !== false
            || strpos($blob, 'temp.') !== false
            || preg_match('/\btemp\b/', $blob) === 1;
        if ($tieneCono && $tieneTemp) {
            return 'TEMP_CONO';
        }

        $roed = (strpos($blob, 'roedor') !== false || strpos($blob, 'raton') !== false || strpos($blob, 'rata') !== false);
        if ($roed) {
            if (strpos($blob, 'consumo') !== false || strpos($blob, '%') !== false
                || strpos($blob, 'porcentaje') !== false || strpos($blob, 'por ciento') !== false
                || strpos($blob, 'muert') !== false || preg_match('/\bviv/', $blob) === 1
                || strpos($blob, 'evaluacion') !== false) {
                return 'PLAGAS';
            }
        }

        return '';
    }
}

if (!function_exists('estcumpl_regnocontable_blob_texto_param_nivel')) {
    function estcumpl_regnocontable_blob_texto_param_nivel(string $parametroRaw, string $nivelRaw): string {
        $s = mb_strtolower(trim(preg_replace('/\s+/', ' ', $parametroRaw . ' ' . $nivelRaw)), 'UTF-8');

        return str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'],
            ['a', 'e', 'i', 'o', 'u', 'u', 'n'],
            $s
        );
    }
}

if (!function_exists('estcumpl_regnocontable_inferir_plaga_roedor_desde_texto')) {
    /**
     * Desambigua métricas regnocontable PLAGAS (roedores) cuando falta o está mal campoValor/ttipo en infoOrigen.
     *
     * @return array{campo: string, ttipo?: string}|null ttipo solo para plagas_pct_consumo (P perímetro / T techo)
     */
    function estcumpl_regnocontable_inferir_plaga_roedor_desde_texto(string $parametroRaw, string $nivelRaw): ?array {
        $blob = estcumpl_regnocontable_blob_texto_param_nivel($parametroRaw, $nivelRaw);
        if ($blob === '') {
            return null;
        }
        $ctx = (strpos($blob, 'roedor') !== false || strpos($blob, 'raton') !== false || strpos($blob, 'rata') !== false
            || (strpos($blob, 'cebo') !== false && strpos($blob, 'consumo') !== false));
        if (!$ctx) {
            return null;
        }
        if (strpos($blob, 'muert') !== false) {
            return ['campo' => 'plagas_roedores_muertos'];
        }
        $pctCue = (strpos($blob, 'consumo') !== false || strpos($blob, '%') !== false
            || strpos($blob, 'porcentaje') !== false || strpos($blob, 'por ciento') !== false);
        if ($pctCue && strpos($blob, 'perimetro') !== false) {
            return ['campo' => 'plagas_pct_consumo', 'ttipo' => 'P'];
        }
        if ($pctCue && strpos($blob, 'techo') !== false) {
            return ['campo' => 'plagas_pct_consumo', 'ttipo' => 'T'];
        }
        if (preg_match('/\bviv/', $blob) === 1 || strpos($blob, 'vivo') !== false || strpos($blob, 'vivos') !== false) {
            return ['campo' => 'plagas_roedores_vivos'];
        }
        /** "Evaluación: Roedores." u otro título sin métrica explícita (historia clínica / PDF). */
        if (strpos($blob, 'evaluacion') !== false) {
            return ['campo' => 'plagas_roedores_vivos'];
        }

        return null;
    }
}

if (!function_exists('estcumpl_regnocontable_enriquecer_inf_plagas_roedores')) {
    /**
     * Completa infoOrigen para filas PLAGAS/roedores a partir del texto del parámetro y del nivel.
     *
     * @param array<string,mixed> $inf
     */
    function estcumpl_regnocontable_enriquecer_inf_plagas_roedores(array &$inf, string $parametroRaw, string $nivelRaw): void {
        $tproc = strtoupper(trim((string)($inf['tproceso'] ?? '')));
        if ($tproc !== '' && $tproc !== 'PLAGAS') {
            return;
        }
        $hit = estcumpl_regnocontable_inferir_plaga_roedor_desde_texto($parametroRaw, $nivelRaw);
        if ($hit === null) {
            return;
        }
        $inf['campoValor'] = $hit['campo'];
        if (isset($hit['ttipo'])) {
            $inf['ttipo'] = $hit['ttipo'];
        }
        $inf['tproceso'] = 'PLAGAS';
    }
}

if (!function_exists('estcumpl_regnocontable_metric_storage_suffix')) {
    /**
     * Sufijo para desambiguar varias filas de estándar (mismo nivel + misma variante de texto)
     * que usan distinto campoValor (p. ej. PLAGAS: % consumo vs vivos vs muertos).
     */
    function estcumpl_regnocontable_metric_storage_suffix(string $campo): ?string {
        $c = strtolower(trim($campo));
        $plagasSolo = ['plagas_pct_consumo', 'plagas_roedores_vivos', 'plagas_roedores_muertos'];
        $gorgojoSolo = ['gorgojo_prom_larva', 'gorgojo_prom_adulto'];
        $tiemposSolo = ['tiempo_retiro_guano', 'tiempo_reuso_cama'];
        $tiemposLd = ['tiempo_limpieza_desinfeccion', 'tiempo_descanso_efectivo', 'tiempo_descanso_total'];
        if (in_array($c, array_merge($plagasSolo, $gorgojoSolo, $tiemposSolo, $tiemposLd), true)) {
            return $c;
        }

        return null;
    }
}

if (!function_exists('estcumpl_regnocontable_storage_key_param')) {
    function estcumpl_regnocontable_storage_key_param(string $paramVariantNorm, string $campo): string {
        $pvn = trim($paramVariantNorm);
        $suf = estcumpl_regnocontable_metric_storage_suffix($campo);
        if ($suf !== null && $pvn !== '') {
            return $pvn . '|' . $suf;
        }

        return $pvn;
    }
}

if (!function_exists('estcumpl_regnocontable_desinfeccion_inner_geo_sql')) {
    /**
     * Filtros granja/campaña dentro del subquery (tabla evento) para acotar el JOIN antes del GROUP BY externo.
     *
     * @return array{sql:string, types:string, bind:list<mixed>}
     */
    function estcumpl_regnocontable_desinfeccion_inner_geo_sql(
        ?string $filtroCampania3,
        array $filtroGranjas,
        string $alias = 'a'
    ): array {
        $pfx = $alias === '' ? '' : rtrim($alias, '.') . '.';
        $sql = '';
        $types = '';
        $bind = [];
        if ($filtroCampania3 !== null && trim((string) $filtroCampania3) !== '') {
            $c3 = substr(str_pad(trim((string) $filtroCampania3), 3, '0', STR_PAD_LEFT), 0, 3);
            $sql .= " AND RIGHT(TRIM({$pfx}tcencos), 3) = ?";
            $types .= 's';
            $bind[] = $c3;
        }
        $granjas = [];
        foreach ($filtroGranjas as $g) {
            $g = substr(str_pad(trim((string) $g), 3, '0', STR_PAD_LEFT), 0, 3);
            if ($g !== '') {
                $granjas[$g] = true;
            }
        }
        $granjas = array_keys($granjas);
        if ($granjas !== []) {
            $ph = implode(',', array_fill(0, count($granjas), '?'));
            $sql .= " AND LEFT(TRIM({$pfx}tcencos), 3) IN ($ph)";
            foreach ($granjas as $g) {
                $types .= 's';
                $bind[] = $g;
            }
        }

        return ['sql' => $sql, 'types' => $types, 'bind' => $bind];
    }
}

if (!function_exists('estcumpl_regnocontable_desinfeccion_tiempo_inner_sql')) {
    /**
     * Subquery DESINFECCION (retiro guano / reuso cama): JOIN + MAX en lugar de subconsultas correlacionadas por fila.
     */
    function estcumpl_regnocontable_desinfeccion_tiempo_inner_sql(
        string $tbl,
        int $tipoPrim,
        int $tipoSeg,
        string $fecInner,
        string $sqlFechaInner,
        string $geoInnerSql
    ): string {
        return "SELECT {$fecInner} AS fecha_ref,
                           LEFT(TRIM(a.tcencos), 3) AS granja,
                           RIGHT(TRIM(a.tcencos), 3) AS campania,
                           TRIM(a.tcodint) AS galpon,
                           (DATEDIFF(DATE(a.tfec_ini), DATE(MAX(c.tfec_ini))) + 1) AS vdiff
                    FROM `{$tbl}` AS a
                    INNER JOIN `{$tbl}` AS c
                        ON TRIM(c.tcencos) = TRIM(a.tcencos)
                       AND TRIM(c.tcodint) = TRIM(a.tcodint)
                       AND UPPER(TRIM(c.tproceso)) = 'DESINFECCION'
                       AND CAST(COALESCE(NULLIF(TRIM(c.ttipo),''),'0') AS UNSIGNED) = {$tipoSeg}
                       AND c.tfec_ini IS NOT NULL
                       AND c.tfec_ini <= a.tfec_ini
                    WHERE UPPER(TRIM(a.tproceso)) = 'DESINFECCION'
                      AND CAST(COALESCE(NULLIF(TRIM(a.ttipo),''),'0') AS UNSIGNED) = {$tipoPrim}
                      {$sqlFechaInner}
                      AND TRIM(a.tcencos) <> ''
                      AND TRIM(a.tcodint) <> ''
                      AND a.tfec_ini IS NOT NULL
                      {$geoInnerSql}
                      AND NOT EXISTS (
                          SELECT 1 FROM `{$tbl}` AS a2
                          WHERE UPPER(TRIM(a2.tproceso)) = 'DESINFECCION'
                            AND CAST(COALESCE(NULLIF(TRIM(a2.ttipo),''),'0') AS UNSIGNED) = {$tipoPrim}
                            AND TRIM(a2.tcencos) = TRIM(a.tcencos)
                            AND TRIM(a2.tcodint) = TRIM(a.tcodint)
                            AND a2.tfec_ini IS NOT NULL
                            AND a2.tfec_ini > a.tfec_ini
                      )
                    GROUP BY {$fecInner}, a.tfec_ini, a.tcencos, a.tcodint";
    }
}

if (!function_exists('estcumpl_campania_siguiente_3')) {
    /** Campaña siguiente (3 dígitos): 060 → 061, misma granja. */
    function estcumpl_campania_siguiente_3(string $camp3): string
    {
        $c = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        $n = (int) $c;

        return str_pad((string) ($n + 1), 3, '0', STR_PAD_LEFT);
    }
}

if (!function_exists('estcumpl_campania_anterior_3')) {
    /** Campaña anterior (3 dígitos varchar): 062 → 061, 001 → 000. */
    function estcumpl_campania_anterior_3(string $camp3): string
    {
        $c = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        $n = (int) $c;

        return str_pad((string) max(0, $n - 1), 3, '0', STR_PAD_LEFT);
    }
}

if (!function_exists('estcumpl_regno_hc_merge_cache_reset')) {
    /** Reinicia caches request-scoped usados por Generar HC (llamar al inicio de hc_build_matriz_programas_new). */
    function estcumpl_regno_hc_merge_cache_reset(): void
    {
        estcumpl_regno_hc_merge_cache_store(true);
        estcumpl_descanso_ld_ctx_cache(true);
        estcumpl_desinfeccion_tiempos_ctx_cache(true);
        estcumpl_limpieza_ld_ctx_cache(true);
    }
}

if (!function_exists('estcumpl_regno_hc_merge_cache_store')) {
    /**
     * @param bool $reset Si true, vacía el cache.
     * @return array<string, array<string, array>>
     */
    function &estcumpl_regno_hc_merge_cache_store(bool $reset = false): array
    {
        static $cache = [];
        if ($reset) {
            $cache = [];
        }

        return $cache;
    }
}

if (!function_exists('estcumpl_regno_hc_merge_cache_key')) {
    /**
     * @param list<string> $filtroGranjas
     * @param array<string,mixed> $inf
     * @param list<string> $paramVariants
     */
    function estcumpl_regno_hc_merge_cache_key(
        string $tproc,
        string $campo,
        ?string $filtroCampania3,
        array $filtroGranjas,
        array $inf,
        string $nivelNorm,
        array $paramVariants
    ): string {
        $gSorted = $filtroGranjas;
        sort($gSorted);
        $pvSorted = array_values(array_map('strval', $paramVariants));
        sort($pvSorted);

        return implode("\x1e", [
            $tproc,
            $campo,
            trim((string) ($filtroCampania3 ?? '')),
            implode(',', $gSorted),
            $nivelNorm,
            implode(',', $pvSorted),
            strtoupper(trim((string) ($inf['tnomtipo'] ?? ''))),
            trim((string) ($inf['ttipo'] ?? '')),
            strtoupper(trim((string) ($inf['tproceso'] ?? ''))),
        ]);
    }
}

if (!function_exists('estcumpl_regno_hc_merge_cache_key_desinfeccion_tiempos')) {
    /**
     * Clave de cache HC para DESINFECCION tiempos: solo geo + métrica (no depende de nivelNorm/paramVariants).
     *
     * @param list<string> $filtroGranjas
     */
    function estcumpl_regno_hc_merge_cache_key_desinfeccion_tiempos(
        string $campo,
        ?string $filtroCampania3,
        array $filtroGranjas
    ): string {
        $gSorted = $filtroGranjas;
        sort($gSorted);

        return implode("\x1e", [
            'DESINFECCION_TIEMPOS',
            $campo,
            trim((string) ($filtroCampania3 ?? '')),
            implode(',', $gSorted),
        ]);
    }
}

if (!function_exists('estcumpl_desinfeccion_tiempos_ctx_cache')) {
    /**
     * @param bool $reset
     * @return array<string, array{val:float,fecha_ref:string}|null>
     */
    function &estcumpl_desinfeccion_tiempos_ctx_cache(bool $reset = false): array
    {
        static $ctx = [];
        if ($reset) {
            $ctx = [];
        }

        return $ctx;
    }
}

if (!function_exists('estcumpl_limpieza_ld_ctx_cache')) {
    /**
     * Cache request-scoped para limpieza/desinfección LD (listas tfec_ini e hits por galpón).
     *
     * @param bool $reset
     * @return array<string, mixed>
     */
    function &estcumpl_limpieza_ld_ctx_cache(bool $reset = false): array
    {
        static $ctx = [];
        if ($reset) {
            $ctx = [];
        }

        return $ctx;
    }
}

if (!function_exists('estcumpl_regno_hc_merge_cache_key_limpieza_ld')) {
    /**
     * Clave de cache HC para DESINFECCION_LD limpieza: geo (granja + campaña).
     *
     * @param list<string> $filtroGranjas
     */
    function estcumpl_regno_hc_merge_cache_key_limpieza_ld(
        ?string $filtroCampania3,
        array $filtroGranjas
    ): string {
        $gSorted = $filtroGranjas;
        sort($gSorted);

        return implode("\x1e", [
            'DESINFECCION_LD_LIMPIEZA',
            trim((string) ($filtroCampania3 ?? '')),
            implode(',', $gSorted),
        ]);
    }
}

if (!function_exists('estcumpl_regnocontable_desinfeccion_tfec_ini_list_galpon')) {
    /**
     * Todas las fechas tfec_ini de un ttipo DESINFECCION en granja/campaña/galpón (orden desc).
     *
     * @return list<string>
     */
    function estcumpl_regnocontable_desinfeccion_tfec_ini_list_galpon(
        mysqli $conn,
        string $granja3,
        string $camp3,
        string $galpon,
        int $ttipo
    ): array {
        $tbl = 'regnocontable';
        if (!estcumpl_col_exists($conn, $tbl, 'tfec_ini') || !estcumpl_col_exists($conn, $tbl, 'ttipo')) {
            return [];
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        $gp = trim($galpon);
        if ($g3 === '' || $c3 === '' || $gp === '') {
            return [];
        }
        $cache = &estcumpl_limpieza_ld_ctx_cache();
        $ck = $g3 . '|' . $c3 . '|' . $gp . '|list|' . $ttipo;
        if (array_key_exists($ck, $cache)) {
            return is_array($cache[$ck]) ? $cache[$ck] : [];
        }
        $tcencosLike = $g3 . $c3;
        $sql = "SELECT a.`tfec_ini` AS fec
                FROM `{$tbl}` AS a
                WHERE UPPER(TRIM(a.`tproceso`)) = 'DESINFECCION'
                  AND CAST(COALESCE(NULLIF(TRIM(a.`ttipo`), ''), '0') AS UNSIGNED) = ?
                  AND (
                      TRIM(a.`tcencos`) = ?
                      OR (LEFT(TRIM(a.`tcencos`), 3) = ? AND RIGHT(TRIM(a.`tcencos`), 3) = ?)
                  )
                  AND CAST(COALESCE(NULLIF(TRIM(a.`tcodint`), ''), '0') AS UNSIGNED) = CAST(? AS UNSIGNED)
                  AND a.`tfec_ini` IS NOT NULL
                ORDER BY a.`tfec_ini` DESC";
        $st = $conn->prepare($sql);
        if (!$st) {
            return $cache[$ck] = [];
        }
        $gpNum = ltrim($gp, '0');
        if ($gpNum === '') {
            $gpNum = '0';
        }
        $st->bind_param('issss', $ttipo, $tcencosLike, $g3, $c3, $gpNum);
        $st->execute();
        $rs = $st->get_result();
        $out = [];
        while ($rs && ($row = $rs->fetch_assoc())) {
            $f = trim((string) ($row['fec'] ?? ''));
            if ($f === '' || $f === '0000-00-00' || strpos($f, '0000-00-00') === 0) {
                continue;
            }
            $out[] = $f;
        }
        $st->close();

        return $cache[$ck] = $out;
    }
}

if (!function_exists('estcumpl_regnocontable_limpieza_ld_hits_galpon')) {
    /**
     * Días limpieza/desinfección por galpón: rama A 17←8; si no hay, rama B 22←19.
     *
     * @return list<array{val:float,fecha_ref:string}>
     */
    function estcumpl_regnocontable_limpieza_ld_hits_galpon(
        mysqli $conn,
        string $granja3,
        string $camp3,
        string $galpon
    ): array {
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        $gp = trim($galpon);
        if ($g3 === '' || $c3 === '' || $gp === '') {
            return [];
        }
        $cache = &estcumpl_limpieza_ld_ctx_cache();
        $ck = $g3 . '|' . $c3 . '|' . $gp . '|hits';
        if (array_key_exists($ck, $cache)) {
            return is_array($cache[$ck]) ? $cache[$ck] : [];
        }
        $byFref = [];
        $lista17 = estcumpl_regnocontable_desinfeccion_tfec_ini_list_galpon($conn, $g3, $c3, $gp, 17);
        foreach ($lista17 as $fecPrim) {
            $fecSeg = estcumpl_regnocontable_desinfeccion_max_tfec_ini_galpon($conn, $g3, $c3, $gp, 8, $fecPrim);
            if ($fecSeg === null) {
                continue;
            }
            $tsPrim = strtotime($fecPrim);
            $tsSeg = strtotime($fecSeg);
            if ($tsPrim === false || $tsSeg === false) {
                continue;
            }
            $vdiff = (int) round(($tsPrim - $tsSeg) / 86400) + 1;
            $fref = date('Y-m-d', $tsPrim);
            if (!isset($byFref[$fref]) || $vdiff > (int) $byFref[$fref]['val']) {
                $byFref[$fref] = ['val' => (float) $vdiff, 'fecha_ref' => $fref];
            }
        }
        if ($byFref !== []) {
            return $cache[$ck] = array_values($byFref);
        }
        $lista22 = estcumpl_regnocontable_desinfeccion_tfec_ini_list_galpon($conn, $g3, $c3, $gp, 22);
        foreach ($lista22 as $fecPrim) {
            $fecSeg = estcumpl_regnocontable_desinfeccion_max_tfec_ini_galpon($conn, $g3, $c3, $gp, 19, $fecPrim);
            if ($fecSeg === null) {
                continue;
            }
            $tsPrim = strtotime($fecPrim);
            $tsSeg = strtotime($fecSeg);
            if ($tsPrim === false || $tsSeg === false) {
                continue;
            }
            $vdiff = (int) round(($tsPrim - $tsSeg) / 86400) + 1;
            $fref = date('Y-m-d', $tsPrim);
            if (!isset($byFref[$fref]) || $vdiff > (int) $byFref[$fref]['val']) {
                $byFref[$fref] = ['val' => (float) $vdiff, 'fecha_ref' => $fref];
            }
        }

        return $cache[$ck] = array_values($byFref);
    }
}

if (!function_exists('estcumpl_regnocontable_galpones_limpieza_ld')) {
    /**
     * Galpones con eventos DESINFECCION (ttipo 8/17/19/22) en regnocontable para limpieza LD.
     *
     * @param list<string> $filtroGranjas
     * @param list<array{g?:string,gp?:string}> $filtroGgPares
     * @return list<array{g3:string,gp:string}>
     */
    function estcumpl_regnocontable_galpones_limpieza_ld(
        mysqli $conn,
        array $filtroGranjas,
        array $filtroGgPares,
        string $granja3,
        string $camp3
    ): array {
        $out = [];
        $seen = [];
        foreach ($filtroGgPares as $pr) {
            $g3 = substr(str_pad(trim((string) ($pr['g'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
            $gp = trim((string) ($pr['gp'] ?? ''));
            if ($g3 === $granja3 && $gp !== '' && !isset($seen[$g3 . "\x1e" . $gp])) {
                $seen[$g3 . "\x1e" . $gp] = true;
                $out[] = ['g3' => $g3, 'gp' => $gp];
            }
        }
        if ($out !== []) {
            return $out;
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        if ($g3 === '' || $c3 === ''
            || !estcumpl_col_exists($conn, 'regnocontable', 'tcodint')
            || !estcumpl_col_exists($conn, 'regnocontable', 'ttipo')
            || !estcumpl_col_exists($conn, 'regnocontable', 'tfec_ini')) {
            return [];
        }
        $sql = "SELECT DISTINCT TRIM(`tcodint`) AS galpon
                FROM `regnocontable`
                WHERE UPPER(TRIM(`tproceso`)) = 'DESINFECCION'
                  AND CAST(COALESCE(NULLIF(TRIM(`ttipo`), ''), '0') AS UNSIGNED) IN (8, 17, 19, 22)
                  AND LEFT(TRIM(`tcencos`), 3) = ?
                  AND RIGHT(TRIM(`tcencos`), 3) = ?
                  AND TRIM(`tcodint`) <> ''
                  AND `tfec_ini` IS NOT NULL";
        $st = $conn->prepare($sql);
        if (!$st) {
            return [];
        }
        $st->bind_param('ss', $g3, $c3);
        $st->execute();
        $rs = $st->get_result();
        while ($rs && ($row = $rs->fetch_assoc())) {
            $gp = trim((string) ($row['galpon'] ?? ''));
            if ($gp !== '' && !isset($seen[$g3 . "\x1e" . $gp])) {
                $seen[$g3 . "\x1e" . $gp] = true;
                $out[] = ['g3' => $g3, 'gp' => $gp];
            }
        }
        $st->close();

        return $out;
    }
}

if (!function_exists('estcumpl_regnocontable_desinfeccion_max_tfec_ini_galpon')) {
    /**
     * @return string|null datetime tfec_ini (Y-m-d H:i:s) o fecha
     */
    function estcumpl_regnocontable_desinfeccion_max_tfec_ini_galpon(
        mysqli $conn,
        string $granja3,
        string $camp3,
        string $galpon,
        int $ttipo,
        ?string $tfecIniHasta = null
    ): ?string {
        $tbl = 'regnocontable';
        if (!estcumpl_col_exists($conn, $tbl, 'tfec_ini') || !estcumpl_col_exists($conn, $tbl, 'ttipo')) {
            return null;
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        $gp = trim($galpon);
        if ($g3 === '' || $c3 === '' || $gp === '') {
            return null;
        }
        $tcencosLike = $g3 . $c3;
        $sql = "SELECT MAX(a.`tfec_ini`) AS fec
                FROM `{$tbl}` AS a
                WHERE UPPER(TRIM(a.`tproceso`)) = 'DESINFECCION'
                  AND CAST(COALESCE(NULLIF(TRIM(a.`ttipo`), ''), '0') AS UNSIGNED) = ?
                  AND (
                      TRIM(a.`tcencos`) = ?
                      OR (LEFT(TRIM(a.`tcencos`), 3) = ? AND RIGHT(TRIM(a.`tcencos`), 3) = ?)
                  )
                  AND CAST(COALESCE(NULLIF(TRIM(a.`tcodint`), ''), '0') AS UNSIGNED) = CAST(? AS UNSIGNED)
                  AND a.`tfec_ini` IS NOT NULL";
        $types = 'issss';
        $gpNum = ltrim($gp, '0');
        if ($gpNum === '') {
            $gpNum = '0';
        }
        $bind = [$ttipo, $tcencosLike, $g3, $c3, $gpNum];
        if ($tfecIniHasta !== null && trim($tfecIniHasta) !== '') {
            $sql .= ' AND a.`tfec_ini` <= ?';
            $types .= 's';
            $bind[] = trim($tfecIniHasta);
        }
        $st = $conn->prepare($sql);
        if (!$st) {
            return null;
        }
        $bindAll = array_merge([$types], $bind);
        $refs = [];
        foreach ($bindAll as $k => $v) {
            $refs[$k] = &$bindAll[$k];
        }
        call_user_func_array([$st, 'bind_param'], $refs);
        $st->execute();
        $row = $st->get_result()->fetch_assoc();
        $st->close();
        $f = trim((string) ($row['fec'] ?? ''));
        if ($f === '' || $f === '0000-00-00' || strpos($f, '0000-00-00') === 0) {
            return null;
        }

        return $f;
    }
}

if (!function_exists('estcumpl_regnocontable_desinfeccion_tiempo_dias_galpon')) {
    /**
     * Días entre último evento ttipo primario y ancla ttipo secundario (DATEDIFF + 1), por galpón.
     *
     * @return array{val: float, fecha_ref: string}|null
     */
    function estcumpl_regnocontable_desinfeccion_tiempo_dias_galpon(
        mysqli $conn,
        string $granja3,
        string $camp3,
        string $galpon,
        int $tipoPrim,
        int $tipoSeg
    ): ?array {
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        $gp = trim($galpon);
        if ($g3 === '' || $c3 === '' || $gp === '') {
            return null;
        }
        $cache = &estcumpl_desinfeccion_tiempos_ctx_cache();
        $ck = $g3 . '|' . $c3 . '|' . $gp . '|' . $tipoPrim . '|' . $tipoSeg;
        if (array_key_exists($ck, $cache)) {
            return $cache[$ck];
        }
        $fecPrim = estcumpl_regnocontable_desinfeccion_max_tfec_ini_galpon($conn, $g3, $c3, $gp, $tipoPrim, null);
        if ($fecPrim === null) {
            return $cache[$ck] = null;
        }
        $fecSeg = estcumpl_regnocontable_desinfeccion_max_tfec_ini_galpon($conn, $g3, $c3, $gp, $tipoSeg, $fecPrim);
        if ($fecSeg === null) {
            return $cache[$ck] = null;
        }
        $tsPrim = strtotime($fecPrim);
        $tsSeg = strtotime($fecSeg);
        if ($tsPrim === false || $tsSeg === false) {
            return $cache[$ck] = null;
        }
        $dias = (int) round(($tsPrim - $tsSeg) / 86400) + 1;
        $fechaRef = date('Y-m-d', $tsPrim);

        return $cache[$ck] = ['val' => (float) $dias, 'fecha_ref' => $fechaRef];
    }
}

if (!function_exists('estcumpl_diff_dias_calendario')) {
    /**
     * Diferencia en días calendario (estilo DATEDIFF de MySQL: solo fecha Y-m-d, sin +1).
     * Descansos LD: día1 proyección campaña actual − fecha_fin HC campaña anterior.
     *
     * @return int|null días (puede ser negativo si la fecha «mayor» es anterior)
     */
    function estcumpl_diff_dias_calendario(string $fechaMayor, string $fechaMenor): ?int
    {
        $dMayor = substr(trim($fechaMayor), 0, 10);
        $dMenor = substr(trim($fechaMenor), 0, 10);
        if ($dMayor === '' || $dMenor === ''
            || strpos($dMayor, '0000-00-00') === 0 || strpos($dMenor, '0000-00-00') === 0) {
            return null;
        }
        $tsMayor = strtotime($dMayor);
        $tsMenor = strtotime($dMenor);
        if ($tsMayor === false || $tsMenor === false) {
            return null;
        }

        return (int) round(($tsMayor - $tsMenor) / 86400);
    }
}

if (!function_exists('estcumpl_descanso_ld_ctx_cache')) {
    /**
     * @param bool $reset
     * @return array<string, array<string, mixed>>
     */
    function &estcumpl_descanso_ld_ctx_cache(bool $reset = false): array
    {
        static $ctx = [];
        if ($reset) {
            $ctx = [];
        }

        return $ctx;
    }
}

if (!function_exists('estcumpl_proyeccion_fecha_dia1_carga')) {
    /**
     * Día 1 de carga (edad=1) desde cargapollo_proyeccion — misma fórmula que cronograma/calcular_fechas.
     */
    function estcumpl_proyeccion_fecha_dia1_carga(
        mysqli $conn,
        string $granja3,
        string $camp3,
        string $galpon
    ): ?string {
        if (!estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'fecha')
            || !estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'tcencos')
            || !estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'tcodint')
            || !estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'edad')) {
            return null;
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        $gp = trim($galpon);
        if ($g3 === '' || $c3 === '' || $gp === '') {
            return null;
        }
        static $projCache = [];
        $pk = $g3 . "\x1e" . $c3 . "\x1e" . $gp;
        if (array_key_exists($pk, $projCache)) {
            return $projCache[$pk];
        }
        $sql = "SELECT MIN(DATE(DATE_ADD(`fecha`, INTERVAL -(`edad`) + 1 DAY))) AS fecha_dia1
                FROM `cargapollo_proyeccion`
                WHERE LEFT(TRIM(`tcencos`), 3) = ?
                  AND RIGHT(TRIM(`tcencos`), 3) = ?
                  AND CAST(COALESCE(NULLIF(TRIM(`tcodint`), ''), '0') AS UNSIGNED) = CAST(? AS UNSIGNED)
                  AND CAST(`edad` AS SIGNED) = 1
                  AND `fecha` IS NOT NULL";
        $st = $conn->prepare($sql);
        if (!$st) {
            return null;
        }
        $gpNum = ltrim($gp, '0');
        if ($gpNum === '') {
            $gpNum = '0';
        }
        $st->bind_param('sss', $g3, $c3, $gpNum);
        $st->execute();
        $row = $st->get_result()->fetch_assoc();
        $st->close();
        $f = trim((string) ($row['fecha_dia1'] ?? ''));
        if ($f === '' || $f === '0000-00-00') {
            return $projCache[$pk] = null;
        }

        return $projCache[$pk] = $f;
    }
}

if (!function_exists('estcumpl_proyeccion_fecha_dia1_map_campania')) {
    /**
     * Día 1 de carga (edad=1) por galpón en una campaña — una sola consulta (evita N+1 en descansos LD).
     *
     * @return array<string, string> galponKey => Y-m-d
     */
    function estcumpl_proyeccion_fecha_dia1_map_campania(
        mysqli $conn,
        string $granja3,
        string $camp3
    ): array {
        if (!estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'fecha')
            || !estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'tcencos')
            || !estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'tcodint')
            || !estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'edad')) {
            return [];
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        if ($g3 === '' || $c3 === '') {
            return [];
        }
        static $mapCache = [];
        $mk = $g3 . "\x1e" . $c3;
        if (isset($mapCache[$mk])) {
            return $mapCache[$mk];
        }
        $sql = "SELECT TRIM(`tcodint`) AS galpon,
                       MIN(DATE(DATE_ADD(`fecha`, INTERVAL -(`edad`) + 1 DAY))) AS fecha_dia1
                FROM `cargapollo_proyeccion`
                WHERE LEFT(TRIM(`tcencos`), 3) = ?
                  AND RIGHT(TRIM(`tcencos`), 3) = ?
                  AND TRIM(`tcodint`) <> ''
                  AND CAST(`edad` AS SIGNED) = 1
                  AND `fecha` IS NOT NULL
                GROUP BY TRIM(`tcodint`)";
        $st = $conn->prepare($sql);
        if (!$st) {
            return $mapCache[$mk] = [];
        }
        $st->bind_param('ss', $g3, $c3);
        $st->execute();
        $rs = $st->get_result();
        $out = [];
        while ($rs && ($row = $rs->fetch_assoc())) {
            $gk = function_exists('estcumpl_hc_galpon_key')
                ? estcumpl_hc_galpon_key(trim((string) ($row['galpon'] ?? '')))
                : trim((string) ($row['galpon'] ?? ''));
            $f = trim((string) ($row['fecha_dia1'] ?? ''));
            if ($gk === '' || $f === '' || $f === '0000-00-00') {
                continue;
            }
            $out[$gk] = $f;
        }
        $st->close();

        return $mapCache[$mk] = $out;
    }
}

if (!function_exists('estcumpl_galpones_push_unique')) {
    /**
     * @param list<array{g3:string,gp:string}> $out
     * @param array<string, bool> $seen
     */
    function estcumpl_galpones_push_unique(array &$out, array &$seen, string $g3, string $gp): void
    {
        $gp = trim($gp);
        if ($g3 === '' || $gp === '') {
            return;
        }
        $k = $g3 . "\x1e" . $gp;
        if (isset($seen[$k])) {
            return;
        }
        $seen[$k] = true;
        $out[] = ['g3' => $g3, 'gp' => $gp];
    }
}

if (!function_exists('estcumpl_regnocontable_galpones_proyeccion_camp')) {
    /**
     * @return list<array{g3:string,gp:string}>
     */
    function estcumpl_regnocontable_galpones_proyeccion_camp(
        mysqli $conn,
        string $granja3,
        string $camp3
    ): array {
        $out = [];
        $seen = [];
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        if ($g3 === '' || $c3 === '' || !estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'tcodint')) {
            return [];
        }
        $sql = "SELECT DISTINCT TRIM(`tcodint`) AS galpon
                FROM `cargapollo_proyeccion`
                WHERE LEFT(TRIM(`tcencos`), 3) = ?
                  AND RIGHT(TRIM(`tcencos`), 3) = ?
                  AND TRIM(`tcodint`) <> ''";
        $st = $conn->prepare($sql);
        if (!$st) {
            return [];
        }
        $st->bind_param('ss', $g3, $c3);
        $st->execute();
        $rs = $st->get_result();
        while ($rs && ($row = $rs->fetch_assoc())) {
            estcumpl_galpones_push_unique($out, $seen, $g3, (string) ($row['galpon'] ?? ''));
        }
        $st->close();

        return $out;
    }
}

if (!function_exists('estcumpl_hc_cab_fecha_fin_granja_campania')) {
    /**
     * fecha_fin de san_fact_historia_clinica_cab (granja + campaña; opcionalmente un galpón).
     * Si se pasa galpón, se filtra por ese galpón (el descanso LD es por galpón, no por granja).
     */
    function estcumpl_hc_cab_fecha_fin_granja_campania(mysqli $conn, string $granja3, string $camp3, ?string $galpon = null): ?string
    {
        if (!function_exists('sip_hc_cab_tabla_disponible')) {
            require_once __DIR__ . '/sip_historia_clinica_cab_lib.php';
        }
        if (!sip_hc_cab_tabla_disponible($conn) || !sip_hc_cab_tiene_columnas_fecha($conn)) {
            return null;
        }
        $t = sip_hc_cab_tabla_lista();
        $g3 = function_exists('sip_hc_cab_normalizar_granja')
            ? sip_hc_cab_normalizar_granja($granja3)
            : substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = function_exists('sip_hc_cab_normalizar_campania')
            ? sip_hc_cab_normalizar_campania($camp3)
            : substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        $gp = trim((string) $galpon);
        $conGalpon = $gp !== '' && estcumpl_col_exists($conn, $t, 'galpon');
        $sql = "SELECT MAX(DATE(`fecha_fin`)) AS fecha_fin
                FROM `{$t}`
                WHERE TRIM(`granja`) = ?
                  AND TRIM(`campania`) = ?
                  AND `fecha_fin` IS NOT NULL
                  AND TRIM(`fecha_fin`) <> ''
                  AND `fecha_fin` <> '0000-00-00'";
        if ($conGalpon) {
            $sql .= " AND CAST(COALESCE(NULLIF(TRIM(CAST(`galpon` AS CHAR)), ''), '0') AS UNSIGNED) = CAST(? AS UNSIGNED)";
        }
        $st = $conn->prepare($sql);
        if (!$st) {
            return null;
        }
        if ($conGalpon) {
            $gpNum = ltrim($gp, '0');
            if ($gpNum === '') {
                $gpNum = '0';
            }
            $st->bind_param('sss', $g3, $c3, $gpNum);
        } else {
            $st->bind_param('ss', $g3, $c3);
        }
        $st->execute();
        $row = $st->get_result()->fetch_assoc();
        $st->close();
        $f = trim((string) ($row['fecha_fin'] ?? ''));
        if ($f === '' || $f === '0000-00-00') {
            return null;
        }
        if (function_exists('sip_hc_cab_normalizar_fecha_ymd')) {
            return sip_hc_cab_normalizar_fecha_ymd($f);
        }

        return $f;
    }
}

if (!function_exists('estcumpl_regnocontable_tfec_ini_desinfeccion_17_o_22')) {
    /**
     * tfec_ini del último evento DESINFECCION ttipo 17; si no hay, del 22 (misma granja/campaña/galpón).
     */
    function estcumpl_regnocontable_tfec_ini_desinfeccion_17_o_22(
        mysqli $conn,
        string $granja3,
        string $camp3,
        string $galpon
    ): ?string {
        $tbl = 'regnocontable';
        if (!estcumpl_col_exists($conn, $tbl, 'tfec_ini') || !estcumpl_col_exists($conn, $tbl, 'ttipo')) {
            return null;
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        $gp = trim($galpon);
        if ($g3 === '' || $c3 === '' || $gp === '') {
            return null;
        }
        $tcencosLike = $g3 . $c3;
        foreach ([17, 22] as $ttipo) {
            $sql = "SELECT MAX(DATE(a.`tfec_ini`)) AS fec
                    FROM `{$tbl}` AS a
                    WHERE UPPER(TRIM(a.`tproceso`)) = 'DESINFECCION'
                      AND CAST(COALESCE(NULLIF(TRIM(a.`ttipo`), ''), '0') AS UNSIGNED) = ?
                      AND (
                          TRIM(a.`tcencos`) = ?
                          OR (LEFT(TRIM(a.`tcencos`), 3) = ? AND RIGHT(TRIM(a.`tcencos`), 3) = ?)
                      )
                      AND CAST(COALESCE(NULLIF(TRIM(a.`tcodint`), ''), '0') AS UNSIGNED) = CAST(? AS UNSIGNED)
                      AND a.`tfec_ini` IS NOT NULL";
            $st = $conn->prepare($sql);
            if (!$st) {
                continue;
            }
            $gpNum = ltrim($gp, '0');
            if ($gpNum === '') {
                $gpNum = '0';
            }
            $st->bind_param('issss', $ttipo, $tcencosLike, $g3, $c3, $gpNum);
            $st->execute();
            $row = $st->get_result()->fetch_assoc();
            $st->close();
            $f = trim((string) ($row['fec'] ?? ''));
            if ($f !== '' && $f !== '0000-00-00') {
                return $f;
            }
        }

        return null;
    }
}

if (!function_exists('estcumpl_regnocontable_galpones_descanso_ld')) {
    /**
     * @param list<string> $filtroGranjas
     * @param list<array{g?:string,gp?:string}> $filtroGgPares
     * @return list<array{g3:string,gp:string}>
     */
    function estcumpl_regnocontable_galpones_descanso_ld(
        mysqli $conn,
        array $filtroGranjas,
        array $filtroGgPares,
        string $granja3,
        string $camp3
    ): array {
        $out = [];
        $seen = [];
        foreach ($filtroGgPares as $pr) {
            $g3 = substr(str_pad(trim((string) ($pr['g'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
            $gp = trim((string) ($pr['gp'] ?? ''));
            if ($g3 === $granja3 && $gp !== '' && !isset($seen[$g3 . "\x1e" . $gp])) {
                $seen[$g3 . "\x1e" . $gp] = true;
                $out[] = ['g3' => $g3, 'gp' => $gp];
            }
        }
        if ($out !== []) {
            return $out;
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        if ($g3 === '' || $c3 === '') {
            return [];
        }
        foreach (estcumpl_regnocontable_galpones_proyeccion_camp($conn, $g3, $c3) as $it) {
            estcumpl_galpones_push_unique($out, $seen, $it['g3'], $it['gp']);
        }
        if (estcumpl_col_exists($conn, 'regnocontable', 'tcodint')
            && estcumpl_col_exists($conn, 'regnocontable', 'ttipo')) {
            $sql = "SELECT DISTINCT TRIM(`tcodint`) AS galpon
                    FROM `regnocontable`
                    WHERE UPPER(TRIM(`tproceso`)) = 'DESINFECCION'
                      AND CAST(COALESCE(NULLIF(TRIM(`ttipo`), ''), '0') AS UNSIGNED) IN (17, 22)
                      AND LEFT(TRIM(`tcencos`), 3) = ?
                      AND RIGHT(TRIM(`tcencos`), 3) = ?
                      AND TRIM(`tcodint`) <> ''";
            $st = $conn->prepare($sql);
            if ($st) {
                $st->bind_param('ss', $g3, $c3);
                $st->execute();
                $rs = $st->get_result();
                while ($rs && ($row = $rs->fetch_assoc())) {
                    estcumpl_galpones_push_unique($out, $seen, $g3, (string) ($row['galpon'] ?? ''));
                }
                $st->close();
            }
        }
        foreach (estcumpl_regnocontable_galpones_limpieza_ld($conn, $filtroGranjas, $filtroGgPares, $g3, $c3) as $it) {
            estcumpl_galpones_push_unique($out, $seen, $it['g3'], $it['gp']);
        }

        return $out;
    }
}

if (!function_exists('estcumpl_regno_hc_merge_cache_key_descanso_ld')) {
    /**
     * @param list<string> $filtroGranjas
     */
    function estcumpl_regno_hc_merge_cache_key_descanso_ld(
        string $campo,
        ?string $filtroCampania3,
        array $filtroGranjas
    ): string {
        $gSorted = $filtroGranjas;
        sort($gSorted);

        return implode("\x1e", [
            'DESINFECCION_LD_DESCANSO',
            $campo,
            trim((string) ($filtroCampania3 ?? '')),
            implode(',', $gSorted),
        ]);
    }
}

if (!function_exists('estcumpl_ld_tiempo_debug_reset')) {
    function estcumpl_ld_tiempo_debug_reset(): void
    {
        $GLOBALS['__estcumpl_ld_tiempo_debug'] = [];
    }
}

if (!function_exists('estcumpl_ld_tiempo_debug_push')) {
    /**
     * @param array<string,mixed> $row
     */
    function estcumpl_ld_tiempo_debug_push(array $row): void
    {
        if (!isset($GLOBALS['__estcumpl_ld_tiempo_debug']) || !is_array($GLOBALS['__estcumpl_ld_tiempo_debug'])) {
            $GLOBALS['__estcumpl_ld_tiempo_debug'] = [];
        }
        $GLOBALS['__estcumpl_ld_tiempo_debug'][] = $row;
    }
}

if (!function_exists('estcumpl_ld_tiempo_debug_get')) {
    /**
     * @return list<array<string,mixed>>
     */
    function estcumpl_ld_tiempo_debug_get(): array
    {
        $d = $GLOBALS['__estcumpl_ld_tiempo_debug'] ?? null;

        return is_array($d) ? $d : [];
    }
}

if (!function_exists('estcumpl_regno_hc_merge_cache_apply')) {
    /**
     * Restaura buckets y calcDebug guardados en cache (Generar HC / Filtrar).
     *
     * @param array<string,array> $muestrasOut
     */
    function estcumpl_regno_hc_merge_cache_apply(string $cacheKey, array &$muestrasOut): bool
    {
        $mergeCache = &estcumpl_regno_hc_merge_cache_store();
        if (!isset($mergeCache[$cacheKey])) {
            return false;
        }
        $entry = $mergeCache[$cacheKey];
        if (isset($entry['__delta']) && is_array($entry['__delta'])) {
            foreach ($entry['__delta'] as $mk => $mv) {
                $muestrasOut[$mk] = $mv;
            }
            if (isset($entry['__calcDebug']) && is_array($entry['__calcDebug'])) {
                foreach ($entry['__calcDebug'] as $row) {
                    if (is_array($row)) {
                        estcumpl_ld_tiempo_debug_push($row);
                    }
                }
            }

            return true;
        }
        foreach ($entry as $mk => $mv) {
            if (!is_string($mk) || $mk === '__calcDebug') {
                continue;
            }
            $muestrasOut[$mk] = $mv;
        }

        return true;
    }
}

if (!function_exists('estcumpl_regno_hc_merge_cache_store_delta')) {
    /**
     * @param array<string,array> $delta
     */
    function estcumpl_regno_hc_merge_cache_store_delta(string $cacheKey, array $delta): void
    {
        $mergeCache = &estcumpl_regno_hc_merge_cache_store();
        $mergeCache[$cacheKey] = [
            '__delta' => $delta,
            '__calcDebug' => estcumpl_ld_tiempo_debug_get(),
        ];
    }
}

if (!function_exists('estcumpl_regnocontable_merge_descanso_ld_std_row')) {
    /**
     * DESINFECCION_LD descanso: día 1 carga (proyección edad 1) campaña actual − fecha_fin HC campaña anterior.
     *
     * @param array<string,array> $muestrasOut
     * @param array<string,mixed> $std
     * @param callable $log
     */
    function estcumpl_regnocontable_merge_descanso_ld_std_row(
        mysqli $conn,
        array $rango,
        array $filtroGranjas,
        array $filtroGgPares,
        ?string $filtroCampania3,
        array &$muestrasOut,
        array $std,
        string $campo,
        string $nivelNorm,
        array $paramVariants,
        callable $log
    ): void {
        if ($filtroCampania3 === null || trim((string) $filtroCampania3) === '') {
            $log('SALIDA: ' . $campo . ' requiere campaña (filtroCampania3)');

            return;
        }
        $campActual = substr(str_pad(trim((string) $filtroCampania3), 3, '0', STR_PAD_LEFT), -3);
        $campAnt = estcumpl_campania_anterior_3($campActual);
        $granjas = [];
        foreach ($filtroGranjas as $g) {
            $g3 = substr(str_pad(trim((string) $g), 3, '0', STR_PAD_LEFT), 0, 3);
            if ($g3 !== '') {
                $granjas[$g3] = true;
            }
        }
        if ($granjas === []) {
            foreach ($filtroGgPares as $pr) {
                $g3 = substr(str_pad(trim((string) ($pr['g'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
                if ($g3 !== '') {
                    $granjas[$g3] = true;
                }
            }
        }
        $granjas = array_keys($granjas);
        if ($granjas === []) {
            $log('SALIDA: ' . $campo . ' sin granja en filtros');

            return;
        }
        $tipoEst = trim((string) ($std['nivelRaw'] ?? ''));
        if ($tipoEst === '') {
            $tipoEst = $nivelNorm;
        }
        $mergeCacheKey = estcumpl_regno_hc_merge_cache_key_descanso_ld($campo, $filtroCampania3, $granjas);
        if (estcumpl_regno_hc_merge_cache_apply($mergeCacheKey, $muestrasOut)) {
            return;
        }
        $mergeKeysBefore = array_keys($muestrasOut);
        $nCalc = 0;
        $descansoCtx = &estcumpl_descanso_ld_ctx_cache();
        foreach ($granjas as $g3) {
            $ctxKey = $g3 . '|' . $campActual;
            if (!isset($descansoCtx[$ctxKey]['galpones'])) {
                $descansoCtx[$ctxKey]['galpones'] = estcumpl_regnocontable_galpones_descanso_ld($conn, $filtroGranjas, $filtroGgPares, $g3, $campActual);
            }
            $galpones = $descansoCtx[$ctxKey]['galpones'];
            $dia1MapKey = 'dia1Map|' . $campActual;
            if (!isset($descansoCtx[$ctxKey][$dia1MapKey])) {
                $descansoCtx[$ctxKey][$dia1MapKey] = estcumpl_proyeccion_fecha_dia1_map_campania($conn, $g3, $campActual);
            }
            $dia1Map = is_array($descansoCtx[$ctxKey][$dia1MapKey] ?? null) ? $descansoCtx[$ctxKey][$dia1MapKey] : [];
            $log('AVISO: ' . $campo . ' galpones a evaluar: ' . count($galpones)
                . ' (día1 proy. camp ' . $campActual . ' − fecha_fin HC camp ant ' . $campAnt . ')');
            foreach ($galpones as $item) {
                $gp = $item['gp'];
                $gk = function_exists('estcumpl_hc_galpon_key') ? estcumpl_hc_galpon_key($gp) : trim($gp);
                $fDia1 = $gk !== '' && isset($dia1Map[$gk]) ? $dia1Map[$gk] : null;
                if ($fDia1 === null) {
                    $fDia1 = estcumpl_proyeccion_fecha_dia1_carga($conn, $g3, $campActual, $gp);
                }
                if ($fDia1 === null) {
                    estcumpl_ld_tiempo_debug_push([
                        'metrica' => $campo,
                        'granja' => $g3,
                        'campania' => $campActual,
                        'campania_anterior' => $campAnt,
                        'galpon' => $gp,
                        'motivo' => 'sin fecha día 1 en cargapollo_proyeccion (edad=1) para campaña actual ' . $campActual,
                        'formula' => 'día1 proyección campaña actual − fecha_fin HC campaña anterior',
                    ]);
                    continue;
                }
                $fFinAntGalKey = 'fFinHc|' . $campAnt . '|' . $gp;
                if (!array_key_exists($fFinAntGalKey, $descansoCtx[$ctxKey])) {
                    $descansoCtx[$ctxKey][$fFinAntGalKey] = estcumpl_hc_cab_fecha_fin_granja_campania($conn, $g3, $campAnt, $gp);
                }
                $fResta = $descansoCtx[$ctxKey][$fFinAntGalKey] ?? null;
                if ($fResta === null) {
                    estcumpl_ld_tiempo_debug_push([
                        'metrica' => $campo,
                        'granja' => $g3,
                        'campania' => $campActual,
                        'campania_anterior' => $campAnt,
                        'galpon' => $gp,
                        'f_dia1_proyeccion' => $fDia1,
                        'motivo' => 'sin fecha_fin en san_fact_historia_clinica_cab para granja/campaña anterior ' . $campAnt,
                        'formula' => 'día1 proyección campaña actual − fecha_fin HC campaña anterior',
                    ]);
                    continue;
                }
                $val = estcumpl_diff_dias_calendario($fDia1, $fResta);
                if ($val === null) {
                    estcumpl_ld_tiempo_debug_push([
                        'metrica' => $campo,
                        'granja' => $g3,
                        'galpon' => $gp,
                        'motivo' => 'fechas inválidas para DATEDIFF en días',
                        'f_dia1_proyeccion' => $fDia1,
                        'f_resta' => $fResta,
                    ]);
                    continue;
                }
                estcumpl_ld_tiempo_debug_push([
                    'metrica' => $campo,
                    'granja' => $g3,
                    'campania' => $campActual,
                    'campania_anterior' => $campAnt,
                    'galpon' => $gp,
                    'dias' => $val,
                    'unidad' => 'dias',
                    'f_dia1_proyeccion' => $fDia1,
                    'f_resta' => $fResta,
                    'formula' => 'DATEDIFF(día1 proyección campaña ' . $campActual . ', fecha_fin HC campaña ' . $campAnt . ') en días',
                    'fuente' => 'cargapollo_proyeccion + san_fact_historia_clinica_cab',
                ]);
                $key = $g3 . '|' . $campActual . '|' . $gp . '|DESINFECCION_LD|' . $fDia1;
                if (!isset($muestrasOut[$key])) {
                    $muestrasOut[$key] = [
                        'granja' => $g3,
                        'campania' => $campActual,
                        'galpon' => $gp,
                        'codEnvio' => '',
                        'posSolicitud' => 0,
                        'fectra' => $fDia1,
                        'tdate' => $fDia1,
                        'tcencos' => '',
                        'tipoEstandar' => $tipoEst,
                        'registros' => [],
                    ];
                }
                if (!isset($muestrasOut[$key]['registros'][$nivelNorm])) {
                    $muestrasOut[$key]['registros'][$nivelNorm] = [];
                }
                foreach ($paramVariants as $pv) {
                    $pvn = trim((string) $pv);
                    if ($pvn === '') {
                        continue;
                    }
                    $storK = estcumpl_regnocontable_storage_key_param($pvn, $campo);
                    if ($storK === '') {
                        continue;
                    }
                    if (!isset($muestrasOut[$key]['registros'][$nivelNorm][$storK])
                        || (float) $muestrasOut[$key]['registros'][$nivelNorm][$storK] < (float) $val) {
                        $muestrasOut[$key]['registros'][$nivelNorm][$storK] = (float) $val;
                    }
                }
                $nCalc++;
            }
        }
        $log('AVISO: ' . $campo . ' en días (DATEDIFF); día1 proy. camp ' . $campActual
            . ' − fecha_fin HC camp ant ' . $campAnt . '; galpones con valor: ' . $nCalc);
        $delta = [];
        foreach ($muestrasOut as $mk => $mv) {
            if (!in_array($mk, $mergeKeysBefore, true)) {
                $delta[$mk] = $mv;
            }
        }
        estcumpl_regno_hc_merge_cache_store_delta($mergeCacheKey, $delta);
    }
}

if (!function_exists('estcumpl_regnocontable_galpones_desinfeccion_tiempos')) {
    /**
     * Galpones con eventos DESINFECCION (ttipo 2/3/19/22) en regnocontable para Manejo de cama.
     * No usa cargapollo_proyeccion (esa fuente es solo para descansos DESINFECCION_LD).
     *
     * @param list<string> $filtroGranjas
     * @param list<array{g?:string,gp?:string}> $filtroGgPares
     * @return list<array{g3:string,gp:string}>
     */
    function estcumpl_regnocontable_galpones_desinfeccion_tiempos(
        mysqli $conn,
        array $filtroGranjas,
        array $filtroGgPares,
        string $granja3,
        string $camp3
    ): array {
        $out = [];
        $seen = [];
        foreach ($filtroGgPares as $pr) {
            $g3 = substr(str_pad(trim((string) ($pr['g'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
            $gp = trim((string) ($pr['gp'] ?? ''));
            if ($g3 === $granja3 && $gp !== '' && !isset($seen[$g3 . "\x1e" . $gp])) {
                $seen[$g3 . "\x1e" . $gp] = true;
                $out[] = ['g3' => $g3, 'gp' => $gp];
            }
        }
        if ($out !== []) {
            return $out;
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), -3);
        if ($g3 === '' || $c3 === ''
            || !estcumpl_col_exists($conn, 'regnocontable', 'tcodint')
            || !estcumpl_col_exists($conn, 'regnocontable', 'ttipo')
            || !estcumpl_col_exists($conn, 'regnocontable', 'tfec_ini')) {
            return [];
        }
        $sql = "SELECT DISTINCT TRIM(`tcodint`) AS galpon
                FROM `regnocontable`
                WHERE UPPER(TRIM(`tproceso`)) = 'DESINFECCION'
                  AND CAST(COALESCE(NULLIF(TRIM(`ttipo`), ''), '0') AS UNSIGNED) IN (2, 3, 19, 22)
                  AND LEFT(TRIM(`tcencos`), 3) = ?
                  AND RIGHT(TRIM(`tcencos`), 3) = ?
                  AND TRIM(`tcodint`) <> ''
                  AND `tfec_ini` IS NOT NULL";
        $st = $conn->prepare($sql);
        if (!$st) {
            return [];
        }
        $st->bind_param('ss', $g3, $c3);
        $st->execute();
        $rs = $st->get_result();
        while ($rs && ($row = $rs->fetch_assoc())) {
            $gp = trim((string) ($row['galpon'] ?? ''));
            if ($gp !== '' && !isset($seen[$g3 . "\x1e" . $gp])) {
                $seen[$g3 . "\x1e" . $gp] = true;
                $out[] = ['g3' => $g3, 'gp' => $gp];
            }
        }
        $st->close();

        return $out;
    }
}

if (!function_exists('estcumpl_regnocontable_merge_desinfeccion_tiempos_std_row')) {
    /**
     * DESINFECCION tiempo_retiro_guano / tiempo_reuso_cama: cálculo por galpón (evita self-join masivo en regnocontable).
     *
     * @param array<string,array> $muestrasOut
     * @param array<string,mixed> $std
     * @param list<string> $paramVariants
     * @param list<string>|null $mergeTrace
     */
    function estcumpl_regnocontable_merge_desinfeccion_tiempos_std_row(
        mysqli $conn,
        array $rango,
        array $filtroGranjas,
        array $filtroGgPares,
        ?string $filtroCampania3,
        array &$muestrasOut,
        array $std,
        string $campo,
        string $nivelNorm,
        array $paramVariants,
        ?array &$mergeTrace = null
    ): void {
        unset($rango);
        $log = function (string $m) use (&$mergeTrace): void {
            if ($mergeTrace !== null) {
                $mergeTrace[] = $m;
            }
        };
        if ($filtroCampania3 === null || trim((string) $filtroCampania3) === '') {
            $log('SALIDA: DESINFECCION tiempos requiere campaña (filtroCampania3)');

            return;
        }
        if (!estcumpl_col_exists($conn, 'regnocontable', 'tfec_ini') || !estcumpl_col_exists($conn, 'regnocontable', 'ttipo')) {
            $log('SALIDA: DESINFECCION (tiempos) requiere tfec_ini y ttipo en regnocontable');

            return;
        }
        $campActual = substr(str_pad(trim((string) $filtroCampania3), 3, '0', STR_PAD_LEFT), -3);
        $tipoPrim = $campo === 'tiempo_retiro_guano' ? 3 : 22;
        $tipoSeg = $campo === 'tiempo_retiro_guano' ? 2 : 19;
        $granjas = [];
        foreach ($filtroGranjas as $g) {
            $g3 = substr(str_pad(trim((string) $g), 3, '0', STR_PAD_LEFT), 0, 3);
            if ($g3 !== '') {
                $granjas[$g3] = true;
            }
        }
        if ($granjas === []) {
            foreach ($filtroGgPares as $pr) {
                $g3 = substr(str_pad(trim((string) ($pr['g'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
                if ($g3 !== '') {
                    $granjas[$g3] = true;
                }
            }
        }
        $granjas = array_keys($granjas);
        if ($granjas === []) {
            $log('SALIDA: DESINFECCION tiempos sin granja en filtros');

            return;
        }
        $mergeCacheKey = null;
        $mergeCache = &estcumpl_regno_hc_merge_cache_store();
        if ($mergeTrace === null) {
            $mergeCacheKey = estcumpl_regno_hc_merge_cache_key_desinfeccion_tiempos(
                $campo,
                $filtroCampania3,
                $granjas
            );
            if (isset($mergeCache[$mergeCacheKey])) {
                foreach ($mergeCache[$mergeCacheKey] as $mk => $mv) {
                    $muestrasOut[$mk] = $mv;
                }

                return;
            }
        }
        $mergeKeysBefore = $mergeCacheKey !== null ? array_keys($muestrasOut) : [];
        $tipoEst = trim((string) ($std['nivelRaw'] ?? ''));
        if ($tipoEst === '') {
            $tipoEst = $nivelNorm;
        }
        $desinCtx = &estcumpl_desinfeccion_tiempos_ctx_cache();
        $nCalc = 0;
        foreach ($granjas as $g3) {
            $ctxKey = $g3 . '|' . $campActual;
            if (!isset($desinCtx[$ctxKey]['galpones'])) {
                $desinCtx[$ctxKey]['galpones'] = estcumpl_regnocontable_galpones_desinfeccion_tiempos(
                    $conn,
                    $filtroGranjas,
                    $filtroGgPares,
                    $g3,
                    $campActual
                );
            }
            $galpones = $desinCtx[$ctxKey]['galpones'];
            foreach ($galpones as $item) {
                $gp = $item['gp'];
                $hit = estcumpl_regnocontable_desinfeccion_tiempo_dias_galpon(
                    $conn,
                    $g3,
                    $campActual,
                    $gp,
                    $tipoPrim,
                    $tipoSeg
                );
                if ($hit === null) {
                    continue;
                }
                $val = (float) ($hit['val'] ?? 0);
                $fref = trim((string) ($hit['fecha_ref'] ?? ''));
                if ($fref === '') {
                    continue;
                }
                $key = $g3 . '|' . $campActual . '|' . $gp . '|DESINFECCION|' . $fref;
                if (!isset($muestrasOut[$key])) {
                    $muestrasOut[$key] = [
                        'granja' => $g3,
                        'campania' => $campActual,
                        'galpon' => $gp,
                        'codEnvio' => '',
                        'posSolicitud' => 0,
                        'fectra' => $fref,
                        'tdate' => $fref,
                        'tcencos' => '',
                        'tipoEstandar' => $tipoEst,
                        'registros' => [],
                    ];
                }
                if (!isset($muestrasOut[$key]['registros'][$nivelNorm])) {
                    $muestrasOut[$key]['registros'][$nivelNorm] = [];
                }
                foreach ($paramVariants as $pv) {
                    $pvn = trim((string) $pv);
                    if ($pvn === '') {
                        continue;
                    }
                    $storK = estcumpl_regnocontable_storage_key_param($pvn, $campo);
                    if ($storK === '') {
                        continue;
                    }
                    if (!isset($muestrasOut[$key]['registros'][$nivelNorm][$storK])
                        || (float) $muestrasOut[$key]['registros'][$nivelNorm][$storK] < $val) {
                        $muestrasOut[$key]['registros'][$nivelNorm][$storK] = $val;
                    }
                }
                $nCalc++;
            }
        }
        $log('AVISO: DESINFECCION tiempos por galpón desde regnocontable (ttipo ' . $tipoPrim . '←' . $tipoSeg
            . '); camp=' . $campActual . '; galpones con valor: ' . $nCalc);
        if ($mergeCacheKey !== null) {
            $delta = [];
            foreach ($muestrasOut as $mk => $mv) {
                if (!in_array($mk, $mergeKeysBefore, true)) {
                    $delta[$mk] = $mv;
                }
            }
            $mergeCache[$mergeCacheKey] = $delta;
        }
    }
}

if (!function_exists('estcumpl_regnocontable_merge_limpieza_ld_std_row')) {
    /**
     * DESINFECCION_LD tiempo_limpieza_desinfeccion: cálculo por galpón (evita UNION masivo en regnocontable).
     *
     * @param array<string,array> $muestrasOut
     * @param array<string,mixed> $std
     * @param list<string> $paramVariants
     * @param list<string>|null $mergeTrace
     */
    function estcumpl_regnocontable_merge_limpieza_ld_std_row(
        mysqli $conn,
        array $rango,
        array $filtroGranjas,
        array $filtroGgPares,
        ?string $filtroCampania3,
        array &$muestrasOut,
        array $std,
        string $campo,
        string $nivelNorm,
        array $paramVariants,
        ?array &$mergeTrace = null
    ): void {
        unset($rango);
        $log = function (string $m) use (&$mergeTrace): void {
            if ($mergeTrace !== null) {
                $mergeTrace[] = $m;
            }
        };
        if ($filtroCampania3 === null || trim((string) $filtroCampania3) === '') {
            $log('SALIDA: DESINFECCION_LD limpieza requiere campaña (filtroCampania3)');

            return;
        }
        if (!estcumpl_col_exists($conn, 'regnocontable', 'tfec_ini') || !estcumpl_col_exists($conn, 'regnocontable', 'ttipo')) {
            $log('SALIDA: DESINFECCION_LD (limpieza) requiere tfec_ini y ttipo en regnocontable');

            return;
        }
        $campActual = substr(str_pad(trim((string) $filtroCampania3), 3, '0', STR_PAD_LEFT), -3);
        $granjas = [];
        foreach ($filtroGranjas as $g) {
            $g3 = substr(str_pad(trim((string) $g), 3, '0', STR_PAD_LEFT), 0, 3);
            if ($g3 !== '') {
                $granjas[$g3] = true;
            }
        }
        if ($granjas === []) {
            foreach ($filtroGgPares as $pr) {
                $g3 = substr(str_pad(trim((string) ($pr['g'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
                if ($g3 !== '') {
                    $granjas[$g3] = true;
                }
            }
        }
        $granjas = array_keys($granjas);
        if ($granjas === []) {
            $log('SALIDA: DESINFECCION_LD limpieza sin granja en filtros');

            return;
        }
        $mergeCacheKey = null;
        $mergeCache = &estcumpl_regno_hc_merge_cache_store();
        if ($mergeTrace === null) {
            $mergeCacheKey = estcumpl_regno_hc_merge_cache_key_limpieza_ld($filtroCampania3, $granjas);
            if (estcumpl_regno_hc_merge_cache_apply($mergeCacheKey, $muestrasOut)) {
                return;
            }
        }
        $mergeKeysBefore = $mergeCacheKey !== null ? array_keys($muestrasOut) : [];
        $tipoEst = trim((string) ($std['nivelRaw'] ?? ''));
        if ($tipoEst === '') {
            $tipoEst = $nivelNorm;
        }
        $ldCtx = &estcumpl_limpieza_ld_ctx_cache();
        $nCalc = 0;
        foreach ($granjas as $g3) {
            $ctxKey = $g3 . '|' . $campActual;
            if (!isset($ldCtx[$ctxKey]['galpones'])) {
                $ldCtx[$ctxKey]['galpones'] = estcumpl_regnocontable_galpones_limpieza_ld(
                    $conn,
                    $filtroGranjas,
                    $filtroGgPares,
                    $g3,
                    $campActual
                );
            }
            $galpones = $ldCtx[$ctxKey]['galpones'];
            foreach ($galpones as $item) {
                $gp = $item['gp'];
                $hits = estcumpl_regnocontable_limpieza_ld_hits_galpon($conn, $g3, $campActual, $gp);
                if ($hits === []) {
                    estcumpl_ld_tiempo_debug_push([
                        'metrica' => $campo,
                        'granja' => $g3,
                        'campania' => $campActual,
                        'galpon' => $gp,
                        'motivo' => 'sin par tfec_ini ttipo 17←8 ni 22←19 en regnocontable (campaña actual)',
                        'formula' => 'regnocontable DESINFECCION: días entre ttipo 17 y 8 (si no hay, 22 y 19)',
                        'fuente' => 'regnocontable',
                    ]);
                }
                foreach ($hits as $hit) {
                    if (!is_array($hit)) {
                        continue;
                    }
                    $val = (float) ($hit['val'] ?? 0);
                    $fref = trim((string) ($hit['fecha_ref'] ?? ''));
                    if ($fref === '') {
                        continue;
                    }
                    estcumpl_ld_tiempo_debug_push([
                        'metrica' => $campo,
                        'granja' => $g3,
                        'campania' => $campActual,
                        'galpon' => $gp,
                        'dias' => $val,
                        'unidad' => 'dias',
                        'fecha_ref' => $fref,
                        'formula' => 'días entre eventos regnocontable (ttipo 17←8; si no, 22←19; DATEDIFF+1)',
                        'fuente' => 'regnocontable',
                    ]);
                    $key = $g3 . '|' . $campActual . '|' . $gp . '|DESINFECCION_LD|' . $fref;
                    if (!isset($muestrasOut[$key])) {
                        $muestrasOut[$key] = [
                            'granja' => $g3,
                            'campania' => $campActual,
                            'galpon' => $gp,
                            'codEnvio' => '',
                            'posSolicitud' => 0,
                            'fectra' => $fref,
                            'tdate' => $fref,
                            'tcencos' => '',
                            'tipoEstandar' => $tipoEst,
                            'registros' => [],
                        ];
                    }
                    if (!isset($muestrasOut[$key]['registros'][$nivelNorm])) {
                        $muestrasOut[$key]['registros'][$nivelNorm] = [];
                    }
                    foreach ($paramVariants as $pv) {
                        $pvn = trim((string) $pv);
                        if ($pvn === '') {
                            continue;
                        }
                        $storK = estcumpl_regnocontable_storage_key_param($pvn, $campo);
                        if ($storK === '') {
                            continue;
                        }
                        if (!isset($muestrasOut[$key]['registros'][$nivelNorm][$storK])
                            || (float) $muestrasOut[$key]['registros'][$nivelNorm][$storK] < $val) {
                            $muestrasOut[$key]['registros'][$nivelNorm][$storK] = $val;
                        }
                    }
                    $nCalc++;
                }
            }
        }
        $log('AVISO: DESINFECCION_LD limpieza por galpón desde regnocontable (17←8; si no, 22←19); camp='
            . $campActual . '; buckets con valor: ' . $nCalc);
        if ($mergeCacheKey !== null) {
            $delta = [];
            foreach ($muestrasOut as $mk => $mv) {
                if (!in_array($mk, $mergeKeysBefore, true)) {
                    $delta[$mk] = $mv;
                }
            }
            estcumpl_regno_hc_merge_cache_store_delta($mergeCacheKey, $delta);
        }
    }
}

if (!function_exists('estcumpl_merge_regnocontable_std_row')) {
    /**
     * Rellena $muestrasOut desde regnocontable para una fila de estándar con tipoParametro = regnocontable.
     *
     * @param array<string,array> $muestrasOut
     * @param array<string,mixed> $std entrada de $estandares (nivelNorm, paramVariants, tipoParametro, infoOrigen)
     * @param list<string>|null $mergeTrace si no es null, se agregan mensajes de diagnóstico (debug informe necropsia)
     * @param string|null $filtroCampania3 si se informa (3 dígitos), se añade RIGHT(tcencos)=campaña en SQL (p. ej. historia clínica por campaña concreta).
     *                          RESPIRATORIO/DIGESTIVO/CLORO + tcantidad: sin filtro por rango de fechas en WHERE; con tnomtipo/ttipo micro (p. ej. estornudo/ronquera → ttipo 1/2) mismo filtro que el repositorio de origen.
     * @param list<array{granja:string,campania:string}>|null $tempConoParesTcencos si no vacío (TEMP_CONO), filtra por granja+campaña de tcencos sin rango de fechas en el SELECT
     */
    function estcumpl_merge_regnocontable_std_row(
        mysqli $conn,
        array $rango,
        array $filtroGranjas,
        array $filtroGgPares,
        array &$muestrasOut,
        array $std,
        ?array &$mergeTrace = null,
        ?string $filtroCampania3 = null,
        ?array $tempConoParesTcencos = null
    ): void {
        if ($filtroCampania3 !== null && !is_string($filtroCampania3)) {
            $filtroCampania3 = (string) $filtroCampania3;
        }
        $log = function (string $m) use (&$mergeTrace): void {
            if ($mergeTrace !== null) {
                $mergeTrace[] = $m;
            }
        };
        if (empty($rango['desde']) || empty($rango['hasta'])) {
            $log('SALIDA: rango vacio');
            return;
        }
        $tpStd = strtolower(trim((string)($std['tipoParametro'] ?? '')));
        if ($tpStd !== 'regnocontable') {
            $log('SALIDA: tipoParametro no es regnocontable (' . $tpStd . ')');
            return;
        }
        $nivelNorm = trim((string)($std['nivelNorm'] ?? ''));
        $paramVariants = isset($std['paramVariants']) && is_array($std['paramVariants']) ? $std['paramVariants'] : [];
        if ($nivelNorm === '') {
            $log('SALIDA: nivelNorm vacio');
            return;
        }
        $inf = estcumpl_info_origen_array($std['infoOrigen'] ?? []);
        $campo = strtolower(trim((string)($inf['campoValor'] ?? 'tcantidad')));
        $tproc = strtoupper(trim((string)($inf['tproceso'] ?? '')));
        if (in_array($campo, ['gorgojo_prom_larva', 'gorgojo_prom_adulto'], true)) {
            $tproc = 'EVA_GORGOJO';
        } elseif (in_array($campo, ['plagas_pct_consumo', 'plagas_roedores_vivos', 'plagas_roedores_muertos'], true)) {
            $tproc = 'PLAGAS';
        } elseif (in_array($campo, ['tiempo_limpieza_desinfeccion', 'tiempo_descanso_efectivo', 'tiempo_descanso_total'], true)) {
            $tproc = 'DESINFECCION_LD';
        } elseif (in_array($campo, ['tiempo_retiro_guano', 'tiempo_reuso_cama'], true)) {
            $tproc = 'DESINFECCION';
        } elseif ($tproc === '' || !in_array($tproc, estcumpl_regnocontable_tproceso_permitidos(), true)) {
            $tproc = estcumpl_regnocontable_inferir_tproceso_std($std);
        }
        if ($tproc === 'DESINFECCION' && in_array($campo, ['tiempo_limpieza_desinfeccion', 'tiempo_descanso_efectivo', 'tiempo_descanso_total'], true)) {
            $tproc = 'DESINFECCION_LD';
        }
        if ($tproc === '' || !in_array($tproc, estcumpl_regnocontable_tproceso_permitidos(), true)) {
            $log('SALIDA: tproceso invalido o vacio tras inferir (' . $tproc . ')');
            return;
        }
        if ($tproc === 'PLAGAS') {
            estcumpl_regnocontable_enriquecer_inf_plagas_roedores(
                $inf,
                (string)($std['parametroRaw'] ?? ''),
                (string)($std['nivelRaw'] ?? '')
            );
            $campo = strtolower(trim((string)($inf['campoValor'] ?? 'tcantidad')));
        }
        if ($tproc === 'EVA_GORGOJO' && !in_array($campo, ['gorgojo_prom_larva', 'gorgojo_prom_adulto'], true)) {
            $wasTcant = ($campo === 'tcantidad');
            $campo = estcumpl_regnocontable_campo_valor_gorgojo_resolve(
                $campo,
                (string)($std['parametroRaw'] ?? ''),
                (string)($std['nivelRaw'] ?? '')
            );
            if ($wasTcant && in_array($campo, ['gorgojo_prom_larva', 'gorgojo_prom_adulto'], true)) {
                $log('AVISO: campoValor tcantidad con EVA_GORGOJO (legacy); se trata como Promedio Larva. En estándares elija explicitamente Promedio Larva o Promedio Adulto.');
            }
        }
        if ($campo === '' || !in_array($campo, estcumpl_regnocontable_campo_valor_permitidos(), true)) {
            $log('SALIDA: campoValor no permitido o vacio (' . $campo . ')');
            return;
        }
        if ($tproc === 'PLAGAS' && $campo === 'tcantidad') {
            $log('SALIDA: PLAGAS con tcantidad');
            return;
        }
        if ($tproc === 'EVA_GORGOJO' && $campo === 'tcantidad') {
            $log('SALIDA: EVA_GORGOJO con tcantidad (falta metrica larva/adulto)');
            return;
        }
        $plagasSolo = ['plagas_pct_consumo', 'plagas_roedores_vivos', 'plagas_roedores_muertos'];
        $gorgojoSolo = ['gorgojo_prom_larva', 'gorgojo_prom_adulto'];
        if (in_array($campo, $plagasSolo, true) && $tproc !== 'PLAGAS') {
            $log('SALIDA: metrica plagas con tproceso distinto de PLAGAS');
            return;
        }
        if (in_array($campo, $gorgojoSolo, true) && $tproc !== 'EVA_GORGOJO') {
            $log('SALIDA: metrica gorgojo con tproceso distinto de EVA_GORGOJO');
            return;
        }
        $tiemposSolo = ['tiempo_retiro_guano', 'tiempo_reuso_cama'];
        $tiemposLd = ['tiempo_limpieza_desinfeccion', 'tiempo_descanso_efectivo', 'tiempo_descanso_total'];
        if ($tproc === 'DESINFECCION_LD' && in_array($campo, ['tiempo_descanso_efectivo', 'tiempo_descanso_total'], true)) {
            estcumpl_regnocontable_merge_descanso_ld_std_row(
                $conn,
                $rango,
                $filtroGranjas,
                $filtroGgPares,
                $filtroCampania3,
                $muestrasOut,
                $std,
                $campo,
                $nivelNorm,
                $paramVariants,
                $log
            );

            return;
        }
        if (in_array($campo, $tiemposSolo, true) && $tproc !== 'DESINFECCION') {
            $log('SALIDA: metrica tiempos (retiro guano / reuso cama) con tproceso distinto de DESINFECCION');
            return;
        }
        if (in_array($campo, $tiemposLd, true) && $tproc !== 'DESINFECCION_LD') {
            $log('SALIDA: metrica Limp. & Desinf. con tproceso distinto de DESINFECCION_LD');
            return;
        }
        if ($tproc === 'DESINFECCION' && !in_array($campo, $tiemposSolo, true)) {
            $log('SALIDA: DESINFECCION requiere campoValor tiempo_retiro_guano o tiempo_reuso_cama');
            return;
        }
        if ($tproc === 'DESINFECCION_LD' && !in_array($campo, $tiemposLd, true)) {
            $log('SALIDA: DESINFECCION_LD requiere campoValor tiempo_limpieza_desinfeccion, tiempo_descanso_efectivo o tiempo_descanso_total');
            return;
        }

        if ($paramVariants === [] && ($tproc === 'DESINFECCION' || $tproc === 'DESINFECCION_LD')) {
            $pv = trim((string) ($std['parametroRaw'] ?? ''));
            if ($pv === '') {
                $pv = $nivelNorm;
            }
            if ($pv !== '') {
                $paramVariants = [$pv];
            } else {
                $paramVariants = [$tproc === 'DESINFECCION_LD' ? '_desinfeccion_ld' : '_desinfeccion_tiempos'];
            }
        }

        if ($paramVariants === [] && $tproc === 'EVA_GORGOJO' && function_exists('estcumpl_param_variants_gorgojo')) {
            $paramVariants = estcumpl_param_variants_gorgojo((string)($std['parametroRaw'] ?? ''));
            $log('AVISO: paramVariants vacios; se usaron sinonimos gorgojo (' . count($paramVariants) . ').');
        }
        if ($paramVariants === []) {
            $log('SALIDA: sin paramVariants tras inferencia (nivel=' . $nivelNorm . ', tproc=' . $tproc . ')');
            return;
        }

        if ($tproc === 'DESINFECCION' && in_array($campo, $tiemposSolo, true)) {
            estcumpl_regnocontable_merge_desinfeccion_tiempos_std_row(
                $conn,
                $rango,
                $filtroGranjas,
                $filtroGgPares,
                $filtroCampania3,
                $muestrasOut,
                $std,
                $campo,
                $nivelNorm,
                $paramVariants,
                $mergeTrace
            );

            return;
        }

        if ($tproc === 'DESINFECCION_LD' && $campo === 'tiempo_limpieza_desinfeccion') {
            estcumpl_regnocontable_merge_limpieza_ld_std_row(
                $conn,
                $rango,
                $filtroGranjas,
                $filtroGgPares,
                $filtroCampania3,
                $muestrasOut,
                $std,
                $campo,
                $nivelNorm,
                $paramVariants,
                $mergeTrace
            );

            return;
        }

        $aggRaw = strtolower(trim((string)($inf['agregacion'] ?? '')));
        if ($aggRaw !== '' && in_array($aggRaw, ['max', 'avg', 'min'], true)) {
            $agg = $aggRaw;
        } else {
            $agg = ($tproc === 'TEMP_CONO') ? 'avg' : 'max';
        }
        if (in_array($campo, $plagasSolo, true)) {
            $agg = 'max';
        }
        if (in_array($campo, $gorgojoSolo, true)) {
            $agg = 'max';
        }
        if (in_array($campo, $tiemposSolo, true)
            || in_array($campo, ['tiempo_limpieza_desinfeccion', 'tiempo_descanso_efectivo', 'tiempo_descanso_total'], true)) {
            $agg = 'max';
        }
        $aggSql = $agg === 'avg' ? 'AVG' : ($agg === 'min' ? 'MIN' : 'MAX');
        $groupByExtra = '';
        $tempConoDiaFiltro = null;
        $tempConoTiposIn = null;
        $skipFinalGroupBy = false;
        $skipFinalGroupByInnerExpr = null;
        $regnoColPrefix = '';
        $fecExprForGroup = null;
        $mergeRegnoSqlCompleto = false;
        $regnoOuterGeoSkip = false;

        $tbl = 'regnocontable';

        /* Micro RESPIRATORIO/DIGESTIVO/CLORO: mismo criterio tnomtipo/ttipo que sip_param_repo_regnocontable_microproceso_tipo_filter.
         * CLORO sin tnomtipo ni ttipo: sin fragmento (cualquier ttipo/tnomtipo en regnocontable — conformidad agregada).
         * Con ttipo numérico y tnom vacío: filtro por ttipo (legacy), igual que el repositorio. */
        $microTipoFil = null;
        if (in_array($tproc, ['RESPIRATORIO', 'DIGESTIVO', 'CLORO'], true) && $campo === 'tcantidad') {
            require_once __DIR__ . '/sip_parametro_origen_repository.php';
            $tnomUser = trim((string) ($inf['tnomtipo'] ?? ''));
            $microTipoFil = sip_param_repo_regnocontable_microproceso_tipo_filter($conn, $tbl, $tproc, $tnomUser);
            if ($microTipoFil === null && $tnomUser === '' && estcumpl_col_exists($conn, $tbl, 'ttipo')) {
                $rawTipo = trim((string) ($inf['ttipo'] ?? ''));
                if ($rawTipo !== '' && preg_match('/^\d+$/', $rawTipo)) {
                    $microTipoFil = [
                        'fragment' => ' AND TRIM(COALESCE(CAST(ttipo AS CHAR), \'\')) = ? ',
                        'types' => 's',
                        'bind' => [$rawTipo],
                    ];
                }
            }
        }

        $ttipo = strtoupper(trim((string)($inf['ttipo'] ?? '')));
        if ($campo === 'plagas_pct_consumo') {
            if ($ttipo !== 'P' && $ttipo !== 'T') {
                $log('SALIDA: plagas_pct_consumo sin ttipo P/T');
                return;
            }
            if (!estcumpl_col_exists($conn, $tbl, 'ttipo') || !estcumpl_col_exists($conn, $tbl, 'tcantidad')) {
                $log('SALIDA: faltan columnas ttipo/tcantidad en ' . $tbl);
                return;
            }
            $fecExpr = estcumpl_regnocontable_fecha_expr($conn, $tbl, $tproc);
            $exprVal = '(100.0 * SUM(IF(CAST(COALESCE(tcantidad,0) AS DECIMAL(18,6)) > 0, 1, 0)) / NULLIF(COUNT(*), 0))';
            $sql = "SELECT {$fecExpr} AS fecha_ref,
                           LEFT(TRIM(tcencos), 3) AS granja,
                           RIGHT(TRIM(tcencos), 3) AS campania,
                           TRIM(tcodint) AS galpon,
                           {$exprVal} AS val_agg
                    FROM `{$tbl}`
                    WHERE UPPER(TRIM(tproceso)) = ?
                      AND {$fecExpr} >= ? AND {$fecExpr} <= ?
                      AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''
                      AND UPPER(TRIM(COALESCE(ttipo, ''))) = ?";
            $params = [$tproc, $rango['desde'], $rango['hasta'], $ttipo];
            $types = 'ssss';
        } elseif ($campo === 'plagas_roedores_vivos') {
            foreach (['tcan_raton_vivo', 'tcan_rata_viva'] as $colReq) {
                if (!estcumpl_col_exists($conn, $tbl, $colReq)) {
                    $log('SALIDA: columna requerida ausente en roedores vivos: ' . $colReq);
                    return;
                }
            }
            $fecExpr = estcumpl_regnocontable_fecha_expr($conn, $tbl, $tproc);
            $exprVal = 'SUM(CAST(COALESCE(tcan_raton_vivo,0) AS DECIMAL(18,6)) + CAST(COALESCE(tcan_rata_viva,0) AS DECIMAL(18,6)))';
            $sql = "SELECT {$fecExpr} AS fecha_ref,
                           LEFT(TRIM(tcencos), 3) AS granja,
                           RIGHT(TRIM(tcencos), 3) AS campania,
                           TRIM(tcodint) AS galpon,
                           {$exprVal} AS val_agg
                    FROM `{$tbl}`
                    WHERE UPPER(TRIM(tproceso)) = ?
                      AND {$fecExpr} >= ? AND {$fecExpr} <= ?
                      AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''";
            $params = [$tproc, $rango['desde'], $rango['hasta']];
            $types = 'sss';
        } elseif ($campo === 'plagas_roedores_muertos') {
            foreach (['tcan_raton_muerto', 'tcan_rata_muerta'] as $colReq) {
                if (!estcumpl_col_exists($conn, $tbl, $colReq)) {
                    $log('SALIDA: columna requerida ausente en roedores muertos: ' . $colReq);
                    return;
                }
            }
            $fecExpr = estcumpl_regnocontable_fecha_expr($conn, $tbl, $tproc);
            $exprVal = 'SUM(CAST(COALESCE(tcan_raton_muerto,0) AS DECIMAL(18,6)) + CAST(COALESCE(tcan_rata_muerta,0) AS DECIMAL(18,6)))';
            $sql = "SELECT {$fecExpr} AS fecha_ref,
                           LEFT(TRIM(tcencos), 3) AS granja,
                           RIGHT(TRIM(tcencos), 3) AS campania,
                           TRIM(tcodint) AS galpon,
                           {$exprVal} AS val_agg
                    FROM `{$tbl}`
                    WHERE UPPER(TRIM(tproceso)) = ?
                      AND {$fecExpr} >= ? AND {$fecExpr} <= ?
                      AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''";
            $params = [$tproc, $rango['desde'], $rango['hasta']];
            $types = 'sss';
        } elseif (in_array($campo, ['gorgojo_prom_larva', 'gorgojo_prom_adulto'], true)) {
            if ($tproc !== 'EVA_GORGOJO') {
                $log('SALIDA: rama gorgojo pero tproceso no EVA_GORGOJO');
                return;
            }
            foreach (['tnomtipo', 'tsexo', 'tcantidad', 'tcencos', 'tcodint'] as $colReq) {
                if (!estcumpl_col_exists($conn, $tbl, $colReq)) {
                    $log('SALIDA: gorgojo columna ausente en ' . $tbl . ': ' . $colReq);
                    return;
                }
            }
            /* Larva/adulto: AVG(tcantidad) por tfectra (si existe), sexo M/H y tnomtipo; alineado a sip_parametro_origen_repository (EVA_GORGOJO). */
            require_once __DIR__ . '/sip_parametro_origen_repository.php';
            $regnoColPrefix = 'a.';
            $fecExprStr = sip_param_repo_regnocontable_fecha_expr_eva_gorgojo($conn, $tbl);
            if ($fecExprStr === null || trim((string) $fecExprStr) === '') {
                $fecExprStr = estcumpl_regnocontable_fecha_expr($conn, $tbl, $tproc);
            }
            $fecExprA = preg_replace('/\b(tfec_ini|tfectra|tdate)\b/', 'a.$1', (string) $fecExprStr);
            $fecExprForGroup = estcumpl_col_exists($conn, $tbl, 'tfectra')
                ? "NULLIF(DATE(a.tfectra), '1000-01-01')"
                : $fecExprA;
            $condTipo = $campo === 'gorgojo_prom_larva'
                ? sip_param_repo_eva_gorgojo_cond_larva()
                : sip_param_repo_eva_gorgojo_cond_adulto();
            $exprInner = "ROUND(AVG(IF({$condTipo}, CAST(a.tcantidad AS DECIMAL(18,6)), NULL)), 2)";
            $joinCarga = '';
            $sexoMhExpr = sip_param_repo_eva_gorgojo_sexo_mh_expr_with_fallback($conn, $fecExprForGroup);
            if (estcumpl_col_exists($conn, 'cargaproduccion00', 'fecha')
                && estcumpl_col_exists($conn, 'cargaproduccion00', 'tcencos')
                && estcumpl_col_exists($conn, 'cargaproduccion00', 'tcodint')
                && estcumpl_col_exists($conn, 'cargaproduccion00', 'tcodigo')) {
                $joinCarga = " LEFT JOIN `cargaproduccion00` AS carga0 ON {$fecExprForGroup} = DATE(carga0.fecha) AND TRIM(a.tcencos) = TRIM(carga0.tcencos) AND TRIM(a.tcodint) = TRIM(carga0.tcodint) AND {$sexoMhExpr} = IF(TRIM(carga0.tcodigo)='P0001001','M','H')";
                $log('AVISO: gorgojo con LEFT JOIN cargaproduccion00 (tabla presente).');
            }
            $sql = "SELECT fecha_ref, granja, campania, galpon, MAX(promv) AS val_agg FROM (
                SELECT {$fecExprForGroup} AS fecha_ref,
                       LEFT(TRIM(a.tcencos), 3) AS granja,
                       RIGHT(TRIM(a.tcencos), 3) AS campania,
                       TRIM(a.tcodint) AS galpon,
                       {$exprInner} AS promv
                FROM `{$tbl}` AS a
                {$joinCarga}
                WHERE UPPER(TRIM(a.tproceso)) = ?
                  AND {$fecExprForGroup} >= ? AND {$fecExprForGroup} <= ?
                  AND TRIM(a.tcencos) <> '' AND TRIM(a.tcodint) <> ''";
            $params = [$tproc, $rango['desde'], $rango['hasta']];
            $types = 'sss';
            $skipFinalGroupBy = true;
            $skipFinalGroupByInnerExpr = ' GROUP BY ' . $fecExprForGroup
                . ', LEFT(TRIM(a.tcencos), 3), RIGHT(TRIM(a.tcencos), 3), TRIM(a.tcodint), '
                . $sexoMhExpr . ') AS gorg_sub GROUP BY fecha_ref, granja, campania, galpon';
        } elseif ($tproc === 'DESINFECCION_LD' && $campo === 'tiempo_limpieza_desinfeccion') {
            if (!estcumpl_col_exists($conn, $tbl, 'tfec_ini') || !estcumpl_col_exists($conn, $tbl, 'ttipo')) {
                $log('SALIDA: DESINFECCION_LD (limpieza/desinfeccion) requiere tfec_ini y ttipo en ' . $tbl);
                return;
            }
            $fecInner = 'COALESCE(DATE(a.tfec_ini), DATE(a.tfectra))';
            $mergeRegnoSqlCompleto = true;
            $regnoColPrefix = 'regno_sub.';
            $fecExpr = $fecInner;
            $omitFechaLd = ($filtroCampania3 !== null && trim((string) $filtroCampania3) !== '');
            $sqlFechaInner = $omitFechaLd ? '' : " AND {$fecInner} >= ? AND {$fecInner} <= ?";
            $geoDesin = estcumpl_regnocontable_desinfeccion_inner_geo_sql($filtroCampania3, $filtroGranjas, 'a');
            $regnoOuterGeoSkip = ($geoDesin['sql'] !== '');
            $anchorSub = static function (int $tipoSeg) use ($tbl): string {
                return "(SELECT MAX(c.tfec_ini) FROM `{$tbl}` c
                                WHERE TRIM(c.tcencos) = TRIM(a.tcencos)
                                  AND TRIM(c.tcodint) = TRIM(a.tcodint)
                                  AND UPPER(TRIM(c.tproceso)) = 'DESINFECCION'
                                  AND CAST(COALESCE(NULLIF(TRIM(c.ttipo),''),'0') AS UNSIGNED) = {$tipoSeg}
                                  AND c.tfec_ini IS NOT NULL
                                  AND c.tfec_ini <= a.tfec_ini)";
            };
            $vdiffDias = static function (string $anchorSql): string {
                return '(DATEDIFF(DATE(a.tfec_ini), DATE(' . $anchorSql . ')) + 1)';
            };
            $ramaAPrioridadExists = "NOT EXISTS (
                          SELECT 1 FROM `{$tbl}` a17
                          WHERE TRIM(a17.tcencos) = TRIM(a.tcencos)
                            AND TRIM(a17.tcodint) = TRIM(a.tcodint)
                            AND UPPER(TRIM(a17.tproceso)) = 'DESINFECCION'
                            AND CAST(COALESCE(NULLIF(TRIM(a17.ttipo),''),'0') AS UNSIGNED) = 17
                            AND a17.tfec_ini IS NOT NULL
                            AND (SELECT MAX(c.tfec_ini) FROM `{$tbl}` c
                                 WHERE TRIM(c.tcencos) = TRIM(a17.tcencos)
                                   AND TRIM(c.tcodint) = TRIM(a17.tcodint)
                                   AND UPPER(TRIM(c.tproceso)) = 'DESINFECCION'
                                   AND CAST(COALESCE(NULLIF(TRIM(c.ttipo),''),'0') AS UNSIGNED) = 8
                                   AND c.tfec_ini IS NOT NULL
                                   AND c.tfec_ini <= a17.tfec_ini) IS NOT NULL
                      )";
            $anchor8 = $anchorSub(8);
            $anchor19 = $anchorSub(19);
            $sql = "SELECT regno_sub.fecha_ref, regno_sub.granja, regno_sub.campania, regno_sub.galpon, MAX(regno_sub.vdiff) AS val_agg
                FROM (
                    SELECT {$fecInner} AS fecha_ref,
                           LEFT(TRIM(a.tcencos), 3) AS granja,
                           RIGHT(TRIM(a.tcencos), 3) AS campania,
                           TRIM(a.tcodint) AS galpon,
                           TRIM(a.tcencos) AS tcencos,
                           TRIM(a.tcodint) AS tcodint,
                           {$vdiffDias($anchor8)} AS vdiff
                    FROM `{$tbl}` AS a
                    WHERE UPPER(TRIM(a.tproceso)) = 'DESINFECCION'
                      AND CAST(COALESCE(NULLIF(TRIM(a.ttipo),''),'0') AS UNSIGNED) = 17
                      {$sqlFechaInner}
                      AND TRIM(a.tcencos) <> ''
                      AND TRIM(a.tcodint) <> ''
                      AND a.tfec_ini IS NOT NULL
                      AND {$anchor8} IS NOT NULL
                      {$geoDesin['sql']}
                    UNION ALL
                    SELECT {$fecInner} AS fecha_ref,
                           LEFT(TRIM(a.tcencos), 3) AS granja,
                           RIGHT(TRIM(a.tcencos), 3) AS campania,
                           TRIM(a.tcodint) AS galpon,
                           TRIM(a.tcencos) AS tcencos,
                           TRIM(a.tcodint) AS tcodint,
                           {$vdiffDias($anchor19)} AS vdiff
                    FROM `{$tbl}` AS a
                    WHERE UPPER(TRIM(a.tproceso)) = 'DESINFECCION'
                      AND CAST(COALESCE(NULLIF(TRIM(a.ttipo),''),'0') AS UNSIGNED) = 22
                      {$sqlFechaInner}
                      AND TRIM(a.tcencos) <> ''
                      AND TRIM(a.tcodint) <> ''
                      AND a.tfec_ini IS NOT NULL
                      AND {$anchor19} IS NOT NULL
                      AND {$ramaAPrioridadExists}
                      {$geoDesin['sql']}
                ) AS regno_sub
                WHERE 1=1";
            $params = [];
            $types = '';
            if (!$omitFechaLd) {
                $params = [
                    $rango['desde'], $rango['hasta'],
                    $rango['desde'], $rango['hasta'],
                ];
                $types = 'ssss';
            }
            if ($geoDesin['bind'] !== []) {
                $params = array_merge($params, $geoDesin['bind'], $geoDesin['bind']);
                $types .= $geoDesin['types'] . $geoDesin['types'];
            }
            if ($omitFechaLd) {
                $log('AVISO: DESINFECCION_LD limpieza sin filtro por fecha (granja/campaña vía filtros).');
            }
            $log('AVISO: DESINFECCION_LD limpieza/desinfeccion: rama A 17←8 días (+1); rama B 22←19 solo si A no calcula en el galpón.');
        } elseif ($tproc === 'ACTAENTREGA' && $campo === 'tsexo') {
            if (!function_exists('estcumpl_repo_regnocontable_actaentrega_query')) {
                $log('SALIDA: helper repository ACTAENTREGA no disponible');
                return;
            }
            $qAe = estcumpl_repo_regnocontable_actaentrega_query($conn, $tbl, $inf, $rango);
            if (empty($qAe['ok'])) {
                $log('SALIDA: ' . trim((string)($qAe['reason'] ?? 'error ACTAENTREGA')));
                return;
            }
            $fecExpr = (string)($qAe['fecExpr'] ?? 'DATE(tfectra)');
            $sql = (string)($qAe['sql'] ?? '');
            $params = isset($qAe['params']) && is_array($qAe['params']) ? $qAe['params'] : [];
            $types = (string)($qAe['types'] ?? '');
            if ($sql === '' || $types === '') {
                $log('SALIDA: helper repository ACTAENTREGA devolvio query vacia');
                return;
            }
        } else {
            if (!estcumpl_col_exists($conn, $tbl, 'tcantidad')) {
                $log('SALIDA: falta tcantidad en ' . $tbl);
                return;
            }
            $fecExpr = estcumpl_regnocontable_fecha_expr($conn, $tbl, $tproc);
            if ($tproc === 'TEMP_CONO'
                && estcumpl_col_exists($conn, $tbl, 'tsexo')
                && estcumpl_col_exists($conn, $tbl, 'ttipo')) {
                $tempConoDiaFiltro = estcumpl_temp_cono_dia_medicion_desde_inf($inf);
            }
            if ($tproc === 'TEMP_CONO'
                && trim((string) ($std['edadDiaExpr'] ?? '')) !== ''
                && function_exists('estcumpl_engine_parse_edad_dia_expr')) {
                $tempConoTiposIn = estcumpl_engine_parse_edad_dia_expr(trim((string) $std['edadDiaExpr']));
                if ($tempConoTiposIn !== []) {
                    $tempConoDiaFiltro = null;
                } else {
                    $tempConoTiposIn = null;
                }
            }
            if ($tproc === 'TEMP_CONO' && $campo === 'tcantidad'
                && $tempConoDiaFiltro === null
                && ($tempConoTiposIn === null || $tempConoTiposIn === [])) {
                if (function_exists('estcumpl_repo_resolve_temp_cono_tipos_in_for_merge')) {
                    $tempConoTiposIn = estcumpl_repo_resolve_temp_cono_tipos_in_for_merge($std);
                } else {
                    $tempConoTiposIn = [1, 2, 3, 4, 5];
                }
                if ($tempConoTiposIn === []) {
                    $log('SALIDA: TEMP_CONO sin días válidos (edadDiaExpr / texto parámetro)');

                    return;
                }
            }
            if ($tproc === 'TEMP_CONO' && $campo === 'tcantidad') {
                $nInferTc = estcumpl_engine_temp_cono_infer_dia_desde_parametro((string) ($std['parametroRaw'] ?? ''));
                if ($nInferTc !== null) {
                    if ($tempConoDiaFiltro !== null) {
                        if ((int) $tempConoDiaFiltro !== $nInferTc) {
                            $log('SALIDA: diaMedicion en infoOrigen no coincide con día del texto parámetro');

                            return;
                        }
                    } elseif (is_array($tempConoTiposIn) && $tempConoTiposIn !== []) {
                        $tempConoTiposIn = array_values(array_intersect(
                            array_map('intval', $tempConoTiposIn),
                            [$nInferTc]
                        ));
                        if ($tempConoTiposIn === []) {
                            $log('SALIDA: edadDiaExpr sin intersección con día inferido del parámetro');

                            return;
                        }
                    }
                }
            }
            $useTcencosPares = ($tproc === 'TEMP_CONO'
                && is_array($tempConoParesTcencos)
                && count($tempConoParesTcencos) > 0);
            $paresSqlMc = '';
            $paresParamsMc = [];
            $paresTypesMc = '';
            if ($useTcencosPares) {
                $pm = estcumpl_regnocontable_temp_cono_sql_pares_tcencos($tempConoParesTcencos, '');
                $paresSqlMc = $pm[0];
                $paresParamsMc = $pm[1];
                $paresTypesMc = $pm[2];
                if ($paresSqlMc === '') {
                    $useTcencosPares = false;
                }
            }
            if ($tempConoDiaFiltro !== null) {
                if ($useTcencosPares) {
                    $sql = "SELECT {$fecExpr} AS fecha_ref,
                               LEFT(TRIM(tcencos), 3) AS granja,
                               RIGHT(TRIM(tcencos), 3) AS campania,
                               TRIM(tcodint) AS galpon,
                               TRIM(tsexo) AS cone_raw,
                               MAX(CAST(tcantidad AS DECIMAL(18,6))) AS val_agg
                        FROM `{$tbl}`
                        WHERE UPPER(TRIM(tproceso)) = ?
                          {$paresSqlMc}
                          AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''
                          AND CAST(COALESCE(NULLIF(TRIM(COALESCE(ttipo, '')), ''), '0') AS UNSIGNED) = ?";
                    $params = array_merge([$tproc], $paresParamsMc, [$tempConoDiaFiltro]);
                    $types = 's' . $paresTypesMc . 'i';
                } else {
                    $sql = "SELECT {$fecExpr} AS fecha_ref,
                               LEFT(TRIM(tcencos), 3) AS granja,
                               RIGHT(TRIM(tcencos), 3) AS campania,
                               TRIM(tcodint) AS galpon,
                               TRIM(tsexo) AS cone_raw,
                               MAX(CAST(tcantidad AS DECIMAL(18,6))) AS val_agg
                        FROM `{$tbl}`
                        WHERE UPPER(TRIM(tproceso)) = ?
                          AND {$fecExpr} >= ? AND {$fecExpr} <= ?
                          AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''
                          AND CAST(COALESCE(NULLIF(TRIM(COALESCE(ttipo, '')), ''), '0') AS UNSIGNED) = ?";
                    $params = [$tproc, $rango['desde'], $rango['hasta'], $tempConoDiaFiltro];
                    $types = 'sssi';
                }
                $groupByExtra = ', TRIM(tsexo)';
            } elseif ($tempConoTiposIn !== null && $tempConoTiposIn !== []) {
                $phIn = implode(',', array_fill(0, count($tempConoTiposIn), '?'));
                $inCast = 'CAST(COALESCE(NULLIF(TRIM(COALESCE(ttipo, \'\')), \'\'), \'0\') AS UNSIGNED)';
                if ($useTcencosPares) {
                    $sql = "SELECT {$fecExpr} AS fecha_ref,
                               LEFT(TRIM(tcencos), 3) AS granja,
                               RIGHT(TRIM(tcencos), 3) AS campania,
                               TRIM(tcodint) AS galpon,
                               TRIM(tsexo) AS cone_raw,
                               {$inCast} AS temp_cono_dia,
                               MAX(CAST(tcantidad AS DECIMAL(18,6))) AS val_agg
                        FROM `{$tbl}`
                        WHERE UPPER(TRIM(tproceso)) = ?
                          {$paresSqlMc}
                          AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''
                          AND {$inCast} IN ($phIn)";
                    $params = array_merge([$tproc], $paresParamsMc, $tempConoTiposIn);
                    $types = 's' . $paresTypesMc . str_repeat('i', count($tempConoTiposIn));
                } else {
                    $sql = "SELECT {$fecExpr} AS fecha_ref,
                               LEFT(TRIM(tcencos), 3) AS granja,
                               RIGHT(TRIM(tcencos), 3) AS campania,
                               TRIM(tcodint) AS galpon,
                               TRIM(tsexo) AS cone_raw,
                               {$inCast} AS temp_cono_dia,
                               MAX(CAST(tcantidad AS DECIMAL(18,6))) AS val_agg
                        FROM `{$tbl}`
                        WHERE UPPER(TRIM(tproceso)) = ?
                          AND {$fecExpr} >= ? AND {$fecExpr} <= ?
                          AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''
                          AND {$inCast} IN ($phIn)";
                    $params = array_merge([$tproc, $rango['desde'], $rango['hasta']], $tempConoTiposIn);
                    $types = 'sss' . str_repeat('i', count($tempConoTiposIn));
                }
                /* Una fila por día de medición (ttipo); sin esto MAX mezcla conos de distintos días y el PHP repetía el valor en todos los buckets. */
                $groupByExtra = ', TRIM(tsexo), ' . $inCast;
            } elseif ($tproc === 'TEMP_CONO' && $campo === 'tcantidad') {
                $log('SALIDA: TEMP_CONO tcantidad requiere ttipo (edadDiaExpr, diaMedicion o resolución por defecto)');

                return;
            } else {
                $regnoMicroSinFecha = in_array($tproc, ['RESPIRATORIO', 'DIGESTIVO', 'CLORO'], true)
                    && $campo === 'tcantidad';
                if ($useTcencosPares) {
                    $sql = "SELECT {$fecExpr} AS fecha_ref,
                               LEFT(TRIM(tcencos), 3) AS granja,
                               RIGHT(TRIM(tcencos), 3) AS campania,
                               TRIM(tcodint) AS galpon,
                               {$aggSql}(CAST(tcantidad AS DECIMAL(18,6))) AS val_agg
                        FROM `{$tbl}`
                        WHERE UPPER(TRIM(tproceso)) = ?
                          {$paresSqlMc}
                          AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''";
                    $params = array_merge([$tproc], $paresParamsMc);
                    $types = 's' . $paresTypesMc;
                    if ($regnoMicroSinFecha && $microTipoFil !== null) {
                        $sql .= $microTipoFil['fragment'];
                        $types .= $microTipoFil['types'];
                        foreach ($microTipoFil['bind'] as $b) {
                            $params[] = $b;
                        }
                    }
                } elseif ($regnoMicroSinFecha) {
                    $log('AVISO: ' . $tproc . ' tcantidad sin filtro por fecha en WHERE (granja/campaña/galpón vía filtros).');
                    $sql = "SELECT {$fecExpr} AS fecha_ref,
                               LEFT(TRIM(tcencos), 3) AS granja,
                               RIGHT(TRIM(tcencos), 3) AS campania,
                               TRIM(tcodint) AS galpon,
                               {$aggSql}(CAST(tcantidad AS DECIMAL(18,6))) AS val_agg
                        FROM `{$tbl}`
                        WHERE UPPER(TRIM(tproceso)) = ?
                          AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''";
                    $params = [$tproc];
                    $types = 's';
                    if ($microTipoFil !== null) {
                        $sql .= $microTipoFil['fragment'];
                        $types .= $microTipoFil['types'];
                        foreach ($microTipoFil['bind'] as $b) {
                            $params[] = $b;
                        }
                    }
                } else {
                    $sql = "SELECT {$fecExpr} AS fecha_ref,
                               LEFT(TRIM(tcencos), 3) AS granja,
                               RIGHT(TRIM(tcencos), 3) AS campania,
                               TRIM(tcodint) AS galpon,
                               {$aggSql}(CAST(tcantidad AS DECIMAL(18,6))) AS val_agg
                        FROM `{$tbl}`
                        WHERE UPPER(TRIM(tproceso)) = ?
                          AND {$fecExpr} >= ? AND {$fecExpr} <= ?
                          AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''";
                    $params = [$tproc, $rango['desde'], $rango['hasta']];
                    $types = 'sss';
                }
            }
        }

        $camp3Sql = null;
        if ($filtroCampania3 !== null && trim((string) $filtroCampania3) !== '') {
            $camp3Sql = substr(str_pad(trim((string) $filtroCampania3), 3, '0', STR_PAD_LEFT), 0, 3);
        }
        if (!$regnoOuterGeoSkip && $camp3Sql !== null && $camp3Sql !== '') {
            if (!empty($mergeRegnoSqlCompleto)) {
                $sql .= ' AND TRIM(' . $regnoColPrefix . 'campania) = ?';
            } else {
                $pfxC = $regnoColPrefix;
                $sql .= " AND RIGHT(TRIM({$pfxC}tcencos), 3) = ?";
            }
            $params[] = $camp3Sql;
            $types .= 's';
        }

        $granjasNorm = [];
        foreach ($filtroGranjas as $g) {
            $g = substr(str_pad(trim((string)$g), 3, '0', STR_PAD_LEFT), 0, 3);
            if ($g !== '') {
                $granjasNorm[$g] = true;
            }
        }
        $granjasNorm = array_keys($granjasNorm);
        $ggNorm = [];
        foreach ($filtroGgPares as $pr) {
            $g3 = substr(str_pad(trim((string)($pr['g'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
            $gp = trim((string)($pr['gp'] ?? ''));
            if ($g3 !== '' && $gp !== '') {
                $ggNorm[] = ['g3' => $g3, 'gp' => $gp];
            }
        }
        if (count($granjasNorm) > 0 || count($ggNorm) > 0) {
            $sub = [];
            $pfx = $regnoColPrefix;
            if (!$regnoOuterGeoSkip && count($granjasNorm) > 0) {
                $ph = implode(',', array_fill(0, count($granjasNorm), '?'));
                if (!empty($mergeRegnoSqlCompleto)) {
                    $sub[] = 'TRIM(' . $pfx . 'granja) IN (' . $ph . ')';
                } else {
                    $sub[] = "LEFT(TRIM({$pfx}tcencos), 3) IN ($ph)";
                }
                foreach ($granjasNorm as $g) {
                    $params[] = $g;
                    $types .= 's';
                }
            }
            if (count($ggNorm) > 0) {
                $conj = [];
                foreach ($ggNorm as $row) {
                    if (!empty($mergeRegnoSqlCompleto)) {
                        $conj[] = '(TRIM(' . $pfx . 'granja) = ? AND CAST(COALESCE(NULLIF(TRIM(' . $pfx . 'galpon), \'\'), \'0\') AS UNSIGNED) = CAST(? AS UNSIGNED))';
                    } else {
                        /* Misma granja + galpón con o sin ceros a la izquierda (1 vs 01). */
                        $conj[] = '(LEFT(TRIM(' . $pfx . 'tcencos), 3) = ? AND CAST(COALESCE(NULLIF(TRIM(' . $pfx . 'tcodint), \'\'), \'0\') AS UNSIGNED) = CAST(? AS UNSIGNED))';
                    }
                    $params[] = $row['g3'];
                    $types .= 's';
                    $params[] = $row['gp'];
                    $types .= 's';
                }
                $sub[] = '(' . implode(' OR ', $conj) . ')';
            }
            if ($sub !== []) {
                $sql .= ' AND (' . implode(' OR ', $sub) . ')';
            }
        }
        if (!empty($mergeRegnoSqlCompleto)) {
            $sql .= ' GROUP BY regno_sub.fecha_ref, regno_sub.granja, regno_sub.campania, regno_sub.galpon';
        } elseif ($skipFinalGroupBy) {
            if ($skipFinalGroupByInnerExpr !== null && $skipFinalGroupByInnerExpr !== '') {
                $sql .= $skipFinalGroupByInnerExpr;
            } else {
                $gbFec = $fecExprForGroup !== null ? $fecExprForGroup : $fecExpr;
                $p = $regnoColPrefix;
                /* ONLY_FULL_GROUP_BY: el SELECT interno usa LEFT/RIGHT(TRIM(tcencos)); hay que agrupar por las mismas expresiones, no solo TRIM(tcencos). */
                $innerGb = " GROUP BY {$gbFec}, LEFT(TRIM({$p}tcencos), 3), RIGHT(TRIM({$p}tcencos), 3), TRIM({$p}tcodint), RIGHT(TRIM(COALESCE({$p}tsexo,'')), 1), TRIM({$p}ttipo)) AS gorg_sub GROUP BY fecha_ref, granja, campania, galpon";
                $sql .= $innerGb;
            }
        } else {
            $sql .= " GROUP BY {$fecExpr}, LEFT(TRIM(tcencos), 3), RIGHT(TRIM(tcencos), 3), TRIM(tcodint)" . $groupByExtra;
        }

        $fecExprLog = isset($fecExpr) ? (string)$fecExpr : '';
        $log('Query: tproc=' . $tproc . ' campo=' . $campo . ' tabla=' . $tbl . ' fecExpr=' . $fecExprLog);
        $mergeCacheKey = null;
        $mergeCache = &estcumpl_regno_hc_merge_cache_store();
        if ($mergeTrace === null) {
            $mergeCacheKey = estcumpl_regno_hc_merge_cache_key(
                $tproc,
                $campo,
                $filtroCampania3,
                $filtroGranjas,
                $inf,
                $nivelNorm,
                $paramVariants
            );
            if (isset($mergeCache[$mergeCacheKey])) {
                foreach ($mergeCache[$mergeCacheKey] as $mk => $mv) {
                    $muestrasOut[$mk] = $mv;
                }

                return;
            }
        }
        $mergeKeysBefore = $mergeCacheKey !== null ? array_keys($muestrasOut) : [];
        $st = $conn->prepare($sql);
        if (!$st) {
            $log('SALIDA: prepare fallo: ' . $conn->error);
            return;
        }
        $bind = [];
        $bind[] = $types;
        foreach ($params as $p) {
            $bind[] = $p;
        }
        $refs = [];
        foreach ($bind as $k => $v) {
            $refs[$k] = &$bind[$k];
        }
        call_user_func_array([$st, 'bind_param'], $refs);
        if (!$st->execute()) {
            $log('SALIDA: execute fallo: ' . $st->error);
            $st->close();
            return;
        }
        $rows = estcumpl_stmt_fetch_all_assoc($st);
        $log('Filas SQL brutas: ' . count($rows));
        $tipoEst = trim((string)($std['nivelRaw'] ?? ''));
        if ($tipoEst === '') {
            $tipoEst = $nivelNorm;
        }
        $omitidasGeo = 0;
        $omitidasValor = 0;
        foreach ($rows as $row) {
            $granja = trim((string)($row['granja'] ?? ''));
            $campania = trim((string)($row['campania'] ?? ''));
            $galpon = trim((string)($row['galpon'] ?? ''));
            $fref = trim((string)($row['fecha_ref'] ?? ''));
            $vagg = $row['val_agg'] ?? null;
            if ($granja === '' || $galpon === '' || $fref === '') {
                $omitidasGeo++;
                continue;
            }
            $val = null;
            if ($vagg !== null && $vagg !== '') {
                if (is_numeric($vagg)) {
                    $val = (float)$vagg;
                } elseif (is_string($vagg)) {
                    $vtrim = str_replace(',', '.', trim($vagg));
                    if ($vtrim !== '' && is_numeric($vtrim)) {
                        $val = (float)$vtrim;
                    }
                }
            }
            if ($val === null) {
                $omitidasValor++;
                continue;
            }
            $key = $granja . '|' . $campania . '|' . $galpon . '|' . $tproc . '|' . $fref;
            if (!isset($muestrasOut[$key])) {
                $muestrasOut[$key] = [
                    'granja' => $granja,
                    'campania' => $campania,
                    'galpon' => $galpon,
                    'codEnvio' => '',
                    'posSolicitud' => 0,
                    'fectra' => $fref,
                    'tdate' => $fref,
                    'tcencos' => '',
                    'tipoEstandar' => $tipoEst,
                    'registros' => [],
                ];
            }
            if (!isset($muestrasOut[$key]['registros'][$nivelNorm])) {
                $muestrasOut[$key]['registros'][$nivelNorm] = [];
            }
            if ($tproc === 'TEMP_CONO' && ($tempConoDiaFiltro !== null || ($tempConoTiposIn !== null && $tempConoTiposIn !== []))) {
                $coneRaw = trim((string)($row['cone_raw'] ?? ''));
                $coneIdx = estcumpl_temp_cono_indice_cono_desde_tsexo($coneRaw);
                if ($coneIdx === null) {
                    continue;
                }
                if ($tempConoDiaFiltro !== null) {
                    $diasBlob = [(int) $tempConoDiaFiltro];
                } else {
                    $dr = isset($row['temp_cono_dia']) ? (int) $row['temp_cono_dia'] : null;
                    $tiposPerm = [];
                    foreach ($tempConoTiposIn as $ti) {
                        $tiposPerm[(int) $ti] = true;
                    }
                    if ($dr === null || $dr < 1 || !isset($tiposPerm[$dr])) {
                        continue;
                    }
                    $diasBlob = [$dr];
                }
                if (!isset($muestrasOut[$key]['registros'][$nivelNorm]['__tempCono'])) {
                    $muestrasOut[$key]['registros'][$nivelNorm]['__tempCono'] = [];
                }
                foreach ($diasBlob as $dB) {
                    if (!isset($muestrasOut[$key]['registros'][$nivelNorm]['__tempCono'][$dB])) {
                        $muestrasOut[$key]['registros'][$nivelNorm]['__tempCono'][$dB] = ['conos' => []];
                    }
                    $refConos = &$muestrasOut[$key]['registros'][$nivelNorm]['__tempCono'][$dB]['conos'];
                    if (!isset($refConos[$coneIdx])) {
                        $refConos[$coneIdx] = $val;
                    } else {
                        $refConos[$coneIdx] = max((float) $refConos[$coneIdx], $val);
                    }
                    unset($refConos);
                }
            } else {
                foreach ($paramVariants as $pv) {
                    $pvn = trim((string) $pv);
                    if ($pvn === '') {
                        continue;
                    }
                    $storK = estcumpl_regnocontable_storage_key_param($pvn, $campo);
                    if ($storK === '') {
                        continue;
                    }
                    if (!isset($muestrasOut[$key]['registros'][$nivelNorm][$storK])) {
                        $muestrasOut[$key]['registros'][$nivelNorm][$storK] = $val;
                    } else {
                        if ($agg === 'min') {
                            $muestrasOut[$key]['registros'][$nivelNorm][$storK] = min(
                                (float) $muestrasOut[$key]['registros'][$nivelNorm][$storK],
                                $val
                            );
                        } elseif ($agg === 'avg') {
                            $muestrasOut[$key]['registros'][$nivelNorm][$storK] = max(
                                (float) $muestrasOut[$key]['registros'][$nivelNorm][$storK],
                                $val
                            );
                        } else {
                            $muestrasOut[$key]['registros'][$nivelNorm][$storK] = max(
                                (float) $muestrasOut[$key]['registros'][$nivelNorm][$storK],
                                $val
                            );
                        }
                    }
                }
            }
        }
        $log('Filas usadas: ' . (count($rows) - $omitidasGeo - $omitidasValor) . ' (omitidas geo=' . $omitidasGeo . ' sinValor=' . $omitidasValor . ')');
        $st->close();
        if ($mergeCacheKey !== null) {
            $delta = [];
            foreach ($muestrasOut as $mk => $mv) {
                if (!in_array($mk, $mergeKeysBefore, true)) {
                    $delta[$mk] = $mv;
                }
            }
            $mergeCache[$mergeCacheKey] = $delta;
        }
    }
}

if (!function_exists('estcumpl_planta_incubacion_bb_metrics_catalog')) {
    /**
     * Métricas g_plantadeincubacion_det2 (supervisión vacunación + calidad). kind: abs | pct_muestreados | pct_calidad.
     * Columnas alineadas a capturas de app; verificar SHOW COLUMNS en ambiente (p. ej. deshitratados).
     *
     * @return list<array{v:string,l:string,kind:string,col:string,categoria:string}>
     */
    function estcumpl_planta_incubacion_bb_metrics_catalog(): array {
        static $cat = null;
        if ($cat !== null) {
            return $cat;
        }
        $cat = [];
        $addAbs = function (string $col, string $label, string $categoria) use (&$cat): void {
            $cat[] = ['v' => $col, 'l' => $label, 'kind' => 'abs', 'col' => $col, 'categoria' => $categoria];
        };
        $addPctM = function (string $vkey, string $col, string $label) use (&$cat): void {
            $cat[] = ['v' => $vkey, 'l' => $label, 'kind' => 'pct_muestreados', 'col' => $col, 'categoria' => 'eficiencia'];
        };
        $addPctC = function (string $vkey, string $col, string $label) use (&$cat): void {
            $cat[] = ['v' => $vkey, 'l' => $label, 'kind' => 'pct_calidad', 'col' => $col, 'categoria' => 'calidad'];
        };
        $addAbs('temperatura_area_vacunacion', 'Temperatura área vacunación (°C)', 'eficiencia');
        $addAbs('hr_area_vacunacion', 'HR área vacunación (%)', 'eficiencia');
        $addAbs('total_pollos_muestreados', 'Total pollos muestreados (vacunación)', 'eficiencia');
        $vacCols = [
            ['pollos_mojados', 'Pollos mojados (N)'],
            ['pollos_con_sangre', 'Pollos con sangre (N)'],
            ['pollos_con_coagulo', 'Pollos con coágulo (N)'],
            ['mala_aplicacion', 'Mala aplicación vacuna (N)'],
            ['pollo_sin_vacuna', 'Pollo sin vacuna (N)'],
            ['otros_vacunacion', 'Otros (vacunación) (N)'],
        ];
        foreach ($vacCols as $p) {
            $addAbs($p[0], $p[1], 'eficiencia');
            $addPctM('pct_' . $p[0], $p[0], '% ' . $p[1] . ' / muestreados vac.');
        }
        $addAbs('total_pollos_muestreados_calidad', 'Total pollos muestreados (calidad)', 'calidad');
        $calAbs = [
            ['baja_vivacidad', 'Baja vivacidad (N)'],
            ['pollo_enano', 'Pollo enano (N)'],
            ['muertos', 'Muertos (N)'],
            ['ombligo_mal_cicatrizado', 'Ombligo mal cicatrizado (N)'],
            ['pulmon_pegajoso', 'Pulmón pegajoso (N)'],
            ['postrados', 'Postrados (N)'],
            ['heridos', 'Heridos (N)'],
            ['codos_rojos', 'Codos rojos (N)'],
            ['pico_rojo', 'Pico rojo (N)'],
            ['defectos_fisicos_geneticos', 'Defectos físicos/genéticos (N)'],
            ['abdomen_hinchado', 'Abdomen hinchado (N)'],
            ['deshitratados', 'Deshidratados (N)'],
            ['otros_calidad', 'Otros (calidad) (N)'],
            ['ae_limp_sec', 'Aspecto externo: limpio y seco (N)'],
            ['ae_hume_peg', 'Aspecto externo: húmedo y pegajoso (N)'],
            ['ae_cojos', 'Aspecto externo: cojos (N)'],
            ['ae_defec', 'Aspecto externo: defectuoso (N)'],
            ['vi_vivaz', 'Vivacidad: vivaz (N)'],
            ['vi_debil', 'Vivacidad: débil (N)'],
            ['oj_abie_brill', 'Ojos: abiertos y brillantes (N)'],
            ['oj_cerrados', 'Ojos: cerrados (N)'],
            ['om_cerra_sin_cica', 'Ombligo: cerrado sin cicatriz (N)'],
            ['om_cerra_con_cica', 'Ombligo: cerrado con cicatriz (N)'],
            ['om_abie_enro', 'Ombligo: abierto o enrojecido (N)'],
            ['ab_normal', 'Abdomen: normal (N)'],
            ['ab_gran_abul', 'Abdomen: grande y abultado (N)'],
            ['tp_normal', 'Tarsos y picos: normal (N)'],
            ['tp_enrojecido', 'Tarsos y picos: enrojecido (N)'],
            ['tp_deshidratado', 'Tarsos y picos: deshidratado (N)'],
        ];
        foreach ($calAbs as $p) {
            $addAbs($p[0], $p[1], 'calidad');
            $suffix = $p[0];
            $addPctC('pct_cal_' . $suffix, $p[0], '% ' . str_replace(' (N)', '', $p[1]));
        }

        $transporteCols = [
            ['da_extractores_funcionales', 'Cumple con: Extractores funcionales'],
            ['da_ventiladores_funcionales', 'Cumple con: Ventiladores funcionales'],
            ['da_dampers_activos', 'Cumple con: Dampers activos'],
            ['da_aspersores_funcionales', 'Cumple con: Aspersores funcionales'],
            ['da_tanque_agua', 'Cumple con: Tanque con agua para aspersión lleno'],
            ['da_boleta_limpieza_interna', 'Cumple con: Boleta de limpieza interna'],
            ['da_boleta_limpieza_externa', 'Cumple con: Boleta de limpieza externa'],
            ['da_puntualidad_llegada', 'Cumple con: Puntualidad de llegada a planta'],
            ['da_limpieza_tolva', 'Cumple con: Limpieza de tolva de camión'],
            ['da_presencia_operador', 'Cumple con: Presencia de 2 operadores de la unidad'],
            ['da_operador_cuarentena', 'Cumple con: Operadores y unidad de transporte con cuarentena previa'],
        ];
        foreach ($transporteCols as $p) {
            $addAbs($p[0], $p[1], 'transporte');
        }

        return $cat;
    }
}

if (!function_exists('estcumpl_planta_incubacion_bb_metric_keys')) {
    /** @return list<string> */
    function estcumpl_planta_incubacion_bb_metric_keys(): array {
        $keys = [];
        foreach (estcumpl_planta_incubacion_bb_metrics_catalog() as $row) {
            $v = trim((string)($row['v'] ?? ''));
            if ($v !== '') {
                $keys[] = $v;
            }
        }

        return $keys;
    }
}

if (!function_exists('estcumpl_planta_incubacion_bb_metric_def')) {
    /** @return array{v:string,l:string,kind:string,col:string,categoria:string}|null */
    function estcumpl_planta_incubacion_bb_metric_def(string $metricKey): ?array {
        $want = trim($metricKey);
        if ($want === '') {
            return null;
        }
        foreach (estcumpl_planta_incubacion_bb_metrics_catalog() as $row) {
            if (trim((string)($row['v'] ?? '')) === $want) {
                return $row;
            }
        }

        return null;
    }
}

if (!function_exists('estcumpl_planta_incubacion_bb_metric_clean_label')) {
    function estcumpl_planta_incubacion_bb_metric_clean_label(string $base): string {
        $d = estcumpl_planta_incubacion_bb_metric_def($base);
        if ($d === null) {
            return $base;
        }

        return trim(str_replace(' (N)', '', (string)($d['l'] ?? $base)));
    }
}

if (!function_exists('estcumpl_planta_incubacion_bb_metric_base_valid')) {
    function estcumpl_planta_incubacion_bb_metric_base_valid(string $base): bool {
        $d = estcumpl_planta_incubacion_bb_metric_def($base);
        return $d !== null && ($d['kind'] ?? '') === 'abs';
    }
}

if (!function_exists('estcumpl_planta_incubacion_bb_metrics_ui_for_api')) {
    /**
     * Una fila por métrica base (sin duplicar N vs %). UI: métrica + modo cantidad/porcentaje.
     *
     * @return list<array{v:string,l:string,categoria:string,allowsPct:bool}>
     */
    function estcumpl_planta_incubacion_bb_metrics_ui_for_api(): array {
        /** Etiquetas UI «Eficiencia vacunación (PI)» (columnas en g_plantadeincubacion_det2). */
        $eficienciaUiEtiquetas = [
            'pollos_mojados' => 'Pollo mojados',
            'pollos_con_sangre' => 'Pollo con sangre',
            'pollos_con_coagulo' => 'Pollo con coágulo',
            'mala_aplicacion' => 'Mala aplicación',
            'pollo_sin_vacuna' => 'Pollo sin vacuna',
            'otros_vacunacion' => 'Otros (vacunación)',
        ];
        /** Solo estas opciones en el select «Check list calidad (PI)» (orden fijo). */
        $calidadUiOrden = [
            'ae_limp_sec' => 'Aspecto externo: limpio y seco',
            'ae_hume_peg' => 'Aspecto externo: húmedo y pegajoso',
            'ab_gran_abul' => 'Abdomen: Grande y abultado',
            'ab_normal' => 'Abdomen: Normal',
            'ae_cojos' => 'Aspecto externo: cojos',
            'ae_defec' => 'Aspecto externo: defectuoso',
            'oj_abie_brill' => 'Ojos: abiertos y brillantes',
            'oj_cerrados' => 'Ojos: cerrados',
            'om_abie_enro' => 'Ombligo: abierto o enrojecido',
            'om_cerra_con_cica' => 'Ombligo: cerrado con cicatriz',
            'om_cerra_sin_cica' => 'Ombligo: cerrado sin cicatriz',
            'tp_deshidratado' => 'Tarsos y picos: deshidratado',
            'tp_enrojecido' => 'Tarsos y picos: enrojecido',
            'tp_normal' => 'Tarsos y picos: normal',
            'vi_debil' => 'Vivacidad: debil',
            'vi_vivaz' => 'Vivacidad: vivaz',
        ];
        $calidadPermitidas = array_flip(array_keys($calidadUiOrden));
        $out = [];
        foreach (estcumpl_planta_incubacion_bb_metrics_catalog() as $row) {
            if (($row['kind'] ?? '') !== 'abs') {
                continue;
            }
            $base = trim((string)($row['v'] ?? ''));
            if ($base === '') {
                continue;
            }
            $cat = strtolower((string)($row['categoria'] ?? ''));
            if ($cat === 'calidad' && !isset($calidadPermitidas[$base])) {
                continue;
            }
            $allowsPct = false;
            if ($cat === 'calidad') {
                $allowsPct = estcumpl_planta_incubacion_bb_metric_def('pct_cal_' . $base) !== null;
            } elseif ($cat === 'eficiencia') {
                $allowsPct = estcumpl_planta_incubacion_bb_metric_def('pct_' . $base) !== null;
            }
            if ($cat === 'calidad' && isset($calidadUiOrden[$base])) {
                $label = $calidadUiOrden[$base];
            } elseif ($cat === 'eficiencia' && isset($eficienciaUiEtiquetas[$base])) {
                $label = $eficienciaUiEtiquetas[$base];
            } else {
                $label = estcumpl_planta_incubacion_bb_metric_clean_label($base);
            }
            $out[] = [
                'v' => $base,
                'l' => $label,
                'categoria' => $cat,
                'allowsPct' => $allowsPct,
            ];
        }

        $bufCal = [];
        $bufOtro = [];
        foreach ($out as $item) {
            if (strtolower((string)($item['categoria'] ?? '')) === 'calidad') {
                $bufCal[(string)($item['v'] ?? '')] = $item;
            } else {
                $bufOtro[] = $item;
            }
        }
        $calOrdenada = [];
        foreach (array_keys($calidadUiOrden) as $k) {
            if (isset($bufCal[$k])) {
                $calOrdenada[] = $bufCal[$k];
            }
        }

        return array_merge($bufOtro, $calOrdenada);
    }
}

if (!function_exists('estcumpl_planta_incubacion_bb_metric_normalize_input')) {
    /**
     * @return array{base:string, valorModo:'cantidad'|'porcentaje', categoria:string}|null
     */
    function estcumpl_planta_incubacion_bb_metric_normalize_input(string $metricKeyRaw, $valorModoRaw, string $categoriaRaw): ?array {
        $mk = trim($metricKeyRaw);
        if ($mk === '') {
            return null;
        }
        $vmIn = strtolower(trim((string)$valorModoRaw));
        $vm = ($vmIn === 'porcentaje') ? 'porcentaje' : 'cantidad';

        if (strpos($mk, 'pct_cal_') === 0) {
            $base = substr($mk, strlen('pct_cal_'));

            return ['base' => $base, 'valorModo' => 'porcentaje', 'categoria' => 'calidad'];
        }
        if (strpos($mk, 'pct_') === 0) {
            $rest = substr($mk, strlen('pct_'));

            return ['base' => $rest, 'valorModo' => 'porcentaje', 'categoria' => 'eficiencia'];
        }
        if (!estcumpl_planta_incubacion_bb_metric_base_valid($mk)) {
            return null;
        }
        $dAbs = estcumpl_planta_incubacion_bb_metric_def($mk);
        $catDef = strtolower((string)($dAbs['categoria'] ?? 'eficiencia'));
        $catIn = strtolower(trim($categoriaRaw));
        $cat = in_array($catIn, ['eficiencia', 'calidad'], true) ? $catIn : $catDef;
        if ($cat !== $catDef) {
            $cat = $catDef;
        }

        return ['base' => $mk, 'valorModo' => $vm, 'categoria' => $cat];
    }
}

if (!function_exists('estcumpl_planta_incubacion_bb_resolve_def_from_norm')) {
    /**
     * @param array{base:string, valorModo:'cantidad'|'porcentaje', categoria:string} $norm
     * @return array{v:string,l:string,kind:string,col:string,categoria:string}|null
     */
    function estcumpl_planta_incubacion_bb_resolve_def_from_norm(array $norm): ?array {
        $base = $norm['base'];
        $mr = $norm['valorModo'];
        if ($base === 'total_pollos_muestreados' || $base === 'total_pollos_muestreados_calidad') {
            if ($mr === 'porcentaje') {
                return null;
            }

            return estcumpl_planta_incubacion_bb_metric_def($base);
        }
        if ($mr === 'cantidad') {
            return estcumpl_planta_incubacion_bb_metric_def($base);
        }
        $cat = $norm['categoria'];
        if ($cat === 'calidad') {
            return estcumpl_planta_incubacion_bb_metric_def('pct_cal_' . $base);
        }

        return estcumpl_planta_incubacion_bb_metric_def('pct_' . $base);
    }
}

if (!function_exists('estcumpl_planta_incubacion_bb_metric_def_from_info')) {
    function estcumpl_planta_incubacion_bb_metric_def_from_info(array $inf): ?array {
        $mk = trim((string)($inf['metricKey'] ?? $inf['campoValor'] ?? ''));
        $vmRaw = $inf['valorModo'] ?? 'cantidad';
        $catRaw = (string)($inf['categoria'] ?? '');
        $norm = estcumpl_planta_incubacion_bb_metric_normalize_input($mk, $vmRaw, $catRaw);
        if ($norm === null) {
            return null;
        }

        return estcumpl_planta_incubacion_bb_resolve_def_from_norm($norm);
    }
}

if (!function_exists('estcumpl_merge_planta_incubacion_bb_std_row')) {
    /**
     * Rellena $muestrasOut desde g_plantadeincubacion_det1 + det2 (formato PlantaIncubacion).
     *
     * @param array<string,array<string,mixed>> $muestrasOut
     * @param array<string,mixed> $std
     */
    function estcumpl_merge_planta_incubacion_bb_std_row(
        mysqli $conn,
        array $rango,
        array $filtroGranjas,
        array $filtroGgPares,
        array &$muestrasOut,
        array $std
    ): void {
        if (empty($rango['desde']) || empty($rango['hasta'])) {
            return;
        }
        $tpStd = strtolower(trim((string)($std['tipoParametro'] ?? '')));
        if ($tpStd !== 'planta_incubacion_bb' && $tpStd !== 'g_plantadeincubacion_det2') {
            return;
        }
        $nivelNorm = trim((string)($std['nivelNorm'] ?? ''));
        $paramVariants = isset($std['paramVariants']) && is_array($std['paramVariants']) ? $std['paramVariants'] : [];
        if ($nivelNorm === '' || $paramVariants === []) {
            return;
        }
        $inf = estcumpl_info_origen_array($std['infoOrigen'] ?? []);
        $def = estcumpl_planta_incubacion_bb_metric_def_from_info($inf);
        if ($def === null) {
            return;
        }
        $fmt = trim((string)($inf['formato'] ?? 'PlantaIncubacion'));
        if ($fmt === '') {
            $fmt = 'PlantaIncubacion';
        }
        $tbl1 = 'g_plantadeincubacion_det1';
        $tbl2 = 'g_plantadeincubacion_det2';
        $t1 = @$conn->query("SHOW TABLES LIKE '" . $conn->real_escape_string($tbl1) . "'");
        $t2 = @$conn->query("SHOW TABLES LIKE '" . $conn->real_escape_string($tbl2) . "'");
        if (!$t1 || $t1->num_rows < 1 || !$t2 || $t2->num_rows < 1) {
            return;
        }
        $col = $def['col'];
        if ($col === 'ae_cojos' && !estcumpl_col_exists($conn, $tbl2, 'ae_cojos') && estcumpl_col_exists($conn, $tbl2, 'ae_defec')) {
            $col = 'ae_defec';
        }
        if (!estcumpl_col_exists($conn, $tbl2, $col)) {
            return;
        }
        $kind = $def['kind'];
        $colE = '`' . str_replace('`', '', $col) . '`';
        if ($kind === 'abs') {
            $valSql = 'CAST(COALESCE(d2.' . $colE . ',0) AS DECIMAL(18,6))';
        } elseif ($kind === 'pct_muestreados') {
            if (!estcumpl_col_exists($conn, $tbl2, 'total_pollos_muestreados')) {
                return;
            }
            $valSql = '(100.0 * CAST(COALESCE(d2.' . $colE . ',0) AS DECIMAL(18,6)) / NULLIF(CAST(COALESCE(d2.`total_pollos_muestreados`,0) AS DECIMAL(18,6)),0))';
        } else {
            $den = 'total_pollos_muestreados_calidad';
            if (!estcumpl_col_exists($conn, $tbl2, $den)) {
                return;
            }
            $valSql = '(100.0 * CAST(COALESCE(d2.' . $colE . ',0) AS DECIMAL(18,6)) / NULLIF(CAST(COALESCE(d2.`total_pollos_muestreados_calidad`,0) AS DECIMAL(18,6)),0))';
        }

        $sql = "SELECT DATE(d2.fecha) AS fecha_ref,
                       LEFT(TRIM(d1.granja), 3) AS granja,
                       RIGHT(TRIM(d1.granja), 3) AS campania,
                       TRIM(SUBSTRING_INDEX(d1.galpones, '-', 1)) AS galpon,
                       TRIM(d2.numero) AS numero,
                       TRIM(d2.formato) AS formato,
                       {$valSql} AS val_agg
                FROM `{$tbl2}` d2
                INNER JOIN `{$tbl1}` d1
                  ON d1.fecha = d2.fecha AND d1.numero = d2.numero AND d1.formato = d2.formato
                WHERE DATE(d2.fecha) >= ? AND DATE(d2.fecha) <= ?
                  AND TRIM(d2.formato) = ?
                  AND TRIM(d1.granja) <> ''
                  AND TRIM(d1.galpones) <> ''";
        $params = [$rango['desde'], $rango['hasta'], $fmt];
        $types = 'sss';

        $granjasNorm = [];
        foreach ($filtroGranjas as $g) {
            $g = substr(str_pad(trim((string)$g), 3, '0', STR_PAD_LEFT), 0, 3);
            if ($g !== '') {
                $granjasNorm[$g] = true;
            }
        }
        $granjasNorm = array_keys($granjasNorm);
        $ggNorm = [];
        foreach ($filtroGgPares as $pr) {
            $g3 = substr(str_pad(trim((string)($pr['g'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
            $gp = trim((string)($pr['gp'] ?? ''));
            if ($g3 !== '' && $gp !== '') {
                $ggNorm[] = ['g3' => $g3, 'gp' => $gp];
            }
        }
        if (count($granjasNorm) > 0 || count($ggNorm) > 0) {
            $refG = 'LEFT(TRIM(d1.granja), 3)';
            $refGp = "TRIM(SUBSTRING_INDEX(d1.galpones, '-', 1))";
            $sub = [];
            if (count($granjasNorm) > 0) {
                $ph = implode(',', array_fill(0, count($granjasNorm), '?'));
                $sub[] = "{$refG} IN ($ph)";
                foreach ($granjasNorm as $g) {
                    $params[] = $g;
                    $types .= 's';
                }
            }
            if (count($ggNorm) > 0) {
                $conj = [];
                foreach ($ggNorm as $rowGg) {
                    $conj[] = "({$refG} = ? AND {$refGp} = ?)";
                    $params[] = $rowGg['g3'];
                    $types .= 's';
                    $params[] = $rowGg['gp'];
                    $types .= 's';
                }
                $sub[] = '(' . implode(' OR ', $conj) . ')';
            }
            $sql .= ' AND (' . implode(' OR ', $sub) . ')';
        }

        $st = $conn->prepare($sql);
        if (!$st) {
            return;
        }
        $bind = [];
        $bind[] = $types;
        foreach ($params as $p) {
            $bind[] = $p;
        }
        $refs = [];
        foreach ($bind as $k => $v) {
            $refs[$k] = &$bind[$k];
        }
        call_user_func_array([$st, 'bind_param'], $refs);
        if (!$st->execute()) {
            $st->close();

            return;
        }
        $rows = estcumpl_stmt_fetch_all_assoc($st);
        $st->close();

        foreach ($rows as $row) {
            $granja = trim((string)($row['granja'] ?? ''));
            $campania = trim((string)($row['campania'] ?? ''));
            $galpon = trim((string)($row['galpon'] ?? ''));
            $fref = trim((string)($row['fecha_ref'] ?? ''));
            $numero = trim((string)($row['numero'] ?? ''));
            $formato = trim((string)($row['formato'] ?? ''));
            $vagg = $row['val_agg'] ?? null;
            if ($granja === '' || $galpon === '' || $fref === '' || $numero === '') {
                continue;
            }
            $val = ($vagg !== null && is_numeric($vagg)) ? (float)$vagg : null;
            if ($val === null) {
                continue;
            }
            $key = $granja . '|' . $campania . '|' . $galpon . '|PIBB|' . $numero . '|' . $formato . '|' . $fref;
            if (!isset($muestrasOut[$key])) {
                $muestrasOut[$key] = [
                    'granja' => $granja,
                    'campania' => $campania,
                    'galpon' => $galpon,
                    'codEnvio' => '',
                    'posSolicitud' => 0,
                    'fectra' => $fref,
                    'tdate' => $fref,
                    'tcencos' => '',
                    'tipoEstandar' => trim((string)($std['nivelRaw'] ?? '')),
                    'registros' => [],
                ];
            }
            foreach ($paramVariants as $pv) {
                $pvn = trim((string)$pv);
                if ($pvn === '') {
                    continue;
                }
                if (!isset($muestrasOut[$key]['registros'][$nivelNorm])) {
                    $muestrasOut[$key]['registros'][$nivelNorm] = [];
                }
                if (!isset($muestrasOut[$key]['registros'][$nivelNorm][$pvn])) {
                    $muestrasOut[$key]['registros'][$nivelNorm][$pvn] = $val;
                } else {
                    $muestrasOut[$key]['registros'][$nivelNorm][$pvn] = max(
                        (float)$muestrasOut[$key]['registros'][$nivelNorm][$pvn],
                        $val
                    );
                }
            }
        }
    }
}

if (!function_exists('estcumpl_regnocontable_temp_cono_sql_pares_tcencos')) {
    /**
     * Fragmento SQL AND (...) por pares LEFT(tcencos,3) + RIGHT(tcencos,3).
     *
     * @param list<array{granja?:string,campania?:string}> $pares
     * @return array{0:string,1:list<mixed>,2:string} [sqlFragment, params, types]
     */
    function estcumpl_regnocontable_temp_cono_sql_pares_tcencos(array $pares, string $colPrefix): array {
        $colPrefix = $colPrefix === '' ? '' : rtrim($colPrefix, '.') . '.';
        $conj = [];
        $params = [];
        $types = '';
        foreach ($pares as $pc) {
            if (!is_array($pc)) {
                continue;
            }
            $g = substr(str_pad(trim((string)($pc['granja'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
            $c = substr(str_pad(trim((string)($pc['campania'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
            if ($g === '' || $c === '') {
                continue;
            }
            $tc = $colPrefix === '' ? 'tcencos' : $colPrefix . 'tcencos';
            $conj[] = "(LEFT(TRIM({$tc}), 3) = ? AND RIGHT(TRIM({$tc}), 3) = ?)";
            $params[] = $g;
            $params[] = $c;
            $types .= 'ss';
        }
        if ($conj === []) {
            return ['', [], ''];
        }

        return [' AND (' . implode(' OR ', $conj) . ')', $params, $types];
    }
}

if (!function_exists('estcumpl_regnocontable_temp_cono_pares_granja_campania_periodo')) {
    /**
     * Pares granja+campaña (tcencos 6 dígitos → 3+3) presentes en el periodo para filtrar TEMP_CONO solo por campaña.
     *
     * Orden de obtención:
     * 1) cargapollo_proyeccion — DISTINCT tcencos con DATE(fecha) en el rango (proyección de carga pollos).
     * 2) regnocontable — cualquier proceso app registrable con fecha de registro en el rango (respaldo).
     * 3) cargaproduccion00 — fecha + tcencos (respaldo).
     *
     * Con pares no vacíos, TEMP_CONO se filtra solo por tcencos (sin acotar por fecha en la lectura).
     *
     * @return list<array{granja:string,campania:string}>
     */
    function estcumpl_regnocontable_temp_cono_pares_granja_campania_periodo(
        mysqli $conn,
        array $rango,
        array $filtroGranjas,
        array $filtroGgPares
    ): array {
        if (empty($rango['desde']) || empty($rango['hasta'])) {
            return [];
        }
        $granjasNorm = [];
        foreach ($filtroGranjas as $g) {
            $g = substr(str_pad(trim((string)$g), 3, '0', STR_PAD_LEFT), 0, 3);
            if ($g !== '') {
                $granjasNorm[$g] = true;
            }
        }
        $granjasNorm = array_keys($granjasNorm);
        $ggNorm = [];
        foreach ($filtroGgPares as $pr) {
            $g3 = substr(str_pad(trim((string)($pr['g'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
            $gp = trim((string)($pr['gp'] ?? ''));
            if ($g3 !== '' && $gp !== '') {
                $ggNorm[] = ['g3' => $g3, 'gp' => $gp];
            }
        }

        $appendFiltrosGgSql = static function (
            string $aliasTcencos,
            string $aliasTcodint,
            string &$sql,
            array &$params,
            string &$types,
            array $granjasNorm,
            array $ggNorm
        ): void {
            if (count($granjasNorm) === 0 && count($ggNorm) === 0) {
                return;
            }
            $sub = [];
            if (count($granjasNorm) > 0) {
                $ph = implode(',', array_fill(0, count($granjasNorm), '?'));
                $sub[] = "LEFT(TRIM({$aliasTcencos}), 3) IN ($ph)";
                foreach ($granjasNorm as $g) {
                    $params[] = $g;
                    $types .= 's';
                }
            }
            if (count($ggNorm) > 0) {
                $conj = [];
                foreach ($ggNorm as $row) {
                    $conj[] = '(LEFT(TRIM(' . $aliasTcencos . '), 3) = ? AND CAST(COALESCE(NULLIF(TRIM(' . $aliasTcodint . '), \'\'), \'0\') AS UNSIGNED) = CAST(? AS UNSIGNED))';
                    $params[] = $row['g3'];
                    $types .= 's';
                    $params[] = $row['gp'];
                    $types .= 's';
                }
                $sub[] = '(' . implode(' OR ', $conj) . ')';
            }
            $sql .= ' AND (' . implode(' OR ', $sub) . ')';
        };

        $appendSoloGranjasDesdeFiltro = static function (
            string $tcencosExpr,
            string &$sql,
            array &$params,
            string &$types,
            array $granjasNorm,
            array $ggNorm
        ): void {
            if (count($granjasNorm) === 0 && count($ggNorm) === 0) {
                return;
            }
            $gEff = [];
            foreach ($granjasNorm as $g) {
                $gEff[$g] = true;
            }
            foreach ($ggNorm as $row) {
                $gEff[$row['g3']] = true;
            }
            $gEff = array_keys($gEff);
            if (count($gEff) === 0) {
                return;
            }
            $phG = implode(',', array_fill(0, count($gEff), '?'));
            $sql .= " AND LEFT(TRIM({$tcencosExpr}), 3) IN ({$phG})";
            foreach ($gEff as $g) {
                $params[] = $g;
                $types .= 's';
            }
        };

        $ingestParesRs = static function ($rs, array &$out, array &$seen): void {
            if (!$rs) {
                return;
            }
            while ($row = $rs->fetch_assoc()) {
                $g = trim((string)($row['granja'] ?? ''));
                $c = trim((string)($row['campania'] ?? ''));
                if ($g === '' || $c === '') {
                    continue;
                }
                $g = substr(str_pad($g, 3, '0', STR_PAD_LEFT), 0, 3);
                $c = substr(str_pad($c, 3, '0', STR_PAD_LEFT), 0, 3);
                $kk = $g . '|' . $c;
                if (isset($seen[$kk])) {
                    continue;
                }
                $seen[$kk] = true;
                $out[] = ['granja' => $g, 'campania' => $c];
            }
        };

        $out = [];
        $seen = [];

        if (estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'fecha')
            && estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'tcencos')) {
            $sqlCp = "SELECT DISTINCT LEFT(TRIM(tcencos), 3) AS granja, RIGHT(TRIM(tcencos), 3) AS campania
                      FROM cargapollo_proyeccion
                      WHERE DATE(fecha) >= ? AND DATE(fecha) <= ?
                        AND TRIM(tcencos) <> ''";
            $paramsCp = [$rango['desde'], $rango['hasta']];
            $typesCp = 'ss';
            if (estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'tcodint')) {
                $appendFiltrosGgSql('tcencos', 'tcodint', $sqlCp, $paramsCp, $typesCp, $granjasNorm, $ggNorm);
            } else {
                $appendSoloGranjasDesdeFiltro('tcencos', $sqlCp, $paramsCp, $typesCp, $granjasNorm, $ggNorm);
            }
            $stCp = $conn->prepare($sqlCp);
            if ($stCp) {
                $bindCp = [$typesCp];
                foreach ($paramsCp as $p) {
                    $bindCp[] = $p;
                }
                $refsCp = [];
                foreach ($bindCp as $k => $v) {
                    $refsCp[$k] = &$bindCp[$k];
                }
                call_user_func_array([$stCp, 'bind_param'], $refsCp);
                if ($stCp->execute()) {
                    $ingestParesRs($stCp->get_result(), $out, $seen);
                }
                $stCp->close();
            }
        }

        if ($out === []) {
            $tbl = 'regnocontable';
            if (estcumpl_col_exists($conn, $tbl, 'tcencos')
                && estcumpl_col_exists($conn, $tbl, 'tfectra')
                && estcumpl_col_exists($conn, $tbl, 'tproceso')
                && estcumpl_col_exists($conn, $tbl, 'tcantidad')) {
                $fecExpr = 'COALESCE(DATE(tfec_ini), DATE(tfectra))';
                if (!estcumpl_col_exists($conn, $tbl, 'tfec_ini')) {
                    $fecExpr = 'DATE(tfectra)';
                }
                $permit = estcumpl_regnocontable_tproceso_permitidos();
                $phProc = implode(',', array_fill(0, count($permit), '?'));
                $params = [];
                $types = '';
                foreach ($permit as $pProc) {
                    $params[] = strtoupper(trim((string)$pProc));
                    $types .= 's';
                }
                $params[] = $rango['desde'];
                $params[] = $rango['hasta'];
                $types .= 'ss';
                $sql = "SELECT DISTINCT LEFT(TRIM(tcencos), 3) AS granja, RIGHT(TRIM(tcencos), 3) AS campania
                        FROM `{$tbl}`
                        WHERE UPPER(TRIM(tproceso)) IN ({$phProc})
                          AND {$fecExpr} >= ? AND {$fecExpr} <= ?
                          AND TRIM(tcencos) <> ''";
                $appendFiltrosGgSql('tcencos', 'tcodint', $sql, $params, $types, $granjasNorm, $ggNorm);

                $st = $conn->prepare($sql);
                if ($st) {
                    $bind = [$types];
                    foreach ($params as $p) {
                        $bind[] = $p;
                    }
                    $refs = [];
                    foreach ($bind as $k => $v) {
                        $refs[$k] = &$bind[$k];
                    }
                    call_user_func_array([$st, 'bind_param'], $refs);
                    if ($st->execute()) {
                        $ingestParesRs($st->get_result(), $out, $seen);
                    }
                    $st->close();
                }
            }
        }

        if ($out !== [] || !estcumpl_col_exists($conn, 'cargaproduccion00', 'fecha')
            || !estcumpl_col_exists($conn, 'cargaproduccion00', 'tcencos')) {
            return $out;
        }
        $aliasC = 'carga0';
        $sqlC = "SELECT DISTINCT LEFT(TRIM({$aliasC}.tcencos), 3) AS granja, RIGHT(TRIM({$aliasC}.tcencos), 3) AS campania
                 FROM `cargaproduccion00` AS {$aliasC}
                 WHERE DATE({$aliasC}.fecha) >= ? AND DATE({$aliasC}.fecha) <= ?
                   AND TRIM({$aliasC}.tcencos) <> ''";
        $paramsC = [$rango['desde'], $rango['hasta']];
        $typesC = 'ss';
        $tcencosCol = $aliasC . '.tcencos';
        $tieneCodintCarga = estcumpl_col_exists($conn, 'cargaproduccion00', 'tcodint');
        if ($tieneCodintCarga) {
            $appendFiltrosGgSql($tcencosCol, $aliasC . '.tcodint', $sqlC, $paramsC, $typesC, $granjasNorm, $ggNorm);
        } elseif (count($granjasNorm) > 0 || count($ggNorm) > 0) {
            $gEff = [];
            foreach ($granjasNorm as $g) {
                $gEff[$g] = true;
            }
            foreach ($ggNorm as $row) {
                $gEff[$row['g3']] = true;
            }
            $gEff = array_keys($gEff);
            if (count($gEff) > 0) {
                $phG = implode(',', array_fill(0, count($gEff), '?'));
                $sqlC .= " AND LEFT(TRIM({$aliasC}.tcencos), 3) IN ({$phG})";
                foreach ($gEff as $g) {
                    $paramsC[] = $g;
                    $typesC .= 's';
                }
            }
        }
        $st2 = $conn->prepare($sqlC);
        if (!$st2) {
            return $out;
        }
        $bindC = [$typesC];
        foreach ($paramsC as $p) {
            $bindC[] = $p;
        }
        $refsC = [];
        foreach ($bindC as $k => $v) {
            $refsC[$k] = &$bindC[$k];
        }
        call_user_func_array([$st2, 'bind_param'], $refsC);
        if (!$st2->execute()) {
            $st2->close();

            return $out;
        }
        $rs2 = $st2->get_result();
        if (!$rs2) {
            $st2->close();

            return $out;
        }
        while ($row = $rs2->fetch_assoc()) {
            $g = trim((string)($row['granja'] ?? ''));
            $c = trim((string)($row['campania'] ?? ''));
            if ($g === '' || $c === '') {
                continue;
            }
            $g = substr(str_pad($g, 3, '0', STR_PAD_LEFT), 0, 3);
            $c = substr(str_pad($c, 3, '0', STR_PAD_LEFT), 0, 3);
            $kk = $g . '|' . $c;
            if (isset($seen[$kk])) {
                continue;
            }
            $seen[$kk] = true;
            $out[] = ['granja' => $g, 'campania' => $c];
        }
        $st2->close();

        return $out;
    }
}

if (!function_exists('estcumpl_valor_desde_analisis_bb_fila')) {
    /**
     * @param array<string,mixed> $r fila san_analisis_pollo_bb_adulto
     */
    function estcumpl_valor_desde_analisis_bb_fila(array $r, string $campoLab, bool $tieneColDato, bool $tieneColCount): ?float {
        $campoLab = trim($campoLab);
        if ($campoLab === '' || !in_array($campoLab, estcumpl_whitelist_campo_lab(), true)) {
            if ($tieneColDato) {
                $fuente = $r['dato'] ?? null;
                if ($fuente === null || $fuente === '' || (is_string($fuente) && trim($fuente) === '') || $fuente === 'No ingresado') {
                    $fuente = $tieneColCount ? ($r['count_muestras'] ?? null) : null;
                }
                if ($fuente !== null && $fuente !== '' && $fuente !== 'No ingresado') {
                    return is_numeric($fuente) ? (float)$fuente : null;
                }
            }
            return null;
        }
        if (!array_key_exists($campoLab, $r)) {
            return null;
        }
        $fuente = $r[$campoLab];
        if ($fuente === null || $fuente === '' || (is_string($fuente) && trim($fuente) === '') || $fuente === 'No ingresado') {
            return null;
        }
        return is_numeric($fuente) ? (float)$fuente : null;
    }
}

if (!function_exists('estcumpl_hc_galpon_key')) {
    /** Alineado a hc_lab_galpon_key (historia_pdf_programas_lib) para buckets PDF. */
    function estcumpl_hc_galpon_key(string $gp): string {
        $gp = trim($gp);
        if ($gp === '') {
            return '';
        }
        if (preg_match('/^\d+$/', $gp)) {
            $n = ltrim($gp, '0');
            return $n === '' ? '0' : $n;
        }
        // Alinear con historia_pdf_programas_lib: soportar galpones tipo G01, GALPON-02, etc.
        if (preg_match('/(\d+)$/', $gp, $m)) {
            $n = ltrim((string)($m[1] ?? ''), '0');
            if ($n !== '') {
                return $n;
            }
            if (($m[1] ?? '') === '0') {
                return '0';
            }
        }
        if (!function_exists('hc_pdf_norm_txt')) {
            return mb_strtolower($gp, 'UTF-8');
        }
        return hc_pdf_norm_txt($gp);
    }
}

if (!function_exists('estcumpl_norm_txt_necro_map')) {
    /**
     * Misma normalización que norm_txt() en generar_reporte_estandares_necropsia.php (variantes de parámetro).
     */
    function estcumpl_norm_txt_necro_map(string $v): string {
        $s = mb_strtolower(trim((string) $v), 'UTF-8');
        $s = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'],
            ['a', 'e', 'i', 'o', 'u', 'u', 'n'],
            $s
        );
        $s = preg_replace('/\s+/', ' ', $s);

        return trim((string) $s);
    }
}

if (!function_exists('estcumpl_param_variants_texto_parametro')) {
    /**
     * Equivalente a param_variants() del informe necropsia (prefijos color/aspecto/tamaño).
     *
     * @return list<string>
     */
    function estcumpl_param_variants_texto_parametro(string $parametroRaw): array {
        $n = estcumpl_norm_txt_necro_map($parametroRaw);
        $variants = [];
        if ($n !== '') {
            $variants[$n] = true;
        }
        foreach (['color ', 'aspecto ', 'tamano ', 'tamaño '] as $pref) {
            if (strpos($n, $pref) === 0) {
                $r = trim(substr($n, strlen($pref)));
                if ($r !== '') {
                    $variants[$r] = true;
                }
            }
        }

        return array_keys($variants);
    }
}

if (!function_exists('estcumpl_hc_regnocontable_line_prepare')) {
    /**
     * Prepara fila de estándar (p. ej. paramsMap) para merge/display regnocontable, alineado a
     * necro_map_estandar_det_row_solicitud en generar_reporte_estandares_necropsia.php.
     *
     * @param array<string, mixed> $line tipo, parametro, tipoParametro, infoOrigen…
     *
     * @return array{paramVariants: list<string>, infoOrigen: array<string, mixed>, tipoRaw: string, param: string}|null
     */
    function estcumpl_hc_regnocontable_line_prepare(array $line): ?array {
        $tipoRaw = trim((string) ($line['tipo'] ?? ''));
        $parametroRaw = trim((string) ($line['parametro'] ?? ''));
        if ($tipoRaw === '' || $parametroRaw === '') {
            return null;
        }
        $tpStd = strtolower(trim((string) ($line['tipoParametro'] ?? 'manual')));
        if ($tpStd === '') {
            $tpStd = 'manual';
        }
        $infStd = estcumpl_info_origen_array($line['infoOrigen'] ?? []);
        if ($tpStd !== 'regnocontable') {
            $tInf = strtoupper(trim((string) ($infStd['tproceso'] ?? '')));
            if ($tInf !== '' && in_array($tInf, estcumpl_regnocontable_tproceso_permitidos(), true)) {
                $tpStd = 'regnocontable';
            } else {
                $synthProbe = [
                    'tipoParametro' => 'regnocontable',
                    'parametroRaw' => $parametroRaw,
                    'nivelRaw' => $tipoRaw,
                    'infoOrigen' => $infStd,
                    'paramVariants' => [],
                ];
                $inferPt = estcumpl_regnocontable_inferir_tproceso_std($synthProbe);
                if ($inferPt !== '' && in_array($inferPt, estcumpl_regnocontable_tproceso_permitidos(), true)) {
                    $tpStd = 'regnocontable';
                }
            }
        }
        if ($tpStd !== 'regnocontable') {
            return null;
        }
        $tprocV = strtoupper(trim((string) ($infStd['tproceso'] ?? '')));
        $cvV = strtolower(trim((string) ($infStd['campoValor'] ?? 'tcantidad')));
        $stdForInfer = [
            'tipoParametro' => 'regnocontable',
            'parametroRaw' => $parametroRaw,
            'nivelRaw' => $tipoRaw,
            'infoOrigen' => $infStd,
            'paramVariants' => [],
        ];
        $inferredT = estcumpl_regnocontable_inferir_tproceso_std($stdForInfer);
        $efTproc = ($tprocV !== '' && in_array($tprocV, estcumpl_regnocontable_tproceso_permitidos(), true))
            ? $tprocV
            : $inferredT;
        if ($tprocV === 'DESINFECCION' && in_array($cvV, ['tiempo_limpieza_desinfeccion', 'tiempo_descanso_efectivo', 'tiempo_descanso_total'], true)) {
            $efTproc = 'DESINFECCION_LD';
        }
        if ($efTproc === 'PLAGAS') {
            estcumpl_regnocontable_enriquecer_inf_plagas_roedores($infStd, $parametroRaw, $tipoRaw);
            $cvV = strtolower(trim((string) ($infStd['campoValor'] ?? 'tcantidad')));
        }
        $cvGorgojo = $cvV;
        if ($efTproc === 'EVA_GORGOJO') {
            $cvGorgojo = estcumpl_regnocontable_campo_valor_gorgojo_resolve($cvV, $parametroRaw, $tipoRaw);
            if (in_array($cvGorgojo, ['gorgojo_prom_larva', 'gorgojo_prom_adulto'], true)) {
                $sv = (int) ($infStd['schemaVersion'] ?? 1);
                if ($sv < 1) {
                    $sv = 1;
                }
                $infStd = array_merge($infStd, [
                    'tproceso' => 'EVA_GORGOJO',
                    'campoValor' => $cvGorgojo,
                    'agregacion' => 'max',
                    'schemaVersion' => $sv,
                ]);
            }
        }
        $paramVars = [];
        if ($efTproc === 'EVA_GORGOJO' && in_array($cvGorgojo, ['gorgojo_prom_larva', 'gorgojo_prom_adulto'], true)) {
            $paramVars = estcumpl_param_variants_gorgojo($parametroRaw);
        } elseif ($efTproc === 'TEMP_CONO' && $cvV === 'tcantidad') {
            $paramVars = estcumpl_param_variants_temperatura_cono($parametroRaw);
        } else {
            $paramVars = estcumpl_param_variants_texto_parametro($parametroRaw);
        }
        // ACTAENTREGA: ancla canónica por ttipo para evitar desalineación por cambios de texto.
        if ($efTproc === 'ACTAENTREGA') {
            $ttAe = trim((string)($infStd['ttipo'] ?? ''));
            if ($ttAe !== '') {
                $tokAe = '__ae_tt_' . strtolower($ttAe);
                $existsAe = false;
                foreach ($paramVars as $pvAe) {
                    if (trim((string)$pvAe) === $tokAe) {
                        $existsAe = true;
                        break;
                    }
                }
                if (!$existsAe) {
                    $paramVars[] = $tokAe;
                }
            }
        }

        return [
            'paramVariants' => $paramVars,
            'infoOrigen' => $infStd,
            'tipoRaw' => $tipoRaw,
            'param' => $parametroRaw,
        ];
    }
}

if (!function_exists('estcumpl_hc_merge_regnocontable_lab_map')) {
    /**
     * Integra regnocontable en el mapa de historia clínica (hc_lab_bucket_add) según filas del estándar.
     * Eje efectivo: granja + campaña (tcencos / filtros de merge); $fechaDesde/$fechaHasta se ignoran (compatibilidad de firma).
     * Usa estcumpl_hc_regnocontable_line_prepare (misma lógica que necro_map_estandar_det_row_solicitud).
     *
     * @param array<string, array<int, array<string, mixed>>> $paramsMapByPathCodigo
     */
    function estcumpl_hc_merge_regnocontable_lab_map(
        mysqli $conn,
        array &$acc,
        string $granja3,
        string $camp3,
        string $fechaDesde,
        string $fechaHasta,
        array $paramsMapByPathCodigo
    ): void {
        if (!function_exists('hc_lab_bucket_add') || !function_exists('hc_pdf_norm_txt') || !function_exists('estcumpl_hc_regnocontable_line_prepare')) {
            return;
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), 0, 3);
        unset($fechaDesde, $fechaHasta);
        if ($g3 === '' || $c3 === '') {
            return;
        }
        /** Matriz HC: eje campaña en SQL (RIGHT tcencos / pares TEMP_CONO); rango amplío para ramas que aún incluyen fecha en WHERE. */
        $rango = ['desde' => '1900-01-01', 'hasta' => '2100-12-31'];
        $mergeTraceHc = null;
        foreach ($paramsMapByPathCodigo as $lines) {
            foreach ($lines as $line) {
                if (!is_array($line)) {
                    continue;
                }
                $prep = estcumpl_hc_regnocontable_line_prepare($line);
                if ($prep === null) {
                    continue;
                }
                $param = $prep['param'];
                $tipoRaw = $prep['tipoRaw'];
                $paramVariants = $prep['paramVariants'];
                $info = $prep['infoOrigen'];
                $nivelNorm = hc_pdf_norm_txt(rtrim($tipoRaw, '.'));
                if ($nivelNorm === '') {
                    continue;
                }
                $infKey = $info;
                $tpInf = strtoupper(trim((string)($infKey['tproceso'] ?? '')));
                $cvInf = strtolower(trim((string)($infKey['campoValor'] ?? 'tcantidad')));
                $regNivelKey = $nivelNorm;
                if ($tpInf === 'TEMP_CONO' && $cvInf === 'tcantidad' && function_exists('hc_pdf_norm_txt')) {
                    $regNivelKey = hc_pdf_norm_txt(rtrim(trim('Manejo de cama'), '.'));
                }
                $std = [
                    'nivelNorm' => $regNivelKey,
                    'paramVariants' => $paramVariants,
                    'parametroRaw' => $param,
                    'nivelRaw' => $tipoRaw,
                    'tipoParametro' => 'regnocontable',
                    'infoOrigen' => $info,
                ];
                $edExHc = trim((string) ($line['edadDiaExpr'] ?? ''));
                if ($edExHc !== '') {
                    $std['edadDiaExpr'] = $edExHc;
                }
                $muestrasOut = [];
                $esTempConoTcant = ($tpInf === 'TEMP_CONO' && $cvInf === 'tcantidad');
                $paresTempConoHc = $esTempConoTcant ? [['granja' => $g3, 'campania' => $c3]] : null;
                $filtroCampSqlHc = $esTempConoTcant ? null : $c3;
                estcumpl_merge_regnocontable_std_row($conn, $rango, [$g3], [], $muestrasOut, $std, $mergeTraceHc, $filtroCampSqlHc, $paresTempConoHc);
                $diaMedTempCono = null;
                if ($tpInf === 'TEMP_CONO' && $cvInf === 'tcantidad' && function_exists('estcumpl_temp_cono_dia_medicion_desde_inf')) {
                    $diaMedTempCono = estcumpl_temp_cono_dia_medicion_desde_inf($infKey);
                }
                /**
                 * TEMP_CONO: ttipo = día 1–5, tsexo = cono; el merge devuelve una muestra por fecha_ref+galpón.
                 * Sin agregar, se acumularían 10 × N fechas en la misma celda. Tomamos el máximo por índice de cono en el rango
                 * (comparables entre lecturas del mismo día de medición). Clave de bucket: solo el param del estándar
                 * (p. ej. "t° cono dia 1"), no las variantes genéricas compartidas entre días 1–5.
                 */
                if ($diaMedTempCono !== null) {
                    /** @var array<string, array<int, float>> $aggConosPorGal índice cono 1..10 → temperatura */
                    $aggConosPorGal = [];
                    foreach ($muestrasOut as $bucket) {
                        if (!is_array($bucket)) {
                            continue;
                        }
                        $gBk = substr(str_pad(trim((string)($bucket['granja'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
                        $cBk = substr(str_pad(trim((string)($bucket['campania'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
                        if ($gBk !== $g3 || $cBk !== $c3) {
                            continue;
                        }
                        $gk = estcumpl_hc_galpon_key(trim((string)($bucket['galpon'] ?? '')));
                        if ($gk === '') {
                            continue;
                        }
                        $regBlock = $bucket['registros'][$regNivelKey] ?? null;
                        if (!is_array($regBlock)) {
                            continue;
                        }
                        $__tc = $regBlock['__tempCono'] ?? null;
                        if (!is_array($__tc)) {
                            continue;
                        }
                        $bloqueDia = $__tc[$diaMedTempCono] ?? $__tc[(string) $diaMedTempCono] ?? null;
                        if (!is_array($bloqueDia)) {
                            continue;
                        }
                        $conos = $bloqueDia['conos'] ?? null;
                        if (!is_array($conos) || $conos === []) {
                            continue;
                        }
                        if (!isset($aggConosPorGal[$gk])) {
                            $aggConosPorGal[$gk] = [];
                        }
                        foreach ($conos as $ciRaw => $tv) {
                            if (!is_numeric($tv)) {
                                continue;
                            }
                            $ci = (int) $ciRaw;
                            $v = (float) $tv;
                            if (!isset($aggConosPorGal[$gk][$ci])) {
                                $aggConosPorGal[$gk][$ci] = $v;
                            } else {
                                $aggConosPorGal[$gk][$ci] = max($aggConosPorGal[$gk][$ci], $v);
                            }
                        }
                    }
                    $paramKeyTc = hc_pdf_norm_txt(rtrim(trim($param), '.'));
                    if ($paramKeyTc !== '') {
                        foreach ($aggConosPorGal as $gkTc => $byCone) {
                            ksort($byCone, SORT_NUMERIC);
                            if (!isset($acc[$regNivelKey])) {
                                $acc[$regNivelKey] = [];
                            }
                            if (!isset($acc[$regNivelKey][$paramKeyTc])) {
                                $acc[$regNivelKey][$paramKeyTc] = [];
                            }
                            $acc[$regNivelKey][$paramKeyTc][$gkTc] = [
                                'nums' => [],
                                'strs' => [],
                                'coneIdx' => $byCone,
                            ];
                        }
                    }
                } else {
                    foreach ($muestrasOut as $bucket) {
                        if (!is_array($bucket)) {
                            continue;
                        }
                        $gBk = substr(str_pad(trim((string)($bucket['granja'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
                        $cBk = substr(str_pad(trim((string)($bucket['campania'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
                        if ($gBk !== $g3 || $cBk !== $c3) {
                            continue;
                        }
                        $gk = estcumpl_hc_galpon_key(trim((string)($bucket['galpon'] ?? '')));
                        if ($gk === '') {
                            continue;
                        }
                        $regBlock = $bucket['registros'][$regNivelKey] ?? null;
                        if (!is_array($regBlock)) {
                            continue;
                        }
                        foreach ($regBlock as $rk => $val) {
                            if ($rk === '__tempCono') {
                                continue;
                            }
                            if (is_array($val)) {
                                continue;
                            }
                            if (!is_numeric($val)) {
                                continue;
                            }
                            hc_lab_bucket_add($acc, $regNivelKey, (string) $rk, $gk, (float) $val);
                        }
                    }
                }
            }
        }
    }
}

if (!function_exists('estcumpl_hc_temphum_fecha_inicio_campania')) {
    function estcumpl_hc_temphum_fecha_inicio_campania(mysqli $conn, string $granja3, string $camp3): ?string
    {
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), 0, 3);
        if ($g3 === '' || $c3 === '') {
            return null;
        }
        if (function_exists('tabla_existe') && tabla_existe($conn, 'cargapollo_proyeccion')
            && estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'tcencos')
            && estcumpl_col_exists($conn, 'cargapollo_proyeccion', 'fecha')) {
            $sql = "SELECT MIN(DATE(fecha)) AS f_ini
                    FROM cargapollo_proyeccion
                    WHERE LEFT(TRIM(tcencos),3) = ? AND RIGHT(TRIM(tcencos),3) = ?";
            $st = $conn->prepare($sql);
            if ($st) {
                $st->bind_param('ss', $g3, $c3);
                if ($st->execute()) {
                    $rs = $st->get_result();
                    $rw = $rs ? $rs->fetch_assoc() : null;
                    $f = trim((string) ($rw['f_ini'] ?? ''));
                    $st->close();
                    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $f)) {
                        return $f;
                    }
                } else {
                    $st->close();
                }
            }
        }

        return null;
    }
}

if (!function_exists('estcumpl_hc_merge_temperatura_humedad_lab_map')) {
    /**
     * Historia clínica: integra san_temp_hum_cab/det en labMap para filas tipoParametro=temperatura_humedad.
     * Genera buckets por "Parámetro: Día N" usando Día 1 = inicio de campaña.
     *
     * @param array<string, list<array<string,mixed>>> $paramsMapByPathCodigo
     */
    function estcumpl_hc_merge_temperatura_humedad_lab_map(
        mysqli $conn,
        array &$acc,
        string $granja3,
        string $camp3,
        string $fechaDesde,
        string $fechaHasta,
        array $paramsMapByPathCodigo
    ): void {
        unset($fechaDesde, $fechaHasta);
        if (!function_exists('hc_lab_bucket_add') || !function_exists('hc_pdf_norm_txt') || !function_exists('estcumpl_info_origen_array')) {
            return;
        }
        $tbCab = 'san_temp_hum_cab';
        $tbDet = 'san_temp_hum_det';
        if (function_exists('tabla_existe')) {
            if (!tabla_existe($conn, $tbCab) || !tabla_existe($conn, $tbDet)) {
                return;
            }
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), 0, 3);
        if ($g3 === '' || $c3 === '') {
            return;
        }
        if (!function_exists('estcumpl_engine_parse_edad_dia_expr')) {
            $eng = __DIR__ . '/sip_estandares_eval_engine.php';
            if (is_readable($eng)) {
                require_once $eng;
            }
        }
        if (!estcumpl_col_exists($conn, $tbCab, 'id')
            || !estcumpl_col_exists($conn, $tbCab, 'codGranja')
            || !estcumpl_col_exists($conn, $tbCab, 'tipo')
            || !estcumpl_col_exists($conn, $tbDet, 'idCab')
            || !estcumpl_col_exists($conn, $tbDet, 'fecha_hora')
            || !estcumpl_col_exists($conn, $tbDet, 'codGalpon')
            || !estcumpl_col_exists($conn, $tbDet, 'valor')) {
            return;
        }
        $hasCampDet = estcumpl_col_exists($conn, $tbDet, 'campania');

        $specByTipoDia = [];
        foreach ($paramsMapByPathCodigo as $lines) {
            foreach ($lines as $line) {
                if (!is_array($line)) {
                    continue;
                }
                if (strtolower(trim((string) ($line['tipoParametro'] ?? ''))) !== 'temperatura_humedad') {
                    continue;
                }
                $info = estcumpl_info_origen_array($line['infoOrigen'] ?? []);
                $tipoData = strtoupper(trim((string) ($info['tipo'] ?? '')));
                if ($tipoData !== 'TEMPERATURA' && $tipoData !== 'HUMEDAD') {
                    continue;
                }
                $nivelNorm = hc_pdf_norm_txt(rtrim(trim((string) ($line['tipo'] ?? '')), '.'));
                if ($nivelNorm === '') {
                    continue;
                }
                $paramBase = trim((string) ($line['parametro'] ?? ''));
                if ($paramBase === '') {
                    $paramBase = $tipoData === 'HUMEDAD' ? 'Humedad ambiental' : 'Temperatura ambiental';
                }
                $aggTh = strtolower(trim((string) ($info['agregacion'] ?? 'avg')));
                if ($aggTh !== 'avg' && $aggTh !== 'min' && $aggTh !== 'max') {
                    $aggTh = 'avg';
                }
                $dias = [];
                $edadExpr = trim((string) ($line['edadDiaExpr'] ?? ''));
                if ($edadExpr !== '' && function_exists('estcumpl_engine_parse_edad_dia_expr')) {
                    $dias = estcumpl_engine_parse_edad_dia_expr($edadExpr);
                }
                if ($dias === []) {
                    continue;
                }
                foreach ($dias as $d) {
                    $d = (int) $d;
                    if ($d <= 0) {
                        continue;
                    }
                    $paramDia = $paramBase . ': Día ' . $d;
                    $paramNorm = hc_pdf_norm_txt(rtrim(trim($paramDia), '.'));
                    if ($paramNorm === '') {
                        continue;
                    }
                    $k = $nivelNorm . '|' . $tipoData . '|' . $d . '|' . $paramNorm;
                    $specByTipoDia[$tipoData][$d][$k] = [
                        'nivelNorm' => $nivelNorm,
                        'paramNorm' => $paramNorm,
                        'agregacion' => $aggTh,
                    ];
                }
            }
        }
        if ($specByTipoDia === []) {
            return;
        }

        $sql = "SELECT TRIM(d.codGalpon) AS galpon,
                       UPPER(TRIM(IFNULL(c.tipo,''))) AS tipo,
                       DATE(d.fecha_hora) AS fecha_ref,
                       d.fecha_hora AS fecha_hora,
                       CAST(d.valor AS DECIMAL(18,6)) AS val_num
                FROM {$tbDet} d
                INNER JOIN {$tbCab} c ON c.id = d.idCab
                WHERE TRIM(c.codGranja) = ?
                  AND TRIM(d.codGalpon) <> ''
                  AND UPPER(TRIM(IFNULL(c.tipo,''))) IN ('TEMPERATURA','HUMEDAD')";
        $types = 's';
        $params = [$g3];
        if ($hasCampDet) {
            $sql .= " AND TRIM(IFNULL(d.campania,'')) = ?";
            $types .= 's';
            $params[] = $c3;
        }
        $sql .= " ORDER BY d.fecha_hora ASC";
        $st = $conn->prepare($sql);
        if (!$st) {
            return;
        }
        $bind = [$types];
        foreach ($params as $p) {
            $bind[] = $p;
        }
        $refs = [];
        foreach ($bind as $i => $v) {
            $refs[$i] = &$bind[$i];
        }
        call_user_func_array([$st, 'bind_param'], $refs);
        if (!$st->execute()) {
            $st->close();
            return;
        }
        $rs = $st->get_result();
        $rows = [];
        while ($rs && ($rw = $rs->fetch_assoc())) {
            $rows[] = $rw;
        }
        $st->close();
        if ($rows === []) {
            return;
        }

        $fInicio = estcumpl_hc_temphum_fecha_inicio_campania($conn, $g3, $c3);
        if ($fInicio === null) {
            $fInicio = trim((string) ($rows[0]['fecha_ref'] ?? ''));
        }
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $fInicio)) {
            return;
        }
        $tsIni = strtotime($fInicio . ' 00:00:00');
        if ($tsIni === false) {
            return;
        }

        $aggBuckets = [];
        foreach ($rows as $rw) {
            $tipoData = strtoupper(trim((string) ($rw['tipo'] ?? '')));
            if (!isset($specByTipoDia[$tipoData])) {
                continue;
            }
            $galpon = trim((string) ($rw['galpon'] ?? ''));
            $gk = estcumpl_hc_galpon_key($galpon);
            if ($gk === '') {
                continue;
            }
            $fRef = trim((string) ($rw['fecha_ref'] ?? ''));
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fRef)) {
                continue;
            }
            $tsRef = strtotime($fRef . ' 00:00:00');
            if ($tsRef === false || $tsRef < $tsIni) {
                continue;
            }
            $dia = (int) floor(($tsRef - $tsIni) / 86400) + 1;
            if ($dia <= 0 || !isset($specByTipoDia[$tipoData][$dia])) {
                continue;
            }
            $valRaw = $rw['val_num'] ?? null;
            if ($valRaw === null || $valRaw === '' || !is_numeric($valRaw)) {
                continue;
            }
            $val = (float) $valRaw;
            $fechaHora = trim((string) ($rw['fecha_hora'] ?? ''));
            foreach ($specByTipoDia[$tipoData][$dia] as $sp) {
                $nivelNorm = (string) ($sp['nivelNorm'] ?? '');
                $paramNorm = (string) ($sp['paramNorm'] ?? '');
                $aggMode = strtolower(trim((string) ($sp['agregacion'] ?? 'avg')));
                if ($nivelNorm === '' || $paramNorm === '') {
                    continue;
                }
                if ($aggMode !== 'min' && $aggMode !== 'max' && $aggMode !== 'avg') {
                    $aggMode = 'avg';
                }
                $bkKey = $nivelNorm . '|' . $paramNorm . '|' . $gk;
                if (!isset($aggBuckets[$bkKey])) {
                    $aggBuckets[$bkKey] = [
                        'nivelNorm' => $nivelNorm,
                        'paramNorm' => $paramNorm,
                        'galKey' => $gk,
                        'agregacion' => $aggMode,
                        'nums' => [],
                        'series' => [],
                    ];
                }
                $aggBuckets[$bkKey]['nums'][] = $val;
                $aggBuckets[$bkKey]['series'][] = [
                    'x' => $fechaHora,
                    'y' => $val,
                ];
            }
        }
        foreach ($aggBuckets as $bk) {
            $nums = isset($bk['nums']) && is_array($bk['nums']) ? $bk['nums'] : [];
            if ($nums === []) {
                continue;
            }
            $aggMode = (string) ($bk['agregacion'] ?? 'avg');
            if ($aggMode === 'min') {
                $valAgg = min($nums);
            } elseif ($aggMode === 'max') {
                $valAgg = max($nums);
            } else {
                $valAgg = array_sum($nums) / count($nums);
            }
            $nivelNorm = (string) ($bk['nivelNorm'] ?? '');
            $paramNorm = (string) ($bk['paramNorm'] ?? '');
            $gk = (string) ($bk['galKey'] ?? '');
            if ($nivelNorm === '' || $paramNorm === '' || $gk === '') {
                continue;
            }
            hc_lab_bucket_add($acc, $nivelNorm, $paramNorm, $gk, (float) $valAgg);
            if (!isset($acc[$nivelNorm][$paramNorm][$gk]) || !is_array($acc[$nivelNorm][$paramNorm][$gk])) {
                continue;
            }
            $series = isset($bk['series']) && is_array($bk['series']) ? $bk['series'] : [];
            if ($series !== []) {
                usort($series, static function (array $a, array $b): int {
                    return strcmp((string) ($a['x'] ?? ''), (string) ($b['x'] ?? ''));
                });
            }
            $acc[$nivelNorm][$paramNorm][$gk]['series'] = $series;
        }
    }
}

if (!function_exists('estcumpl_hc_merge_necropsias_lab_map')) {
    /**
     * Historia clínica: integra t_regnecropsia en el labMap (hc_lab_bucket_add / hc_lab_celda_valor).
     * Granja (LEFT 3) + campaña desde tcampania o RIGHT(tcencos) en PHP; no filtra por tfectra ni por fechas del dashboard.
     * Variantes estcumpl_param_variants_texto_parametro, agregación MAX por galpón; campo numérico según infoOrigen.campoCompara o tporcentajetotal.
     *
     * @param array<string, array<string, array<string, array{nums: list<float>, strs: list<string>}>>> $acc
     * @param array<string, list<array<string, mixed>>> $paramsMapByPathCodigo  hc_pdf_map_parametros_por_path_codigo
     */
    function estcumpl_hc_merge_necropsias_lab_map(
        mysqli $conn,
        array &$acc,
        string $granja3,
        string $camp3,
        string $fechaDesde,
        string $fechaHasta,
        array $paramsMapByPathCodigo
    ): void {
        if (!function_exists('hc_lab_bucket_add') || !function_exists('hc_pdf_norm_txt') || !function_exists('tabla_existe')) {
            return;
        }
        if (!tabla_existe($conn, 't_regnecropsia')) {
            return;
        }
        $g3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $c3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), 0, 3);
        unset($fechaDesde, $fechaHasta);
        if ($g3 === '' || $c3 === '') {
            return;
        }
        $stdLines = [];
        foreach ($paramsMapByPathCodigo as $lines) {
            foreach ($lines as $line) {
                if (!is_array($line)) {
                    continue;
                }
                if (strtolower(trim((string) ($line['tipoParametro'] ?? ''))) !== 'necropsias') {
                    continue;
                }
                $paramRaw = trim((string) ($line['parametro'] ?? ''));
                $tipoCol = trim((string) ($line['tipo'] ?? ''));
                $inf = function_exists('estcumpl_info_origen_array') ? estcumpl_info_origen_array($line['infoOrigen'] ?? []) : [];
                if (function_exists('estcumpl_necropsia_nivel_param_desde_fila')) {
                    $np = estcumpl_necropsia_nivel_param_desde_fila($inf, $paramRaw, $tipoCol, false);
                    $nivelRaw = trim((string) ($np['nivelRaw'] ?? ''));
                    $parametroRaw = trim((string) ($np['parametroRaw'] ?? ''));
                } else {
                    $partes = explode(':', $paramRaw, 2);
                    $nivelRaw = trim((string) ($partes[0] ?? ''));
                    $parametroRaw = trim((string) ($partes[1] ?? ''));
                }
                if ($nivelRaw === '') {
                    continue;
                }
                $colN = trim((string) ($inf['campoCompara'] ?? 'tporcentajetotal'));
                if ($colN === '' || !in_array($colN, estcumpl_whitelist_campo_necro(), true)) {
                    $colN = 'tporcentajetotal';
                }
                $nivelTipo = hc_pdf_norm_txt(rtrim($nivelRaw, '.'));
                if ($nivelTipo === '') {
                    continue;
                }
                $paramVariants = [];
                foreach (estcumpl_param_variants_texto_parametro($parametroRaw) as $pv0) {
                    $vn = hc_pdf_norm_txt(rtrim(trim((string) $pv0), '.'));
                    if ($vn !== '') {
                        $paramVariants[$vn] = true;
                    }
                }
                if ($paramVariants === []) {
                    continue;
                }
                $stdLines[] = [
                    'nivelTipo' => $nivelTipo,
                    'paramVariants' => array_keys($paramVariants),
                    'col' => $colN,
                ];
            }
        }
        if ($stdLines === []) {
            return;
        }
        $colsNeeded = ['tporcentajetotal'];
        foreach ($stdLines as $sl) {
            $c = $sl['col'];
            if (!in_array($c, $colsNeeded, true)) {
                $colsNeeded[] = $c;
            }
        }
        $selExtra = [];
        foreach ($colsNeeded as $c) {
            if ($c === 'tporcentajetotal') {
                continue;
            }
            if (estcumpl_col_exists($conn, 't_regnecropsia', $c)) {
                $selExtra[] = '`' . str_replace('`', '', $c) . '`';
            }
        }
        $sel = 'tgranja, tcampania, tgalpon, tfectra, tcencos, tnivel, tparametro, tporcentajetotal'
            . ($selExtra !== [] ? ', ' . implode(', ', $selExtra) : '');
        /** Historia clínica matriz: solo granja (+ filtro campaña en PHP); no excluir por tfectra ni fecToma. */
        $sql = 'SELECT ' . $sel . ' FROM t_regnecropsia WHERE LEFT(TRIM(tgranja), 3) = ?';
        $st = $conn->prepare($sql);
        if (!$st) {
            return;
        }
        $st->bind_param('s', $g3);
        $st->execute();
        $rows = function_exists('estcumpl_stmt_fetch_all_assoc') ? estcumpl_stmt_fetch_all_assoc($st) : [];
        $st->close();
        $tieneTcencos = estcumpl_col_exists($conn, 't_regnecropsia', 'tcencos');
        $campCoincide = static function (array $row) use ($c3, $tieneTcencos): bool {
            $cr = trim((string) ($row['tcampania'] ?? ''));
            if ($cr === '' && $tieneTcencos) {
                $ce = trim((string) ($row['tcencos'] ?? ''));
                if (strlen($ce) >= 6) {
                    $cr = substr($ce, -3);
                }
            }
            $cr = trim($cr);
            if ($cr === '') {
                return false;
            }
            $digits = preg_replace('/\s+/', '', $cr);
            if ($digits !== '' && ctype_digit($digits)) {
                $cn = substr(str_pad($digits, 3, '0', STR_PAD_LEFT), -3);
            } else {
                $cn = $cr;
            }

            return $cn === $c3;
        };
        /** @var array<string, array<string, array<string, float>>> $maxGrid nivelTipo -> paramKey -> galKey -> max */
        $maxGrid = [];
        foreach ($rows as $row) {
            if (!is_array($row) || !$campCoincide($row)) {
                continue;
            }
            $tg = trim((string) ($row['tgranja'] ?? ''));
            if ($tg === '') {
                continue;
            }
            $leftG = substr($tg, 0, min(3, strlen($tg)));
            if ($leftG !== $g3) {
                continue;
            }
            $galpon = trim((string) ($row['tgalpon'] ?? ''));
            if ($galpon === '') {
                continue;
            }
            $gk = estcumpl_hc_galpon_key($galpon);
            if ($gk === '') {
                continue;
            }
            $nivelRow = hc_pdf_norm_txt(rtrim(trim((string) ($row['tnivel'] ?? '')), '.'));
            if ($nivelRow === '') {
                continue;
            }
            $tparam = trim((string) ($row['tparametro'] ?? ''));
            $rowPvHc = [];
            foreach (estcumpl_param_variants_texto_parametro($tparam) as $pv0) {
                $vn = hc_pdf_norm_txt(rtrim(trim((string) $pv0), '.'));
                if ($vn !== '') {
                    $rowPvHc[$vn] = true;
                }
            }
            if ($rowPvHc === []) {
                continue;
            }
            foreach ($stdLines as $sl) {
                if ($sl['nivelTipo'] !== $nivelRow) {
                    continue;
                }
                $col = $sl['col'];
                if (!array_key_exists($col, $row) || $row[$col] === null || $row[$col] === '' || !is_numeric($row[$col])) {
                    continue;
                }
                $val = (float) $row[$col];
                foreach ($sl['paramVariants'] as $pv) {
                    if ($pv === '' || !isset($rowPvHc[$pv])) {
                        continue;
                    }
                    if (!isset($maxGrid[$sl['nivelTipo']][$pv][$gk])) {
                        $maxGrid[$sl['nivelTipo']][$pv][$gk] = $val;
                    } else {
                        $maxGrid[$sl['nivelTipo']][$pv][$gk] = max($maxGrid[$sl['nivelTipo']][$pv][$gk], $val);
                    }
                }
            }
        }
        foreach ($maxGrid as $tipoN => $byPk) {
            foreach ($byPk as $pk => $byGk) {
                foreach ($byGk as $gk => $val) {
                    hc_lab_bucket_add($acc, $tipoN, $pk, $gk, $val);
                }
            }
        }
    }
}

if (!function_exists('estcumpl_ingcascarilla_campo_valor_permitidos')) {
    /**
     * Campos en reg_ingcascarilla admitidos en infoOrigen.campoValor (cuantitativos o duración).
     *
     * @return list<string>
     */
    function estcumpl_ingcascarilla_campo_valor_permitidos(): array {
        return ['tcantcascarilla', 'tcalcascarilla', 'taltcama', 'thoras_descarga', 'tnumsacosing', 'tnumdescargadores', 'tcamionapto'];
    }
}

if (!function_exists('estcumpl_ingcascarilla_tepre_permitidos')) {
    /** @return list<string> */
    function estcumpl_ingcascarilla_tepre_permitidos(): array {
        return ['RS'];
    }
}

if (!function_exists('estcumpl_ingcascarilla_agregacion_permitidos')) {
    /** @return list<string> */
    function estcumpl_ingcascarilla_agregacion_permitidos(): array {
        return ['max', 'min', 'avg', 'sum'];
    }
}

if (!function_exists('estcumpl_ingcascarilla_tabla')) {
    function estcumpl_ingcascarilla_tabla(mysqli $conn): string {
        static $t = null;
        if ($t !== null) {
            return $t;
        }
        $chk = @$conn->query("SHOW TABLES LIKE 'reg_ingcascarilla'");
        if ($chk && $chk->num_rows > 0) {
            $t = 'reg_ingcascarilla';
            return $t;
        }
        $chk2 = @$conn->query("SHOW TABLES LIKE 'reg_ingCascarilla'");
        if ($chk2 && $chk2->num_rows > 0) {
            $t = 'reg_ingCascarilla';
            return $t;
        }
        $t = 'reg_ingcascarilla';
        return $t;
    }
}

if (!function_exists('estcumpl_ingcascarilla_val_expr')) {
    /**
     * Expresión SQL (SELECT interno) para el campo lógico; null si no aplica.
     */
    function estcumpl_ingcascarilla_val_expr(mysqli $conn, string $tbl, string $campo): ?string {
        $campo = strtolower(trim($campo));
        if (!in_array($campo, estcumpl_ingcascarilla_campo_valor_permitidos(), true)) {
            return null;
        }
        if ($campo === 'thoras_descarga') {
            $c1 = estcumpl_col_exists($conn, $tbl, 'thorainiciod')
                ? 'thorainiciod'
                : (estcumpl_col_exists($conn, $tbl, 'thorainicio') ? 'thorainicio' : null);
            $c2 = estcumpl_col_exists($conn, $tbl, 'thorafind') ? 'thorafind' : null;
            if ($c1 === null || $c2 === null) {
                return null;
            }
            return '(CASE WHEN ' . $c1 . ' IS NOT NULL AND ' . $c2 . ' IS NOT NULL '
                . 'AND TRIM(COALESCE(CAST(' . $c1 . ' AS CHAR), \'\')) <> \'\' '
                . 'AND TRIM(COALESCE(CAST(' . $c2 . ' AS CHAR), \'\')) <> \'\' '
                . 'THEN TIME_TO_SEC(TIMEDIFF(' . $c2 . ', ' . $c1 . ')) / 3600.0 ELSE NULL END)';
        }
        if (!estcumpl_col_exists($conn, $tbl, $campo)) {
            return null;
        }
        return '`' . $campo . '`';
    }
}

if (!function_exists('estcumpl_param_variants_ingreso_cascarilla')) {
    /**
     * Variantes de texto para cruzar parametro del estándar con registros mergeados (Manejo de cama / ingreso).
     *
     * @return list<string>
     */
    function estcumpl_param_variants_ingreso_cascarilla(string $parametroEstandarRaw): array {
        $base = mb_strtolower(trim($parametroEstandarRaw), 'UTF-8');
        $base = str_replace(
            ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ'],
            ['a', 'e', 'i', 'o', 'u', 'u', 'n'],
            $base
        );
        $base = preg_replace('/\s+/', ' ', (string) $base);
        $base = trim((string) $base);
        $out = [];
        if ($base !== '') {
            $out[$base] = true;
        }
        $addSyn = static function (array $syn) use (&$out): void {
            foreach ($syn as $s) {
                $n = mb_strtolower(trim((string) $s), 'UTF-8');
                if ($n !== '') {
                    $out[$n] = true;
                }
            }
        };
        if ($base === '') {
            return array_keys($out);
        }
        /*
         * No usar solo «cascarilla»: aparece en cantidad, calidad y tiempo; mezclar sinónimos hacía que
         * el merge guardara el mismo valor bajo claves de otras métricas (p. ej. Check List: Renovación de cama).
         */
        $pareceCantidad = strpos($base, 'cantidad') !== false
            || (strpos($base, 'kg') !== false && strpos($base, 'cascarilla') !== false);
        if ($pareceCantidad) {
            $addSyn([
                'cantidad de cascarilla',
                'cantidad cascarilla',
                'kg cascarilla',
            ]);
        }
        if (strpos($base, 'calidad') !== false) {
            $addSyn([
                'calidad de cascarilla',
                'calidad cascarilla',
            ]);
        }
        $pareceAlturaCama = (strpos($base, 'altura') !== false
            || (strpos($base, 'cama') !== false && strpos($base, 'cascarilla') === false));
        if ($pareceAlturaCama) {
            $addSyn(['altura de cama', 'altura cama', 'alt cama']);
        }
        $pareceTiempoIngreso = strpos($base, 'tiempo') !== false
            || strpos($base, 'duracion') !== false
            || (strpos($base, 'ingreso') !== false && strpos($base, 'cascarilla') !== false)
            || (strpos($base, 'descarga') !== false && strpos($base, 'descargador') === false);
        if ($pareceTiempoIngreso) {
            $addSyn([
                'tiempo de ingreso de cascarilla',
                'tiempo ingreso cascarilla',
                'duracion descarga cascarilla',
            ]);
        }
        if (strpos($base, 'saco') !== false) {
            $addSyn(['sacos de ingreso', 'numsacos ingreso', 'tnumsacosing']);
        }
        if (strpos($base, 'descargador') !== false) {
            $addSyn(['numero de descargadores', 'descargadores', 'tnumdescargadores']);
        }
        if (strpos($base, 'camion') !== false && strpos($base, 'apto') !== false) {
            $addSyn(['camion apto', 'tcamionapto']);
        }
        return array_keys($out);
    }
}

if (!function_exists('estcumpl_merge_ingcascarilla_std_row')) {
    /**
     * Rellena $muestrasOut desde reg_ingcascarilla (tepre típ. RS).
     *
     * @param array<string,array> $muestrasOut
     * @param array<string,mixed> $std
     */
    function estcumpl_merge_ingcascarilla_std_row(
        mysqli $conn,
        array $rango,
        array $filtroGranjas,
        array $filtroGgPares,
        array &$muestrasOut,
        array $std
    ): void {
        if (empty($rango['desde']) || empty($rango['hasta'])) {
            return;
        }
        $tpStd = strtolower(trim((string) ($std['tipoParametro'] ?? '')));
        if ($tpStd !== 'ingreso_cascarilla') {
            return;
        }
        $nivelNorm = trim((string) ($std['nivelNorm'] ?? ''));
        $paramVariants = isset($std['paramVariants']) && is_array($std['paramVariants']) ? $std['paramVariants'] : [];
        if ($nivelNorm === '' || $paramVariants === []) {
            return;
        }
        $inf = estcumpl_info_origen_array($std['infoOrigen'] ?? []);
        $campo = strtolower(trim((string) ($inf['campoValor'] ?? 'tcantcascarilla')));
        $tbl = estcumpl_ingcascarilla_tabla($conn);
        $valExpr = estcumpl_ingcascarilla_val_expr($conn, $tbl, $campo);
        if ($valExpr === null) {
            return;
        }
        $tepre = strtoupper(trim((string) ($inf['tepre'] ?? 'RS')));
        if ($tepre === '' || !in_array($tepre, estcumpl_ingcascarilla_tepre_permitidos(), true)) {
            $tepre = 'RS';
        }
        $agg = strtolower(trim((string) ($inf['agregacion'] ?? 'max')));
        if (!in_array($agg, estcumpl_ingcascarilla_agregacion_permitidos(), true)) {
            $agg = 'max';
        }
        if ($agg === 'avg') {
            $aggSql = 'AVG';
        } elseif ($agg === 'min') {
            $aggSql = 'MIN';
        } elseif ($agg === 'sum') {
            $aggSql = 'SUM';
        } else {
            $aggSql = 'MAX';
        }
        if (!estcumpl_col_exists($conn, $tbl, 'tfectra') || !estcumpl_col_exists($conn, $tbl, 'tepre')
            || !estcumpl_col_exists($conn, $tbl, 'tcencos') || !estcumpl_col_exists($conn, $tbl, 'tcodint')) {
            return;
        }

        $sql = "SELECT DATE(tfectra) AS fecha_ref,
                       LEFT(TRIM(tcencos), 3) AS granja,
                       RIGHT(TRIM(tcencos), 3) AS campania,
                       TRIM(tcodint) AS galpon,
                       {$aggSql}({$valExpr}) AS val_agg
                FROM `{$tbl}`
                WHERE UPPER(TRIM(tepre)) = ?
                  AND DATE(tfectra) >= ? AND DATE(tfectra) <= ?
                  AND TRIM(tcencos) <> '' AND TRIM(tcodint) <> ''";

        $params = [$tepre, $rango['desde'], $rango['hasta']];
        $types = 'sss';

        $granjasNorm = [];
        foreach ($filtroGranjas as $g) {
            $g = substr(str_pad(trim((string) $g), 3, '0', STR_PAD_LEFT), 0, 3);
            if ($g !== '') {
                $granjasNorm[$g] = true;
            }
        }
        $granjasNorm = array_keys($granjasNorm);
        $ggNorm = [];
        foreach ($filtroGgPares as $pr) {
            $g3 = substr(str_pad(trim((string) ($pr['g'] ?? '')), 3, '0', STR_PAD_LEFT), 0, 3);
            $gp = trim((string) ($pr['gp'] ?? ''));
            if ($g3 !== '' && $gp !== '') {
                $ggNorm[] = ['g3' => $g3, 'gp' => $gp];
            }
        }
        if (count($granjasNorm) > 0 || count($ggNorm) > 0) {
            $sub = [];
            if (count($granjasNorm) > 0) {
                $ph = implode(',', array_fill(0, count($granjasNorm), '?'));
                $sub[] = "LEFT(TRIM(tcencos), 3) IN ($ph)";
                foreach ($granjasNorm as $g) {
                    $params[] = $g;
                    $types .= 's';
                }
            }
            if (count($ggNorm) > 0) {
                $conj = [];
                foreach ($ggNorm as $rowGg) {
                    $conj[] = '(LEFT(TRIM(tcencos), 3) = ? AND CAST(COALESCE(NULLIF(TRIM(tcodint), \'\'), \'0\') AS UNSIGNED) = CAST(? AS UNSIGNED))';
                    $params[] = $rowGg['g3'];
                    $types .= 's';
                    $params[] = $rowGg['gp'];
                    $types .= 's';
                }
                $sub[] = '(' . implode(' OR ', $conj) . ')';
            }
            $sql .= ' AND (' . implode(' OR ', $sub) . ')';
        }
        $sql .= ' GROUP BY DATE(tfectra), LEFT(TRIM(tcencos), 3), RIGHT(TRIM(tcencos), 3), TRIM(tcodint)';

        $st = $conn->prepare($sql);
        if (!$st) {
            return;
        }
        $bind = [];
        $bind[] = $types;
        foreach ($params as $p) {
            $bind[] = $p;
        }
        $refs = [];
        foreach ($bind as $k => $v) {
            $refs[$k] = &$bind[$k];
        }
        call_user_func_array([$st, 'bind_param'], $refs);
        $st->execute();
        $rows = estcumpl_stmt_fetch_all_assoc($st);
        $tipoEst = trim((string) ($std['nivelRaw'] ?? ''));
        if ($tipoEst === '') {
            $tipoEst = $nivelNorm;
        }
        $keySuffix = 'INGCAS|' . $tepre . '|' . $campo;
        foreach ($rows as $row) {
            $granja = trim((string) ($row['granja'] ?? ''));
            $campania = trim((string) ($row['campania'] ?? ''));
            $galpon = trim((string) ($row['galpon'] ?? ''));
            $fref = trim((string) ($row['fecha_ref'] ?? ''));
            $vagg = $row['val_agg'] ?? null;
            if ($granja === '' || $galpon === '' || $fref === '') {
                continue;
            }
            $val = ($vagg !== null && is_numeric($vagg)) ? (float) $vagg : null;
            if ($val === null) {
                continue;
            }
            $key = $granja . '|' . $campania . '|' . $galpon . '|' . $keySuffix . '|' . $fref;
            if (!isset($muestrasOut[$key])) {
                $muestrasOut[$key] = [
                    'granja' => $granja,
                    'campania' => $campania,
                    'galpon' => $galpon,
                    'codEnvio' => '',
                    'posSolicitud' => 0,
                    'fectra' => $fref,
                    'tdate' => $fref,
                    'tcencos' => '',
                    'tipoEstandar' => $tipoEst,
                    'registros' => [],
                ];
            }
            if (!isset($muestrasOut[$key]['registros'][$nivelNorm])) {
                $muestrasOut[$key]['registros'][$nivelNorm] = [];
            }
            foreach ($paramVariants as $pv) {
                $pvn = trim((string) $pv);
                if ($pvn === '') {
                    continue;
                }
                if (!isset($muestrasOut[$key]['registros'][$nivelNorm][$pvn])) {
                    $muestrasOut[$key]['registros'][$nivelNorm][$pvn] = $val;
                } else {
                    if ($agg === 'min') {
                        $muestrasOut[$key]['registros'][$nivelNorm][$pvn] = min(
                            (float) $muestrasOut[$key]['registros'][$nivelNorm][$pvn],
                            $val
                        );
                    } elseif ($agg === 'sum') {
                        $muestrasOut[$key]['registros'][$nivelNorm][$pvn] = (float) $muestrasOut[$key]['registros'][$nivelNorm][$pvn] + $val;
                    } else {
                        $muestrasOut[$key]['registros'][$nivelNorm][$pvn] = max(
                            (float) $muestrasOut[$key]['registros'][$nivelNorm][$pvn],
                            $val
                        );
                    }
                }
            }
        }
        $st->close();
    }
}

if (!function_exists('estcumpl_hc_merge_ingcascarilla_en_lab_map')) {
    /**
     * Historia clínica: métricas de reg_ingcascarilla bajo tipo «manejo de cama» (keys alineadas a variantes).
     * Solo filtra por granja+campaña en tcencos (todos los registros de la campaña, sin acotar por fecha).
     */
    function estcumpl_hc_merge_ingcascarilla_en_lab_map(mysqli $conn, array &$acc, string $granja3, string $camp3): void {
        if (!function_exists('hc_lab_bucket_add')) {
            return;
        }
        $granja3 = substr(str_pad(trim($granja3), 3, '0', STR_PAD_LEFT), 0, 3);
        $camp3 = substr(str_pad(trim($camp3), 3, '0', STR_PAD_LEFT), 0, 3);
        if ($granja3 === '' || $camp3 === '') {
            return;
        }
        $tbl = estcumpl_ingcascarilla_tabla($conn);
        if (!estcumpl_col_exists($conn, $tbl, 'tepre')
            || !estcumpl_col_exists($conn, $tbl, 'tcencos') || !estcumpl_col_exists($conn, $tbl, 'tcodint')) {
            return;
        }
        $tipoNorm = 'manejo de cama';
        $tepreHc = 'RS';
        $mergeMetric = static function (mysqli $con, string $tblInner, string $sqlVal, string $labelSeed, string $aggFn) use (&$acc, $granja3, $camp3, $tipoNorm, $tepreHc): void {
            $aggSql = strtoupper($aggFn) === 'AVG' ? 'AVG' : 'MAX';
            $sql = "SELECT TRIM(tcodint) AS galpon, {$aggSql}({$sqlVal}) AS vmet
                    FROM `{$tblInner}`
                    WHERE UPPER(TRIM(tepre)) = ?
                      AND LEFT(TRIM(tcencos), 3) = ?
                      AND RIGHT(TRIM(tcencos), 3) = ?
                      AND TRIM(tcodint) <> ''
                    GROUP BY TRIM(tcodint)";
            $st = $con->prepare($sql);
            if (!$st) {
                return;
            }
            $st->bind_param('sss', $tepreHc, $granja3, $camp3);
            $st->execute();
            $rowsIc = estcumpl_stmt_fetch_all_assoc($st);
            foreach ($rowsIc as $row) {
                $gk = estcumpl_hc_galpon_key((string) ($row['galpon'] ?? ''));
                if ($gk === '') {
                    continue;
                }
                $vm = $row['vmet'] ?? null;
                if ($vm === null || !is_numeric($vm)) {
                    continue;
                }
                foreach (estcumpl_param_variants_ingreso_cascarilla($labelSeed) as $pv) {
                    hc_lab_bucket_add($acc, $tipoNorm, $pv, $gk, (float) $vm);
                }
            }
            $st->close();
        };
        $eCant = estcumpl_ingcascarilla_val_expr($conn, $tbl, 'tcantcascarilla');
        if ($eCant !== null) {
            $mergeMetric($conn, $tbl, $eCant, 'Cantidad de cascarilla', 'MAX');
        }
        $eAlt = estcumpl_ingcascarilla_val_expr($conn, $tbl, 'taltcama');
        if ($eAlt !== null) {
            $mergeMetric($conn, $tbl, $eAlt, 'Altura de cama', 'MAX');
        }
        $eHor = estcumpl_ingcascarilla_val_expr($conn, $tbl, 'thoras_descarga');
        if ($eHor !== null) {
            $mergeMetric($conn, $tbl, $eHor, 'Tiempo de ingreso de cascarilla', 'AVG');
        }
        $eCal = estcumpl_ingcascarilla_val_expr($conn, $tbl, 'tcalcascarilla');
        if ($eCal !== null) {
            $mergeMetric($conn, $tbl, $eCal, 'Calidad de cascarilla', 'AVG');
        }
        $eDesc = estcumpl_ingcascarilla_val_expr($conn, $tbl, 'tnumdescargadores');
        if ($eDesc !== null) {
            $mergeMetric($conn, $tbl, $eDesc, 'Número de descargadores', 'MAX');
        }
        $eCam = estcumpl_ingcascarilla_val_expr($conn, $tbl, 'tcamionapto');
        if ($eCam !== null) {
            $mergeMetric($conn, $tbl, $eCam, 'Camión apto', 'MAX');
        }
    }
}

if (!function_exists('sip_est2_meta_origen_payload')) {
    /**
     * JSON de metadatos para el configurador EST2 (origen de datos): mismas whitelists `estcumpl_*` + etiquetas UI.
     * Consumo: `get_est2_meta_origen.php`, `dashboard-estandares2.php` (variable global inicial en head).
     *
     * @return array{success:bool,regnocontable:array,necropsiasCamposCompara:array,ingresoCascarilla:array,plantaIncubacionBb:array}
     */
    function sip_est2_meta_origen_payload(): array
    {
        $etiquetaTprocesoRegno = [
            'TEMP_CONO' => 'Temperatura de cono',
            'RESPIRATORIO' => 'Respiratorio',
            'DIGESTIVO' => 'Digestivo',
            'CLORO' => 'Cloro',
            'COLOR' => 'Color de tarsos',
            'PLAGAS' => 'Roedores',
            'EVA_GORGOJO' => 'Gorgojo',
            'ACTAENTREGA' => 'Acta Entrega',
            'DESINFECCION' => 'Tiempos del proceso Manejo de Cama',
            'DESINFECCION_LD' => 'Tiempos del proceso Limp. & Desinf.',
        ];

        $procesos = [];
        foreach (estcumpl_regnocontable_tproceso_permitidos() as $tp) {
            $tpU = strtoupper(trim((string) $tp));
            $procesos[] = [
                'v' => $tpU,
                'l' => $etiquetaTprocesoRegno[$tpU] ?? $tpU,
            ];
        }

        $regnoCampoLabels = [
            'tcantidad' => 'Cantidad (tcantidad)',
            'tsexo' => 'Estado (tsexo)',
            'plagas_pct_consumo' => 'Roedores: % consumo cebo (por cebadero con consumo)',
            'plagas_roedores_vivos' => 'Roedores: N vivos (ratones + ratas)',
            'plagas_roedores_muertos' => 'Roedores: N muertos (ratones + ratas)',
            'gorgojo_prom_larva' => 'Promedio Larva',
            'gorgojo_prom_adulto' => 'Promedio Adulto',
            'tiempo_retiro_guano' => 'Tiempo de retiro de guano',
            'tiempo_reuso_cama' => 'Tiempo de reuso de cama',
            'tiempo_limpieza_desinfeccion' => 'Tiempo de limpieza y desinfección',
            'tiempo_descanso_efectivo' => 'Tiempo de descanso efectivo',
            'tiempo_descanso_total' => 'Tiempo de descanso total',
        ];
        $campos = [];
        foreach (estcumpl_regnocontable_campo_valor_permitidos() as $c) {
            $c = trim((string) $c);
            $campos[] = [
                'v' => $c,
                'l' => $regnoCampoLabels[strtolower($c)] ?? $c,
            ];
        }

        $agregaciones = [
            ['v' => 'max', 'l' => 'Máximo'],
            ['v' => 'avg', 'l' => 'Promedio'],
            ['v' => 'min', 'l' => 'Mínimo'],
        ];

        $necroCampos = [];
        foreach (estcumpl_whitelist_campo_necro() as $nc) {
            $necroCampos[] = ['v' => $nc, 'l' => $nc];
        }

        $icCampoLabels = [
            'tcantcascarilla' => 'Cantidad de cascarilla',
            'tcalcascarilla' => 'Calidad de cascarilla',
            'taltcama' => 'Altura de cama',
            'thoras_descarga' => 'Tiempo de ingreso de cascarilla',
            'tnumsacosing' => 'Sacos de ingreso',
            'tnumdescargadores' => 'Número de descargadores',
            'tcamionapto' => 'Camión apto',
        ];
        $icCampos = [];
        foreach (estcumpl_ingcascarilla_campo_valor_permitidos() as $cv) {
            $cv = trim((string) $cv);
            $icCampos[] = [
                'v' => $cv,
                'l' => $icCampoLabels[$cv] ?? $cv,
            ];
        }
        $icAgg = [];
        foreach (estcumpl_ingcascarilla_agregacion_permitidos() as $ag) {
            $ag = trim((string) $ag);
            $lab = $ag === 'max' ? 'Máximo' : ($ag === 'min' ? 'Mínimo' : ($ag === 'avg' ? 'Promedio' : 'Suma'));
            $icAgg[] = ['v' => $ag, 'l' => $lab];
        }
        $icTepre = [];
        foreach (estcumpl_ingcascarilla_tepre_permitidos() as $tp) {
            $tpU = strtoupper(trim((string) $tp));
            $icTepre[] = ['v' => $tpU, 'l' => $tpU === 'RS' ? 'Ingreso cascarilla (RS)' : $tpU];
        }

        $piBbMetrics = estcumpl_planta_incubacion_bb_metrics_ui_for_api();

        return [
            'success' => true,
            'regnocontable' => [
                'procesos' => $procesos,
                'camposValor' => $campos,
                'agregaciones' => $agregaciones,
            ],
            'necropsiasCamposCompara' => $necroCampos,
            'ingresoCascarilla' => [
                'camposValor' => $icCampos,
                'agregaciones' => $icAgg,
                'tepre' => $icTepre,
            ],
            'plantaIncubacionBb' => [
                'metrics' => $piBbMetrics,
            ],
        ];
    }
}
