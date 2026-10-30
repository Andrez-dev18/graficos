<?php

class CP08Pdf
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

        $datos = $payload['datos'] ?? [];
        $seleccion = $payload['seleccion'] ?? [];
        $filtros = $payload['filtros'] ?? [];

        $cencosActivo = $seleccion['cencosActivo'] ?? ($datos['cencos_activo'] ?? '');
        $nomcencosActivo = $seleccion['nomcencosActivo'] ?? ($datos['nomcencos_activo'] ?? '');
        $galponActivo = $seleccion['galponActivo'] ?? null;
        $lineaSeleccionada = $seleccion['lineaSeleccionada'] ?? null;
        $selectedGranjas = $seleccion['selectedGranjas'] ?? [];
        $selectedClasif = $seleccion['selectedClasif'] ?? [];

        $periodo = $filtros['fecha_formateada'] ?? '';
        if (empty($periodo)) {
            $fIni = $filtros['fecha_inicio'] ?? '';
            $fFin = $filtros['fecha_fin'] ?? '';
            $periodo = self::fechaCorta($fIni) . ' al ' . self::fechaCorta($fFin);
        }

        $fechaGeneracion = (new DateTimeImmutable('now', new DateTimeZone('America/Lima')))->format('d/m/Y H:i');

        // Configuración de mPDF en formato A4 Horizontal (Landscape)
        $mpdf = new \Mpdf\Mpdf([
            'mode'          => 'utf-8',
            'format'        => 'A4-L',
            'margin_left'   => 8,
            'margin_right'  => 8,
            'margin_top'    => 20,
            'margin_header' => 4,
            'margin_bottom' => 8,
            'margin_footer' => 4,
            'tempDir'       => sys_get_temp_dir(),
            'default_font'  => 'dejavusans'
        ]);

        $mpdf->SetTitle('CP08 Comparativo Granja Galpón');
        $mpdf->SetAuthor('Granja Rinconada del Sur S.A.');

        // Cabecera institucional limpia: Título y Período
        $cabecera = '
            <table style="width:100%;border-collapse:collapse;background-color:#1e40af;color:#ffffff;border:1px solid #1e3a8a;">
                <tr>
                    <td style="width:25%;padding:2mm 3mm;font-size:8pt;font-weight:bold;vertical-align:middle;border-right:1px solid #60a5fa;">
                        GRANJA RINCONADA DEL SUR S.A.
                    </td>
                    <td style="width:50%;padding:2mm 3mm;font-size:10pt;font-weight:bold;text-align:center;vertical-align:middle;border-right:1px solid #60a5fa;">
                        CP08 - COMPARATIVO GRANJA GALPÓN
                    </td>
                    <td style="width:25%;padding:2mm 3mm;font-size:7.5pt;text-align:right;vertical-align:middle;">
                        Generado: ' . htmlspecialchars($fechaGeneracion) . '
                    </td>
                </tr>
            </table>
            <div style="font-size:7.5pt;color:#334155;background:#f8fafc;border:1px solid #cbd5e1;border-top:none;padding:1.5mm 3mm;">
                <strong>Período:</strong> ' . htmlspecialchars($periodo) . '
            </div>';

        $mpdf->SetHTMLHeader($cabecera);
        $mpdf->SetHTMLFooter('
            <table style="width:100%;font-size:6.8pt;color:#64748b;border-top:0.5px solid #cbd5e1;padding-top:1mm;">
                <tr>
                    <td style="text-align:left;">CoreBI - Análisis Costo Diario (CP08)</td>
                    <td style="text-align:right;">Página {PAGENO} de {nbpg}</td>
                </tr>
            </table>
        ');

        // Construir contenido HTML de las 3 tablas
        $html = self::estilosCss();

        // 1. Tabla: DATOS PRODUCTIVOS
        $html .= self::construirTabla1($datos['tabla1_datos_productivos'] ?? [], $selectedGranjas, $cencosActivo, $galponActivo);

        // Salto de página para la Tabla 2
        $html .= '<pagebreak />';

        // 2. Tabla: COMPARACIÓN LÍNEA
        $html .= self::construirTabla2($datos['tabla2_comparacion_linea'] ?? [], $galponActivo, $selectedClasif);

        // Salto de página para la Tabla 3
        $html .= '<pagebreak />';

        // 3. Tabla: COMPARATIVO DETALLE PRODUCTOS
        $html .= self::construirTabla3($datos['tabla3_comparativo_detalle'] ?? [], $galponActivo, $lineaSeleccionada, $selectedClasif, $cencosActivo);

        $mpdf->WriteHTML($html);

        $nombre = 'CP08_ComparativoGranjaGalpon_' . date('Ymd_His') . '.pdf';
        $mpdf->Output($nombre, \Mpdf\Output\Destination::INLINE);
        exit;
    }

    private static function estilosCss(): string
    {
        return '
        <style>
            body { font-family: dejavusans, sans-serif; font-size: 7pt; color: #1e293b; }
            .section-title { font-size: 8.5pt; font-weight: bold; color: #1e3a8a; margin: 2mm 0 1.5mm 0; text-transform: uppercase; border-bottom: 1.5px solid #2563eb; padding-bottom: 1mm; }
            .section-subtitle { font-size: 6.8pt; color: #64748b; font-weight: normal; text-transform: none; }
            table.report-table { width: 100%; border-collapse: collapse; font-size: 6.8pt; margin-bottom: 3mm; }
            table.report-table th { background-color: #2563eb; color: #ffffff; font-weight: bold; text-align: center; border: 0.5px solid #1d4ed8; padding: 1.2mm 1.5mm; }
            table.report-table td { border: 0.5px solid #cbd5e1; padding: 1.1mm 1.5mm; }
            table.report-table tr:nth-child(even) td { background-color: #f8fafc; }
            
            .text-left { text-align: left; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: bold; }
            .font-mono { font-family: monospace; }
            
            .row-subtotal td { background-color: #f1f5f9 !important; font-weight: bold; color: #0f172a; border-top: 1px solid #94a3b8; border-bottom: 1px solid #94a3b8; }
            .row-total-gen td { background-color: #e2e8f0 !important; font-weight: bold; color: #1e3a8a; border-top: 1.5px solid #64748b; border-bottom: 1.5px solid #64748b; }
            .row-selected td { background-color: #bae6fd !important; font-weight: bold; color: #0c4a6e; }
            
            .badge-pos { color: #b91c1c; background-color: #fee2e2; font-weight: bold; padding: 0.5mm 1mm; border-radius: 2px; }
            .badge-neg { color: #15803d; background-color: #dcfce7; font-weight: bold; padding: 0.5mm 1mm; border-radius: 2px; }
            .badge-neutral { color: #64748b; }
            
            .header-cencos { background-color: #1e3a8a !important; color: #ffffff !important; }
            .header-galpon { background-color: #1d4ed8 !important; color: #ffffff !important; }
            .header-subcol { background-color: #3b82f6 !important; color: #ffffff !important; font-size: 6.2pt; }
        </style>';
    }

    private static function construirTabla1(array $t1Data, array $selectedGranjas, string $cencosActivo, ?string $galponActivo): string
    {
        $allGranjas = $t1Data['granjas'] ?? [];
        if (!empty($selectedGranjas)) {
            $granjas = array_filter($allGranjas, function ($g) use ($selectedGranjas) {
                return in_array((string)$g['cencos'], array_map('strval', $selectedGranjas), true);
            });
        } else {
            $granjas = $allGranjas;
        }

        $html = '<div class="section-title">1. DATOS PRODUCTIVOS</div>';
        $html .= '<table class="report-table">';
        $html .= '<thead>
                    <tr>
                        <th style="width:8%;">Cencos</th>
                        <th style="width:6%;">Galpón</th>
                        <th style="width:12%;">Unidades Vendidas</th>
                        <th style="width:14%;">Kilos Vendidos</th>
                        <th style="width:12%;">Peso Promedio</th>
                        <th style="width:10%;">ICA</th>
                        <th style="width:12%;">Prom. Edad Venta</th>
                        <th style="width:12%;">% Mortalidad</th>
                        <th style="width:14%;">PGD</th>
                    </tr>
                  </thead><tbody>';

        if (empty($granjas)) {
            $html .= '<tr><td colspan="9" class="text-center" style="padding:4mm;color:#94a3b8;">No hay datos productivos para los filtros seleccionados</td></tr>';
        } else {
            foreach ($granjas as $g) {
                $isGranjaActiva = ($cencosActivo === (string)$g['cencos']);
                $galpones = $g['galpones'] ?? [];

                foreach ($galpones as $idx => $r) {
                    $isFirst = ($idx === 0);
                    $cencosTxt = $isFirst ? htmlspecialchars($r['cencos']) : '';
                    $isSelectedRow = ($isGranjaActiva && $galponActivo !== null && (string)$galponActivo === (string)$r['galpon']);
                    $rowClass = $isSelectedRow ? 'row-selected' : '';

                    $html .= "<tr class='{$rowClass}'>";
                    $html .= "<td class='text-center font-bold font-mono'>{$cencosTxt}</td>";
                    $html .= "<td class='text-center font-mono'>" . htmlspecialchars($r['galpon']) . "</td>";
                    $html .= "<td class='text-right font-mono'>" . number_format((float)$r['unidades_ven'], 0) . "</td>";
                    $html .= "<td class='text-right font-mono'>" . number_format((float)$r['kilos_vendidos'], 2) . "</td>";
                    $html .= "<td class='text-right font-mono'>" . number_format((float)$r['peso_promedio'], 3) . "</td>";
                    $html .= "<td class='text-right font-mono'>" . number_format((float)$r['ica'], 3) . "</td>";
                    $html .= "<td class='text-right font-mono'>" . number_format((float)$r['prom_edad_ven'], 3) . "</td>";
                    $html .= "<td class='text-right font-mono'>" . number_format((float)$r['porc_mort'], 3) . "%</td>";
                    $html .= "<td class='text-right font-mono font-bold'>" . number_format((float)$r['pgd'], 3) . "</td>";
                    $html .= "</tr>";
                }

                // Subtotal Granja
                $sub = $g['subtotal'] ?? [];
                $isSubSelected = ($isGranjaActiva && $galponActivo === null);
                $subClass = $isSubSelected ? 'row-selected' : 'row-subtotal';

                $html .= "<tr class='{$subClass}'>";
                $html .= "<td class='text-center font-bold'></td>";
                $html .= "<td class='text-center font-bold'>TOTAL</td>";
                $html .= "<td class='text-right font-mono'>" . number_format((float)($sub['unidades_ven'] ?? 0), 0) . "</td>";
                $html .= "<td class='text-right font-mono'>" . number_format((float)($sub['kilos_vendidos'] ?? 0), 2) . "</td>";
                $html .= "<td class='text-right font-mono'>" . number_format((float)($sub['peso_promedio'] ?? 0), 3) . "</td>";
                $html .= "<td class='text-right font-mono'>" . number_format((float)($sub['ica'] ?? 0), 3) . "</td>";
                $html .= "<td class='text-right font-mono'>" . number_format((float)($sub['prom_edad_ven'] ?? 0), 3) . "</td>";
                $html .= "<td class='text-right font-mono'>" . number_format((float)($sub['porc_mort'] ?? 0), 3) . "%</td>";
                $html .= "<td class='text-right font-mono font-bold'>" . number_format((float)($sub['pgd'] ?? 0), 3) . "</td>";
                $html .= "</tr>";
            }

            // Total General
            $totGen = $t1Data['total_general'] ?? [];
            $html .= "<tr class='row-total-gen'>";
            $html .= "<td class='text-center font-bold' colspan='2'>TOTAL GENERAL</td>";
            $html .= "<td class='text-right font-mono'>" . number_format((float)($totGen['unidades_ven'] ?? 0), 0) . "</td>";
            $html .= "<td class='text-right font-mono'>" . number_format((float)($totGen['kilos_vendidos'] ?? 0), 2) . "</td>";
            $html .= "<td class='text-right font-mono'>" . number_format((float)($totGen['peso_promedio'] ?? 0), 3) . "</td>";
            $html .= "<td class='text-right font-mono'>" . number_format((float)($totGen['ica'] ?? 0), 3) . "</td>";
            $html .= "<td class='text-right font-mono'>" . number_format((float)($totGen['prom_edad_ven'] ?? 0), 3) . "</td>";
            $html .= "<td class='text-right font-mono'>" . number_format((float)($totGen['porc_mort'] ?? 0), 3) . "%</td>";
            $html .= "<td class='text-right font-mono font-bold'>" . number_format((float)($totGen['pgd'] ?? 0), 3) . "</td>";
            $html .= "</tr>";
        }

        $html .= '</tbody></table>';
        return $html;
    }

    private static function construirTabla2(array $t2Data, ?string $galponActivo, array $selectedClasif): string
    {
        $allGalpones = $t2Data['galpones_headers'] ?? [];
        if ($galponActivo !== null && $galponActivo !== '') {
            $galpones = array_values(array_filter($allGalpones, function ($g) use ($galponActivo) {
                return (string)$g === (string)$galponActivo;
            }));
        } else {
            $galpones = $allGalpones;
        }

        $allFilas = $t2Data['filas'] ?? [];
        if (!empty($selectedClasif)) {
            $filas = array_filter($allFilas, function ($r) use ($selectedClasif) {
                $clasifStr = trim(($r['linea'] ?? '') . ' ' . ($r['nomlinea'] ?? ''));
                foreach ($selectedClasif as $sel) {
                    if ($sel === $r['linea'] || $sel === $clasifStr || str_starts_with($clasifStr, $sel)) {
                        return true;
                    }
                }
                return false;
            });
        } else {
            $filas = $allFilas;
        }

        $totalesGalpon = $t2Data['totales_galpon'] ?? [];

        $html = '<div class="section-title">2. COMPARACIÓN LÍNEA</div>';
        $html .= '<table class="report-table">';
        $html .= '<thead>';

        // Fila 1 de cabecera
        $html .= '<tr>';
        $html .= '<th style="width:7%;" rowspan="2">Línea</th>';
        $html .= '<th style="width:23%;" rowspan="2">Descripción Línea</th>';
        foreach ($galpones as $g) {
            $html .= '<th class="header-galpon" colspan="4">Galpón ' . htmlspecialchars($g) . '</th>';
        }
        $html .= '</tr>';

        // Fila 2 de cabecera
        $html .= '<tr>';
        foreach ($galpones as $g) {
            $html .= '<th class="header-subcol" style="width:9%;">Valor</th>';
            $html .= '<th class="header-subcol" style="width:9%;">Kilos Prod.</th>';
            $html .= '<th class="header-subcol" style="width:7%;">CU</th>';
            $html .= '<th class="header-subcol" style="width:8%;">Dif en CU</th>';
        }
        $html .= '</tr></thead><tbody>';

        if (empty($filas) || empty($galpones)) {
            $colTotal = 2 + (count($galpones) * 4);
            $html .= "<tr><td colspan='{$colTotal}' class='text-center' style='padding:4mm;color:#94a3b8;'>No hay datos de comparación de línea para los filtros seleccionados</td></tr>";
        } else {
            foreach ($filas as $r) {
                $html .= '<tr>';
                $html .= '<td class="text-center font-bold font-mono">' . htmlspecialchars($r['linea']) . '</td>';
                $html .= '<td class="text-left">' . htmlspecialchars($r['nomlinea']) . '</td>';

                foreach ($galpones as $g) {
                    $gData = $r['galpones'][$g] ?? null;
                    if ($gData) {
                        $val = (float)($gData['valor'] ?? 0);
                        $kilos = (float)($gData['kilos'] ?? 0);
                        $cu = (float)($gData['cu'] ?? 0);
                        $difCu = (float)($gData['dif_cu'] ?? 0);

                        if ($difCu > 0) {
                            $difHtml = '<span class="badge-pos">+' . number_format($difCu, 3) . '</span>';
                        } elseif ($difCu < 0) {
                            $difHtml = '<span class="badge-neg">' . number_format($difCu, 3) . '</span>';
                        } else {
                            $difHtml = '<span class="badge-neutral">-</span>';
                        }

                        $html .= '<td class="text-right font-mono">' . number_format($val, 2) . '</td>';
                        $html .= '<td class="text-right font-mono">' . number_format($kilos, 2) . '</td>';
                        $html .= '<td class="text-right font-mono font-bold">' . number_format($cu, 3) . '</td>';
                        $html .= '<td class="text-center font-mono">' . $difHtml . '</td>';
                    } else {
                        $html .= '<td class="text-center font-mono" style="color:#cbd5e1;">-</td>';
                        $html .= '<td class="text-center font-mono" style="color:#cbd5e1;">-</td>';
                        $html .= '<td class="text-center font-mono" style="color:#cbd5e1;">-</td>';
                        $html .= '<td class="text-center font-mono" style="color:#cbd5e1;">-</td>';
                    }
                }
                $html .= '</tr>';
            }

            // Fila Total General
            $html .= '<tr class="row-total-gen">';
            $html .= '<td class="text-center font-bold" colspan="2">TOTAL GENERAL</td>';
            foreach ($galpones as $g) {
                $totG = $totalesGalpon[$g] ?? [];
                $totVal = (float)($totG['valor'] ?? 0);
                $totKilos = (float)($totG['kilos'] ?? 0);
                $totCu = (float)($totG['cu'] ?? 0);

                $html .= '<td class="text-right font-mono font-bold">' . number_format($totVal, 2) . '</td>';
                $html .= '<td class="text-right font-mono font-bold">' . number_format($totKilos, 2) . '</td>';
                $html .= '<td class="text-right font-mono font-bold">' . number_format($totCu, 3) . '</td>';
                $html .= '<td class="text-center font-mono font-bold"></td>';
            }
            $html .= '</tr>';
        }

        $html .= '</tbody></table>';
        return $html;
    }

    private static function construirTabla3(array $t3Data, ?string $galponActivo, ?string $lineaSeleccionada, array $selectedClasif, string $cencosActivo): string
    {
        $allGalpones = $t3Data['galpones_headers'] ?? [];
        if ($galponActivo !== null && $galponActivo !== '') {
            $galpones = array_values(array_filter($allGalpones, function ($g) use ($galponActivo) {
                return (string)$g === (string)$galponActivo;
            }));
        } else {
            $galpones = $allGalpones;
        }

        $allFilas = $t3Data['filas'] ?? [];
        $filas = array_filter($allFilas, function ($r) use ($lineaSeleccionada, $selectedClasif) {
            // Filtro por línea activa si está seleccionada en pantalla
            if ($lineaSeleccionada !== null && $lineaSeleccionada !== '' && (string)$r['linea'] !== (string)$lineaSeleccionada) {
                return false;
            }
            if (!empty($selectedClasif)) {
                $match = false;
                foreach ($selectedClasif as $sel) {
                    if ($sel === $r['linea'] || str_starts_with($r['linea'], $sel)) {
                        $match = true;
                        break;
                    }
                }
                if (!$match) return false;
            }
            return true;
        });

        $subtotalesLinea = $t3Data['subtotales_linea'] ?? [];
        $totalesGenerales = $t3Data['totales_generales'] ?? [];

        $html = '<div class="section-title">3. COMPARATIVO DETALLE PRODUCTOS</div>';
        $html .= '<table class="report-table">';
        $html .= '<thead>';

        // Cabecera Fila 1: Metadatos y Cencos
        $totalGalpCols = count($galpones) * 3;
        $html .= '<tr>';
        $html .= '<th style="width:6%;" rowspan="3">Línea</th>';
        $html .= '<th style="width:10%;" rowspan="3">Código</th>';
        $html .= '<th style="width:20%;" rowspan="3">Descripción Producto</th>';
        $html .= '<th style="width:6%;" rowspan="3">Trans.</th>';
        $html .= '<th class="header-cencos" colspan="' . max(1, $totalGalpCols) . '">Cencos: ' . htmlspecialchars($cencosActivo) . '</th>';
        $html .= '</tr>';

        // Cabecera Fila 2: Galpones
        $html .= '<tr>';
        foreach ($galpones as $g) {
            $html .= '<th class="header-galpon" colspan="3">Galpón ' . htmlspecialchars($g) . '</th>';
        }
        $html .= '</tr>';

        // Cabecera Fila 3: Subcolumnas por galpón
        $html .= '<tr>';
        foreach ($galpones as $g) {
            $html .= '<th class="header-subcol">Cantidad</th>';
            $html .= '<th class="header-subcol">Peso</th>';
            $html .= '<th class="header-subcol">Valor</th>';
        }
        $html .= '</tr></thead><tbody>';

        if (empty($filas) || empty($galpones)) {
            $colTotal = 4 + $totalGalpCols;
            $html .= "<tr><td colspan='{$colTotal}' class='text-center' style='padding:4mm;color:#94a3b8;'>No hay productos para la granja y filtros seleccionados</td></tr>";
        } else {
            // Agrupar filas por línea para incluir subtotal de línea
            $gruposPorLinea = [];
            foreach ($filas as $r) {
                $lin = $r['linea'] ?? 'OTRO';
                $gruposPorLinea[$lin][] = $r;
            }

            foreach ($gruposPorLinea as $lin => $items) {
                foreach ($items as $idx => $r) {
                    $linDisplay = ($idx === 0) ? htmlspecialchars($r['linea']) : '';

                    $html .= '<tr>';
                    $html .= '<td class="text-center font-bold font-mono">' . $linDisplay . '</td>';
                    $html .= '<td class="text-left font-mono font-bold" style="color:#1e3a8a;">' . htmlspecialchars($r['codigo']) . '</td>';
                    $html .= '<td class="text-left">' . htmlspecialchars($r['nomcodigo']) . '</td>';
                    $html .= '<td class="text-center font-mono font-bold" style="color:#475569;">' . htmlspecialchars($r['transaccion']) . '</td>';

                    foreach ($galpones as $g) {
                        $gData = $r['galpones'][$g] ?? null;
                        if ($gData) {
                            $cant = (float)($gData['cantidad'] ?? 0);
                            $peso = (float)($gData['peso'] ?? 0);
                            $val = (float)($gData['valor'] ?? 0);

                            $html .= '<td class="text-right font-mono">' . number_format($cant, 2) . '</td>';
                            $html .= '<td class="text-right font-mono">' . number_format($peso, 2) . '</td>';
                            $html .= '<td class="text-right font-mono font-bold">' . number_format($val, 2) . '</td>';
                        } else {
                            $html .= '<td class="text-right font-mono" style="color:#cbd5e1;">-</td>';
                            $html .= '<td class="text-right font-mono" style="color:#cbd5e1;">-</td>';
                            $html .= '<td class="text-right font-mono" style="color:#cbd5e1;">-</td>';
                        }
                    }
                    $html .= '</tr>';
                }

                // Subtotal de la Línea
                $subL = $subtotalesLinea[$lin] ?? [];
                $html .= '<tr class="row-subtotal">';
                $html .= '<td class="text-center font-bold" colspan="4">TOTAL LÍNEA ' . htmlspecialchars($lin) . '</td>';
                foreach ($galpones as $g) {
                    $subG = $subL[$g] ?? [];
                    $subCant = (float)($subG['cantidad'] ?? 0);
                    $subPeso = (float)($subG['peso'] ?? 0);
                    $subVal = (float)($subG['valor'] ?? 0);

                    $html .= '<td class="text-right font-mono">' . number_format($subCant, 2) . '</td>';
                    $html .= '<td class="text-right font-mono">' . number_format($subPeso, 2) . '</td>';
                    $html .= '<td class="text-right font-mono font-bold">' . number_format($subVal, 2) . '</td>';
                }
                $html .= '</tr>';
            }

            // Total General
            $html .= '<tr class="row-total-gen">';
            $html .= '<td class="text-center font-bold" colspan="4">TOTAL GENERAL</td>';
            foreach ($galpones as $g) {
                $totG = $totalesGenerales[$g] ?? [];
                $totCant = (float)($totG['cantidad'] ?? 0);
                $totPeso = (float)($totG['peso'] ?? 0);
                $totVal = (float)($totG['valor'] ?? 0);

                $html .= '<td class="text-right font-mono font-bold">' . number_format($totCant, 2) . '</td>';
                $html .= '<td class="text-right font-mono font-bold">' . number_format($totPeso, 2) . '</td>';
                $html .= '<td class="text-right font-mono font-bold">' . number_format($totVal, 2) . '</td>';
            }
            $html .= '</tr>';
        }

        $html .= '</tbody></table>';
        return $html;
    }

    private static function fechaCorta(string $fecha): string
    {
        if (empty($fecha)) return '';
        $p = explode('-', $fecha);
        return count($p) === 3 ? "{$p[2]}/{$p[1]}/{$p[0]}" : $fecha;
    }
}
