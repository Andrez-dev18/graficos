<?php

class CostosDias2Pdf
{
    public static function generar(array $data, array $filtros): void
    {
        $autoload = __DIR__ . '/../../libs/vendor/autoload.php';
        if (!file_exists($autoload)) {
            throw new RuntimeException('No se encontró el autoload de mPDF.');
        }
        require_once $autoload;

        $galpones = $data['galpones'] ?? [];
        $granjas = $data['granjas'] ?? [];
        $totalGeneral = $data['totalGeneral'] ?? [];

        $periodo = self::fechaCorta($filtros['fecha_inicio'] ?? '') . ' al ' . self::fechaCorta($filtros['fecha_fin'] ?? '');
        $fechaLiqIni = self::fechaCorta($filtros['fecha_liq_inicio'] ?? '');
        $fechaLiqFin = self::fechaCorta($filtros['fecha_liq_fin'] ?? '');
        $fechaLiq = ($fechaLiqIni !== '' || $fechaLiqFin !== '') ? trim($fechaLiqIni . ' al ' . $fechaLiqFin) : '-';
        $granjasFiltro = self::listaFiltro($filtros['granjas'] ?? []);
        $campanasFiltro = self::listaFiltro($filtros['campanas'] ?? []);
        $galponesFiltro = self::listaFiltro($filtros['galpones'] ?? []);
        $fechaGeneracion = (new DateTimeImmutable('now', new DateTimeZone('America/Lima')))->format('d/m/Y H:i');

        $cabecera = '
            <table style="width:100%;border-collapse:collapse;background-color:#2f6fed;color:#ffffff;">
                <tr>
                    <td style="width:29%;padding:2.4mm 3mm;border-right:1px solid #8bb0ff;font-size:8.5pt;font-weight:bold;vertical-align:middle;">GRANJA RINCONADA DEL SUR</td>
                    <td style="width:49%;padding:2.4mm 3mm;border-right:1px solid #8bb0ff;font-size:11pt;font-weight:bold;text-align:center;vertical-align:middle;">COSTOS TRADICIONAL DÍA 2 - POR GALPÓN</td>
                    <td style="width:22%;padding:2.4mm 3mm;font-size:7.8pt;text-align:right;vertical-align:middle;">' . self::e($fechaGeneracion) . '</td>
                </tr>
            </table>';

        $html = '
        <style>
            body { font-family: dejavusans, sans-serif; color: #1e293b; font-size: 7pt; }
            .rango { font-size: 8pt; color: #334155; margin: 0 0 1mm 0; }
            .filtros { font-size: 6.8pt; color: #64748b; margin: 0 0 3mm 0; }
            table { width: 100%; border-collapse: collapse; table-layout: auto; }
            thead { display: table-header-group; }
            tr { page-break-inside: avoid; }
            th, td { border: 0.35pt solid #cbd5e1; padding: 1.5mm 1.5mm; vertical-align: middle; }
            th { color: #ffffff; background-color: #1e40af; font-size: 6.6pt; font-weight: bold; text-align: center; }
            th.dim { background-color: #1e3a8a; text-align: left; }
            td.dim { font-size: 6.5pt; color: #334155; }
            td.num { text-align: right; font-family: dejavusans, sans-serif; white-space: nowrap; font-size: 6.4pt; }
            tr.total-granja td { background-color: #e2e8f0; font-weight: bold; color: #0f172a; }
            tr.total-general td { background-color: #dbeafe; font-weight: bold; color: #1e3a8a; }
            .mono { font-family: dejavusans, sans-serif; }
        </style>
        <div class="rango"><strong>Rango:</strong> ' . self::e($periodo) . '</div>
        <div class="filtros">
            <strong>F. Liq.:</strong> ' . self::e($fechaLiq) . '
            &nbsp;&nbsp;|&nbsp;&nbsp;<strong>Granja:</strong> ' . self::e($granjasFiltro ?: 'Todas') . '
            &nbsp;&nbsp;|&nbsp;&nbsp;<strong>Campaña:</strong> ' . self::e($campanasFiltro ?: 'Todas') . '
            &nbsp;&nbsp;|&nbsp;&nbsp;<strong>Galpón:</strong> ' . self::e($galponesFiltro ?: 'Todos') . '
        </div>
        <table>
            <thead>
                <tr>
                    <th rowspan="2" class="dim">tnomcen</th>
                    <th rowspan="2" class="dim">tcencos</th>
                    <th rowspan="2" class="dim">tanio</th>
                    <th rowspan="2" class="dim">t.</th>
                    <th rowspan="2" class="dim">tnomMes</th>
                    ' . self::cabeceraGalpones($galpones) . '
                </tr>
                <tr>' . self::subcabeceraGalpones($galpones) . '</tr>
            </thead>
            <tbody>';

        foreach ($granjas as $granja) {
            $meses = $granja['meses'] ?? [];
            foreach ($meses as $mes) {
                $html .= '<tr>';
                $html .= '<td class="dim">' . self::e($granja['tnomcen'] ?? '') . '</td>';
                $html .= '<td class="dim">' . self::e($granja['tcencos'] ?? '') . '</td>';
                $html .= '<td class="dim">' . self::e($granja['tanio'] ?? '') . '</td>';
                $html .= '<td class="dim">' . self::e($granja['tuser'] ?? '') . '</td>';
                $html .= '<td class="dim">' . self::e($mes['tnomMes'] ?? '') . '</td>';
                foreach ($galpones as $galpon) {
                    $valores = $mes['galpones'][$galpon] ?? ['valor' => 0, 'peso_glp' => 0, 'cu_glp' => null];
                    $html .= self::celdasMetricas($valores);
                }
                $html .= '</tr>';
            }

            $html .= '<tr class="total-granja"><td colspan="5" style="text-align:center;">Total</td>';
            foreach ($galpones as $galpon) {
                $valores = $granja['total']['galpones'][$galpon] ?? ['valor' => 0, 'peso_glp' => 0, 'cu_glp' => null];
                $html .= self::celdasMetricas($valores);
            }
            $html .= '</tr>';
        }

        $html .= '</tbody><tfoot><tr class="total-general"><td colspan="5" style="text-align:center;">TOTAL GENERAL</td>';
        foreach ($galpones as $galpon) {
            $valores = $totalGeneral[$galpon] ?? ['valor' => 0, 'peso_glp' => 0, 'cu_glp' => null];
            $html .= self::celdasMetricas($valores);
        }
        $html .= '</tr></tfoot></table>';

        $mpdf = new \Mpdf\Mpdf([
            'mode'                 => 'utf-8',
            'format'               => 'A3-L',
            'margin_left'          => 7,
            'margin_right'         => 7,
            'margin_top'           => 24,
            'margin_bottom'        => 12,
            'shrink_tables_to_fit' => 1,
            'tempDir'              => sys_get_temp_dir(),
            'default_font'         => 'dejavusans'
        ]);

        $mpdf->SetTitle('Costos Tradicional Día 2 - Por Galpón');
        $mpdf->SetAuthor('Granja Rinconada del Sur');
        $mpdf->SetHTMLHeader($cabecera);
        $mpdf->SetHTMLFooter('<div style="text-align:right;font-size:6.5pt;color:#64748b;">Página {PAGENO} de {nbpg}</div>');
        $mpdf->WriteHTML($html);

        $nombre = 'Costos_Tradicional_Dia2_' . preg_replace('/[^0-9]/', '', $periodo) . '.pdf';
        $mpdf->Output($nombre, \Mpdf\Output\Destination::INLINE);
    }

    private static function cabeceraGalpones(array $galpones): string
    {
        $html = '';
        foreach ($galpones as $galpon) {
            $html .= '<th colspan="3">Galpón ' . self::e($galpon) . '</th>';
        }
        return $html;
    }

    private static function subcabeceraGalpones(array $galpones): string
    {
        $html = '';
        foreach ($galpones as $galpon) {
            $html .= '<th>Valor</th><th>Peso GLP</th><th>CU GLP</th>';
        }
        return $html;
    }

    private static function celdasMetricas(array $valores): string
    {
        return '<td class="num">' . self::e(self::moneda($valores['valor'] ?? 0)) . '</td>'
            . '<td class="num">' . self::e(self::peso($valores['peso_glp'] ?? 0)) . '</td>'
            . '<td class="num">' . self::e(self::cu($valores['cu_glp'] ?? null)) . '</td>';
    }

    private static function moneda($valor): string
    {
        if ($valor === null || $valor === '' || (float)$valor == 0.0) return '-';
        return 'S/ ' . number_format((float)$valor, 2, '.', ',');
    }

    private static function peso($valor): string
    {
        if ($valor === null || $valor === '' || (float)$valor == 0.0) return '-';
        return number_format((float)$valor, 2, '.', ',') . ' Kg';
    }

    private static function cu($valor): string
    {
        if ($valor === null || $valor === '' || (float)$valor == 0.0) return '-';
        return number_format((float)$valor, 3, '.', ',');
    }

    private static function listaFiltro($valor): string
    {
        if (is_array($valor)) {
            return implode(', ', array_map('strval', $valor));
        }
        return trim((string)$valor);
    }

    private static function fechaCorta($fecha): string
    {
        $fecha = trim((string)$fecha);
        if ($fecha === '') return '';
        try {
            return (new DateTimeImmutable($fecha))->format('d/m/Y');
        } catch (Throwable $e) {
            return $fecha;
        }
    }

    private static function e($valor): string
    {
        return htmlspecialchars((string)$valor, ENT_QUOTES, 'UTF-8');
    }
}
