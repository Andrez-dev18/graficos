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

// 4. Complementos: variación porcentual, proyección y luminometría
$this->get('/interconsulta/grafica-pct', 'InterconsultaController@getGraficaPct');
$this->post('/interconsulta/grafica-pct', 'InterconsultaController@getGraficaPct');

$this->get('/interconsulta/grafica-proyeccion', 'InterconsultaController@getGraficaProyeccion');
$this->post('/interconsulta/grafica-proyeccion', 'InterconsultaController@getGraficaProyeccion');

$this->get('/interconsulta/luminometria-puntos', 'InterconsultaController@getLuminometriaPuntos');
$this->post('/interconsulta/luminometria-puntos', 'InterconsultaController@getLuminometriaPuntos');
