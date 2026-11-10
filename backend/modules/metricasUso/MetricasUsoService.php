<?php
require_once __DIR__ . '/MetricasUsoRepository.php';

class MetricasUsoService
{
    private $repo;
    private $urlModulo = 'modules/metricasUso/metricasUso.html';

    public function __construct($db)
    {
        $this->repo = new MetricasUsoRepository($db);
    }

    public function tienePermiso($codUsuario, $epre, $idPrograma)
    {
        return $this->repo->tienePermisoModulo($codUsuario, $epre, $idPrograma, $this->urlModulo);
    }

    public function obtenerDashboard($codUsuario, $epre, $idPrograma, $desde, $hasta)
    {
        list($desde, $hasta) = $this->validarPeriodo($desde, $hasta);

        $desdeSql = $desde . ' 00:00:00';
        $hastaSql = $hasta . ' 23:59:59';

        $accesosDia = $this->repo->obtenerAccesosPorDia($idPrograma, $desdeSql, $hastaSql);
        $accesosUsuarios = $this->repo->obtenerAccesosPorUsuario($idPrograma, $desdeSql, $hastaSql);
        $accesosModulos = $this->repo->obtenerAccesosPorModulo($idPrograma, $desdeSql, $hastaSql);
        $ingresosDia = $this->repo->obtenerIngresosPorDia($idPrograma, $desdeSql, $hastaSql);
        $ingresosUsuarios = $this->repo->obtenerIngresosPorUsuario($idPrograma, $desdeSql, $hastaSql);
        $usuariosConAcceso = $this->repo->obtenerUsuariosConAcceso($idPrograma);

        $mapaAccesosUsuarios = [];
        foreach ($accesosUsuarios as $fila) {
            $mapaAccesosUsuarios[$fila['cod_usuario']] = $fila;
        }

        $mapaIngresosUsuarios = [];
        foreach ($ingresosUsuarios as $fila) {
            $mapaIngresosUsuarios[$fila['cod_usuario']] = $fila;
        }

        $mapaUsuarios = [];

        foreach ($usuariosConAcceso as $usuario) {
            $codigo = $usuario['codigo'];
            $acceso = $mapaAccesosUsuarios[$codigo] ?? null;
            $ingreso = $mapaIngresosUsuarios[$codigo] ?? null;

            $mapaUsuarios[$codigo] = [
                'cod_usuario' => $codigo,
                'nombre' => $usuario['nombre'],
                'roles' => $usuario['roles'],
                'consultas' => $acceso ? (int) $acceso['consultas'] : 0,
                'modulos' => $acceso ? (int) $acceso['modulos'] : 0,
                'ingresos' => $ingreso ? (int) $ingreso['ingresos'] : 0,
                'ultimo_acceso' => $acceso['ultimo_acceso'] ?? null,
                'ultimo_ingreso' => $ingreso['ultimo_ingreso'] ?? null
            ];
        }

        foreach ($mapaAccesosUsuarios as $codigo => $acceso) {
            if (isset($mapaUsuarios[$codigo])) {
                continue;
            }

            $ingreso = $mapaIngresosUsuarios[$codigo] ?? null;

            $mapaUsuarios[$codigo] = [
                'cod_usuario' => $codigo,
                'nombre' => !empty($acceso['nombre']) ? $acceso['nombre'] : $codigo,
                'roles' => 'Sin rol actual',
                'consultas' => (int) $acceso['consultas'],
                'modulos' => (int) $acceso['modulos'],
                'ingresos' => $ingreso ? (int) $ingreso['ingresos'] : 0,
                'ultimo_acceso' => $acceso['ultimo_acceso'] ?? null,
                'ultimo_ingreso' => $ingreso['ultimo_ingreso'] ?? null
            ];
        }

        foreach ($mapaIngresosUsuarios as $codigo => $ingreso) {
            if (isset($mapaUsuarios[$codigo])) {
                continue;
            }

            $mapaUsuarios[$codigo] = [
                'cod_usuario' => $codigo,
                'nombre' => !empty($ingreso['nombre']) ? $ingreso['nombre'] : $codigo,
                'roles' => 'Sin rol actual',
                'consultas' => 0,
                'modulos' => 0,
                'ingresos' => (int) $ingreso['ingresos'],
                'ultimo_acceso' => null,
                'ultimo_ingreso' => $ingreso['ultimo_ingreso'] ?? null
            ];
        }

        $serieDiaria = $this->construirSerieDiaria($desde, $hasta, $accesosDia, $ingresosDia);

        $totalConsultas = 0;
        foreach ($accesosDia as $fila) {
            $totalConsultas += (int) $fila['total'];
        }

        $totalIngresos = 0;
        foreach ($ingresosDia as $fila) {
            $totalIngresos += (int) $fila['total'];
        }

        $usuariosActivos = count($mapaAccesosUsuarios);
        $usuariosIngresaron = count($mapaIngresosUsuarios);
        $usuariosConAccesoTotal = count($usuariosConAcceso);
        $promedioConsultas = $usuariosActivos > 0 ? round($totalConsultas / $usuariosActivos, 2) : 0;

        $modulos = [];
        foreach ($accesosModulos as $fila) {
            $modulos[] = [
                'cod_mod' => $fila['cod_mod'],
                'nom_mod' => trim(!empty($fila['nom_mod']) ? $fila['nom_mod'] : $fila['cod_mod']),
                'categoria' => trim(!empty($fila['categoria']) ? $fila['categoria'] : 'Sin categoría'),
                'consultas' => (int) $fila['consultas'],
                'usuarios' => (int) $fila['usuarios'],
                'ultimo_acceso' => $fila['ultimo_acceso']
            ];
        }

        $moduloTop = count($modulos) > 0 ? $modulos[0] : null;
        $topModulos = array_slice($modulos, 0, 10);

        $usuariosLista = array_values($mapaUsuarios);
        $usuariosLista = array_values(array_filter($usuariosLista, function ($usuario) {
            return $usuario['consultas'] > 0 || $usuario['ingresos'] > 0;
        }));

        usort($usuariosLista, function ($a, $b) {
            if ($a['consultas'] === $b['consultas']) {
                if ($a['ingresos'] === $b['ingresos']) {
                    return strcmp($a['nombre'], $b['nombre']);
                }

                return $b['ingresos'] <=> $a['ingresos'];
            }

            return $b['consultas'] <=> $a['consultas'];
        });

        $topUsuarios = array_slice($usuariosLista, 0, 10);

        $rolesDistribucion = [];
        foreach ($usuariosConAcceso as $usuario) {
            $codigo = $usuario['codigo'];
            $consultas = isset($mapaAccesosUsuarios[$codigo]) ? (int) $mapaAccesosUsuarios[$codigo]['consultas'] : 0;
            $ingresos = isset($mapaIngresosUsuarios[$codigo]) ? (int) $mapaIngresosUsuarios[$codigo]['ingresos'] : 0;

            if ($consultas === 0 && $ingresos === 0) {
                continue;
            }

            $roles = array_filter(array_map('trim', explode(',', $usuario['roles'])));

            foreach ($roles as $rol) {
                if (!isset($rolesDistribucion[$rol])) {
                    $rolesDistribucion[$rol] = 0;
                }

                $rolesDistribucion[$rol]++;
            }
        }

        arsort($rolesDistribucion);

        $roles = [];
        foreach ($rolesDistribucion as $rol => $total) {
            $roles[] = [
                'rol' => $rol,
                'usuarios' => $total
            ];
        }

        $usuariosSinActividad = [];
        foreach ($usuariosConAcceso as $usuario) {
            $codigo = $usuario['codigo'];
            $consultas = isset($mapaAccesosUsuarios[$codigo]) ? (int) $mapaAccesosUsuarios[$codigo]['consultas'] : 0;
            $ingresos = isset($mapaIngresosUsuarios[$codigo]) ? (int) $mapaIngresosUsuarios[$codigo]['ingresos'] : 0;

            if ($consultas === 0 && $ingresos === 0) {
                $usuariosSinActividad[] = [
                    'cod_usuario' => $codigo,
                    'nombre' => $usuario['nombre'],
                    'roles' => $usuario['roles']
                ];
            }
        }

        $totalUsuariosSinActividad = count($usuariosSinActividad);

        return [
            'periodo' => [
                'desde' => $desde,
                'hasta' => $hasta
            ],
            'kpis' => [
                'usuariosActivos' => $usuariosActivos,
                'usuariosConAcceso' => $usuariosConAccesoTotal,
                'usuariosIngresaron' => $usuariosIngresaron,
                'usuariosConActividad' => count($usuariosLista),
                'totalConsultas' => $totalConsultas,
                'totalIngresos' => $totalIngresos,
                'promedioConsultas' => $promedioConsultas,
                'modulosConActividad' => count($modulos),
                'moduloTop' => $moduloTop
            ],
            'serieDiaria' => $serieDiaria,
            'topModulos' => $topModulos,
            'topUsuarios' => $topUsuarios,
            'roles' => $roles,
            'usuariosSinActividad' => array_slice($usuariosSinActividad, 0, 100),
            'totalUsuariosSinActividad' => $totalUsuariosSinActividad
        ];
    }

