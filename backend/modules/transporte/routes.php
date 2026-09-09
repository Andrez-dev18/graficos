<?php
// Rutas para el módulo Transporte (Libro 5)
$this->post('/transporte/dashboard', 'TransportesController@getDashboard');
$this->post('/transporte/detalle-eventos', 'TransportesController@getDetalleEventos');
$this->post('/transportes/dashboard', 'TransportesController@getDashboard');
$this->post('/transportes/detalle-eventos', 'TransportesController@getDetalleEventos');