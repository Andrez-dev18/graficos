<?php

$this->get('/dashboardPrincipal/resumen', 'DashboardPrincipalController@resumen');
$this->post('/dashboardPrincipal/acceso', 'DashboardPrincipalController@registrarAcceso');
$this->get('/dashboardPrincipal/accesos', 'DashboardPrincipalController@obtenerAccesos');
$this->post('/dashboardPrincipal/accesos/guardar', 'DashboardPrincipalController@guardarAccesos');
$this->get('/dashboardPrincipal/accesos-lateral', 'DashboardPrincipalController@accesosLateral');
