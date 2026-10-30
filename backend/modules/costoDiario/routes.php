<?php

// Rutas para el módulo Análisis Costos Diario
$this->post('/costoDiario/dashboard', 'CostoDiarioController@getDashboard');
$this->post('/costo-diario/dashboard', 'CostoDiarioController@getDashboard');
$this->post('/costoDiario/guardar-factor-alimento', 'CostoDiarioController@guardarFactorAlimento');
$this->post('/costo-diario/guardar-factor-alimento', 'CostoDiarioController@guardarFactorAlimento');
$this->post('/costoDiario/exportar-pdf-cp08', 'CostoDiarioController@exportarPdfCP08');
$this->post('/costo-diario/exportar-pdf-cp08', 'CostoDiarioController@exportarPdfCP08');
