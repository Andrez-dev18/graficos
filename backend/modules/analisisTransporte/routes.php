<?php
// Rutas para Análisis de Transportes
$this->post('/analisisTransporte/liquidacion-placas', 'AnalisisTransporteController@getLiquidacionPlacas');
$this->post('/analisis-transporte/liquidacion-placas', 'AnalisisTransporteController@getLiquidacionPlacas');
$this->get('/analisisTransporte/correlacion-filtros', 'AnalisisTransporteController@getCorrelacionFiltros');
$this->post('/analisisTransporte/correlacion-general', 'AnalisisTransporteController@getCorrelacionGral');
$this->post('/analisisTransporte/correlacion-tabla', 'AnalisisTransporteController@getCorrelacionTabla');
$this->post('/analisisTransporte/correlacion-seleccion', 'AnalisisTransporteController@getCorrelacionSeleccion');
