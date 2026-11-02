<?php

class MermaGeneralMensualHandler
{
    private const FECHA_INICIO = '2025-01-01';
    private const MES_INICIO = '2025-01';
    private const PROMEDIO_ANTES_INICIO = '2025-01';
    private const PROMEDIO_ANTES_FIN = '2025-09';
    private const PROMEDIO_ACTUAL_INICIO = '2026-01';
    private const PROMEDIO_ACTUAL_FIN = '2026-08';

    private const MESES_CORTOS = [
        1 => 'ene', 2 => 'feb', 3 => 'mar', 4 => 'abr',
        5 => 'may', 6 => 'jun', 7 => 'jul', 8 => 'ago',
        9 => 'sep', 10 => 'oct', 11 => 'nov', 12 => 'dic'
    ];

    private const MESES_LARGOS = [
        1 => 'enero', 2 => 'febrero', 3 => 'marzo', 4 => 'abril',
        5 => 'mayo', 6 => 'junio', 7 => 'julio', 8 => 'agosto',
        9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre'
    ];

    public static function handle(PDO $db, array $filtros = []): array
    {
        $opciones = self::obtenerOpcionesFiltros($db);
        $fechaMaxMes = $opciones['fecha_max'] ?? null;

        $zonas = self::normalizarLista($filtros['zonas'] ?? null);
        $clientes = self::normalizarLista($filtros['clientes'] ?? null);
        $codigos = self::normalizarLista($filtros['codigos'] ?? null);

        $periodo = self::resolverPeriodo($filtros, $fechaMaxMes);

        $where = ["dato = 'Peso'"];
        $params = [];

        if (!$periodo['invalido']) {
            $where[] = 'fechaproceso BETWEEN :fecha_inicio AND :fecha_fin';
            $params[':fecha_inicio'] = $periodo['inicio_sql'];
            $params[':fecha_fin'] = $periodo['fin_sql'];
        } else {
            $where[] = '1 = 0';
        }

        self::agregarFiltroLista($where, $params, $zonas, 'zonaorigen', 'SIN_ZONA');
        self::agregarFiltroLista($where, $params, $clientes, 'cliente');
        self::agregarFiltroLista($where, $params, $codigos, 'codigo');

        $filas = self::obtenerFilasMensuales($db, $where, $params);
        $fechaCorte = self::obtenerFechaCorte($db, $where, $params);
        $meses = self::completarMeses(
            $filas,
            $fechaCorte,
            $periodo['inicio'],
            $periodo['fin']
        );

        $promedioAntes = self::calcularPromedio(
            $meses,
            self::PROMEDIO_ANTES_INICIO,
            self::PROMEDIO_ANTES_FIN
        );

        $promedioActual = self::calcularPromedio(
            $meses,
            self::PROMEDIO_ACTUAL_INICIO,
            self::PROMEDIO_ACTUAL_FIN
        );

        $filtrosAplicados = self::construirFiltrosAplicados(
            $periodo,
            $zonas,
            $clientes,
            $codigos,
            $opciones
        );

        $ultimoMes = !empty($meses) ? $meses[count($meses) - 1] : null;

        return [
            'status' => 'success',
            'tipo_grafico' => 'MermaGeneralMensual',
            'fuente' => 'dmmermas',
            'opciones_filtros' => $opciones,
            'filtros_aplicados' => $filtrosAplicados,
            'fecha_corte' => $fechaCorte,
            'fecha_corte_dmy' => self::formatearFechaDMY($fechaCorte),
            'total_meses' => count($meses),
            'meses' => $meses,
            'promedio_antes' => $promedioAntes['valor'],
            'promedio_antes_meses' => $promedioAntes['meses'],
            'promedio_antes_periodo' => [
                'inicio' => self::PROMEDIO_ANTES_INICIO,
                'fin' => self::PROMEDIO_ANTES_FIN,
                'label' => 'ene-25 a sep-25'
            ],
            'promedio_actual' => $promedioActual['valor'],
            'promedio_actual_meses' => $promedioActual['meses'],
            'promedio_actual_periodo' => [
                'inicio' => self::PROMEDIO_ACTUAL_INICIO,
                'fin' => self::PROMEDIO_ACTUAL_FIN,
                'label' => 'ene-26 a ago-26'
            ],
            'ultimo_mes' => $ultimoMes ? $ultimoMes['mes'] : null,
            'ultimo_mes_parcial' => $ultimoMes ? (bool)$ultimoMes['parcial'] : false
        ];
    }

