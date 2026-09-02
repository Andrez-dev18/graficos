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
            ['key' => 'zonafiscal',    'label' => 'ZONAFISCAL',     'type' => 'string'],
            ['key' => 'dia_fechacarga','label' => 'DÍA FECHACARGA', 'type' => 'dia_fechacarga'],
            ['key' => 'decision',      'label' => 'DECISION',       'type' => 'string'],
            ['key' => 'fechacarga',    'label' => 'FECHACARGA',     'type' => 'short_date'],
            ['key' => 'observacion',   'label' => 'OBSERVACION',    'type' => 'string'],
            ['key' => 'vencimiento',   'label' => 'VENCIMIENTO',    'type' => 'string'],
            ['key' => 'saldofinal',    'label' => 'SALDOFINAL',     'type' => 'currency']
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

        foreach ($datos as $row) {
            $monto = (float)($row['saldofinal'] ?? 0);
            $totalSaldofinal += $monto;

            foreach ($columnas as $i => $colDef) {
                $colLetter = PHPExcel_Cell::stringFromColumnIndex($i);
                $key = $colDef['key'];
                $type = $colDef['type'];

                switch ($type) {
                    case 'currency':
                        $sheet->setCellValue($colLetter . $fila, $monto);
                        $sheet->getStyle($colLetter . $fila)->getNumberFormat()->setFormatCode('#,##0.00');
                        break;

                    case 'dia_fechacarga':
                        $fechaBase = $row['fechacarga'] ?? ($params['fechacarga'] ?? '');
                        $sheet->setCellValue($colLetter . $fila, $this->formatearFechaLarga($fechaBase));
                        break;

                    case 'short_date':
                        $fechaBase = $row[$key] ?? ($row['fechacarga'] ?? '');
                        $sheet->setCellValue($colLetter . $fila, $this->formatearFechaCorta($fechaBase));
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
        $colLabelTotal = PHPExcel_Cell::stringFromColumnIndex(max(0, $totalCols - 2));
        $colMontoTotal = $colFinal;

        $sheet->setCellValue($colLabelTotal . $fila, 'TOTAL SALDO FINAL:');
        $sheet->setCellValue($colMontoTotal . $fila, $totalSaldofinal);

        $sheet->getStyle("{$colLabelTotal}{$fila}:{$colMontoTotal}{$fila}")->getFont()->setBold(true);
        $sheet->getStyle("{$colMontoTotal}{$fila}")->getNumberFormat()->setFormatCode('#,##0.00');
        $sheet->getStyle("{$colLabelTotal}{$fila}")->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_RIGHT);
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
        $tipoEtiqueta = ($tipoGrafico === '02SalxCobrarxZona') ? 'Zona' : 'Cliente';
        $cuentaNombre = isset($params['cuentaventa']) ? $params['cuentaventa'] : 'cuenta';
        $zonaNombre   = !empty($params['zonafiscal']) ? '_' . preg_replace('/[^A-Za-z0-9]/', '', $params['zonafiscal']) : '';
        $fechaNombre  = isset($params['fechacarga']) ? $params['fechacarga'] : date('Ymd');
        $filename = "Detalle_Saldos_{$tipoEtiqueta}_{$cuentaNombre}{$zonaNombre}_{$fechaNombre}.xlsx";

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header("Content-Disposition: attachment; filename=\"{$filename}\"");
        header('Cache-Control: max-age=0');

        $objWriter = PHPExcel_IOFactory::createWriter($objPHPExcel, 'Excel2007');
        $objWriter->save('php://output');
        exit;
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
}