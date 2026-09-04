<?php

// Rutas para el módulo Ventas Resumen (Ventas y Devoluciones)
$this->get('/ventasResumen/filtros', 'VentasResumenController@getFiltros');
$this->post('/ventasResumen/filtros', 'VentasResumenController@getFiltros');

$this->get('/ventasResumen/opciones-linea', 'VentasResumenController@getOpcionesPorLinea');
$this->post('/ventasResumen/opciones-linea', 'VentasResumenController@getOpcionesPorLinea');

// Gráfico 07VentasSacCoor
$this->post('/ventasResumen/ventas-sac-coor', 'VentasResumenController@getGraficoVentasSacCoor');

// Modal Análisis Secundario (Mini Gráficos: Clientes y Devoluciones)
$this->post('/ventasResumen/analisis-secundario', 'VentasResumenController@getAnalisisSecundario');


