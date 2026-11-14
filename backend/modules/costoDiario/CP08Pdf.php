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

        $cencosActivo = (string)($seleccion['cencosActivo'] ?? ($datos['cencos_activo'] ?? ''));
        $nomcencosActivo = (string)($seleccion['nomcencosActivo'] ?? ($datos['nomcencos_activo'] ?? ''));
        $galponActivo = $seleccion['galponActivo'] ?? null;
        $lineaSeleccionada = $seleccion['lineaSeleccionada'] ?? null;
        $selectedGranjas = $seleccion['selectedGranjas'] ?? [];
        $selectedClasif = $seleccion['selectedClasif'] ?? [];

        [$lineasSet, $lineaFallback] = self::construirSetLineas($seleccion);
        $galponesSet = self::construirSetGalpones($seleccion, $cencosActivo, $galponActivo);
        $grupos = self::normalizarGrupos($datos, $seleccion, $cencosActivo, $nomcencosActivo, $galponActivo);

        $modoPagina = self::determinarModoPagina($grupos);
        $formato = $modoPagina['formato'];
        $dividirPorCencos = $modoPagina['split'];

        $periodo = $filtros['fecha_formateada'] ?? '';
        if (empty($periodo)) {
            $fIni = $filtros['fecha_inicio'] ?? '';
            $fFin = $filtros['fecha_fin'] ?? '';
            $periodo = self::fechaCorta($fIni) . ' al ' . self::fechaCorta($fFin);
        }

        $fechaGeneracion = (new DateTimeImmutable('now', new DateTimeZone('America/Lima')))->format('d/m/Y H:i');

        $mpdf = new \Mpdf\Mpdf([
            'mode'          => 'utf-8',
            'format'        => $formato,
            'margin_left'   => 8,
            'margin_right'  => 8,
            'margin_top'    => 20,
            'margin_header' => 4,
            'margin_bottom' => 8,
            'margin_footer' => 4,
            'tempDir'       => sys_get_temp_dir(),
            'default_font'  => 'dejavusans',
            'shrink_tables_to_fit' => 1.4
        ]);

        $mpdf->SetTitle('CP08 Comparativo Granja Galpón');
        $mpdf->SetAuthor('Granja Rinconada del Sur S.A.');

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

        $html = self::estilosCss();

        // 1. DATOS PRODUCTIVOS
        $html .= self::construirTabla1(
            $datos['tabla1_datos_productivos'] ?? [],
            $selectedGranjas,
            $galponesSet,
            $cencosActivo
        );

        if ($dividirPorCencos) {
            foreach ($grupos as $grupo) {
                $sufijo = ' - CENCOS ' . ($grupo['cencos'] ?? '');
                $html .= '<pagebreak />';
                $html .= self::construirTabla2([$grupo], $lineasSet, $lineaFallback, $selectedClasif, $sufijo);
                $html .= '<pagebreak />';
                $html .= self::construirTabla3([$grupo], $lineasSet, $lineaFallback, $selectedClasif, $sufijo);
            }
        } else {
            $html .= '<pagebreak />';
            $html .= self::construirTabla2($grupos, $lineasSet, $lineaFallback, $selectedClasif);
            $html .= '<pagebreak />';
            $html .= self::construirTabla3($grupos, $lineasSet, $lineaFallback, $selectedClasif);
        }

        $mpdf->WriteHTML($html);

        $nombre = 'CP08_ComparativoGranjaGalpon_' . date('Ymd_His') . '.pdf';
        $mpdf->Output($nombre, \Mpdf\Output\Destination::INLINE);
        exit;
    }

    private static function construirSetGalpones(array $seleccion, string $cencosActivo, ?string $galponActivo): array
    {
        $set = [];
        $seleccionados = $seleccion['galponesSeleccionados'] ?? [];

        if (is_array($seleccionados)) {
            foreach ($seleccionados as $item) {
                if (!is_array($item)) continue;
                $cencos = (string)($item['cencos'] ?? '');
                $galpon = (string)($item['galpon'] ?? '');
                if ($cencos !== '' && $galpon !== '') {
                    $set[$cencos . '|' . $galpon] = true;
                }
            }
        }

        if (empty($set) && $cencosActivo !== '' && $galponActivo !== null && $galponActivo !== '') {
            $set[$cencosActivo . '|' . (string)$galponActivo] = true;
        }

        return $set;
    }

    private static function construirSetLineas(array $seleccion): array
    {
        $set = [];
        $lineas = $seleccion['lineasSeleccionadas'] ?? [];

        if (is_array($lineas)) {
            foreach ($lineas as $linea) {
                if (is_array($linea)) {
                    $clave = self::claveLinea($linea['linea'] ?? '', $linea['nomlinea'] ?? '');
                } else {
                    $clave = (string)$linea;
                }
                if ($clave !== '') {
                    $set[$clave] = true;
                }
            }
        }

        $fallback = null;
        if (empty($set) && !empty($seleccion['lineaSeleccionada'])) {
            $fallback = (string)$seleccion['lineaSeleccionada'];
        }

        return [$set, $fallback];
    }

    private static function normalizarGrupos(
        array $datos,
        array $seleccion,
        string $cencosActivo,
        string $nomcencosActivo,
        ?string $galponActivo
    ): array {
        $gruposInput = $seleccion['grupos'] ?? [];
        $grupos = [];

        if (is_array($gruposInput)) {
            foreach ($gruposInput as $grupo) {
                if (!is_array($grupo)) continue;

                $cencos = (string)($grupo['cencos'] ?? '');
                if ($cencos === '') continue;

                $tabla2 = is_array($grupo['tabla2'] ?? null) ? $grupo['tabla2'] : [];
                $tabla3 = is_array($grupo['tabla3'] ?? null) ? $grupo['tabla3'] : [];
                $galpones2 = $grupo['galpones2'] ?? ($tabla2['galpones_headers'] ?? []);
                $galpones3 = $grupo['galpones3'] ?? ($tabla3['galpones_headers'] ?? []);

                $grupos[] = [
                    'cencos'    => $cencos,
                    'nomcencos' => (string)($grupo['nomcencos'] ?? ''),
                    'tabla2'    => $tabla2,
                    'tabla3'    => $tabla3,
                    'galpones2' => self::normalizarGalpones($galpones2),
                    'galpones3' => self::normalizarGalpones($galpones3)
                ];
            }
        }

        if (!empty($grupos)) {
            return $grupos;
        }

        // Compatibilidad con el payload anterior (una sola granja activa)
        $tabla2 = $datos['tabla2_comparacion_linea'] ?? [];
        $tabla3 = $datos['tabla3_comparativo_detalle'] ?? [];
        $galpones2 = $tabla2['galpones_headers'] ?? [];
        $galpones3 = $tabla3['galpones_headers'] ?? [];

        if ($galponActivo !== null && $galponActivo !== '') {
            $galpones2 = array_values(array_filter($galpones2, function ($g) use ($galponActivo) {
                return (string)$g === (string)$galponActivo;
            }));
            $galpones3 = array_values(array_filter($galpones3, function ($g) use ($galponActivo) {
                return (string)$g === (string)$galponActivo;
            }));
        }

        return [[
            'cencos'    => $cencosActivo,
            'nomcencos' => $nomcencosActivo,
            'tabla2'    => $tabla2,
            'tabla3'    => $tabla3,
            'galpones2' => self::normalizarGalpones($galpones2),
            'galpones3' => self::normalizarGalpones($galpones3)
        ]];
    }

    private static function normalizarGalpones($galpones): array
    {
        if (!is_array($galpones)) return [];

        return array_values(array_map(function ($g) {
            return (string)$g;
        }, $galpones));
    }

    private static function determinarModoPagina(array $grupos): array
    {
        if (empty($grupos)) {
            return ['formato' => 'A4-L', 'split' => false];
        }

        $total2 = 0;
        $total3 = 0;
        $max2 = 0;
        $max3 = 0;

        foreach ($grupos as $grupo) {
            $n2 = count($grupo['galpones2'] ?? []);
            $n3 = count($grupo['galpones3'] ?? []);
            $total2 += $n2;
            $total3 += $n3;
            $max2 = max($max2, $n2);
            $max3 = max($max3, $n3);
        }

        $columnasCombinadas = max(2 + (4 * $total2), 4 + (3 * $total3));

        if ($columnasCombinadas <= 22) {
            return ['formato' => 'A4-L', 'split' => false];
        }

        if ($columnasCombinadas <= 32) {
            return ['formato' => 'A3-L', 'split' => false];
        }

        $columnasPorGrupo = max(2 + (4 * $max2), 4 + (3 * $max3));

        return [
            'formato' => $columnasPorGrupo <= 22 ? 'A4-L' : 'A3-L',
            'split'   => true
        ];
    }

    private static function claveLinea($linea, $nomlinea): string
    {
        return (string)$linea . '||' . (string)$nomlinea;
    }

    private static function clasificacionCoincide(array $fila, array $selectedClasif): bool
    {
        if (empty($selectedClasif)) return true;

        $linea = trim((string)($fila['linea'] ?? ''));
        $nomlinea = trim((string)($fila['nomlinea'] ?? ''));
        $clasifStr = trim($linea . ' ' . $nomlinea);

        foreach ($selectedClasif as $sel) {
            $sel = trim((string)$sel);
            if ($sel === $linea || $sel === $clasifStr || strpos($clasifStr, $sel) === 0) {
                return true;
            }
        }

        return false;
    }

    private static function filaPasaFiltros(array $fila, array $lineasSet, ?string $lineaFallback, array $selectedClasif): bool
    {
        if (!self::clasificacionCoincide($fila, $selectedClasif)) {
            return false;
        }

        if ($lineaFallback !== null && (string)($fila['linea'] ?? '') !== $lineaFallback) {
            return false;
        }

        if (!empty($lineasSet)) {
            $clave = self::claveLinea($fila['linea'] ?? '', $fila['nomlinea'] ?? '');
            if (!isset($lineasSet[$clave])) {
                return false;
            }
        }

        return true;
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

    private static function construirTabla1(array $t1Data, array $selectedGranjas, array $galponesSet, string $cencosActivo): string
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
                $cencosGranja = (string)$g['cencos'];
                $isGranjaActiva = ($cencosActivo === $cencosGranja);
                $galpones = $g['galpones'] ?? [];

                foreach ($galpones as $idx => $r) {
                    $isFirst = ($idx === 0);
                    $cencosTxt = $isFirst ? htmlspecialchars($r['cencos']) : '';
                    $isSelectedRow = isset($galponesSet[$cencosGranja . '|' . (string)$r['galpon']]);
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

                $sub = $g['subtotal'] ?? [];
                $isSubSelected = (empty($galponesSet) && $isGranjaActiva);
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

    private static function construirTabla2(
        array $grupos,
        array $lineasSet,
        ?string $lineaFallback,
        array $selectedClasif,
        string $sufijoTitulo = ''
    ): string {
        $columnas = [];
        $totalGalpones = 0;

        foreach ($grupos as $grupo) {
            $galpones = $grupo['galpones2'] ?? [];
            if (empty($galpones)) continue;
            $columnas[] = [
                'cencos'   => (string)($grupo['cencos'] ?? ''),
                'galpones' => $galpones
            ];
            $totalGalpones += count($galpones);
        }

        $gruposPorCencos = [];
        foreach ($grupos as $grupo) {
            $gruposPorCencos[(string)($grupo['cencos'] ?? '')] = $grupo;
        }

        $lineasMap = [];
        $lineasOrden = [];

        foreach ($grupos as $grupo) {
            $cencos = (string)($grupo['cencos'] ?? '');
            foreach (($grupo['tabla2']['filas'] ?? []) as $r) {
                if (!self::clasificacionCoincide($r, $selectedClasif)) {
                    continue;
                }

                $clave = self::claveLinea($r['linea'] ?? '', $r['nomlinea'] ?? '');
                if (!isset($lineasMap[$clave])) {
                    $lineasMap[$clave] = [
                        'linea'    => $r['linea'] ?? '',
                        'nomlinea' => $r['nomlinea'] ?? '',
                        'porGrupo' => []
                    ];
                    $lineasOrden[] = $clave;
                }
                $lineasMap[$clave]['porGrupo'][$cencos] = $r;
            }
        }

        $filas = array_map(function ($clave) use ($lineasMap) {
            return $lineasMap[$clave];
        }, $lineasOrden);

        // Totales recalculados sobre las filas mostradas.
        $totales = [];
        foreach ($columnas as $col) {
            foreach ($col['galpones'] as $g) {
                $totales[$col['cencos'] . '|' . $g] = ['valor' => 0.0, 'kilos' => 0.0];
            }
        }
        foreach ($filas as $fila) {
            foreach ($fila['porGrupo'] as $cencos => $r) {
                foreach (($r['galpones'] ?? []) as $g => $gData) {
                    $key = $cencos . '|' . (string)$g;
                    if (isset($totales[$key])) {
                        $totales[$key]['valor'] += (float)($gData['valor'] ?? 0);
                        $totales[$key]['kilos'] += (float)($gData['kilos'] ?? 0);
                    }
                }
            }
        }

        $html = '<div class="section-title">2. COMPARACIÓN LÍNEA' . htmlspecialchars($sufijoTitulo) . '</div>';

        $html .= '<table class="report-table">';
        $html .= '<thead>';

        if (empty($columnas)) {
            $html .= '<tr><th>Sin datos</th></tr></thead><tbody>';
            $html .= '<tr><td class="text-center" style="padding:4mm;color:#94a3b8;">No hay datos de comparación de línea para los filtros seleccionados</td></tr>';
            $html .= '</tbody></table>';
            return $html;
        }

        $html .= '<tr>';
        $html .= '<th style="width:7%;" rowspan="3">Línea</th>';
        $html .= '<th style="width:18%;" rowspan="3">Descripción Línea</th>';
        foreach ($columnas as $col) {
            $html .= '<th class="header-cencos" colspan="' . (count($col['galpones']) * 4) . '">Cencos: ' . htmlspecialchars($col['cencos']) . '</th>';
        }
        $html .= '</tr>';

        $html .= '<tr>';
        foreach ($columnas as $col) {
            foreach ($col['galpones'] as $g) {
                $html .= '<th class="header-galpon" colspan="4">Galpón ' . htmlspecialchars($g) . '</th>';
            }
        }
        $html .= '</tr>';

        $html .= '<tr>';
        foreach ($columnas as $col) {
            foreach ($col['galpones'] as $g) {
                $html .= '<th class="header-subcol">Valor</th>';
                $html .= '<th class="header-subcol">Kilos Prod.</th>';
                $html .= '<th class="header-subcol">CU</th>';
                $html .= '<th class="header-subcol">Dif en CU</th>';
            }
        }
        $html .= '</tr></thead><tbody>';

        if (empty($filas)) {
            $colTotal = 2 + ($totalGalpones * 4);
            $html .= "<tr><td colspan='{$colTotal}' class='text-center' style='padding:4mm;color:#94a3b8;'>No hay datos de comparación de línea para los filtros seleccionados</td></tr>";
        } else {
            foreach ($filas as $r) {
                $claveLinea = self::claveLinea($r['linea'] ?? '', $r['nomlinea'] ?? '');
                $esLineaSeleccionada = isset($lineasSet[$claveLinea])
                    || ($lineaFallback !== null && (string)$r['linea'] === $lineaFallback);

                $html .= '<tr' . ($esLineaSeleccionada ? ' class="row-selected"' : '') . '>';
                $html .= '<td class="text-center font-bold font-mono">' . htmlspecialchars((string)$r['linea']) . '</td>';
                $html .= '<td class="text-left">' . htmlspecialchars((string)$r['nomlinea']) . '</td>';

                foreach ($columnas as $col) {
                    $filaGrupo = $r['porGrupo'][$col['cencos']] ?? null;

                    foreach ($col['galpones'] as $g) {
                        $gData = ($filaGrupo && isset($filaGrupo['galpones'][$g])) ? $filaGrupo['galpones'][$g] : null;

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
                }
                $html .= '</tr>';
            }

            $html .= '<tr class="row-total-gen">';
            $html .= '<td class="text-center font-bold" colspan="2">TOTAL GENERAL</td>';
            foreach ($columnas as $col) {
                $grupo = $gruposPorCencos[$col['cencos']] ?? null;

                foreach ($col['galpones'] as $g) {
                    $totBackend = ($grupo && isset($grupo['tabla2']['totales_galpon'][$g]))
                        ? $grupo['tabla2']['totales_galpon'][$g]
                        : null;

                    if (is_array($totBackend)) {
                        $totVal = (float)($totBackend['valor'] ?? 0);
                        $totKilos = (float)($totBackend['kilos'] ?? 0);
                        $totCu = array_key_exists('cu', $totBackend)
                            ? (float)$totBackend['cu']
                            : ($totKilos > 0 ? ($totVal / $totKilos) : 0.0);
                    } else {
                        $tot = $totales[$col['cencos'] . '|' . $g] ?? ['valor' => 0.0, 'kilos' => 0.0];
                        $totVal = (float)$tot['valor'];
                        $totKilos = (float)$tot['kilos'];
                        $totCu = $totKilos > 0 ? ($totVal / $totKilos) : 0.0;
                    }

                    $html .= '<td class="text-right font-mono font-bold">' . number_format($totVal, 2) . '</td>';
                    $html .= '<td class="text-right font-mono font-bold">' . number_format($totKilos, 2) . '</td>';
                    $html .= '<td class="text-right font-mono font-bold">' . number_format($totCu, 3) . '</td>';
                    $html .= '<td class="text-center font-mono font-bold"></td>';
                }
            }
            $html .= '</tr>';
        }

        $html .= '</tbody></table>';
        return $html;
    }

    private static function construirTabla3(
        array $grupos,
        array $lineasSet,
        ?string $lineaFallback,
        array $selectedClasif,
        string $sufijoTitulo = ''
    ): string {
        $columnas = [];
        $totalGalpones = 0;

        foreach ($grupos as $grupo) {
            $galpones = $grupo['galpones3'] ?? [];
            if (empty($galpones)) continue;
            $columnas[] = [
                'cencos'   => (string)($grupo['cencos'] ?? ''),
                'galpones' => $galpones
            ];
            $totalGalpones += count($galpones);
        }

        $gruposPorCencos = [];
        foreach ($grupos as $grupo) {
            $gruposPorCencos[(string)($grupo['cencos'] ?? '')] = $grupo;
        }

        $itemsMap = [];
        $itemsOrden = [];

        foreach ($grupos as $grupo) {
            $cencos = (string)($grupo['cencos'] ?? '');
            foreach (($grupo['tabla3']['filas'] ?? []) as $r) {
                if (!self::filaPasaFiltros($r, $lineasSet, $lineaFallback, $selectedClasif)) {
                    continue;
                }

                $claveLinea = self::claveLinea($r['linea'] ?? '', $r['nomlinea'] ?? '');
                $claveItem = $claveLinea . '||' . ($r['codigo'] ?? '') . '||' . ($r['nomcodigo'] ?? '') . '||' . ($r['transaccion'] ?? '');

                if (!isset($itemsMap[$claveItem])) {
                    $itemsMap[$claveItem] = [
                        'linea'       => $r['linea'] ?? '',
                        'nomlinea'    => $r['nomlinea'] ?? '',
                        'codigo'      => $r['codigo'] ?? '',
                        'nomcodigo'   => $r['nomcodigo'] ?? '',
                        'transaccion' => $r['transaccion'] ?? '',
                        'porGrupo'    => []
                    ];
                    $itemsOrden[] = $claveItem;
                }
                $itemsMap[$claveItem]['porGrupo'][$cencos] = $r;
            }
        }

        $items = array_map(function ($clave) use ($itemsMap) {
            return $itemsMap[$clave];
        }, $itemsOrden);

        $porLinea = [];
        foreach ($items as $item) {
            $claveLinea = self::claveLinea($item['linea'], $item['nomlinea']);
            $porLinea[$claveLinea][] = $item;
        }

        // Totales generales calculados sobre las filas mostradas.
        $totales = [];
        foreach ($columnas as $col) {
            foreach ($col['galpones'] as $g) {
                $totales[$col['cencos'] . '|' . $g] = ['cantidad' => 0.0, 'peso' => 0.0, 'valor' => 0.0];
            }
        }
        foreach ($items as $item) {
            foreach ($item['porGrupo'] as $cencos => $r) {
                foreach (($r['galpones'] ?? []) as $g => $gData) {
                    $key = $cencos . '|' . (string)$g;
                    if (isset($totales[$key])) {
                        $totales[$key]['cantidad'] += (float)($gData['cantidad'] ?? 0);
                        $totales[$key]['peso'] += (float)($gData['peso'] ?? 0);
                        $totales[$key]['valor'] += (float)($gData['valor'] ?? 0);
                    }
                }
            }
        }

        $html = '<div class="section-title">3. COMPARATIVO DETALLE PRODUCTOS' . htmlspecialchars($sufijoTitulo) . '</div>';
        $html .= '<table class="report-table">';
        $html .= '<thead>';

        if (empty($columnas)) {
            $html .= '<tr><th>Sin datos</th></tr></thead><tbody>';
            $html .= '<tr><td class="text-center" style="padding:4mm;color:#94a3b8;">No hay productos para la granja y filtros seleccionados</td></tr>';
            $html .= '</tbody></table>';
            return $html;
        }

        $html .= '<tr>';
        $html .= '<th style="width:6%;" rowspan="3">Línea</th>';
        $html .= '<th style="width:10%;" rowspan="3">Código</th>';
        $html .= '<th style="width:18%;" rowspan="3">Descripción Producto</th>';
        $html .= '<th style="width:6%;" rowspan="3">Trans.</th>';
        foreach ($columnas as $col) {
            $html .= '<th class="header-cencos" colspan="' . (count($col['galpones']) * 3) . '">Cencos: ' . htmlspecialchars($col['cencos']) . '</th>';
        }
        $html .= '</tr>';

        $html .= '<tr>';
        foreach ($columnas as $col) {
            foreach ($col['galpones'] as $g) {
                $html .= '<th class="header-galpon" colspan="3">Galpón ' . htmlspecialchars($g) . '</th>';
            }
        }
        $html .= '</tr>';

        $html .= '<tr>';
        foreach ($columnas as $col) {
            foreach ($col['galpones'] as $g) {
                $html .= '<th class="header-subcol">Cantidad</th>';
                $html .= '<th class="header-subcol">Peso</th>';
                $html .= '<th class="header-subcol">Valor</th>';
            }
        }
        $html .= '</tr></thead><tbody>';

        if (empty($items)) {
            $colTotal = 4 + ($totalGalpones * 3);
            $html .= "<tr><td colspan='{$colTotal}' class='text-center' style='padding:4mm;color:#94a3b8;'>No hay productos para la granja y filtros seleccionados</td></tr>";
        } else {
            foreach ($porLinea as $claveLinea => $itemsLinea) {
                foreach ($itemsLinea as $idx => $item) {
                    $linDisplay = ($idx === 0) ? htmlspecialchars((string)$item['linea']) : '';

                    $html .= '<tr>';
                    $html .= '<td class="text-center font-bold font-mono">' . $linDisplay . '</td>';
                    $html .= '<td class="text-left font-mono font-bold" style="color:#1e3a8a;">' . htmlspecialchars((string)$item['codigo']) . '</td>';
                    $html .= '<td class="text-left">' . htmlspecialchars((string)$item['nomcodigo']) . '</td>';
                    $html .= '<td class="text-center font-mono font-bold" style="color:#475569;">' . htmlspecialchars((string)$item['transaccion']) . '</td>';

                    foreach ($columnas as $col) {
                        $filaGrupo = $item['porGrupo'][$col['cencos']] ?? null;

                        foreach ($col['galpones'] as $g) {
                            $gData = ($filaGrupo && isset($filaGrupo['galpones'][$g])) ? $filaGrupo['galpones'][$g] : null;

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
                    }
                    $html .= '</tr>';
                }

                // Subtotal de la Línea
                $lineaCodigo = (string)($itemsLinea[0]['linea'] ?? '');
                $html .= '<tr class="row-subtotal">';
                $html .= '<td class="text-center font-bold" colspan="4">TOTAL LÍNEA ' . htmlspecialchars($lineaCodigo) . '</td>';

                foreach ($columnas as $col) {
                    $grupo = null;
                    foreach ($grupos as $gCandidate) {
                        if ((string)($gCandidate['cencos'] ?? '') === $col['cencos']) {
                            $grupo = $gCandidate;
                            break;
                        }
                    }
                    $subL = $grupo['tabla3']['subtotales_linea'][$lineaCodigo] ?? [];

                    foreach ($col['galpones'] as $g) {
                        $subG = $subL[$g] ?? [];
                        $subCant = (float)($subG['cantidad'] ?? 0);
                        $subPeso = (float)($subG['peso'] ?? 0);
                        $subVal = (float)($subG['valor'] ?? 0);

                        $html .= '<td class="text-right font-mono">' . number_format($subCant, 2) . '</td>';
                        $html .= '<td class="text-right font-mono">' . number_format($subPeso, 2) . '</td>';
                        $html .= '<td class="text-right font-mono font-bold">' . number_format($subVal, 2) . '</td>';
                    }
                }
                $html .= '</tr>';
            }

            $html .= '<tr class="row-total-gen">';
            $html .= '<td class="text-center font-bold" colspan="4">TOTAL GENERAL</td>';
            foreach ($columnas as $col) {
                $grupo = $gruposPorCencos[$col['cencos']] ?? null;

                foreach ($col['galpones'] as $g) {
                    $totBackend = ($grupo && isset($grupo['tabla3']['totales_generales'][$g]))
                        ? $grupo['tabla3']['totales_generales'][$g]
                        : null;

                    if (is_array($totBackend)) {
                        $totCant = (float)($totBackend['cantidad'] ?? 0);
                        $totPeso = (float)($totBackend['peso'] ?? 0);
                        $totVal = (float)($totBackend['valor'] ?? 0);
                    } else {
                        $totG = $totales[$col['cencos'] . '|' . $g] ?? ['cantidad' => 0.0, 'peso' => 0.0, 'valor' => 0.0];
                        $totCant = (float)$totG['cantidad'];
                        $totPeso = (float)$totG['peso'];
                        $totVal = (float)$totG['valor'];
                    }

                    $html .= '<td class="text-right font-mono font-bold">' . number_format($totCant, 2) . '</td>';
                    $html .= '<td class="text-right font-mono font-bold">' . number_format($totPeso, 2) . '</td>';
                    $html .= '<td class="text-right font-mono font-bold">' . number_format($totVal, 2) . '</td>';
                }
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
