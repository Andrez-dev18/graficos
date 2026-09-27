<?php

// Rutas para el módulo EEGGyPP (LIMA 1 EE_GGyPP)
$this->get('/EEGGyPP/filtros', 'EEGGyPPController@getFiltros');
$this->get('/eeggypp/filtros', 'EEGGyPPController@getFiltros');

$this->post('/EEGGyPP/dashboard', 'EEGGyPPController@getDashboard');
$this->post('/eeggypp/dashboard', 'EEGGyPPController@getDashboard');
$this->post('/EE_GGyPP/dashboard', 'EEGGyPPController@getDashboard');
$this->post('/ee_ggypp/dashboard', 'EEGGyPPController@getDashboard');
