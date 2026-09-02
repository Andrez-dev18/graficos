<?php

class SaldosExportExcel
{
    /**
     * Construye y emite el archivo .xlsx en el flujo de salida
     *
     * @param array $datos  Filas transaccionales devueltas por el repositorio
     * @param array $params Parámetros del modal (cuentaventa, fechacarga, etc.)
     */
    public function generarExcelDetalle(array $datos, array $params = [])
    {
        // Ruta a PHPExcel
        $phpExcelPath = __DIR__ . '/../../libs/Classes/PHPExcel.php';
        if (!file_exists($phpExcelPath)) {
            $phpExcelPath = __DIR__ . '/../../../libs/Classes/PHPExcel.php';
        }
        require_once $phpExcelPath;

        $objPHPExcel = new PHPExcel();
        $objPHPExcel->getProperties()
            ->setCreator("Sistema de Visualización")
            ->setTitle("Detalle Saldos por Cobrar");

        $sheet = $objPHPExcel->getActiveSheet();
        $sheet->setTitle('Detalle Saldos');

        // 1. Encabezados
        $headers = [
            'A1' => 'CUENTAVENTA',
            'B1' => 'DÍA FECHACARGA',
            'C1' => 'FECHACARGA',
            'D1' => 'CODCLIENTE',
            'E1' => 'NOMCLIENTE',
            'F1' => 'CONDICION PAGO',
            'G1' => 'NUMERODOC',
            'H1' => 'SALDOFINAL'
        ];

        foreach ($headers as $col => $texto) {
            $sheet->setCellValue($col, $texto);
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
        $sheet->getStyle('A1:H1')->applyFromArray($styleHeader);
        $sheet->getRowDimension(1)->setRowHeight(26);

        // 2. Filas de datos
        $fila = 2;
        $totalSaldofinal = 0.0;

        foreach ($datos as $row) {
            $monto = (float) $row['saldofinal'];
            $totalSaldofinal += $monto;

            $sheet->setCellValueExplicit('A' . $fila, $row['cuentaventa'], PHPExcel_Cell_DataType::TYPE_STRING);
            $sheet->setCellValue('B' . $fila, $row['fechacarga']);
            $sheet->setCellValue('C' . $fila, $row['fechacarga']);
            $sheet->setCellValueExplicit('D' . $fila, $row['codcliente'], PHPExcel_Cell_DataType::TYPE_STRING);
            $sheet->setCellValue('E' . $fila, $row['nomcliente']);
            $sheet->setCellValue('F' . $fila, $row['condicionpago']);
            $sheet->setCellValueExplicit('G' . $fila, $row['numerodoc'], PHPExcel_Cell_DataType::TYPE_STRING);
            $sheet->setCellValue('H' . $fila, $monto);

            $sheet->getStyle('H' . $fila)->getNumberFormat()->setFormatCode('#,##0.00');

            $fila++;
        }

        // 3. Fila de Totalización
        $sheet->setCellValue('G' . $fila, 'TOTAL SALDO FINAL:');
        $sheet->setCellValue('H' . $fila, $totalSaldofinal);

        $sheet->getStyle('G' . $fila . ':H' . $fila)->getFont()->setBold(true);
        $sheet->getStyle('H' . $fila)->getNumberFormat()->setFormatCode('#,##0.00');
        $sheet->getStyle('G' . $fila)->getAlignment()->setHorizontal(PHPExcel_Style_Alignment::HORIZONTAL_RIGHT);
        $sheet->getStyle('A' . $fila . ':H' . $fila)->getFill()->setFillType(PHPExcel_Style_Fill::FILL_SOLID)->getStartColor()->setRGB('F1F5F9');

        // Bordes
        $styleBorders = [
            'borders' => [
                'allborders' => [
                    'style' => PHPExcel_Style_Border::BORDER_THIN,
                    'color' => ['rgb' => 'CBD5E1']
                ]
            ]
        ];
        $sheet->getStyle('A1:H' . $fila)->applyFromArray($styleBorders);

        // Autoajuste de columnas
        foreach (range('A', 'H') as $col) {
            $sheet->getColumnDimension($col)->setAutoSize(true);
        }

        // 4. Salida en streaming
        $cuentaNombre = isset($params['cuentaventa']) ? $params['cuentaventa'] : 'cuenta';
        $fechaNombre  = isset($params['fechacarga']) ? $params['fechacarga'] : date('Ymd');
        $filename = "Detalle_Saldos_{$cuentaNombre}_{$fechaNombre}.xlsx";

        header('Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        header("Content-Disposition: attachment; filename=\"{$filename}\"");
        header('Cache-Control: max-age=0');

        $objWriter = PHPExcel_IOFactory::createWriter($objPHPExcel, 'Excel2007');
        $objWriter->save('php://output');
        exit;
    }
}