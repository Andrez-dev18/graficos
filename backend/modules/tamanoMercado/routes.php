<?php

// Rutas para el módulo Tamaño de Mercado
$this->get('/tamanoMercado/filtros', 'TamanoMercadoController@getFiltros');
$this->get('/tamanomercado/filtros', 'TamanoMercadoController@getFiltros');

$this->post('/tamanoMercado/dashboard', 'TamanoMercadoController@getDashboard');
$this->post('/tamanomercado/dashboard', 'TamanoMercadoController@getDashboard');
