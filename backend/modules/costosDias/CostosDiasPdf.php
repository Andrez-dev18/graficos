<?php

class CostosDiasPdf
{
    public static function generar(array $payload): void
    {
        ini_set('memory_limit', '512M');
        ini_set('max_execution_time', '180');

        $autoload = __DIR__ . '/../../libs/vendor/autoload.php';
        if (!file_exists($autoload)) {
            throw new RuntimeException('No se encontró el autoload de mPDF.');
        }
        require_once $autoload;

        $chartImage = $payload['chartImage'] ?? '';
        $datos = $payload['datos'] ?? [];
        $filtros = $payload['filtros'] ?? [];

        if (!is_string($chartImage) || strpos($chartImage, 'data:image/') !== 0) {
            throw new RuntimeException('La imagen del gráfico no es válida.');
        }

        $periodos = $datos['periodos'] ?? [];
        $aniosEstructura = $datos['aniosEstructura'] ?? [];
        $matrizFamilias = $datos['matrizFamilias'] ?? [];
        $graficaCosto = $datos['graficaCosto'] ?? [];

        $periodo = self::fechaCorta($filtros['fecha_inicio'] ?? '') . ' al ' . self::fechaCorta($filtros['fecha_fin'] ?? '');
        $fechaGeneracion = (new DateTimeImmutable('now', new DateTimeZone('America/Lima')))->format('d/m/Y H:i');

        $cabecera = '
            <table style="width:100%;border-collapse:collapse;background-color:#2f6fed;color:#ffffff;border:1px solid #1e40af;">
                <tr>
                    <td style="width:25%;padding:2.2mm 3mm;border-right:1px solid #8bb0ff;font-size:8pt;font-weight:bold;vertical-align:middle;">
                        GRANJA RINCONADA DEL SUR S.A.
                    </td>
                    <td style="width:55%;padding:2.2mm 3mm;border-right:1px solid #8bb0ff;font-size:11pt;font-weight:bold;text-align:center;vertical-align:middle;">
                        COSTOS TRADICIONAL DÍA
                    </td>
                    <td style="width:20%;padding:2.2mm 3mm;font-size:7.8pt;text-align:right;vertical-align:middle;">
                        ' . self::e($fechaGeneracion) . '
                    </td>
                </tr>
            </table>
            <div style="font-size:7pt;color:#475569;text-align:center;padding-top:1mm;">
                Período: ' . self::e($periodo) . '
            </div>';

        $mpdf = new \Mpdf\Mpdf([
            'mode' => 'utf-8',
            'format' => 'A3-L',
            'margin_left' => 8,
            'margin_right' => 8,
            'margin_top' => 24,
            'margin_header' => 5,
            'margin_bottom' => 8,
            'tempDir' => sys_get_temp_dir(),
            'default_font' => 'dejavusans'
        ]);

        $mpdf->SetTitle('Costos Tradicional Día');
        $mpdf->SetAuthor('Granja Rinconada del Sur S.A.');
        $mpdf->SetHTMLHeader($cabecera);

        // Página 1: gráfico
        $mpdf->WriteHTML('<img src="' . $chartImage . '" style="width:100%;" />');

        // Página 2 en adelante: tabla de detalle
        $mpdf->AddPage();

        $chunks = self::construirTablaChunks($periodos, $aniosEstructura, $matrizFamilias, $graficaCosto);
        foreach ($chunks as $i => $chunk) {
            if ($i > 0) {
                $mpdf->AddPage();
            }
            $mpdf->WriteHTML($chunk);
        }

        $nombre = 'Costos_Tradicional_Dia_' . date('Ymd_His') . '.pdf';
        $mpdf->Output($nombre, \Mpdf\Output\Destination::INLINE);
        exit;
    }

