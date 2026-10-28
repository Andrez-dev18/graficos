<?php

$this->post('/tomasDescisiones/filtros-proyectado-ventas', 'TomasDescisionesController@getFiltrosProyectadoVentas');
$this->post('/tomasDescisiones/proyectado-ventas-indicador', 'TomasDescisionesController@getProyectadoVentasIndicador');
$this->post('/tomasDescisiones/tasas-interes', 'TomasDescisionesController@getTasasInteres');
$this->post('/tomasDescisiones/graficas-proyectados-vs-real', 'TomasDescisionesController@getGraficasProyectadosVSReal');
$this->post('/tomasDescisiones/graficas-proyectados-dias', 'TomasDescisionesController@getGraficasProyectadosDias');