    public function obtenerModulosDatatable($codUsuario, $epre, $idPrograma, $params)
    {
        list($desde, $hasta) = $this->validarPeriodo($params['desde'] ?? '', $params['hasta'] ?? '');
        $desdeSql = $desde . ' 00:00:00';
        $hastaSql = $hasta . ' 23:59:59';

        $modulos = $this->obtenerModulosDetalle($idPrograma, $desdeSql, $hastaSql);
        $parametros = $this->obtenerParametrosDatatable($params);

        return $this->construirRespuestaDatatable(
            $modulos,
            $parametros,
            ['nom_mod', 'categoria'],
            [0 => 'nom_mod', 1 => 'consultas', 2 => 'usuarios', 3 => 'ultimo_acceso']
        );
    }

    public function obtenerUsuariosDatatable($codUsuario, $epre, $idPrograma, $params)
    {
        list($desde, $hasta) = $this->validarPeriodo($params['desde'] ?? '', $params['hasta'] ?? '');
        $desdeSql = $desde . ' 00:00:00';
        $hastaSql = $hasta . ' 23:59:59';

        $detalle = $this->obtenerUsuariosDetalle($idPrograma, $desdeSql, $hastaSql);
        $parametros = $this->obtenerParametrosDatatable($params);

        return $this->construirRespuestaDatatable(
            $detalle['usuarios'],
            $parametros,
            ['nombre', 'cod_usuario', 'roles'],
            [0 => 'nombre', 1 => 'roles', 2 => 'ingresos', 3 => 'consultas', 4 => 'modulos', 5 => 'ultima_actividad']
        );
    }