    private static function construirTablaChunks(array $periodos, array $aniosEstructura, array $matrizFamilias, array $graficaCosto): array
    {
        $graficaPorKey = [];
        foreach ($graficaCosto as $punto) {
            if (isset($punto['key'])) {
                $graficaPorKey[$punto['key']] = $punto;
            }
        }

        $header = self::construirHeaderTabla($periodos, $aniosEstructura);
        $estilos = self::estilosTabla();
        $seccion = '
            <div style="font-size:11pt;font-weight:bold;color:#0f172a;margin:0 0 0.5mm 0;">Detalle Familia/SubFamilia</div>
            <div style="font-size:7pt;color:#64748b;margin:0 0 1.2mm 0;">Desglose de Costo Unitario (CU) y Variación (Dif) por mes</div>
            <div style="font-size:7pt;color:#64748b;margin:0 0 2mm 0;">
                <span style="color:#059669;">●</span> Incremento (+) &nbsp;&nbsp;
                <span style="color:#e11d48;">●</span> Disminución (-)
            </div>';

        $chunks = [];
        $filas = '';
        $filasEnPagina = 0;
        $primeraPagina = true;
        $maxFilasPorPagina = 52;

        $cerrarPagina = function () use (&$chunks, &$filas, &$filasEnPagina, &$primeraPagina, $header, $estilos, $seccion) {
            $chunks[] = $estilos . ($primeraPagina ? $seccion : '') . '<table class="detalle">' . $header . '<tbody>' . $filas . '</tbody></table>';
            $filas = '';
            $filasEnPagina = 0;
            $primeraPagina = false;
        };

        foreach ($matrizFamilias as $familia) {
            $subfamilias = $familia['subfamilias'] ?? [];
            $totalSub = count($subfamilias);
            $indice = 0;

            while ($indice < $totalSub) {
                if ($filasEnPagina >= $maxFilasPorPagina) {
                    $cerrarPagina();
                }

                $espacio = $maxFilasPorPagina - $filasEnPagina;
                if ($espacio <= 0) {
                    $cerrarPagina();
                    continue;
                }

                $restantes = $totalSub - $indice;
                $tomar = min($restantes, $espacio);

                if ($tomar < $restantes && $tomar < 2) {
                    $cerrarPagina();
                    continue;
                }

                $slice = array_slice($subfamilias, $indice, $tomar);
                $filas .= self::filasFamilia($familia, $slice, $periodos);
                $filasEnPagina += $tomar;
                $indice += $tomar;
            }
        }

        $filas .= self::filaTotal($periodos, $graficaPorKey);
        $cerrarPagina();

        return $chunks;
    }

    private static function construirHeaderTabla(array $periodos, array $aniosEstructura): string
    {
        $totalPeriodCols = 1 + max(0, count($periodos) - 1) * 2;
        $anchoPeriodo = $totalPeriodCols > 0 ? 64 / $totalPeriodCols : 64;

        $html = '<thead><tr>';
        $html .= '<th rowspan="3" class="dim" style="width:15%;">Familia</th>';
        $html .= '<th rowspan="3" class="dim" style="width:21%;">SubFamilia</th>';

        $globalIdx = 0;
        foreach ($aniosEstructura as $anioItem) {
            $colspan = 0;
            foreach (($anioItem['meses'] ?? []) as $mes) {
                $colspan += ($globalIdx === 0) ? 1 : 2;
                $globalIdx++;
            }
            $html .= '<th colspan="' . $colspan . '" class="anio">' . self::e($anioItem['anio'] ?? '') . '</th>';
        }
        $html .= '</tr><tr>';

        $globalIdx = 0;
        foreach ($periodos as $p) {
            $colspan = ($globalIdx === 0) ? 1 : 2;
            $html .= '<th colspan="' . $colspan . '">' . self::e($p['mes'] ?? '') . '</th>';
            $globalIdx++;
        }
        $html .= '</tr><tr>';

        $globalIdx = 0;
        foreach ($periodos as $p) {
            $html .= '<th class="subcol" style="width:' . $anchoPeriodo . '%;">CU</th>';
            if ($globalIdx > 0) {
                $html .= '<th class="subcol" style="width:' . $anchoPeriodo . '%;">Dif</th>';
            }
            $globalIdx++;
        }
        $html .= '</tr></thead>';

        return $html;
    }

