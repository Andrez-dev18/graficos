<?php

// Rutas para el módulo Ventas2025
$this->get('/Ventas2025/filtros', 'Ventas2025Controller@getFiltros');
$this->get('/ventas2025/filtros', 'Ventas2025Controller@getFiltros');

$this->post('/Ventas2025/dashboard', 'Ventas2025Controller@getDashboard');
$this->post('/ventas2025/dashboard', 'Ventas2025Controller@getDashboard');
