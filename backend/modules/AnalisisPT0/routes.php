<?php

// Rutas para el módulo AnalisisPT0 (Planta Beneficio)
$this->get('/AnalisisPT0/filtros', 'AnalisisPT0Controller@getFiltros');
$this->get('/analisispt0/filtros', 'AnalisisPT0Controller@getFiltros');

$this->post('/AnalisisPT0/dashboard', 'AnalisisPT0Controller@getDashboard');
$this->post('/analisispt0/dashboard', 'AnalisisPT0Controller@getDashboard');
