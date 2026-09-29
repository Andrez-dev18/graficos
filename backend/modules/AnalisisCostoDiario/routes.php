<?php

// Rutas para el módulo AnalisisCostoDiario
$this->get('/AnalisisCostoDiario/filtros', 'AnalisisCostoDiarioController@getFiltros');
$this->get('/analisiscostodiario/filtros', 'AnalisisCostoDiarioController@getFiltros');

$this->post('/AnalisisCostoDiario/dashboard', 'AnalisisCostoDiarioController@getDashboard');
$this->post('/analisiscostodiario/dashboard', 'AnalisisCostoDiarioController@getDashboard');
