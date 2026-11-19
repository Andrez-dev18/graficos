<?php

// Rutas para el módulo Control de Jabas
$this->get('/controlJabas/filtros', 'ControlJabasController@getFiltros');
$this->post('/controlJabas/clientes', 'ControlJabasController@getClientes');
$this->post('/controlJabas/stock-provincias', 'ControlJabasController@getStockProvincias');
$this->post('/controlJabas/stock-provincias/detalle', 'ControlJabasController@getStockProvinciasDetalle');
$this->post('/controlJabas/stock-provincias/filtros', 'ControlJabasController@getStockProvinciasFiltros');
$this->post('/controlJabas/dashboard', 'ControlJabasController@getDashboard');

$this->get('/control-jabas/filtros', 'ControlJabasController@getFiltros');
$this->post('/control-jabas/clientes', 'ControlJabasController@getClientes');
$this->post('/control-jabas/stock-provincias', 'ControlJabasController@getStockProvincias');
$this->post('/control-jabas/stock-provincias/detalle', 'ControlJabasController@getStockProvinciasDetalle');
$this->post('/control-jabas/stock-provincias/filtros', 'ControlJabasController@getStockProvinciasFiltros');
$this->post('/control-jabas/dashboard', 'ControlJabasController@getDashboard');
