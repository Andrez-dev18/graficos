<?php

$this->post('/usuario/login', 'UsuarioController@login');
$this->get('/usuario/validarSesion', 'UsuarioController@validarSesion');
$this->get('/usuario/logout', 'UsuarioController@logout');

$this->get('/usuario/obtener-usuarios', 'UsuarioController@obtenerUsuarios');
$this->get('/usuario/unUsuario', 'UsuarioController@obtenerUsuario');
$this->post('/usuario/guardarUsuario', 'UsuarioController@guardarUsuario');
$this->post('/usuario/cambiarEstado', 'UsuarioController@cambiarEstado');
$this->post('/usuario/resetPassword', 'UsuarioController@resetPassword');

$this->get('/usuario/buscarDniExterno', 'UsuarioController@consultarDni'); 

$this->post('/usuario/updatepass', 'UsuarioController@actualizarPassword'); 

?>