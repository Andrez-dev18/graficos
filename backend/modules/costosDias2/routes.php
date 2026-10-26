<?php
// Rutas para el módulo Costos Tradicional Día 2 (costosDias2 - Galpones Horizontal)
$this->post('/costosDias2/dashboard', 'CostosDias2Controller@getDashboard');
$this->post('/costos-dias2/dashboard', 'CostosDias2Controller@getDashboard');
$this->post('/costosDias2/exportar-pdf', 'CostosDias2Controller@exportarPdf');
$this->post('/costos-dias2/exportar-pdf', 'CostosDias2Controller@exportarPdf');

$this->post('/costosDias2/filtros', 'CostosDias2Controller@getFiltros');
$this->post('/costos-dias2/filtros', 'CostosDias2Controller@getFiltros');
$this->get('/costosDias2/filtros', 'CostosDias2Controller@getFiltros');
$this->get('/costos-dias2/filtros', 'CostosDias2Controller@getFiltros');
