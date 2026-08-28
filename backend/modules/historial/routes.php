<?php

$this->post('/historial/logs', 'HistorialController@listar');
$this->get('/historial/filtros', 'HistorialController@cargarFiltros');