    public function obtenerModulosUsuario($codUsuario, $epre, $idPrograma, $params)
    {
        list($desde, $hasta) = $this->validarPeriodo($params['desde'] ?? '', $params['hasta'] ?? '');
        $codUsuarioObjetivo = trim((string) ($params['cod_usuario'] ?? ''));

        if ($codUsuarioObjetivo === '') {
            throw new InvalidArgumentException('El usuario es obligatorio.');
        }

        $desdeSql = $desde . ' 00:00:00';
        $hastaSql = $hasta . ' 23:59:59';

        $accesos = $this->repo->obtenerModulosPorUsuario($idPrograma, $codUsuarioObjetivo, $desdeSql, $hastaSql);

        $modulos = [];
        $totalConsultas = 0;

        foreach ($accesos as $fila) {
            $consultas = (int) $fila['consultas'];
            $totalConsultas += $consultas;

            $modulos[] = [
                'cod_mod' => $fila['cod_mod'],
                'nom_mod' => trim(!empty($fila['nom_mod']) ? $fila['nom_mod'] : $fila['cod_mod']),
                'categoria' => trim(!empty($fila['categoria']) ? $fila['categoria'] : 'Sin categoría'),
                'consultas' => $consultas,
                'ultimo_acceso' => $fila['ultimo_acceso']
            ];
        }

        return [
            'periodo' => [
                'desde' => $desde,
                'hasta' => $hasta
            ],
            'usuario' => $codUsuarioObjetivo,
            'modulos' => $modulos,
            'totalModulos' => count($modulos),
            'totalConsultas' => $totalConsultas
        ];
    }

