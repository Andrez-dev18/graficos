<?php

// Rutas para el módulo AsoGallina
$this->get('/AsoGallina/filtros', 'AsoGallinaController@getFiltros');
$this->get('/asogallina/filtros', 'AsoGallinaController@getFiltros');

$this->post('/AsoGallina/dashboard', 'AsoGallinaController@getDashboard');
$this->post('/asogallina/dashboard', 'AsoGallinaController@getDashboard');
