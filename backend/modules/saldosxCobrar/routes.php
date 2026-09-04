<?php

$this->post('/saldosxCobrar/filtros-barra', 'saldosxCobrarController@getFiltros');
$this->post('/saldosxCobrar/grafico-barra', 'saldosxCobrarController@getGraficoSaldos');
$this->post('/saldosxCobrar/detalle', 'saldosxCobrarController@getDetalleSaldos');

// Rutas para SalxCobrarxZona (Gráfico de líneas por zona)
$this->post('/saldosxCobrar/filtros-linea', 'saldosxCobrarController@getFiltrosZona');
$this->post('/saldosxCobrar/grafico-linea', 'saldosxCobrarController@getGraficoZona');

$this->post('/saldosxCobrar/exportar-detalle-excel', 'saldosxCobrarController@exportarExcelDetalle');

$this->post('/saldosxCobrar/grafico-anticipos', 'saldosxCobrarController@getGraficoAnticipos');

// Rutas para 20DashAnalisisCtasMaxDeudoresDocs (Saldos por cuenta de venta)
$this->post('/saldosxCobrar/grafico-analisis-cuentas', 'saldosxCobrarController@getGraficoAnalisisCuentas');
$this->post('/saldosxCobrar/analisis-corporativos', 'saldosxCobrarController@getAnalisisCorporativosYDocs');

// Ruta para 18CorporativosZonaDeudores (Corporativos más deudores por zona fiscal)
$this->post('/saldosxCobrar/corporativos-zona-deudores', 'saldosxCobrarController@getCorporativosZonaDeudores');

?>