    public function obtenerInactivosDatatable($codUsuario, $epre, $idPrograma, $params)
    {
        list($desde, $hasta) = $this->validarPeriodo($params['desde'] ?? '', $params['hasta'] ?? '');
        $desdeSql = $desde . ' 00:00:00';
        $hastaSql = $hasta . ' 23:59:59';

        $detalle = $this->obtenerUsuariosDetalle($idPrograma, $desdeSql, $hastaSql);
        $parametros = $this->obtenerParametrosDatatable($params);

        return $this->construirRespuestaDatatable(
            $detalle['inactivos'],
            $parametros,
            ['cod_usuario', 'nombre', 'roles'],
            [0 => 'cod_usuario', 1 => 'nombre', 2 => 'roles']
        );
    }

    private function obtenerModulosDetalle($idPrograma, $desdeSql, $hastaSql)
    {
        $accesosModulos = $this->repo->obtenerAccesosPorModulo($idPrograma, $desdeSql, $hastaSql);
        $modulos = [];

        foreach ($accesosModulos as $fila) {
            $modulos[] = [
                'cod_mod' => $fila['cod_mod'],
                'nom_mod' => trim(!empty($fila['nom_mod']) ? $fila['nom_mod'] : $fila['cod_mod']),
                'categoria' => trim(!empty($fila['categoria']) ? $fila['categoria'] : 'Sin categoría'),
                'consultas' => (int) $fila['consultas'],
                'usuarios' => (int) $fila['usuarios'],
                'ultimo_acceso' => $fila['ultimo_acceso']
            ];
        }

        return $modulos;
    }

    private function obtenerUsuariosDetalle($idPrograma, $desdeSql, $hastaSql)
    {
        $accesosUsuarios = $this->repo->obtenerAccesosPorUsuario($idPrograma, $desdeSql, $hastaSql);
        $ingresosUsuarios = $this->repo->obtenerIngresosPorUsuario($idPrograma, $desdeSql, $hastaSql);
        $usuariosConAcceso = $this->repo->obtenerUsuariosConAcceso($idPrograma);

        $mapaAccesosUsuarios = [];
        foreach ($accesosUsuarios as $fila) {
            $mapaAccesosUsuarios[$fila['cod_usuario']] = $fila;
        }

        $mapaIngresosUsuarios = [];
        foreach ($ingresosUsuarios as $fila) {
            $mapaIngresosUsuarios[$fila['cod_usuario']] = $fila;
        }

        $mapaUsuarios = [];

        foreach ($usuariosConAcceso as $usuario) {
            $codigo = $usuario['codigo'];
            $acceso = $mapaAccesosUsuarios[$codigo] ?? null;
            $ingreso = $mapaIngresosUsuarios[$codigo] ?? null;

            $mapaUsuarios[$codigo] = [
                'cod_usuario' => $codigo,
                'nombre' => $usuario['nombre'],
                'roles' => $usuario['roles'],
                'consultas' => $acceso ? (int) $acceso['consultas'] : 0,
                'modulos' => $acceso ? (int) $acceso['modulos'] : 0,
                'ingresos' => $ingreso ? (int) $ingreso['ingresos'] : 0,
                'ultimo_acceso' => $acceso['ultimo_acceso'] ?? null,
                'ultimo_ingreso' => $ingreso['ultimo_ingreso'] ?? null
            ];
        }

        foreach ($mapaAccesosUsuarios as $codigo => $acceso) {
            if (isset($mapaUsuarios[$codigo])) {
                continue;
            }

            $ingreso = $mapaIngresosUsuarios[$codigo] ?? null;

            $mapaUsuarios[$codigo] = [
                'cod_usuario' => $codigo,
                'nombre' => !empty($acceso['nombre']) ? $acceso['nombre'] : $codigo,
                'roles' => 'Sin rol actual',
                'consultas' => (int) $acceso['consultas'],
                'modulos' => (int) $acceso['modulos'],
                'ingresos' => $ingreso ? (int) $ingreso['ingresos'] : 0,
                'ultimo_acceso' => $acceso['ultimo_acceso'] ?? null,
                'ultimo_ingreso' => $ingreso['ultimo_ingreso'] ?? null
            ];
        }

        foreach ($mapaIngresosUsuarios as $codigo => $ingreso) {
            if (isset($mapaUsuarios[$codigo])) {
                continue;
            }

            $mapaUsuarios[$codigo] = [
                'cod_usuario' => $codigo,
                'nombre' => !empty($ingreso['nombre']) ? $ingreso['nombre'] : $codigo,
                'roles' => 'Sin rol actual',
                'consultas' => 0,
                'modulos' => 0,
                'ingresos' => (int) $ingreso['ingresos'],
                'ultimo_acceso' => null,
                'ultimo_ingreso' => $ingreso['ultimo_ingreso'] ?? null
            ];
        }

        $usuarios = [];
        $inactivos = [];

        foreach ($mapaUsuarios as $usuario) {
            $usuario['ultima_actividad'] = $this->mayorFecha($usuario['ultimo_acceso'], $usuario['ultimo_ingreso']);

            if ($usuario['consultas'] > 0 || $usuario['ingresos'] > 0) {
                $usuarios[] = $usuario;
            }
        }

        foreach ($usuariosConAcceso as $usuario) {
            $codigo = $usuario['codigo'];
            $consultas = isset($mapaAccesosUsuarios[$codigo]) ? (int) $mapaAccesosUsuarios[$codigo]['consultas'] : 0;
            $ingresos = isset($mapaIngresosUsuarios[$codigo]) ? (int) $mapaIngresosUsuarios[$codigo]['ingresos'] : 0;

            if ($consultas === 0 && $ingresos === 0) {
                $inactivos[] = [
                    'cod_usuario' => $codigo,
                    'nombre' => $usuario['nombre'],
                    'roles' => $usuario['roles']
                ];
            }
        }

        return [
            'usuarios' => $usuarios,
            'inactivos' => $inactivos
        ];
    }

