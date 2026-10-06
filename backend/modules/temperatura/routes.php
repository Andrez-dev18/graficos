<?php

// Rutas para el módulo Temperatura / Datalogger

// 1. Endpoint genérico CRUD (para compatibilidad total con peticiones action=...)
$this->get('/temperatura/crud', 'TemperaturaController@crud');
$this->post('/temperatura/crud', 'TemperaturaController@crud');

// 2. Endpoints específicos
$this->get('/temperatura/upload-limits', 'TemperaturaController@getUploadLimits');
$this->post('/temperatura/upload-limits', 'TemperaturaController@getUploadLimits');

$this->get('/temperatura/granjas', 'TemperaturaController@getGranjas');
$this->post('/temperatura/granjas', 'TemperaturaController@getGranjas');

$this->get('/temperatura/list-groups', 'TemperaturaController@listGroups');
$this->post('/temperatura/list-groups', 'TemperaturaController@listGroups');

$this->get('/temperatura/consulta-meta', 'TemperaturaController@getConsultaMeta');
$this->post('/temperatura/consulta-meta', 'TemperaturaController@getConsultaMeta');

$this->get('/temperatura/consulta-campanias', 'TemperaturaController@getConsultaCampaniasPeriodo');
$this->post('/temperatura/consulta-campanias', 'TemperaturaController@getConsultaCampaniasPeriodo');

$this->get('/temperatura/consulta-datos', 'TemperaturaController@getConsultaDatos');
$this->post('/temperatura/consulta-datos', 'TemperaturaController@getConsultaDatos');

$this->get('/temperatura/list-group-detail', 'TemperaturaController@listGroupDetail');
$this->post('/temperatura/list-group-detail', 'TemperaturaController@listGroupDetail');

$this->get('/temperatura/actualizar-galpon', 'TemperaturaController@actualizarGalpon');
$this->post('/temperatura/actualizar-galpon', 'TemperaturaController@actualizarGalpon');

$this->get('/temperatura/delete-group', 'TemperaturaController@deleteGroup');
$this->post('/temperatura/delete-group', 'TemperaturaController@deleteGroup');
