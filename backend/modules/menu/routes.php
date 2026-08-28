<?php

$this->get('/menu/obtener', 'MenuController@obtener');
$this->get('/menu/listar', 'MenuController@listar');
$this->get('/menu/grupos', 'MenuController@listarGrupos');
$this->get('/menu/obtenerPorId', 'MenuController@obtenerModulosId');
$this->post('/menu/guardar', 'MenuController@guardar');
$this->post('/menu/eliminar', 'MenuController@eliminar');

