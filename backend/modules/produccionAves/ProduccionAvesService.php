<?php

require_once __DIR__ . '/../../core/SanidadGraficasClient.php';

/**
 * Puente hacia las gráficas de Sanidad.
 */
class ProduccionAvesService
{
    private $client;

    public function __construct()
    {
        $this->client = new SanidadGraficasClient();
    }

    /**
     * @param array<string,mixed> $params
     * @return array<string,mixed>
     */
    public function graficas($recurso, array $params = [])
    {
        return $this->client->recurso($recurso, $params);
    }

    /** @return array<int,string> */
    public function recursos()
    {
        return SanidadGraficasClient::recursosPermitidos();
    }
}
