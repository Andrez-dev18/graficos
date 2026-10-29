<?php
// Rutas para el módulo Costos Tradicional Día (costosDias)
$this->post('/costosDias/dashboard', 'CostosDiasController@getDashboard');
$this->post('/costos-dias/dashboard', 'CostosDiasController@getDashboard');

$this->post('/costosDias/exportar-pdf', 'CostosDiasController@exportarPdf');
$this->post('/costos-dias/exportar-pdf', 'CostosDiasController@exportarPdf');
