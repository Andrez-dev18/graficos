<?php

// Rutas para el módulo productoSusti
$this->get('/productoSusti/filtros', 'ProductoSustiController@getFiltros');
$this->get('/productosusti/filtros', 'ProductoSustiController@getFiltros');

$this->post('/productoSusti/dashboard', 'ProductoSustiController@getDashboard');
$this->post('/productosusti/dashboard', 'ProductoSustiController@getDashboard');
