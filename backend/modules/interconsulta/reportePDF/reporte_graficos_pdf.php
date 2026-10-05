<?php
// modules/sip/interconsultas/reportePDF/reporte_graficos_pdf.php
declare(strict_types=1);

// Aumentar límites de memoria y regex de PHP para payloads grandes de imágenes base64
ini_set('memory_limit', '512M');
ini_set('max_execution_time', '180');
ini_set('pcre.backtrack_limit', '20000000');
ini_set('pcre.recursion_limit', '20000000');

// Carga del autoload de Composer
$autoloadCandidates = [
    __DIR__ . '/../../../libs/vendor/autoload.php',
    dirname(__DIR__, 2) . '/libs/vendor/autoload.php',
    dirname(__DIR__, 4) . '/backend/libs/vendor/autoload.php',
    'C:/laragon/www/corebi/backend/libs/vendor/autoload.php',
    'C:/laragon/www/corebi/vendor/autoload.php',
];
$autoloadPath = null;
foreach ($autoloadCandidates as $cand) {
    if (file_exists($cand)) {
        $autoloadPath = $cand;
        break;
    }
}
if (!$autoloadPath) {
    http_response_code(500);
    die('Error: No se encontró el autoload de vendor en backend/libs/vendor/autoload.php');
}
require_once $autoloadPath;

// Recepción del payload
$payloadRaw = $_POST['payload'] ?? '';
$data = [];

if (!empty($payloadRaw)) {
    $data = json_decode($payloadRaw, true);
    if (!is_array($data)) {
        $data = [];
    }
}

$disposicion = isset($data['disposicion']) && $data['disposicion'] === 'horizontal' ? 'horizontal' : 'vertical';
$secciones = isset($data['secciones']) && is_array($data['secciones']) ? $data['secciones'] : [];
$graficosPlano = isset($data['graficos']) && is_array($data['graficos']) ? $data['graficos'] : [];
$fechaHora = date('d/m/Y H:i');

// Si no vienen secciones estructuradas pero sí graficos planos, las agrupamos
if (empty($secciones) && !empty($graficosPlano)) {
    $grupos = [];
    foreach ($graficosPlano as $g) {
        $tipoKey = $g['seccion'] ?? 'MÉTRICA';
        if (!isset($grupos[$tipoKey])) {
            $grupos[$tipoKey] = [
                'tipo' => $g['tipo'] ?? strtolower($tipoKey),
                'label' => $tipoKey,
                'graficos' => []
            ];
        }
        $grupos[$tipoKey]['graficos'][] = $g;
    }
    $secciones = array_values($grupos);
}

