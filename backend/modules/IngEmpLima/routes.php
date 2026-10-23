<?php

// Rutas para el módulo IngEmpLima
$this->get('/IngEmpLima/filtros', 'IngEmpLimaController@getFiltros');
$this->get('/ingemplima/filtros', 'IngEmpLimaController@getFiltros');

$this->post('/IngEmpLima/dashboard', 'IngEmpLimaController@getDashboard');
$this->post('/ingemplima/dashboard', 'IngEmpLimaController@getDashboard');
