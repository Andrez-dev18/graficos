<?php

class VentasResumenExportExcel
{
    /**
     * Definición de esquemas de columnas por tipo de gráfico
     */
    private $esquemas = [
        '07VentasSacCoor' => [
            ['key' => 'lineaproceso',       'label' => 'lineaproceso',                                'type' => 'string'],
            ['key' => 'dia_fechaproceso',   'label' => 'Día de fechaproceso',                         'type' => 'dia_fechaproceso'],
            ['key' => 'tipo_doc',           'label' => 'iF [coddoc]="01" OR [codc',                   'type' => 'string'],
            ['key' => 'coditem',            'label' => 'coditem',                                     'type' => 'string'],
            ['key' => 'nomcorporativo',     'label' => 'nomcorporativo',                              'type' => 'string'],
            ['key' => 'nomdevolucion',      'label' => 'nomdevolucion',                               'type' => 'string'],
            ['key' => 'nomdoc',             'label' => 'nomdoc',                                      'type' => 'string'],
            ['key' => 'nomitem',            'label' => 'nomitem',                                     'type' => 'string'],
            ['key' => 'zonafiscal',         'label' => 'zonafiscal',                                  'type' => 'string'],
            ['key' => 'fechaproceso',       'label' => 'fechaproceso',                                'type' => 'short_date'],
            ['key' => 'item',               'label' => 'Item',                                        'type' => 'string'],
            ['key' => 'coddoc',             'label' => 'coddoc',                                      'type' => 'string'],
            ['key' => 'cantidad',           'label' => 'cantidad',                                    'type' => 'currency4'],
            ['key' => 'cantidaddevolucion', 'label' => 'cantidaddevolucion',                          'type' => 'currency4'],
            ['key' => 'cantidadventa',      'label' => 'cantidadventa',                               'type' => 'currency4'],
            ['key' => 'sum_ratio',          'label' => 'SUM([cantidaddevolucion',                     'type' => 'string']
        ],
        '06VentasSaca' => [
            ['key' => 'lineaproceso',       'label' => 'lineaproceso',                                'type' => 'string'],
            ['key' => 'dia_fechaproceso',   'label' => 'Día de fechaproceso',                         'type' => 'dia_fechaproceso'],
            ['key' => 'tipo_doc',           'label' => 'iF [coddoc]="01" OR [codd',                   'type' => 'string'],
            ['key' => 'zonafiscal',         'label' => 'zonafiscal',                                  'type' => 'string'],
            ['key' => 'familia',            'label' => 'familia',                                     'type' => 'string'],
            ['key' => 'fechaproceso',       'label' => 'fechaproceso',                                'type' => 'short_date'],
            ['key' => 'item',               'label' => 'Item',                                        'type' => 'string'],
            ['key' => 'coddoc',             'label' => 'coddoc',                                      'type' => 'string'],
            ['key' => 'coditem',            'label' => 'coditem',                                     'type' => 'string'],
            ['key' => 'nomitem',            'label' => 'nomitem',                                     'type' => 'string'],
            ['key' => 'cantidad',           'label' => 'cantidad',                                    'type' => 'currency4'],
            ['key' => 'cantidaddevolucion', 'label' => 'cantidaddevolucion',                          'type' => 'currency4'],
            ['key' => 'cantidadventa',      'label' => 'cantidadventa',                               'type' => 'currency4'],
            ['key' => 'sum_ratio',          'label' => 'SUM([cantidaddevolucion',                     'type' => 'string']
        ]
    ];

