<?php

// Rutas para el módulo Laboratorio / Trazabilidad

// 1. Catálogos y Filtros
$this->get('/trazabilidad/granjas', 'TrazabilidadController@getGranjas');
$this->post('/trazabilidad/granjas', 'TrazabilidadController@getGranjas');

$this->get('/trazabilidad/origen-aves', 'TrazabilidadController@getOrigenAves');
$this->post('/trazabilidad/origen-aves', 'TrazabilidadController@getOrigenAves');

$this->get('/trazabilidad/tipos-muestra', 'TrazabilidadController@getTiposMuestra');
$this->post('/trazabilidad/tipos-muestra', 'TrazabilidadController@getTiposMuestra');

$this->get('/trazabilidad/analisis-filtro', 'TrazabilidadController@getAnalisisFiltro');
$this->post('/trazabilidad/analisis-filtro', 'TrazabilidadController@getAnalisisFiltro');

// 2. Gráficas y Métricas (4 Tabs)
$this->get('/trazabilidad/analisis-detalle', 'TrazabilidadController@getAnalisisDetalle');
$this->post('/trazabilidad/analisis-detalle', 'TrazabilidadController@getAnalisisDetalle');

$this->get('/trazabilidad/analisis-codref', 'TrazabilidadController@getAnalisisCodref');
$this->post('/trazabilidad/analisis-codref', 'TrazabilidadController@getAnalisisCodref');

$this->get('/trazabilidad/analisis-periodo', 'TrazabilidadController@getAnalisisPeriodo');
$this->post('/trazabilidad/analisis-periodo', 'TrazabilidadController@getAnalisisPeriodo');

$this->get('/trazabilidad/analisis-porcentaje', 'TrazabilidadController@getAnalisisPorcentaje');
$this->post('/trazabilidad/analisis-porcentaje', 'TrazabilidadController@getAnalisisPorcentaje');

// 3. Reportes Tabulares Web
$this->get('/trazabilidad/reporte-resultados', 'TrazabilidadController@getReporteResultados');
$this->post('/trazabilidad/reporte-resultados', 'TrazabilidadController@getReporteResultados');

$this->get('/trazabilidad/reporte-enfermedades', 'TrazabilidadController@getReporteEnfermedades');
$this->post('/trazabilidad/reporte-enfermedades', 'TrazabilidadController@getReporteEnfermedades');
