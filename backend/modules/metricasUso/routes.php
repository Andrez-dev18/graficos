<?php

$this->get('/metricasUso/dashboard', 'MetricasUsoController@dashboard');
$this->get('/metricasUso/modulos/datatable', 'MetricasUsoController@modulosDatatable');
$this->get('/metricasUso/usuarios/datatable', 'MetricasUsoController@usuariosDatatable');
$this->get('/metricasUso/inactivos/datatable', 'MetricasUsoController@inactivosDatatable');
