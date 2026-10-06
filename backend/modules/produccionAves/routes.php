<?php

// Rutas del módulo Producción Aves (gráficos de Sanidad)

$this->get('/produccionAves/tipos', 'ProduccionAvesController@getTipos');
$this->post('/produccionAves/tipos', 'ProduccionAvesController@getTipos');

$this->get('/produccionAves/granjas', 'ProduccionAvesController@getGranjas');
$this->post('/produccionAves/granjas', 'ProduccionAvesController@getGranjas');

$this->get('/produccionAves/recursos', 'ProduccionAvesController@getRecursos');
$this->post('/produccionAves/recursos', 'ProduccionAvesController@getRecursos');

$this->get('/produccionAves/graficas', 'ProduccionAvesController@getGraficas');
$this->post('/produccionAves/graficas', 'ProduccionAvesController@getGraficas');