    private function obtenerParametrosDatatable($params)
    {
        $draw = (int) ($params['draw'] ?? 0);
        $start = max(0, (int) ($params['start'] ?? 0));
        $length = (int) ($params['length'] ?? 10);
        $search = trim((string) ($params['search']['value'] ?? ''));
        $orderColumn = (int) ($params['order'][0]['column'] ?? 0);
        $orderDir = strtolower((string) ($params['order'][0]['dir'] ?? 'desc')) === 'asc' ? 'asc' : 'desc';

        if ($length <= 0 || $length > 100) {
            $length = 10;
        }

        return [
            'draw' => $draw,
            'start' => $start,
            'length' => $length,
            'search' => $search,
            'order_column' => $orderColumn,
            'order_dir' => $orderDir
        ];
    }

    private function construirRespuestaDatatable($items, $parametros, $camposBusqueda, $mapaOrden)
    {
        $total = count($items);
        $filtrados = $this->filtrarItems($items, $parametros['search'], $camposBusqueda);
        $filtradosTotal = count($filtrados);

        $maxValues = [];
        foreach ($filtrados as $item) {
            foreach (['consultas', 'usuarios', 'ingresos', 'modulos'] as $campo) {
                if (!array_key_exists($campo, $item)) {
                    continue;
                }

                $valor = (int) $item[$campo];

                if (!isset($maxValues[$campo]) || $valor > $maxValues[$campo]) {
                    $maxValues[$campo] = $valor;
                }
            }
        }

        $campoOrden = $mapaOrden[$parametros['order_column']] ?? reset($mapaOrden);
        $filtrados = $this->ordenarItems($filtrados, $campoOrden, $parametros['order_dir']);
        $data = array_slice($filtrados, $parametros['start'], $parametros['length']);

        return [
            'draw' => $parametros['draw'],
            'recordsTotal' => $total,
            'recordsFiltered' => $filtradosTotal,
            'data' => $data,
            'meta' => [
                'maxValues' => $maxValues
            ]
        ];
    }

