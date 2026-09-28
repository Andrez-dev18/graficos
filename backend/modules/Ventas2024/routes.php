<?php

// Rutas para el módulo Ventas2024
$this->get('/Ventas2024/filtros', 'Ventas2024Controller@getFiltros');
$this->get('/ventas2024/filtros', 'Ventas2024Controller@getFiltros');

$this->post('/Ventas2024/dashboard', 'Ventas2024Controller@getDashboard');
$this->post('/ventas2024/dashboard', 'Ventas2024Controller@getDashboard');
