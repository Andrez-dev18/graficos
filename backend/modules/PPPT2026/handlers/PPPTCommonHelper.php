<?php

class PPPTCommonHelper
{
    public static function resolverAnio(array $filtros): string
    {
        $anio = isset($filtros['anio']) ? trim((string)$filtros['anio']) : '2026';
        return in_array($anio, ['2024', '2025', '2026'], true) ? $anio : '2026';
    }

    public static function resolverTfectra(array $filtros, string $anio): string
    {
        $periodo = '';

        if (!empty($filtros['mes'])) {
            $periodo = trim((string)$filtros['mes']);
        } elseif (!empty($filtros['fecha_inicio'])) {
            $periodo = substr(trim((string)$filtros['fecha_inicio']), 0, 7);
        } elseif (!empty($filtros['tfectra'])) {
            $periodo = is_array($filtros['tfectra'])
                ? (string)($filtros['tfectra'][0] ?? '')
                : (string)$filtros['tfectra'];
            $periodo = trim($periodo);
        }

        $periodo = str_replace('-', '/', $periodo);

        if (preg_match('/^(\d{4})\/(\d{1,2})/', $periodo, $coincidencias)) {
            $mes = str_pad((string)(int)$coincidencias[2], 2, '0', STR_PAD_LEFT);
            return $anio . '/' . $mes;
        }

        return $anio . '/' . date('m');
    }

    public static function obtenerOpciones(PDO $db, string $anio): array
    {
        $stmtAct = $db->prepare("
            SELECT DISTINCT actividad
            FROM preal
            WHERE actividad IS NOT NULL
              AND actividad != ''
              AND LEFT(tfectra, 4) = ?
            ORDER BY actividad
        ");
        $stmtAct->execute([$anio]);
        $opcionesActividad = $stmtAct->fetchAll(PDO::FETCH_COLUMN);
        $opcionesActividad = array_values(array_unique(array_filter(array_map('trim', $opcionesActividad))));

        $stmtMeses = $db->prepare("
            SELECT DISTINCT tfectra
            FROM preal
            WHERE tfectra IS NOT NULL
              AND tfectra != ''
              AND LEFT(tfectra, 4) = ?
            ORDER BY tfectra DESC
        ");
        $stmtMeses->execute([$anio]);
        $opcionesMeses = $stmtMeses->fetchAll(PDO::FETCH_COLUMN);
        $opcionesMeses = array_values(array_unique(array_filter(array_map('trim', $opcionesMeses))));

        return [
            'actividades' => $opcionesActividad,
            'meses' => $opcionesMeses
        ];
    }

    public static function resolverActividades($seleccionadas, array $opciones): array
    {
        $actividades = $seleccionadas ?? ['AV'];

        if (!is_array($actividades)) {
            $actividades = [$actividades];
        }

        $actividades = array_filter(array_map('trim', array_map('strval', $actividades)));

        if (empty($opciones)) {
            return !empty($actividades) ? array_values(array_unique($actividades)) : ['AV'];
        }

        $validas = array_values(array_intersect($actividades, $opciones));

        if (!empty($validas)) {
            return array_values(array_unique($validas));
        }

        if (in_array('AV', $opciones, true)) {
            return ['AV'];
        }

        return [(string)$opciones[0]];
    }
}
