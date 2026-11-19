<?php

require_once __DIR__ . '/handlers/DashJabasContHandler.php';
require_once __DIR__ . '/handlers/DashJabasProHandler.php';
require_once __DIR__ . '/handlers/KardexClienteContHandler.php';
require_once __DIR__ . '/handlers/KardexClienteProHandler.php';
require_once __DIR__ . '/handlers/StockProvinciasHandler.php';
require_once __DIR__ . '/handlers/GraficoIndicadoresHandler.php';

class ControlJabasService
{
    private const ALMACENES = ['JAB', 'JAG', 'TNB'];
    private const CLIENTE_DEFECTO = 'ALCAHUAMAN CHUMA TEODOCIA';

    private $db;

    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    public function obtenerFiltros(): array
    {
        $sql = "SELECT
                    DATE_FORMAT(MIN(fechacontable), '%Y-%m-%d') AS fecha_min,
                    DATE_FORMAT(MAX(fechacontable), '%Y-%m-%d') AS fecha_max
                FROM ft_stockalmacen
                WHERE fechacontable IS NOT NULL";

        $stmt = $this->db->query($sql);
        $rango = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'fecha_min' => $rango['fecha_min'] ?? null,
            'fecha_max' => $rango['fecha_max'] ?? null,
            'fecha_defecto' => date('Y-m-d'),
            'codalmacenes' => ['JAB', 'JAG', 'TNB'],
            'codalmacenes_defecto' => ['JAB']
        ];
    }

    public function obtenerDashboard(array $filtros): array
    {
        $tipoGrafico = trim((string)($filtros['tipo_grafico'] ?? 'DashJabasCont'));

        switch ($tipoGrafico) {
            case 'DashJabasPro':
                return DashJabasProHandler::handle($this->db, $filtros);
            case 'KardexClientePro':
                return KardexClienteProHandler::handle($this->db, $filtros);
            case 'KardexClienteCont':
                return KardexClienteContHandler::handle($this->db, $filtros);
            case 'GraficoIndicadores':
                return GraficoIndicadoresHandler::handle($this->db, $filtros);
            case 'DashJabasCont':
            default:
                return DashJabasContHandler::handle($this->db, $filtros);
        }
    }

    public function obtenerClientes(array $filtros): array
    {
        $fechaInicio = self::fecha($filtros['fecha_inicio'] ?? null, date('Y-m-01'));
        $fechaFin = self::fecha($filtros['fecha_fin'] ?? null, date('Y-m-d'));

        if ($fechaInicio > $fechaFin) {
            [$fechaInicio, $fechaFin] = [$fechaFin, $fechaInicio];
        }

        $almacenes = self::normalizarAlmacenes($filtros['codalmacenes'] ?? $filtros['codalmacen'] ?? null);
        $tipoGrafico = trim((string)($filtros['tipo_grafico'] ?? 'KardexClienteCont'));
        $campoFecha = $tipoGrafico === 'KardexClientePro' ? 'fechaproceso' : 'fechacontable';

        $where = [
            $campoFecha . ' BETWEEN :fecha_inicio AND :fecha_fin',
            "TRIM(IFNULL(nomcliente, '')) != ''"
        ];
        $params = [
            ':fecha_inicio' => $fechaInicio,
            ':fecha_fin' => $fechaFin
        ];

        $todosLosAlmacenes = empty($almacenes) || count($almacenes) === count(self::ALMACENES);
        if (!$todosLosAlmacenes) {
            $marcadores = [];
            foreach ($almacenes as $indice => $almacen) {
                $marcador = ':almacen_' . $indice;
                $marcadores[] = $marcador;
                $params[$marcador] = $almacen;
            }
            $where[] = 'codalmacen IN (' . implode(', ', $marcadores) . ')';
        }

        $sql = "SELECT DISTINCT TRIM(nomcliente) AS nomcliente
                FROM ft_almacen
                WHERE " . implode(' AND ', $where) . "
                ORDER BY nomcliente ASC";

        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $clientes = $stmt->fetchAll(PDO::FETCH_COLUMN);

        $clienteDefecto = in_array(self::CLIENTE_DEFECTO, $clientes, true)
            ? self::CLIENTE_DEFECTO
            : ($clientes[0] ?? '');

        return [
            'clientes' => array_values($clientes),
            'cliente_defecto' => $clienteDefecto,
            'fecha_inicio' => $fechaInicio,
            'fecha_fin' => $fechaFin,
            'codalmacenes' => $todosLosAlmacenes ? array_values(self::ALMACENES) : $almacenes
        ];
    }

    public function obtenerStockProvincias(array $filtros): array
    {
        return StockProvinciasHandler::resumen($this->db, $filtros);
    }

    public function obtenerStockProvinciasDetalle(array $filtros): array
    {
        return StockProvinciasHandler::detalle($this->db, $filtros);
    }

    public function obtenerStockProvinciasFiltros(array $filtros): array
    {
        return StockProvinciasHandler::filtros($this->db, $filtros);
    }

    private static function normalizarAlmacenes($valor): array
    {
        if ($valor === null) {
            return ['JAB'];
        }

        $valores = is_array($valor) ? $valor : explode(',', (string)$valor);
        $limpios = [];

        foreach ($valores as $almacen) {
            $almacen = strtoupper(trim((string)$almacen));
            if (in_array($almacen, self::ALMACENES, true)) {
                $limpios[] = $almacen;
            }
        }

        return array_values(array_unique($limpios));
    }

    private static function fecha($valor, string $defecto): string
    {
        $valor = trim((string)$valor);
        if ($valor === '') {
            return $defecto;
        }

        $fecha = DateTimeImmutable::createFromFormat('Y-m-d', $valor);
        return $fecha && $fecha->format('Y-m-d') === $valor ? $valor : $defecto;
    }
}
