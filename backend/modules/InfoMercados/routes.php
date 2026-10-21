<?php

// Rutas para el módulo InfoMercados
$this->get('/InfoMercados/volsemanal', 'InfoMercadosController@getVolSemanal');
$this->get('/infomercados/volsemanal', 'InfoMercadosController@getVolSemanal');

$this->get('/InfoMercados/AQPCantEmpresa/filtros', 'InfoMercadosController@getAqpCantEmpresaFiltros');
$this->get('/infomercados/aqpcantempresa/filtros', 'InfoMercadosController@getAqpCantEmpresaFiltros');

$this->post('/InfoMercados/AQPCantEmpresa/dashboard', 'InfoMercadosController@getAqpCantEmpresaDashboard');
$this->post('/infomercados/aqpcantempresa/dashboard', 'InfoMercadosController@getAqpCantEmpresaDashboard');

$this->get('/InfoMercados/AQPEmpresa/filtros', 'InfoMercadosController@getAqpEmpresaFiltros');
$this->get('/infomercados/aqpempresa/filtros', 'InfoMercadosController@getAqpEmpresaFiltros');

$this->post('/InfoMercados/AQPEmpresa/dashboard', 'InfoMercadosController@getAqpEmpresaDashboard');
$this->post('/infomercados/aqpempresa/dashboard', 'InfoMercadosController@getAqpEmpresaDashboard');
