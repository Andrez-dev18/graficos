<?php

// Rutas para el módulo TiendasMercados
$this->get('/TiendasMercados/filtros', 'TiendasMercadosController@getFiltros');
$this->get('/tiendasmercados/filtros', 'TiendasMercadosController@getFiltros');

$this->post('/TiendasMercados/dashboard', 'TiendasMercadosController@getDashboard');
$this->post('/tiendasmercados/dashboard', 'TiendasMercadosController@getDashboard');
