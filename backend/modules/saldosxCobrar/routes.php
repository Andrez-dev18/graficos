<?php

$this->post('/saldosxCobrar/filtros-barra', 'saldosxCobrarController@getFiltros');
$this->post('/saldosxCobrar/grafico-barra', 'saldosxCobrarController@getGraficoSaldos');
$this->post('/saldosxCobrar/detalle', 'saldosxCobrarController@getDetalleSaldos');

// Rutas para SalxCobrarxZona (Gráfico de líneas por zona)
$this->post('/saldosxCobrar/filtros-linea', 'saldosxCobrarController@getFiltrosZona');
$this->post('/saldosxCobrar/grafico-linea', 'saldosxCobrarController@getGraficoZona');

$this->post('/saldosxCobrar/exportar-detalle-excel', 'saldosxCobrarController@exportarExcelDetalle');

$this->post('/saldosxCobrar/grafico-anticipos', 'saldosxCobrarController@getGraficoAnticipos');

?>