try {
    $mpdf = new \Mpdf\Mpdf([
        'mode'                  => 'utf-8',
        'format'                => 'A3-L', // A3 Horizontal (420mm x 297mm)
        'margin_left'           => 10,
        'margin_right'          => 10,
        'margin_top'            => 22,    // Espacio reservado para la cabecera repetitiva
        'margin_header'         => 6,     // Margen superior de la cabecera
        'margin_bottom'         => 10,
        'shrink_tables_to_fit'  => 0,     // Desactiva reducción automática de fuentes en tablas anidadas
        'tempDir'               => sys_get_temp_dir(),
        'default_font'          => 'dejavusans'
    ]);

    $mpdf->SetTitle('Reporte Gráficos Interconsultas');
    $mpdf->SetAuthor('SIP Sanidad');

    // Cabecera institucional persistente en todas las páginas del PDF
    $cabeceraInstitucional = '
    <table style="width: 100%; border-collapse: collapse; border: 1.5px solid #475569;">
        <tr>
            <td style="width: 26%; background-color: #ffffff; color: #1e293b; font-size: 11pt; font-weight: bold; text-transform: uppercase; padding: 6px 12px; vertical-align: middle; border-right: 1.5px solid #475569;">
                GRANJA RINCONADA DEL SUR S.A.
            </td>
            <td style="width: 58%; background-color: #2563eb; color: #ffffff; font-size: 13pt; font-weight: bold; text-align: center; padding: 6px 10px; vertical-align: middle; border-right: 1.5px solid #475569; letter-spacing: 0.5px;">
                REPORTE GRAFICOS INTERCONSULTAS
            </td>
            <td style="width: 16%; background-color: #ffffff; color: #1e293b; font-size: 11pt; font-weight: normal; text-align: right; padding: 6px 12px; vertical-align: middle; white-space: nowrap;">
                ' . htmlspecialchars($fechaHora) . '
            </td>
        </tr>
    </table>';

    $mpdf->SetHTMLHeader($cabeceraInstitucional);

    // Paleta de colores para los badges de cada tipo de sección
    $obtenerEstiloBadgeSeccion = function(string $tipo) {
        $t = strtolower($tipo);
        if (strpos($t, 'mortalidad') !== false) {
            return 'background: #fff1f2; color: #e11d48; border: 1.5px solid #fecdd3;';
        } elseif (strpos($t, 'alimento') !== false) {
            return 'background: #fffbeb; color: #d97706; border: 1.5px solid #fde68a;';
        } elseif (strpos($t, 'agua') !== false) {
            return 'background: #ecfeff; color: #0891b2; border: 1.5px solid #a5f3fc;';
        } elseif (strpos($t, 'peso') !== false) {
            return 'background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0;';
        } elseif (strpos($t, 'temperatura') !== false) {
            return 'background: #fef2f2; color: #dc2626; border: 1.5px solid #fca5a5;';
        } elseif (strpos($t, 'gas') !== false) {
            return 'background: #eff6ff; color: #2563eb; border: 1.5px solid #bfdbfe;';
        }
        return 'background: #eff6ff; color: #2563eb; border: 1.5px solid #bfdbfe;';
    };

    // Función auxiliar para renderizar una tarjeta de gráfico individual
    $renderizarTarjetaGrafico = function(array $g, string $maxAltoImg) {
        $metaPartes = [];
        if (!empty($g['granja'])) $metaPartes[] = htmlspecialchars($g['granja']);
        if (!empty($g['campania'])) $metaPartes[] = htmlspecialchars($g['campania']);
        if (!empty($g['galpon'])) $metaPartes[] = htmlspecialchars($g['galpon']);
        $badgeUbicacion = !empty($metaPartes) ? implode(' · ', $metaPartes) : 'GRÁFICO';

        return '
        <table class="card-table">
            <tr>
                <td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; vertical-align: middle;">
                    <span class="badge-ubicacion">' . $badgeUbicacion . '</span>
                </td>
                ' . (!empty($g['sexo']) ? '<td style="padding: 5px 8px; border-bottom: 1px solid #f1f5f9; text-align: right; vertical-align: middle; white-space: nowrap;"><span class="badge-sexo">' . htmlspecialchars($g['sexo']) . '</span></td>' : '') . '
            </tr>
            <tr>
                <td colspan="2" style="padding: 6px 8px 8px 8px; text-align: center;">
                    <img src="' . $g['imagenBase64'] . '" width="100%" class="chart-img" style="width: 100%; max-height: ' . $maxAltoImg . ';" />
                </td>
            </tr>
        </table>';
    };

    $estilos = '
        body {
            font-family: dejavusans, sans-serif;
            color: #1e293b;
            font-size: 12px;
        }
        .section-header-box {
            margin-bottom: 8px;
            padding-bottom: 3px;
            border-bottom: 1.5px solid #e2e8f0;
        }
        .badge-seccion {
            display: inline-block;
            padding: 3.5px 9px;
            border-radius: 5px;
            font-size: 13px;
            font-weight: bold;
            line-height: 1.2;
        }
        .badge-seccion-count {
            font-size: 11.5px;
            font-weight: normal;
            opacity: 0.85;
        }
        .card-table {
            width: 100%;
            border-collapse: collapse;
            border: 1.5px solid #cbd5e1;
            border-radius: 6px;
            background-color: #ffffff;
            margin: 0;
            padding: 0;
        }
        .badge-ubicacion {
            display: inline-block;
            font-size: 12px;
            font-weight: bold;
            color: #1d4ed8;
            background-color: #eff6ff;
            border: 1px solid #bfdbfe;
            padding: 2.5px 7px;
            border-radius: 4px;
            line-height: 1.2;
        }
        .badge-sexo {
            display: inline-block;
            font-size: 11px;
            font-weight: bold;
            color: #475569;
            line-height: 1.2;
        }
        .chart-img {
            width: 100%;
            display: block;
            margin: 0 auto;
        }
        .sin-graficos-box {
            text-align: center;
            padding: 50px 20px;
            background-color: #f8fafc;
            border: 1px dashed #cbd5e1;
            border-radius: 8px;
            margin-top: 30px;
        }
    ';

    // Cargar estilos CSS directamente en el registro de mPDF
    $mpdf->WriteHTML($estilos, \Mpdf\HTMLParserMode::HEADER_CSS);

    if (empty($secciones)) {
        $htmlSinGraficos = '
        <div class="sin-graficos-box">
            <h3 style="color: #475569; font-size: 14pt; margin-bottom: 8px;">No hay gráficos seleccionados para exportar</h3>
            <p style="color: #94a3b8; font-size: 10pt;">Por favor seleccione los filtros deseados en el dashboard y haga clic en "Cargar" antes de generar el PDF.</p>
        </div>';
        $mpdf->WriteHTML($htmlSinGraficos, \Mpdf\HTMLParserMode::HTML_BODY);
    } else {
        $totalSecciones = count($secciones);

        if ($disposicion === 'horizontal') {
            // DISPOSICIÓN HORIZONTAL:
            // Cada página agrupa hasta 3 columnas de métricas.
            // En cada columna caben HASTA 3 GRÁFICOS APILADOS por página.
            // Altura de imagen calculada en proporción exacta al ancho de columna para evitar desbordes.
            $maxColsPorPagina = 3;
            $chunksSecciones = array_chunk($secciones, $maxColsPorPagina);
            $esPrimeraPaginaGlobal = true;

            foreach ($chunksSecciones as $chunk) {
                $maxGraficosEnChunk = 0;
                foreach ($chunk as $sec) {
                    $maxGraficosEnChunk = max($maxGraficosEnChunk, count($sec['graficos'] ?? []));
                }

                $totalPaginasVerticales = max(1, (int)ceil($maxGraficosEnChunk / 3));

                for ($pag = 0; $pag < $totalPaginasVerticales; $pag++) {
                    if (!$esPrimeraPaginaGlobal) {
                        $mpdf->WriteHTML('<pagebreak />', \Mpdf\HTMLParserMode::HTML_BODY);
                    }
                    $esPrimeraPaginaGlobal = false;

                    $numCols = count($chunk);
                    $anchoCol = ($numCols === 1) ? '100%' : (($numCols === 2) ? '50%' : '33.33%');

                    $htmlPagina = '<table style="width: 100%; border-collapse: separate; border-spacing: 16px 0; margin: 0; padding: 0;"><tr>';

                    foreach ($chunk as $sec) {
                        $tipoLabel = htmlspecialchars(str_replace('_', ' ', $sec['label'] ?? 'MÉTRICA'));
                        $badgeStyle = $obtenerEstiloBadgeSeccion($sec['tipo'] ?? $tipoLabel);
                        $todosLosGraficos = $sec['graficos'] ?? [];
                        $totalEnSec = count($todosLosGraficos);

                        $sliceGraficos = array_slice($todosLosGraficos, $pag * 3, 3);
                        $cantEnSlice = count($sliceGraficos);

                        if ($cantEnSlice === 0) {
                            $htmlPagina .= '<td style="width: ' . $anchoCol . '; border: none; background: transparent; padding: 0;"></td>';
                            continue;
                        }

                        // Altura máxima proporcional tanto al ancho de la columna ($numCols) como al número de gráficas ($cantEnSlice):
                        if ($numCols === 1) {
                            $maxAltoImg = ($cantEnSlice === 1 && $totalEnSec === 1) ? '190mm' : (($cantEnSlice === 1) ? '105mm' : (($cantEnSlice === 2) ? '100mm' : '66mm'));
                        } elseif ($numCols === 2) {
                            $maxAltoImg = ($cantEnSlice === 1) ? '108mm' : (($cantEnSlice === 2) ? '102mm' : '66mm');
                        } else {
                            // 3 columnas: ancho de columna ~125mm, alto ideal 75mm para mantener escala sin overflow
                            $maxAltoImg = ($cantEnSlice === 1) ? '75mm' : (($cantEnSlice === 2) ? '75mm' : '66mm');
                        }

                        $htmlPagina .= '<td style="width: ' . $anchoCol . '; vertical-align: top; padding: 0;">';
                        
                        $labelPaginacion = ($totalPaginasVerticales > 1) ? ' <span style="font-size: 10.5px; opacity: 0.75; font-weight: normal;">(Pág. ' . ($pag + 1) . '/' . $totalPaginasVerticales . ')</span>' : '';
                        $htmlPagina .= '
                        <div class="section-header-box">
                            <span class="badge-seccion" style="' . $badgeStyle . '">
                                ' . $tipoLabel . ' <span class="badge-seccion-count">(' . $totalEnSec . ' ' . ($totalEnSec === 1 ? 'gráfica' : 'gráficas') . ')' . $labelPaginacion . '</span>
                            </span>
                        </div>';

                        $htmlPagina .= '<table style="width: 100%; border-collapse: collapse; margin: 0; padding: 0;">';
                        $cantRestante = $cantEnSlice;
                        foreach ($sliceGraficos as $g) {
                            $cantRestante--;
                            $paddingBottom = ($cantRestante > 0) ? 'padding-bottom: 16px;' : 'padding-bottom: 0;';
                            $htmlPagina .= '<tr><td style="' . $paddingBottom . '">';
                            $htmlPagina .= $renderizarTarjetaGrafico($g, $maxAltoImg);
                            $htmlPagina .= '</td></tr>';
                        }
                        $htmlPagina .= '</table>';

                        $htmlPagina .= '</td>';
                    }

                    $htmlPagina .= '</tr></table>';

                    // Escribir la página actual directamente a mPDF
                    $mpdf->WriteHTML($htmlPagina, \Mpdf\HTMLParserMode::HTML_BODY);
                }
            }

        } else {
            // DISPOSICIÓN VERTICAL:
            // Cada sección se procesa y escribe individualmente a mPDF con page-break-inside: avoid.
            foreach ($secciones as $secIdx => $sec) {
                $tipoLabel = htmlspecialchars(str_replace('_', ' ', $sec['label'] ?? 'MÉTRICA'));
                $badgeStyle = $obtenerEstiloBadgeSeccion($sec['tipo'] ?? $tipoLabel);
                $graficosDeSec = $sec['graficos'] ?? [];
                $cantGraficos = count($graficosDeSec);

                $htmlSec = '
                <div style="page-break-inside: avoid; margin-bottom: 24px;">
                    <div class="section-header-box">
                        <span class="badge-seccion" style="' . $badgeStyle . '">
                            ' . $tipoLabel . ' <span class="badge-seccion-count">(' . $cantGraficos . ' ' . ($cantGraficos === 1 ? 'gráfica' : 'gráficas') . ')</span>
                        </span>
                    </div>';

                if ($cantGraficos === 1) {
                    $g = $graficosDeSec[0];
                    $htmlSec .= $renderizarTarjetaGrafico($g, '190mm');
                } elseif ($cantGraficos === 2) {
                    $htmlSec .= '<table style="width: 100%; border-collapse: separate; border-spacing: 16px 0; margin: 0; padding: 0;"><tr>';
                    foreach ($graficosDeSec as $g) {
                        $htmlSec .= '<td style="width: 50%; vertical-align: top; padding: 0;">';
                        $htmlSec .= $renderizarTarjetaGrafico($g, '110mm');
                        $htmlSec .= '</td>';
                    }
                    $htmlSec .= '</tr></table>';
                } elseif ($cantGraficos === 3) {
                    $htmlSec .= '<table style="width: 100%; border-collapse: separate; border-spacing: 14px 0; margin: 0; padding: 0;"><tr>';
                    foreach ($graficosDeSec as $g) {
                        $htmlSec .= '<td style="width: 33.33%; vertical-align: top; padding: 0;">';
                        $htmlSec .= $renderizarTarjetaGrafico($g, '78mm');
                        $htmlSec .= '</td>';
                    }
                    $htmlSec .= '</tr></table>';
                } elseif ($cantGraficos === 4) {
                    $chunksCards = array_chunk($graficosDeSec, 2);
                    foreach ($chunksCards as $chunkIdx => $chunk) {
                        $marginRow = ($chunkIdx < count($chunksCards) - 1) ? 'margin-bottom: 18px;' : '';
                        $htmlSec .= '<table style="width: 100%; border-collapse: separate; border-spacing: 16px 0; margin: 0; padding: 0; ' . $marginRow . '"><tr>';
                        foreach ($chunk as $g) {
                            $htmlSec .= '<td style="width: 50%; vertical-align: top; padding: 0;">';
                            $htmlSec .= $renderizarTarjetaGrafico($g, '95mm');
                            $htmlSec .= '</td>';
                        }
                        $htmlSec .= '</tr></table>';
                    }
                } else {
                    $chunksCards = array_chunk($graficosDeSec, 3);
                    foreach ($chunksCards as $chunkIdx => $chunk) {
                        $marginRow = ($chunkIdx < count($chunksCards) - 1) ? 'margin-bottom: 18px;' : '';
                        $htmlSec .= '<table style="width: 100%; border-collapse: separate; border-spacing: 14px 0; margin: 0; padding: 0; ' . $marginRow . '"><tr>';
                        foreach ($chunk as $g) {
                            $htmlSec .= '<td style="width: 33.33%; vertical-align: top; padding: 0;">';
                            $htmlSec .= $renderizarTarjetaGrafico($g, '75mm');
                            $htmlSec .= '</td>';
                        }
                        while (count($chunk) < 3) {
                            $htmlSec .= '<td style="width: 33.33%; border: none; background: transparent; padding: 0;"></td>';
                            $chunk[] = null;
                        }
                        $htmlSec .= '</tr></table>';
                    }
                }

                $htmlSec .= '</div>';

                // Escribir la sección actual directamente a mPDF
                $mpdf->WriteHTML($htmlSec, \Mpdf\HTMLParserMode::HTML_BODY);
            }
        }
    }

    if (ob_get_length()) {
        ob_end_clean();
    }

    $mpdf->Output('reporte_graficos_interconsultas.pdf', \Mpdf\Output\Destination::INLINE);

} catch (\Throwable $e) {
    http_response_code(500);
    echo '<h3>Error al generar el PDF:</h3><p>' . htmlspecialchars($e->getMessage()) . '</p>';
}