    /**
     * Construye y emite el archivo .xlsx en el flujo de salida de forma dinámica
     *
     * @param array $datos  Filas transaccionales devueltas por el repositorio
     * @param array $params Parámetros del modal (tipo_grafico, fechaproceso, etc.)
     */
    public function generarExcelDetalle(array $datos, array $params = [])
    {
        $phpExcelPath = __DIR__ . '/../../libs/Classes/PHPExcel.php';
        if (!file_exists($phpExcelPath)) {
            $phpExcelPath = __DIR__ . '/../../../libs/Classes/PHPExcel.php';
        }
        require_once $phpExcelPath;

        $tipoGrafico = $params['tipo_grafico'] ?? '07VentasSacCoor';
        $columnas = $this->esquemas[$tipoGrafico] ?? $this->esquemas['07VentasSacCoor'];

        $objPHPExcel = new PHPExcel();
        $objPHPExcel->getProperties()
            ->setCreator("Sistema de Visualización")
            ->setTitle("Detalle Ventas y Devoluciones");

        $sheet = $objPHPExcel->getActiveSheet();
        $sheet->setTitle('Detalle Ventas');

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
        $totalCantidad = 0.0;

        foreach ($datos as $row) {
            $monto = (float)($row['cantidad'] ?? 0);
            $totalCantidad += $monto;

            foreach ($columnas as $i => $colDef) {
                $colLetter = PHPExcel_Cell::stringFromColumnIndex($i);
                $key = $colDef['key'];
                $type = $colDef['type'];

                switch ($type) {
                    case 'currency4':
                        $val = $row[$key] ?? null;
                        $valMonto = ($val !== null && $val !== '') ? (float)$val : 0.0;
                        $sheet->setCellValue($colLetter . $fila, $valMonto);
                        $sheet->getStyle($colLetter . $fila)->getNumberFormat()->setFormatCode('#,##0.0000');
                        break;

                    case 'dia_fechaproceso':
                        $fechaBase = $row['fechaproceso'] ?? ($params['fechaproceso'] ?? '');
                        $sheet->setCellValue($colLetter . $fila, $this->formatearFechaLarga($fechaBase));
                        break;

                    case 'short_date':
                        $fechaBase = $row[$key] ?? ($row['fechaproceso'] ?? '');
                        $sheet->setCellValue($colLetter . $fila, $this->formatearFechaCorta($fechaBase));
                        break;

                    case 'string':
                        $val = $row[$key] ?? '';
                        $sheet->setCellValueExplicit($colLetter . $fila, (string)$val, PHPExcel_Cell_DataType::TYPE_STRING);
                        break;

                    default:
                        $val = $row[$key] ?? '';
                        $sheet->setCellValue($colLetter . $fila, (string)$val);
                        break;
                }
            }

            $fila++;
        }

        // Bordes
        $styleBorders = [
            'borders' => [
                'allborders' => [
                    'style' => PHPExcel_Style_Border::BORDER_THIN,
                    'color' => ['rgb' => 'CBD5E1']
                ]
            ]
        ];
        $sheet->getStyle("{$colInicial}1:{$colFinal}" . ($fila - 1))->applyFromArray($styleBorders);

        // Autoajuste dinámico de todas las columnas
        for ($c = 0; $c < $totalCols; $c++) {
            $colLetter = PHPExcel_Cell::stringFromColumnIndex($c);
            $sheet->getColumnDimension($colLetter)->setAutoSize(true);
        }

        // 3. Salida en streaming
        $lineaNombre = !empty($params['lineaproceso']) ? preg_replace('/[^A-Za-z0-9]/', '', $params['lineaproceso']) : 'Linea';
        $fechaNombre = isset($params['fechaproceso']) ? str_replace('-', '', $params['fechaproceso']) : date('Ymd');
        $filename = "Detalle_Ventas_{$lineaNombre}_{$fechaNombre}.xlsx";

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header("Content-Disposition: attachment; filename=\"{$filename}\"");
        header('Cache-Control: max-age=0');

        $objWriter = PHPExcel_IOFactory::createWriter($objPHPExcel, 'Excel2007');
        $objWriter->save('php://output');
        exit;
    }

    /**
     * Convierte fecha YYYY-MM-DD al formato largo de Tableau (ej. '1 de septiembre de 2026')
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
     * Convierte fecha YYYY-MM-DD a formato corto de Tableau (ej. '1/9/2026')
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
