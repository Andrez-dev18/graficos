<?php

// Rutas para el módulo CriadorEmpre
$this->get('/CriadorEmpre/filtros', 'CriadorEmpreController@getFiltros');
$this->get('/criadorempre/filtros', 'CriadorEmpreController@getFiltros');

$this->post('/CriadorEmpre/dashboard', 'CriadorEmpreController@getDashboard');
$this->post('/criadorempre/dashboard', 'CriadorEmpreController@getDashboard');