    private static function filasFamilia(array $familia, array $subfamilias, array $periodos): string
    {
        $html = '';
        $total = count($subfamilias);

        foreach ($subfamilias as $idx => $subfamilia) {
            $html .= '<tr>';

            if ($idx === 0) {
                $html .= '<td rowspan="' . $total . '" class="fam">' . self::e($familia['familia'] ?? '') . '</td>';
            }

            $html .= '<td class="sub">' . self::e($subfamilia['subfamilia'] ?? '') . '</td>';

            $globalIdx = 0;
            foreach ($periodos as $p) {
                $valor = $subfamilia['valores'][$p['key']] ?? ['cu' => 0, 'dif' => null];
                $cu = (float)($valor['cu'] ?? 0);
                $dif = $valor['dif'] ?? null;

                $colorCu = '#1e293b';
                if ($globalIdx === 0) {
                    $colorCu = '#e11d48';
                } elseif (is_numeric($dif)) {
                    if ((float)$dif > 0) {
                        $colorCu = '#059669';
                    } elseif ((float)$dif < 0) {
                        $colorCu = '#e11d48';
                    }
                }

                $html .= '<td class="num" style="color:' . $colorCu . ';">S/' . number_format($cu, 3, ',', '') . '</td>';

                if ($globalIdx > 0) {
                    if (!is_numeric($dif)) {
                        $html .= '<td class="num" style="color:#94a3b8;">-</td>';
                    } else {
                        $difNum = (float)$dif;
                        $colorDif = $difNum > 0 ? '#059669' : ($difNum < 0 ? '#e11d48' : '#64748b');
                        $html .= '<td class="num" style="color:' . $colorDif . ';">' . number_format($difNum, 3, ',', '') . '</td>';
                    }
                }

                $globalIdx++;
            }

            $html .= '</tr>';
        }

        return $html;
    }

    private static function filaTotal(array $periodos, array $graficaPorKey): string
    {
        $html = '<tr class="total"><td colspan="2">TOTAL GENERAL</td>';

        $globalIdx = 0;
        foreach ($periodos as $p) {
            $punto = $graficaPorKey[$p['key']] ?? null;
            $cu = $punto ? (float)($punto['costo'] ?? 0) : 0;
            $dif = $punto ? ($punto['dif'] ?? null) : null;

            $html .= '<td class="num">S/' . number_format($cu, 3, ',', '') . '</td>';

            if ($globalIdx > 0) {
                $difTxt = is_numeric($dif) ? number_format((float)$dif, 3, ',', '') : '-';
                $html .= '<td class="num">' . $difTxt . '</td>';
            }
            $globalIdx++;
        }

        $html .= '</tr>';
        return $html;
    }

    private static function estilosTabla(): string
    {
        return '
        <style>
            table.detalle { width:100%; border-collapse:collapse; table-layout:fixed; font-size:6pt; }
            table.detalle thead { display:table-header-group; }
            table.detalle tr { page-break-inside:avoid; }
            table.detalle th, table.detalle td { border:0.3pt solid #cbd5e1; padding:0.65mm 0.55mm; vertical-align:middle; }
            table.detalle th { background:#2563eb; color:#ffffff; font-weight:bold; text-align:center; }
            table.detalle th.anio { background:#1d4ed8; font-size:6.4pt; }
            table.detalle th.subcol { background:#e2e8f0; color:#334155; font-size:5.5pt; }
            table.detalle th.dim { background:#1e40af; text-align:left; }
            table.detalle td.fam { font-weight:bold; color:#0f172a; font-size:5.8pt; vertical-align:top; }
            table.detalle td.sub { color:#334155; font-size:5.8pt; }
            table.detalle td.num { text-align:center; white-space:nowrap; font-size:5.8pt; }
            table.detalle tr.total td { background:#dbeafe; color:#1e3a8a; font-weight:bold; font-size:6pt; }
        </style>';
    }

    private static function fechaCorta(string $fecha): string
    {
        if ($fecha === '') {
            return '';
        }
        $date = DateTime::createFromFormat('Y-m-d', substr($fecha, 0, 10));
        return $date ? $date->format('d/m/Y') : $fecha;
    }

    private static function e($texto): string
    {
        return htmlspecialchars((string)$texto, ENT_QUOTES, 'UTF-8');
    }
}
