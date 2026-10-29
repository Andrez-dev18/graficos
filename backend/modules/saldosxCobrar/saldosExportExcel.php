<?php

class SaldosExportExcel
{
    /**
     * Definición de esquemas de columnas por tipo de gráfico
     */
    private $esquemas = [
        'saltosXcobrarXbarra' => [
            ['key' => 'cuentaventa',   'label' => 'CUENTAVENTA',    'type' => 'string'],
            ['key' => 'dia_fechacarga','label' => 'DÍA FECHACARGA', 'type' => 'dia_fechacarga'],
            ['key' => 'fechacarga',    'label' => 'FECHACARGA',     'type' => 'short_date'],
            ['key' => 'codcliente',    'label' => 'CODCLIENTE',     'type' => 'string'],
            ['key' => 'nomcliente',    'label' => 'NOMCLIENTE',     'type' => 'string'],
            ['key' => 'condicionpago', 'label' => 'CONDICION PAGO', 'type' => 'string'],
            ['key' => 'numerodoc',     'label' => 'NUMERODOC',      'type' => 'string'],
            ['key' => 'saldofinal',    'label' => 'SALDOFINAL',     'type' => 'currency']
        ],
        '02SalxCobrarxZona' => [
            ['key' => 'cuentaventa',   'label' => 'CUENTAVENTA',    'type' => 'string'],
            ['key' => 'nomcuentaventa','label' => 'NOMCUENTAVENTA', 'type' => 'string'],
            ['key' => 'nomcliente',    'label' => 'NOMCLIENTE',     'type' => 'string'],
            ['key' => 'zonafiscal',    'label' => 'ZONAFISCAL',     'type' => 'string'],
            ['key' => 'dia_fechacarga','label' => 'DÍA FECHACARGA', 'type' => 'dia_fechacarga'],
            ['key' => 'decision',      'label' => 'DECISION',       'type' => 'string'],
            ['key' => 'fechacarga',    'label' => 'FECHACARGA',     'type' => 'short_date'],
            ['key' => 'observacion',   'label' => 'OBSERVACION',    'type' => 'string'],
            ['key' => 'vencimiento',   'label' => 'VENCIMIENTO',    'type' => 'string'],
            ['key' => 'saldofinal',    'label' => 'SALDOFINAL',     'type' => 'currency']
        ],
        '08IndAnticipos' => [
            ['key' => 'nomcuentaventa', 'label' => 'nomcuentaventa', 'type' => 'string'],
            ['key' => 'dia_fechacarga', 'label' => 'Día de fechacarga', 'type' => 'dia_fechacarga'],
            ['key' => 'cuentaventa',    'label' => 'cuentaventa',    'type' => 'string'],
            ['key' => 'nomcliente',     'label' => 'nomcliente',     'type' => 'string'],
            ['key' => 'fechacarga',     'label' => 'fechacarga',     'type' => 'short_date'],
            ['key' => 'resta_saldo',    'label' => 'ROUND((sum([saldoinicial])-sum([saldofinal])),2)', 'type' => 'currency'],
            ['key' => 'ratio_cobranza', 'label' => 'ROUND((sum([saldoinicial])-sum([saldofinal]))/sum([saldoinici...', 'type' => 'ratio5'],
            ['key' => 'saldofinal',     'label' => 'saldofinal',     'type' => 'currency'],
            ['key' => 'saldoinicial',   'label' => 'saldoinicial',   'type' => 'currency']
        ],
        '20DashAnalisisCtasMaxDeudoresDocs' => [
            ['key' => 'cuentaventa',   'label' => 'cuentaventa',    'type' => 'string'],
            ['key' => 'nomcuentaventa','label' => 'nomcuentaventa', 'type' => 'string'],
            ['key' => 'dia_fechacarga','label' => 'Día de fechacarga', 'type' => 'dia_fechacarga'],
            ['key' => 'condicionpago', 'label' => 'condicionpago',  'type' => 'string'],
            ['key' => 'fechacontable', 'label' => 'fechacontable',  'type' => 'short_date'],
            ['key' => 'horacreacion',  'label' => 'horacreacion',   'type' => 'date_time'],
            ['key' => 'numerodoc',     'label' => 'numerodoc',      'type' => 'string'],
            ['key' => 'nomcliente',    'label' => 'nomcliente',     'type' => 'string'],
            ['key' => 'nomcorporativo','label' => 'nomcorporativo', 'type' => 'string'],
            ['key' => 'decision',      'label' => 'decision',       'type' => 'string'],
            ['key' => 'fechacarga',    'label' => 'fechacarga',     'type' => 'short_date'],
            ['key' => 'observacion',   'label' => 'observacion',    'type' => 'string'],
            ['key' => 'vencimiento',   'label' => 'vencimiento',    'type' => 'string'],
            ['key' => 'saldofinal',    'label' => 'saldofinal',     'type' => 'currency']
        ],
        '18CorporativosZonaDeudores' => [
            ['key' => 'nomcorporativo', 'label' => 'nomcorporativo', 'type' => 'string'],
            ['key' => 'nomcliente',    'label' => 'nomcliente',     'type' => 'string'],
            ['key' => 'zonafiscal',    'label' => 'zonafiscal',     'type' => 'string'],
            ['key' => 'cuentaventa',   'label' => 'cuentaventa',    'type' => 'string'],
            ['key' => 'decision',      'label' => 'decision',       'type' => 'string'],
            ['key' => 'fechacarga',    'label' => 'fechacarga',     'type' => 'short_date'],
            ['key' => 'numerodoc',     'label' => 'numerodoc',      'type' => 'string'],
            ['key' => 'vencimiento',   'label' => 'vencimiento',    'type' => 'string'],
            ['key' => 'saldofinal',    'label' => 'saldofinal',     'type' => 'currency']
        ],
        '10IndSalxCobrarxCtaxFechaDocSegmentado' => [
            ['key' => 'codcliente',       'label' => 'codcliente',       'type' => 'string'],
            ['key' => 'codcondpago',      'label' => 'codcondpago',      'type' => 'string'],
            ['key' => 'codcorporativo',   'label' => 'codcorporativo',   'type' => 'string'],
            ['key' => 'coddoc',           'label' => 'coddoc',           'type' => 'string'],
            ['key' => 'codzonaventa',     'label' => 'codzonaventa',     'type' => 'string'],
            ['key' => 'condicionpago',    'label' => 'condicionpago',    'type' => 'string'],
            ['key' => 'cuentaventa',      'label' => 'cuentaventa',      'type' => 'string'],
            ['key' => 'decision',         'label' => 'decision',         'type' => 'string'],
            ['key' => 'fechacarga',       'label' => 'fechacarga',       'type' => 'short_date_padded'],
            ['key' => 'fechacontable',    'label' => 'fechacontable',    'type' => 'short_date_padded'],
            ['key' => 'fechacreacion',    'label' => 'fechacreacion',    'type' => 'short_date_padded'],
            ['key' => 'fechaproceso',     'label' => 'fechaproceso',     'type' => 'short_date_padded'],
            ['key' => 'fechavencimiento', 'label' => 'fechavencimiento', 'type' => 'short_date_padded'],
            ['key' => 'horacreacion',     'label' => 'horacreacion',     'type' => 'date_time_padded'],
            ['key' => 'nomcliente',       'label' => 'nomcliente',       'type' => 'string'],
            ['key' => 'nomcorporativo',   'label' => 'nomcorporativo',   'type' => 'string'],
            ['key' => 'nomcuentaventa',   'label' => 'nomcuentaventa',   'type' => 'string'],
            ['key' => 'nomdoc',           'label' => 'nomdoc',           'type' => 'string'],
            ['key' => 'numdocref',        'label' => 'numdocref',        'type' => 'string'],
            ['key' => 'numeroalfdoc',     'label' => 'numeroalfdoc',     'type' => 'string'],
            ['key' => 'numerodoc',        'label' => 'numerodoc',        'type' => 'string'],
            ['key' => 'observacion',      'label' => 'observacion',      'type' => 'string'],
            ['key' => 'seriealfdoc',      'label' => 'seriealfdoc',      'type' => 'string'],
            ['key' => 'seriealfref',      'label' => 'seriealfref',      'type' => 'string'],
            ['key' => 'subzonaventa',     'label' => 'subzonaventa',     'type' => 'string'],
            ['key' => 'tipdocref',        'label' => 'tipdocref',        'type' => 'string'],
            ['key' => 'vencimiento',      'label' => 'vencimiento',      'type' => 'string'],
            ['key' => 'zonafiscal',       'label' => 'zonafiscal',       'type' => 'string'],
            ['key' => 'zonaventa',        'label' => 'zonaventa',        'type' => 'string'],
            ['key' => 'diasporvencer',    'label' => 'diasporvencer',    'type' => 'currency'],
            ['key' => 'importe',          'label' => 'importe',          'type' => 'currency'],
            ['key' => 'numero_registros', 'label' => 'Número de registros', 'type' => 'integer'],
            ['key' => 'ratio_cobranza',   'label' => 'ROUND(1-(sum([saldofinal])/sum([saldoinicial])),2)', 'type' => 'ratio6'],
            ['key' => 'ratio_cobranza',   'label' => 'ROUND(1-(sum([saldofinal])/sum([saldoinicial])),2)', 'type' => 'ratio6'],
            ['key' => 'saldofinal',       'label' => 'saldofinal',       'type' => 'currency'],
            ['key' => 'saldoinicial',     'label' => 'saldoinicial',     'type' => 'currency']
        ]
    ];

