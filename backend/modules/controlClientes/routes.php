<?php

// Rutas para el módulo Control de Clientes
$this->get('/controlClientes/filtros', 'ControlClientesController@getFiltros');
$this->get('/ControlClientes/filtros', 'ControlClientesController@getFiltros');

$this->post('/controlClientes/dashboard', 'ControlClientesController@getDashboard');
$this->post('/ControlClientes/dashboard', 'ControlClientesController@getDashboard');