    private static function obtenerOpcionesFiltros(PDO $db): array
    {
        $stmtZonas = $db->prepare("
            SELECT DISTINCT COALESCE(NULLIF(TRIM(zonaorigen), ''), 'SIN_ZONA') AS id
            FROM dmmermas
            WHERE dato = 'Peso'
              AND fechaproceso >= :fecha_inicio
        ");
        $stmtZonas->execute([':fecha_inicio' => self::FECHA_INICIO]);
        $zonasIds = $stmtZonas->fetchAll(PDO::FETCH_COLUMN);

        $ordenZonas = ['JOYA' => 0, 'MOLLENDO' => 1, 'SIN_ZONA' => 2];
        usort($zonasIds, function ($a, $b) use ($ordenZonas) {
            return ($ordenZonas[$a] ?? 99) <=> ($ordenZonas[$b] ?? 99);
        });

        $stmtClientes = $db->prepare("
            SELECT DISTINCT TRIM(cliente) AS id
            FROM dmmermas
            WHERE dato = 'Peso'
              AND fechaproceso >= :fecha_inicio
              AND TRIM(cliente) <> ''
            ORDER BY id ASC
        ");
        $stmtClientes->execute([':fecha_inicio' => self::FECHA_INICIO]);
        $clientesIds = $stmtClientes->fetchAll(PDO::FETCH_COLUMN);

        $stmtCodigos = $db->prepare("
            SELECT DISTINCT TRIM(codigo) AS id
            FROM dmmermas
            WHERE dato = 'Peso'
              AND fechaproceso >= :fecha_inicio
              AND TRIM(codigo) <> ''
            ORDER BY id ASC
        ");
        $stmtCodigos->execute([':fecha_inicio' => self::FECHA_INICIO]);
        $codigosIds = $stmtCodigos->fetchAll(PDO::FETCH_COLUMN);

        $stmtFechas = $db->prepare("
            SELECT MIN(fechaproceso) AS min_fecha, MAX(fechaproceso) AS max_fecha
            FROM dmmermas
            WHERE dato = 'Peso'
              AND fechaproceso >= :fecha_inicio
        ");
        $stmtFechas->execute([':fecha_inicio' => self::FECHA_INICIO]);
        $fechas = $stmtFechas->fetch(PDO::FETCH_ASSOC) ?: [];

        $maxFecha = !empty($fechas['max_fecha']) ? (string)$fechas['max_fecha'] : null;
        $maxMes = $maxFecha ? substr($maxFecha, 0, 7) : null;

        return [
            'zonas' => array_map(function ($id) {
                return [
                    'id' => $id,
                    'label' => $id === 'SIN_ZONA' ? 'Sin zona' : $id
                ];
            }, $zonasIds),
            'clientes' => array_map(function ($id) {
                return ['id' => $id, 'label' => $id];
            }, $clientesIds),
            'codigos' => array_map(function ($id) {
                return ['id' => $id, 'label' => $id];
            }, $codigosIds),
            'fecha_min' => self::MES_INICIO,
            'fecha_min_dia' => !empty($fechas['min_fecha']) ? (string)$fechas['min_fecha'] : self::FECHA_INICIO,
            'fecha_max' => $maxMes,
            'fecha_max_dia' => $maxFecha,
            'periodo_default' => 'personalizado'
        ];
    }

    private static function resolverPeriodo(array $filtros, ?string $fechaMaxMes): array
    {
        $baseInicio = self::MES_INICIO;
        $baseFin = $fechaMaxMes ?: self::MES_INICIO;
        $periodo = strtolower(trim((string)($filtros['periodo'] ?? 'todo')));
        $inicio = $baseInicio;
        $fin = $baseFin;

        if ($periodo === '2025') {
            $inicio = '2025-01';
            $fin = '2025-12';
        } elseif ($periodo === '2026') {
            $inicio = '2026-01';
            $fin = $baseFin;
        } elseif ($periodo === 'ultimos_12') {
            $fin = $baseFin;
            $inicio = (new DateTimeImmutable($fin . '-01'))->modify('-11 months')->format('Y-m');
        } elseif ($periodo === 'personalizado') {
            $inicio = self::normalizarMes($filtros['fecha_inicio'] ?? null) ?: $baseInicio;
            $fin = self::normalizarMes($filtros['fecha_fin'] ?? null) ?: $baseFin;
        } else {
            $periodo = 'todo';
        }

        $inicio = max($inicio, $baseInicio);
        $fin = min($fin, $baseFin);

        $invalido = !$fechaMaxMes || $inicio > $fin;

        $inicioSql = null;
        $finSql = null;
        if (!$invalido) {
            $inicioSql = $inicio . '-01';
            $finSql = (new DateTimeImmutable($fin . '-01'))->format('Y-m-t');
        }

        if ($periodo === 'todo') {
            $label = 'Todo el período';
        } elseif ($periodo === '2025' || $periodo === '2026') {
            $label = $periodo;
        } elseif ($periodo === 'ultimos_12') {
            $label = 'Últimos 12 meses';
        } else {
            $label = self::etiquetaMes($inicio) . ' a ' . self::etiquetaMes($fin);
        }

        return [
            'codigo' => $periodo,
            'label' => $label,
            'inicio' => $inicio,
            'fin' => $fin,
            'inicio_sql' => $inicioSql,
            'fin_sql' => $finSql,
            'invalido' => $invalido
        ];
    }

    private static function agregarFiltroLista(
        array &$where,
        array &$params,
        ?array $valores,
        string $columna,
        ?string $valorSinDato = null
    ): void {
        if ($valores === null) {
            return;
        }

        if (count($valores) === 0) {
            $where[] = '1 = 0';
            return;
        }

        $condiciones = [];

        $normales = [];
        foreach ($valores as $valor) {
            if ($valorSinDato !== null && $valor === $valorSinDato) {
                continue;
            }
            $normales[] = $valor;
        }

        if (!empty($normales)) {
            $placeholders = [];
            foreach ($normales as $indice => $valor) {
                $placeholder = ':filtro_' . $columna . '_' . $indice;
                $placeholders[] = $placeholder;
                $params[$placeholder] = $valor;
            }
            $condiciones[] = "TRIM({$columna}) IN (" . implode(', ', $placeholders) . ")";
        }

        if ($valorSinDato !== null && in_array($valorSinDato, $valores, true)) {
            $condiciones[] = "({$columna} IS NULL OR TRIM({$columna}) = '')";
        }

        if (empty($condiciones)) {
            $where[] = '1 = 0';
            return;
        }

        $where[] = '(' . implode(' OR ', $condiciones) . ')';
    }

    private static function obtenerFilasMensuales(PDO $db, array $where, array $params): array
    {
        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT
                DATE_FORMAT(fechaproceso, '%Y-%m') AS mes,
                SUM(COALESCE(mermatotal, 0)) AS merma,
                SUM(COALESCE(entrada, 0)) AS entrada
            FROM dmmermas
            WHERE {$whereSql}
            GROUP BY DATE_FORMAT(fechaproceso, '%Y-%m')
            ORDER BY mes ASC
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    private static function obtenerFechaCorte(PDO $db, array $where, array $params): ?string
    {
        $whereSql = implode(' AND ', $where);

        $sql = "
            SELECT MAX(fechaproceso) AS fecha_corte
            FROM dmmermas
            WHERE {$whereSql}
        ";

        $stmt = $db->prepare($sql);
        $stmt->execute($params);
        $fila = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$fila || empty($fila['fecha_corte'])) {
            return null;
        }

        return (string)$fila['fecha_corte'];
    }

    private static function completarMeses(
        array $filas,
        ?string $fechaCorte,
        string $inicioMes,
        string $finMes
    ): array {
        if (!$fechaCorte) {
            return [];
        }

        $mapa = [];
        foreach ($filas as $fila) {
            if (!empty($fila['mes'])) {
                $mapa[$fila['mes']] = $fila;
            }
        }

        $cursor = (new DateTimeImmutable($inicioMes . '-01'))->modify('first day of this month');
        $limite = (new DateTimeImmutable($finMes . '-01'))->modify('first day of this month');
        $meses = [];

        while ($cursor <= $limite) {
            $mesKey = $cursor->format('Y-m');
            $fila = $mapa[$mesKey] ?? null;
            $mermaRaw = $fila ? (float)$fila['merma'] : null;
            $entradaRaw = $fila ? (float)$fila['entrada'] : null;
            $merma = $mermaRaw !== null ? round($mermaRaw, 2) : null;
            $entrada = $entradaRaw !== null ? round($entradaRaw, 2) : null;
            $pct = ($mermaRaw !== null && $entradaRaw !== null && $entradaRaw > 0)
                ? round(($mermaRaw / $entradaRaw) * 100, 4)
                : null;

            $mesNumero = (int)$cursor->format('n');
            $esUltimo = ($mesKey === $limite->format('Y-m'));
            $ultimoDiaMes = $cursor->format('Y-m-t');

            $meses[] = [
                'mes' => $mesKey,
                'label' => self::MESES_CORTOS[$mesNumero] . '-' . $cursor->format('y'),
                'label_largo' => self::MESES_LARGOS[$mesNumero] . ' ' . $cursor->format('Y'),
                'merma_pct' => $pct,
                'merma' => $merma,
                'entrada' => $entrada,
                'parcial' => $esUltimo && $fechaCorte < $ultimoDiaMes
            ];

            $cursor = $cursor->modify('+1 month');
        }

        return $meses;
    }

    private static function calcularPromedio(array $meses, string $inicio, string $fin): array
    {
        $valores = [];

        foreach ($meses as $mes) {
            if ($mes['mes'] < $inicio || $mes['mes'] > $fin) {
                continue;
            }
            if ($mes['merma_pct'] === null) {
                continue;
            }
            $valores[] = (float)$mes['merma_pct'];
        }

        $cantidad = count($valores);
        $promedio = $cantidad > 0 ? round(array_sum($valores) / $cantidad, 4) : null;

        return [
            'valor' => $promedio,
            'meses' => $cantidad
        ];
    }

    private static function construirFiltrosAplicados(
        array $periodo,
        ?array $zonas,
        ?array $clientes,
        ?array $codigos,
        array $opciones
    ): array {
        $opcionesZonas = $opciones['zonas'] ?? [];
        $opcionesClientes = $opciones['clientes'] ?? [];
        $opcionesCodigos = $opciones['codigos'] ?? [];

        $zonasTexto = self::etiquetaLista($zonas, $opcionesZonas, 'Todas las zonas', 'Ninguna zona', 'zona');
        $clientesTexto = self::etiquetaLista($clientes, $opcionesClientes, 'Todos los clientes', 'Ningún cliente', 'cliente');
        $codigosTexto = self::etiquetaLista($codigos, $opcionesCodigos, 'Todos los códigos', 'Ningún código', 'código');

        $zonasTodas = $zonas === null || (count($opcionesZonas) > 0 && count($zonas) === count($opcionesZonas));
        $clientesTodos = $clientes === null || (count($opcionesClientes) > 0 && count($clientes) === count($opcionesClientes));
        $codigosTodos = $codigos === null || (count($opcionesCodigos) > 0 && count($codigos) === count($opcionesCodigos));

        $partes = [
            $periodo['label'],
            $zonasTodas ? 'Todas las zonas' : 'Zona: ' . $zonasTexto,
            $clientesTodos ? 'Todos los clientes' : 'Cliente: ' . $clientesTexto,
            $codigosTodos ? 'Todos los códigos' : 'Código: ' . $codigosTexto
        ];

        $nota = '';
        if ($zonas !== null && in_array('SIN_ZONA', $zonas, true)) {
            $totalZonas = count($opcionesZonas);
            if ($totalZonas === 0 || count($zonas) < $totalZonas) {
                $nota = 'Incluye registros sin zona con entrada no registrada; interpretar con cautela.';
            }
        }

        return [
            'periodo' => $periodo['codigo'],
            'periodo_label' => $periodo['label'],
            'zonas' => $zonas,
            'zonas_label' => $zonasTexto,
            'clientes' => $clientes,
            'clientes_label' => $clientesTexto,
            'codigos' => $codigos,
            'codigos_label' => $codigosTexto,
            'resumen' => implode(' · ', $partes),
            'nota' => $nota
        ];
    }

    private static function etiquetaLista(
        ?array $seleccion,
        array $opciones,
        string $todas,
        string $ninguna,
        string $singular
    ): string {
        if ($seleccion === null) {
            return $todas;
        }

        $totalOpciones = count($opciones);
        if ($totalOpciones > 0 && count($seleccion) === $totalOpciones) {
            return $todas;
        }

        if (count($seleccion) === 0) {
            return $ninguna;
        }

        $mapa = [];
        foreach ($opciones as $opcion) {
            $mapa[$opcion['id']] = $opcion['label'];
        }

        $labels = [];
        foreach ($seleccion as $id) {
            $labels[] = $mapa[$id] ?? $id;
        }

        if (count($labels) === 1) {
            return $labels[0];
        }

        if (count($labels) === 2) {
            return implode(', ', $labels);
        }

        $plural = $singular === 'código' ? 'códigos' : $singular . 's';
        return count($labels) . ' ' . $plural;
    }

    private static function normalizarLista($valor): ?array
    {
        if ($valor === null) {
            return null;
        }

        if (!is_array($valor)) {
            $valor = [$valor];
        }

        $resultado = [];
        foreach ($valor as $item) {
            $texto = trim((string)$item);
            if ($texto !== '') {
                $resultado[] = $texto;
            }
        }

        return array_values(array_unique($resultado));
    }

    private static function normalizarMes($valor): ?string
    {
        if ($valor === null) {
            return null;
        }

        $texto = trim((string)$valor);
        if (!preg_match('/^(\d{4})-(\d{2})/', $texto, $coincidencias)) {
            return null;
        }

        $anio = (int)$coincidencias[1];
        $mes = (int)$coincidencias[2];

        if ($anio < 2000 || $anio > 2100 || $mes < 1 || $mes > 12) {
            return null;
        }

        return sprintf('%04d-%02d', $anio, $mes);
    }

    private static function etiquetaMes(string $mes): string
    {
        $partes = explode('-', $mes);
        if (count($partes) !== 2) {
            return $mes;
        }

        $anio = $partes[0];
        $mesNumero = (int)$partes[1];
        $nombre = self::MESES_CORTOS[$mesNumero] ?? $partes[1];

        return $nombre . '-' . substr($anio, -2);
    }

    private static function formatearFechaDMY(?string $fecha): ?string
    {
        if (!$fecha) {
            return null;
        }

        try {
            $dt = new DateTimeImmutable($fecha);
            return $dt->format('d/m/Y');
        } catch (Throwable $e) {
            return $fecha;
        }
    }
}
