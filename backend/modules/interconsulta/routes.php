<?php

// Rutas para el módulo Interconsulta (Gráficas SIP / Dinámicas / Horizontales)

// 1. Catálogos y Filtros
$this->get('/interconsulta/granjas-campanias-galpones', 'InterconsultaController@getGranjasCampaniasGalpones');
$this->post('/interconsulta/granjas-campanias-galpones', 'InterconsultaController@getGranjasCampaniasGalpones');

$this->get('/interconsulta/tipos-grafica', 'InterconsultaController@getTiposGrafica');
$this->post('/interconsulta/tipos-grafica', 'InterconsultaController@getTiposGrafica');

$this->get('/interconsulta/pesaje-dias', 'InterconsultaController@getPesajeDias');
$this->post('/interconsulta/pesaje-dias', 'InterconsultaController@getPesajeDias');

// 2. Gráficos Dinámicos / Verticales (Tab 1)
$this->get('/interconsulta/grafica-data', 'InterconsultaController@getGraficaData');
$this->post('/interconsulta/grafica-data', 'InterconsultaController@getGraficaData');

// 3. Gráficos Horizontales / Semanales (Tab 2)
$this->get('/interconsulta/acumulado-semanal', 'InterconsultaController@getAcumuladoSemanal');
$this->post('/interconsulta/acumulado-semanal', 'InterconsultaController@getAcumuladoSemanal');
