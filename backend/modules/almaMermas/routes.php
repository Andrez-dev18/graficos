<?php

// Rutas para el módulo Almacén Mermas Vivo
$this->post('/almaMermas/porc-merma-proceso-dia-cliente-placa', 'AlmacenMermasVivoController@getPorcMermaProcesoDiaClientePlaca');
$this->post('/almaMermas/porc-merma-proceso-dia-cliente', 'AlmacenMermasVivoController@getPorcMermaProcesoDiaCliente');
$this->post('/almaMermas/porc-merma-proceso-dia-cliente-zona', 'AlmacenMermasVivoController@getPorcMermaProcesoDiaClienteZona');
$this->post('/almaMermas/porc-merma-diaria-proceso', 'AlmacenMermasVivoController@getPorcMermaDiariaProceso');
$this->post('/almaMermas/porc-merma-diaria-proceso-mes-zona', 'AlmacenMermasVivoController@getPorcMermaDiariaProcesoMesZona');
$this->post('/almaMermas/porc-merma-diaria-proceso-cliente', 'AlmacenMermasVivoController@getPorcMermaDiariaProcesoCiente');
$this->post('/almaMermas/porc-merma-diaria-proceso-cliente-placa', 'AlmacenMermasVivoController@getPorcMermaDiariaProcesoCientePlaca');
$this->get('/almaMermas/filtros-merma', 'AlmacenMermasVivoController@getFiltrosMerma');
$this->post('/almaMermas/merma-proceso-placa-objetivo', 'AlmacenMermasVivoController@getMermaProcesoPlacaObjetivo');
$this->post('/almaMermas/detalle-placa-ruta-causales', 'AlmacenMermasVivoController@getDetallePlacaRutaCausales');
