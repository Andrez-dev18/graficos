<?php

$this->post('/saldosxCobrar/filtros', 'saldosxCobrarController@getFiltros');
$this->post('/saldosxCobrar/grafico', 'saldosxCobrarController@getGraficoSaldos');
$this->post('/saldosxCobrar/detalle', 'saldosxCobrarController@getDetalleSaldos');

?>