<?php

// Rutas para el módulo Ventas Resumen (Ventas y Devoluciones)
$this->get('/ventasResumen/filtros', 'ventasResumenController@getFiltros');
$this->post('/ventasResumen/filtros', 'ventasResumenController@getFiltros');

$this->get('/ventasResumen/opciones-linea', 'ventasResumenController@getOpcionesPorLinea');
$this->post('/ventasResumen/opciones-linea', 'ventasResumenController@getOpcionesPorLinea');

// Gráfico 07VentasSacCoor
$this->post('/ventasResumen/ventas-sac-coor', 'ventasResumenController@getGraficoVentasSacCoor');

// Modal Análisis Secundario (Mini Gráficos: Clientes y Devoluciones)
$this->post('/ventasResumen/analisis-secundario', 'ventasResumenController@getAnalisisSecundario');

// Modal Plan vs Real (06 Ventas Saca)
$this->post('/ventasResumen/cumplimiento-plan-real', 'ventasResumenController@getCumplimientoPlanReal');

// Gráfico 08 DevolucionesSaca (Matriz Principal y Modal Detalle)
$this->post('/ventasResumen/devoluciones-zona-motivo', 'ventasResumenController@getDevolucionesPorZonaMotivo');
$this->post('/ventasResumen/detalle-motivo-devolucion', 'ventasResumenController@getDetalleMotivoDevolucion');

// Modal Ver Datos (Resumen y Datos Completos)
$this->post('/ventasResumen/detalle', 'ventasResumenController@getDetalle');
$this->post('/ventasResumen/exportar-detalle-excel', 'ventasResumenController@exportarExcelDetalle');




