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

$this->get('/InfoMercados/PROVEmpresa/filtros', 'InfoMercadosController@getProvEmpresaFiltros');
$this->get('/infomercados/provempresa/filtros', 'InfoMercadosController@getProvEmpresaFiltros');

$this->post('/InfoMercados/PROVEmpresa/dashboard', 'InfoMercadosController@getProvEmpresaDashboard');
$this->post('/infomercados/provempresa/dashboard', 'InfoMercadosController@getProvEmpresaDashboard');

$this->get('/InfoMercados/ParticipacionMercadoAQP/filtros', 'InfoMercadosController@getParticipacionMercadoAqpFiltros');
$this->get('/infomercados/participacionmercadoaqp/filtros', 'InfoMercadosController@getParticipacionMercadoAqpFiltros');

$this->post('/InfoMercados/ParticipacionMercadoAQP/dashboard', 'InfoMercadosController@getParticipacionMercadoAqpDashboard');
$this->post('/infomercados/participacionmercadoaqp/dashboard', 'InfoMercadosController@getParticipacionMercadoAqpDashboard');

$this->get('/InfoMercados/ParticipacionMercadoPROV/filtros', 'InfoMercadosController@getParticipacionMercadoProvFiltros');
$this->get('/infomercados/participacionmercadoprov/filtros', 'InfoMercadosController@getParticipacionMercadoProvFiltros');

$this->post('/InfoMercados/ParticipacionMercadoPROV/dashboard', 'InfoMercadosController@getParticipacionMercadoProvDashboard');
$this->post('/infomercados/participacionmercadoprov/dashboard', 'InfoMercadosController@getParticipacionMercadoProvDashboard');
