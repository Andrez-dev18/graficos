<?php
// endpoints para roles
$this->get('/roles/listar', 'RolController@listar');
$this->get('/roles/modulos', 'RolController@obtenerModulos');
$this->get('/roles/obtener', 'RolController@obtener');

$this->post('/roles/guardar', 'RolController@guardar');
$this->post('/roles/eliminar', 'RolController@eliminar');
$this->post('/roles/estado', 'RolController@cambiarEstado');


// endpoints para asignacion de roles
$this->get('/roles/asignacionRoles/datatable', 'AsignacionController@datatable');
$this->get('/roles/asignacionRoles/obtenerDatosParaRoles', 'AsignacionController@obtenerDatosParaRoles');
$this->post('/roles/asignacionRoles/guardar', 'AsignacionController@guardar');