    private function filtrarItems($items, $search, $campos)
    {
        if ($search === '') {
            return $items;
        }

        $needle = function_exists('mb_strtolower') ? mb_strtolower($search, 'UTF-8') : strtolower($search);
        $resultado = [];

        foreach ($items as $item) {
            $texto = '';
            foreach ($campos as $campo) {
                $texto .= ' ' . ($item[$campo] ?? '');
            }
            $texto = function_exists('mb_strtolower') ? mb_strtolower($texto, 'UTF-8') : strtolower($texto);

            if (strpos($texto, $needle) !== false) {
                $resultado[] = $item;
            }
        }

        return $resultado;
    }

    private function ordenarItems($items, $campo, $direccion)
    {
        usort($items, function ($a, $b) use ($campo, $direccion) {
            $valorA = $a[$campo] ?? null;
            $valorB = $b[$campo] ?? null;

            if (is_numeric($valorA) && is_numeric($valorB)) {
                $comparacion = $valorA <=> $valorB;
            } else {
                $comparacion = strcasecmp((string) $valorA, (string) $valorB);
            }

            return $direccion === 'asc' ? $comparacion : -$comparacion;
        });

        return $items;
    }

    private function mayorFecha($fechaA, $fechaB)
    {
        if (empty($fechaA)) {
            return $fechaB;
        }

        if (empty($fechaB)) {
            return $fechaA;
        }

        return strcmp($fechaA, $fechaB) >= 0 ? $fechaA : $fechaB;
    }

    private function construirSerieDiaria($desde, $hasta, $accesosDia, $ingresosDia)
    {
        $accesosMap = [];
        foreach ($accesosDia as $fila) {
            $accesosMap[$fila['dia']] = [
                'total' => (int) $fila['total'],
                'usuarios' => (int) ($fila['usuarios'] ?? 0),
                'modulos' => (int) ($fila['modulos'] ?? 0)
            ];
        }

        $ingresosMap = [];
        foreach ($ingresosDia as $fila) {
            $ingresosMap[$fila['dia']] = [
                'total' => (int) $fila['total'],
                'usuarios' => (int) ($fila['usuarios'] ?? 0)
            ];
        }

        $serie = [];
        $inicio = new DateTime($desde);
        $fin = new DateTime($hasta);
        $fin->modify('+1 day');
        $intervalo = new DateInterval('P1D');
        $periodo = new DatePeriod($inicio, $intervalo, $fin);

        foreach ($periodo as $fecha) {
            $dia = $fecha->format('Y-m-d');
            $acceso = $accesosMap[$dia] ?? ['total' => 0, 'usuarios' => 0, 'modulos' => 0];
            $ingreso = $ingresosMap[$dia] ?? ['total' => 0, 'usuarios' => 0];

            $consultas = (int) $acceso['total'];
            $usuariosActivos = (int) $acceso['usuarios'];

            $serie[] = [
                'dia' => $dia,
                'consultas' => $consultas,
                'ingresos' => (int) $ingreso['total'],
                'usuariosActivos' => $usuariosActivos,
                'usuariosIngresaron' => (int) $ingreso['usuarios'],
                'modulosDistintos' => (int) $acceso['modulos'],
                'promedioConsultas' => $usuariosActivos > 0 ? round($consultas / $usuariosActivos, 2) : 0
            ];
        }

        return $serie;
    }

    private function validarPeriodo($desde, $hasta)
    {
        $desde = trim((string) $desde);
        $hasta = trim((string) $hasta);

        if ($desde === '') {
            $desde = date('Y-m-01');
        }

        if ($hasta === '') {
            $hasta = date('Y-m-t');
        }

        if (!$this->esFechaValida($desde) || !$this->esFechaValida($hasta)) {
            throw new InvalidArgumentException('Formato de fecha inválido. Use YYYY-MM-DD.');
        }

        $tsDesde = strtotime($desde);
        $tsHasta = strtotime($hasta);

        if ($tsDesde > $tsHasta) {
            throw new InvalidArgumentException('La fecha desde no puede ser mayor que la fecha hasta.');
        }

        if (($tsHasta - $tsDesde) / 86400 > 366) {
            throw new InvalidArgumentException('El rango máximo permitido es 1 año.');
        }

        return [$desde, $hasta];
    }

    private function esFechaValida($fecha)
    {
        return is_string($fecha)
            && preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha)
            && date('Y-m-d', strtotime($fecha)) === $fecha;
    }
}
