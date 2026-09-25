<?php

// Rutas para el módulo Presupuestos PAB (LIMA 1 PresupuestosPAB)
$this->post('/PresupuestosPAB/dashboard', 'PresupuestosPABController@getDashboard');
$this->post('/presupuestospab/dashboard', 'PresupuestosPABController@getDashboard');
$this->post('/presupuestoPAB/dashboard', 'PresupuestosPABController@getDashboard');
$this->post('/pab/dashboard', 'PresupuestosPABController@getDashboard');

// Endpoints para control y asignación de accesos a presupuestos por usuario
$this->get('/PresupuestosPAB/acceso/datatable', 'PresupuestosAccesoController@datatable');
$this->get('/PresupuestosPAB/acceso/obtenerDatos', 'PresupuestosAccesoController@obtenerDatosParaUsuario');
$this->post('/PresupuestosPAB/acceso/guardar', 'PresupuestosAccesoController@guardar');
$this->get('/PresupuestosPAB/acceso/misPresupuestos', 'PresupuestosAccesoController@misPresupuestos');