    /**
     * Construye y emite el archivo .xlsx en el flujo de salida de forma dinámica
     *
     * @param array $datos  Filas transaccionales devueltas por el repositorio
     * @param array $params Parámetros del modal (tipo_grafico, cuentaventa, fechacarga, etc.)
     */
    public function generarExcelDetalle(array $datos, array $params = [])
    {
        // Ruta a PHPExcel
        $phpExcelPath = __DIR__ . '/../../libs/Classes/PHPExcel.php';
        if (!file_exists($phpExcelPath)) {
            $phpExcelPath = __DIR__ . '/../../../libs/Classes/PHPExcel.php';
        }
        require_once $phpExcelPath;

        // Detectar tipo de gráfico
        $tipoGrafico = $params['tipo_grafico'] ?? (!empty($params['zonafiscal']) ? '02SalxCobrarxZona' : 'saltosXcobrarXbarra');
        $columnas = $this->esquemas[$tipoGrafico] ?? $this->esquemas['saltosXcobrarXbarra'];

        $objPHPExcel = new PHPExcel();
        $objPHPExcel->getProperties()
            ->setCreator("Sistema de Visualización")
            ->setTitle("Detalle Saldos por Cobrar");

        $sheet = $objPHPExcel->getActiveSheet();
        $sheet->setTitle('Detalle Saldos');

        $totalCols = count($columnas);
        $colInicial = 'A';
        $colFinal = PHPExcel_Cell::stringFromColumnIndex($totalCols - 1);

        // 1. Encabezados dinámicos
        foreach ($columnas as $i => $colDef) {
            $colLetter = PHPExcel_Cell::stringFromColumnIndex($i);
            $sheet->setCellValue($colLetter . '1', $colDef['label']);
        }

        // Estilo del encabezado
        $styleHeader = [
            'font' => [
                'bold'  => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size'  => 10
            ],
            'fill' => [
                'type'  => PHPExcel_Style_Fill::FILL_SOLID,
                'color' => ['rgb' => '2563EB']
            ],
            'alignment' => [
                'horizontal' => PHPExcel_Style_Alignment::HORIZONTAL_CENTER,
                'vertical'   => PHPExcel_Style_Alignment::VERTICAL_CENTER
            ]
        ];
        $sheet->getStyle("{$colInicial}1:{$colFinal}1")->applyFromArray($styleHeader);
        $sheet->getRowDimension(1)->setRowHeight(26);

        // 2. Filas de datos
        $fila = 2;
        $totalSaldofinal = 0.0;
        $totalSaldoinicial = 0.0;

        foreach ($datos as $row) {
            $monto = (float)($row['saldofinal'] ?? 0);
            $totalSaldofinal += $monto;
            $totalSaldoinicial += (float)($row['saldoinicial'] ?? 0);

            foreach ($columnas as $i => $colDef) {
                $colLetter = PHPExcel_Cell::stringFromColumnIndex($i);
                $key = $colDef['key'];
                $type = $colDef['type'];

                switch ($type) {
                    case 'currency':
                        $valMonto = (float)($row[$key] ?? 0);
                        if ($key === 'resta_saldo' && !isset($row['resta_saldo'])) {
                            $valMonto = ((float)($row['saldoinicial'] ?? 0)) - ((float)($row['saldofinal'] ?? 0));
                        }
                        $sheet->setCellValue($colLetter . $fila, $valMonto);
                        $sheet->getStyle($colLetter . $fila)->getNumberFormat()->setFormatCode('#,##0.00');
                        break;

                    case 'ratio5':
                        $valRatio = (float)($row[$key] ?? 0);
                        if (!isset($row[$key])) {
                            $sIni = (float)($row['saldoinicial'] ?? 0);
                            $sFin = (float)($row['saldofinal'] ?? 0);
                            $valRatio = ($sIni != 0.0) ? round(($sIni - $sFin) / $sIni, 5) : 0.0;
                        }
                        $sheet->setCellValue($colLetter . $fila, $valRatio);
                        $sheet->getStyle($colLetter . $fila)->getNumberFormat()->setFormatCode('0.00000');
                        break;

                    case 'ratio6':
                        $valRatio = (float)($row[$key] ?? 0);
                        $sheet->setCellValue($colLetter . $fila, $valRatio);
                        $sheet->getStyle($colLetter . $fila)->getNumberFormat()->setFormatCode('0.000000');
                        break;

                    case 'integer':
                        $valInt = (int)($row[$key] ?? 0);
                        $sheet->setCellValue($colLetter . $fila, $valInt);
                        $sheet->getStyle($colLetter . $fila)->getNumberFormat()->setFormatCode('0');
                        break;

                    case 'dia_fechacarga':
                        $fechaBase = $row['fechacarga'] ?? ($params['fechacarga'] ?? '');
                        $sheet->setCellValue($colLetter . $fila, $this->formatearFechaLarga($fechaBase));
                        break;

                    case 'short_date':
                        $fechaBase = $row[$key] ?? ($row['fechacarga'] ?? '');
                        $sheet->setCellValue($colLetter . $fila, $this->formatearFechaCorta($fechaBase));
                        break;

                    case 'date_time':
                        $valDt = $row[$key] ?? '';
                        if ($valDt && strpos($valDt, ' ') !== false) {
                            $partes = explode(' ', trim($valDt));
                            $fechaFormateada = $this->formatearFechaCorta($partes[0]);
                            $sheet->setCellValueExplicit($colLetter . $fila, $fechaFormateada . ' ' . $partes[1], PHPExcel_Cell_DataType::TYPE_STRING);
                        } else {
                            $sheet->setCellValueExplicit($colLetter . $fila, (string)$valDt, PHPExcel_Cell_DataType::TYPE_STRING);
                        }
                        break;

                    case 'short_date_padded':
                        $fechaBase = $row[$key] ?? '';
                        $sheet->setCellValueExplicit($colLetter . $fila, $this->formatearFechaCortaPadded($fechaBase), PHPExcel_Cell_DataType::TYPE_STRING);
                        break;

                    case 'date_time_padded':
                        $valDt = $row[$key] ?? '';
                        $sheet->setCellValueExplicit($colLetter . $fila, $this->formatearFechaHoraPadded($valDt), PHPExcel_Cell_DataType::TYPE_STRING);
                        break;

                    case 'string':
                        $val = $row[$key] ?? '';
                        $sheet->setCellValueExplicit($colLetter . $fila, (string)$val, PHPExcel_Cell_DataType::TYPE_STRING);
                        break;

                    default:
                        $sheet->setCellValue($colLetter . $fila, $row[$key] ?? '-');
                        break;
                }
            }

            $fila++;
        }

        // 3. Fila de Totalización dinámica
        if ($tipoGrafico === '10IndSalxCobrarxCtaxFechaDocSegmentado') {
            $colLabelTotal = PHPExcel_Cell::stringFromColumnIndex(max(0, $totalCols - 3));
            $colSaldoFinal = PHPExcel_Cell::stringFromColumnIndex($totalCols - 2);
            $colSaldoInicial = PHPExcel_Cell::stringFromColumnIndex($totalCols - 1);

            $sheet->setCellValue($colLabelTotal . $fila, 'TOTALES:');
            $sheet->setCellValue($colSaldoFinal . $fila, $totalSaldofinal);
            $sheet->setCellValue($colSaldoInicial . $fila, $totalSaldoinicial);

            $sheet->getStyle("{$colLabelTotal}{$fila}:{$colSaldoInicial}{$fila}")->getFont()->setBold(true);
            $sheet->getStyle("{$colSaldoFinal}{$fila}")->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle("{$colSaldoInicial}{$fila}")->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle("{$colLabelTotal}{$fila}")->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_RIGHT);
        } else {
            $colLabelTotal = PHPExcel_Cell::stringFromColumnIndex(max(0, $totalCols - 2));
            $colMontoTotal = $colFinal;

            $sheet->setCellValue($colLabelTotal . $fila, 'TOTAL SALDO FINAL:');
            $sheet->setCellValue($colMontoTotal . $fila, $totalSaldofinal);

            $sheet->getStyle("{$colLabelTotal}{$fila}:{$colMontoTotal}{$fila}")->getFont()->setBold(true);
            $sheet->getStyle("{$colMontoTotal}{$fila}")->getNumberFormat()->setFormatCode('#,##0.00');
            $sheet->getStyle("{$colLabelTotal}{$fila}")->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_RIGHT);
        }

        $sheet->getStyle("{$colInicial}{$fila}:{$colFinal}{$fila}")->getFill()->setFillType(PHPExcel_Style_Fill::FILL_SOLID)->getStartColor()->setRGB('F1F5F9');

        // Bordes
        $styleBorders = [
            'borders' => [
                'allborders' => [
                    'style' => PHPExcel_Style_Border::BORDER_THIN,
                    'color' => ['rgb' => 'CBD5E1']
                ]
            ]
        ];
        $sheet->getStyle("{$colInicial}1:{$colFinal}{$fila}")->applyFromArray($styleBorders);

        // Autoajuste dinámico de todas las columnas
        for ($c = 0; $c < $totalCols; $c++) {
            $colLetter = PHPExcel_Cell::stringFromColumnIndex($c);
            $sheet->getColumnDimension($colLetter)->setAutoSize(true);
        }

        // 4. Salida en streaming
        if ($tipoGrafico === '18CorporativosZonaDeudores') {
            $corpNombre = !empty($params['nomcorporativo']) ? preg_replace('/[^A-Za-z0-9]/', '', $params['nomcorporativo']) : 'Corporativo';
            $zonaNombre = !empty($params['zonafiscal']) ? '_' . preg_replace('/[^A-Za-z0-9]/', '', $params['zonafiscal']) : '';
            $fechaNombre = isset($params['fechacarga']) ? str_replace('-', '', $params['fechacarga']) : date('Ymd');
            $filename = "Detalle_Corporativo_{$corpNombre}{$zonaNombre}_{$fechaNombre}.xlsx";
        } elseif ($tipoGrafico === '10IndSalxCobrarxCtaxFechaDocSegmentado') {
            $cuentaNombre = isset($params['cuentaventa']) ? $params['cuentaventa'] : 'cuenta';
            $fechaContable = isset($params['fechacontable']) ? str_replace('-', '', $params['fechacontable']) : date('Ymd');
            $fechaCarga = isset($params['fechacarga']) ? str_replace('-', '', $params['fechacarga']) : date('Ymd');
            $filename = "Detalle_10IndSalxCobrarxCtaxFechaDocSegmentado_{$cuentaNombre}_{$fechaContable}_{$fechaCarga}.xlsx";
        } else {
            $tipoEtiqueta = ($tipoGrafico === '02SalxCobrarxZona') ? 'Zona' : (($tipoGrafico === '08IndAnticipos') ? 'Anticipos' : 'Cliente');
            $cuentaNombre = isset($params['cuentaventa']) ? $params['cuentaventa'] : 'cuenta';
            $zonaNombre   = !empty($params['zonafiscal']) ? '_' . preg_replace('/[^A-Za-z0-9]/', '', $params['zonafiscal']) : '';
            $fechaNombre  = isset($params['fechacarga']) ? str_replace('-', '', $params['fechacarga']) : date('Ymd');
            $filename = "Detalle_Saldos_{$tipoEtiqueta}_{$cuentaNombre}{$zonaNombre}_{$fechaNombre}.xlsx";
        }

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header("Content-Disposition: attachment; filename=\"{$filename}\"");
        header('Cache-Control: max-age=0');

        $objWriter = PHPExcel_IOFactory::createWriter($objPHPExcel, 'Excel2007');
        $objWriter->save('php://output');
        exit;
    }

    public function generarExcelDetallePorZonas(array $datos, array $params = [])
    {
        $phpExcelPath = __DIR__ . '/../../libs/Classes/PHPExcel.php';
        if (!file_exists($phpExcelPath)) {
            $phpExcelPath = __DIR__ . '/../../../libs/Classes/PHPExcel.php';
        }
        require_once $phpExcelPath;

        $columnas = $this->esquemas['18CorporativosZonaDeudores'] ?? [];

        $porZona = [];
        foreach ($datos as $row) {
            $zona = trim((string)($row['zonafiscal'] ?? ''));
            if ($zona === '') {
                $zona = 'SIN ZONA';
            }
            if (!isset($porZona[$zona])) {
                $porZona[$zona] = [];
            }
            $porZona[$zona][] = $row;
        }

        $ordenCorp = (isset($params['corporativos_orden']) && is_array($params['corporativos_orden']))
            ? $params['corporativos_orden']
            : [];

        if (empty($ordenCorp)) {
            $totalesCorp = [];
            foreach ($datos as $row) {
                $corp = trim((string)($row['nomcorporativo'] ?? ''));
                if ($corp === '') {
                    continue;
                }
                $totalesCorp[$corp] = ($totalesCorp[$corp] ?? 0) + (float)($row['saldofinal'] ?? 0);
            }
            $ordenCorp = array_keys($totalesCorp);
            usort($ordenCorp, function ($a, $b) use ($totalesCorp) {
                if ($totalesCorp[$a] == $totalesCorp[$b]) {
                    return strcmp($a, $b);
                }
                return ($totalesCorp[$b] > $totalesCorp[$a]) ? 1 : -1;
            });
        }

        $rankingCorp = [];
        $posicion = 0;
        foreach ($ordenCorp as $corp) {
            $corp = trim((string)$corp);
            if ($corp !== '' && !isset($rankingCorp[$corp])) {
                $rankingCorp[$corp] = $posicion++;
            }
        }

        $faltantes = [];
        foreach ($datos as $row) {
            $corp = trim((string)($row['nomcorporativo'] ?? ''));
            if ($corp !== '' && !isset($rankingCorp[$corp]) && !in_array($corp, $faltantes, true)) {
                $faltantes[] = $corp;
            }
        }
        sort($faltantes);
        foreach ($faltantes as $corp) {
            $rankingCorp[$corp] = $posicion++;
        }

        foreach ($porZona as &$filasZona) {
            usort($filasZona, function ($a, $b) use ($rankingCorp) {
                $corpA = trim((string)($a['nomcorporativo'] ?? ''));
                $corpB = trim((string)($b['nomcorporativo'] ?? ''));
                $rankA = isset($rankingCorp[$corpA]) ? $rankingCorp[$corpA] : PHP_INT_MAX;
                $rankB = isset($rankingCorp[$corpB]) ? $rankingCorp[$corpB] : PHP_INT_MAX;

                if ($rankA !== $rankB) {
                    return ($rankA < $rankB) ? -1 : 1;
                }

                $clienteA = trim((string)($a['nomcliente'] ?? ''));
                $clienteB = trim((string)($b['nomcliente'] ?? ''));
                $cmpCliente = strcmp($clienteA, $clienteB);
                if ($cmpCliente !== 0) {
                    return $cmpCliente;
                }

                return strcmp((string)($a['numerodoc'] ?? ''), (string)($b['numerodoc'] ?? ''));
            });
        }
        unset($filasZona);

        $zonasOrden = [];
        $zonasParam = (isset($params['zonas']) && is_array($params['zonas'])) ? $params['zonas'] : [];
        foreach ($zonasParam as $zona) {
            $zona = trim((string)$zona);
            if ($zona !== '' && isset($porZona[$zona]) && !in_array($zona, $zonasOrden, true)) {
                $zonasOrden[] = $zona;
            }
        }
        foreach (array_keys($porZona) as $zona) {
            if (!in_array($zona, $zonasOrden, true)) {
                $zonasOrden[] = $zona;
            }
        }

        $objPHPExcel = new PHPExcel();
        $objPHPExcel->getProperties()
            ->setCreator("Sistema de Visualización")
            ->setTitle("Detalle 18CorporativosZonaDeudores");

        $objPHPExcel->removeSheetByIndex(0);

        if (empty($zonasOrden)) {
            $sheet = $objPHPExcel->createSheet();
            $sheet->setTitle('Sin datos');
            $this->escribirHoja18($sheet, $columnas, []);
        } else {
            $titulosUsados = [];
            foreach ($zonasOrden as $zona) {
                $sheet = $objPHPExcel->createSheet();
                $sheet->setTitle($this->nombreHojaValido($zona, $titulosUsados));
                $this->escribirHoja18($sheet, $columnas, $porZona[$zona]);
            }
        }

        $objPHPExcel->setActiveSheetIndex(0);

        $fechaNombre = isset($params['fechacarga']) ? str_replace('-', '', $params['fechacarga']) : date('Ymd');
        $filename = "Detalle_18CorporativosZonaDeudores_{$fechaNombre}.xlsx";

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header("Content-Disposition: attachment; filename=\"{$filename}\"");
        header('Cache-Control: max-age=0');

        $objWriter = PHPExcel_IOFactory::createWriter($objPHPExcel, 'Excel2007');
        $objWriter->save('php://output');
        exit;
    }

    private function escribirHoja18($sheet, array $columnas, array $datos)
    {
        $totalCols = count($columnas);
        if ($totalCols === 0) {
            return;
        }

        $colFinal = PHPExcel_Cell::stringFromColumnIndex($totalCols - 1);

        $styleHeader = [
            'font' => [
                'bold'  => true,
                'color' => ['rgb' => 'FFFFFF'],
                'size'  => 10
            ],
            'fill' => [
                'type'  => PHPExcel_Style_Fill::FILL_SOLID,
                'color' => ['rgb' => '2563EB']
            ],
            'alignment' => [
                'horizontal' => PHPExcel_Style_Alignment::HORIZONTAL_CENTER,
                'vertical'   => PHPExcel_Style_Alignment::VERTICAL_CENTER,
                'wrapText'   => true
            ]
        ];

        $styleData = [
            'font' => [
                'name'  => 'Segoe UI',
                'size'  => 9.5,
                'color' => ['rgb' => '1E293B']
            ],
            'borders' => [
                'allborders' => [
                    'style' => PHPExcel_Style_Border::BORDER_THIN,
                    'color' => ['rgb' => 'E2E8F0']
                ]
            ]
        ];

        $styleTotal = [
            'font' => [
                'bold'  => true,
                'color' => ['rgb' => '0F172A']
            ],
            'fill' => [
                'type'  => PHPExcel_Style_Fill::FILL_SOLID,
                'color' => ['rgb' => 'F1F5F9']
            ],
            'borders' => [
                'allborders' => [
                    'style' => PHPExcel_Style_Border::BORDER_THIN,
                    'color' => ['rgb' => 'CBD5E1']
                ]
            ]
        ];

        foreach ($columnas as $i => $colDef) {
            $colLetter = PHPExcel_Cell::stringFromColumnIndex($i);
            $sheet->setCellValue($colLetter . '1', $colDef['label']);
        }
        $sheet->getStyle("A1:{$colFinal}1")->applyFromArray($styleHeader);
        $sheet->getRowDimension(1)->setRowHeight(26);

        $fila = 2;
        $totalSaldofinal = 0.0;

        foreach ($datos as $row) {
            $monto = (float)($row['saldofinal'] ?? 0);
            $totalSaldofinal += $monto;

            foreach ($columnas as $i => $colDef) {
                $colLetter = PHPExcel_Cell::stringFromColumnIndex($i);
                $key = $colDef['key'];
                $type = $colDef['type'];

                if ($type === 'currency') {
                    $sheet->setCellValue($colLetter . $fila, (float)($row[$key] ?? 0));
                    $sheet->getStyle($colLetter . $fila)->getNumberFormat()->setFormatCode('#,##0.00');
                    $sheet->getStyle($colLetter . $fila)->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_RIGHT);
                } elseif ($type === 'short_date') {
                    $sheet->setCellValueExplicit($colLetter . $fila, $this->formatearFechaCorta($row[$key] ?? ''), PHPExcel_Cell_DataType::TYPE_STRING);
                    $sheet->getStyle($colLetter . $fila)->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_LEFT);
                } else {
                    $sheet->setCellValueExplicit($colLetter . $fila, (string)($row[$key] ?? ''), PHPExcel_Cell_DataType::TYPE_STRING);
                    $sheet->getStyle($colLetter . $fila)->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_LEFT);
                }

                $sheet->getStyle($colLetter . $fila)->applyFromArray($styleData);
            }

            $sheet->getRowDimension($fila)->setRowHeight(20);
            $fila++;
        }

        $totalRow = $fila;
        $colLabelTotal = PHPExcel_Cell::stringFromColumnIndex(max(0, $totalCols - 2));
        $colMontoTotal = $colFinal;

        $sheet->setCellValue($colLabelTotal . $totalRow, 'TOTAL SALDO FINAL:');
        $sheet->setCellValue($colMontoTotal . $totalRow, $totalSaldofinal);
        $sheet->getStyle("A{$totalRow}:{$colFinal}{$totalRow}")->applyFromArray($styleTotal);
        $sheet->getStyle($colLabelTotal . $totalRow)->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle($colMontoTotal . $totalRow)->getNumberFormat()->setFormatCode('#,##0.00');
        $sheet->getRowDimension($totalRow)->setRowHeight(22);

        for ($c = 0; $c < $totalCols; $c++) {
            $colLetter = PHPExcel_Cell::stringFromColumnIndex($c);
            $sheet->getColumnDimension($colLetter)->setAutoSize(true);
        }

        $sheet->freezePane('A2');
    }

    private function nombreHojaValido($nombre, array &$usados)
    {
        $titulo = str_replace(['\\', '/', '?', '*', '[', ']', ':'], ' ', (string)$nombre);
        $titulo = trim(preg_replace('/\s+/', ' ', $titulo));
        if ($titulo === '') {
            $titulo = 'ZONA';
        }
        $titulo = function_exists('mb_substr') ? mb_substr($titulo, 0, 31, 'UTF-8') : substr($titulo, 0, 31);

        $base = $titulo;
        $contador = 2;
        while (in_array($titulo, $usados, true)) {
            $sufijo = ' (' . $contador . ')';
            $limite = 31 - strlen($sufijo);
            $prefijo = function_exists('mb_substr') ? mb_substr($base, 0, $limite, 'UTF-8') : substr($base, 0, $limite);
            $titulo = $prefijo . $sufijo;
            $contador++;
        }

        $usados[] = $titulo;
        return $titulo;
    }

    /**
     * Convierte fecha YYYY-MM-DD al formato largo de Tableau (ej. '31 de marzo de 2026')
     */
    private function formatearFechaLarga($fechaStr)
    {
        if (empty($fechaStr)) return '';
        $meses = [
            1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril',
            5 => 'mayo', 6 => 'junio', 7 => 'julio', 8 => 'agosto',
            9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre'
        ];
        $partes = explode('-', $fechaStr);
        if (count($partes) === 3) {
            $mes = (int)$partes[1];
            return (int)$partes[2] . ' de ' . ($meses[$mes] ?? '') . ' de ' . $partes[0];
        }
        return $fechaStr;
    }

    /**
     * Convierte fecha YYYY-MM-DD a formato corto de Tableau (ej. '31/3/2026')
     */
    private function formatearFechaCorta($fechaStr)
    {
        if (empty($fechaStr)) return '';
        $partes = explode('-', $fechaStr);
        if (count($partes) === 3) {
            return (int)$partes[2] . '/' . (int)$partes[1] . '/' . $partes[0];
        }
        return $fechaStr;
    }

    private function formatearFechaCortaPadded($fechaStr)
    {
        if (empty($fechaStr)) return '';
        $partes = explode('-', substr((string)$fechaStr, 0, 10));
        if (count($partes) === 3) {
            return str_pad($partes[2], 2, '0', STR_PAD_LEFT) . '/' . str_pad($partes[1], 2, '0', STR_PAD_LEFT) . '/' . $partes[0];
        }
        return $fechaStr;
    }

    private function formatearFechaHoraPadded($fechaStr)
    {
        if (empty($fechaStr)) return '';
        $partes = explode(' ', trim((string)$fechaStr));
        if (count($partes) === 2) {
            return $this->formatearFechaCortaPadded($partes[0]) . ' ' . $partes[1];
        }
        return $this->formatearFechaCortaPadded($fechaStr);
    }
}