<?php
require_once __DIR__ . '/DashboardPrincipalRepository.php';
require_once __DIR__ . '/../menu/MenuService.php';

class DashboardPrincipalService
{
    private $repo;
    private $menuService;

    public function __construct($db)
    {
        $this->repo = new DashboardPrincipalRepository($db);
        $this->menuService = new MenuService($db);
    }

    public function obtenerResumen($codUsuario, $epre, $idPrograma = '5')
    {
        $catalogo = $this->obtenerCatalogo($codUsuario, $epre, $idPrograma);

        $inicioDia = date('Y-m-d 00:00:00');
        $finDia = date('Y-m-d 00:00:00', strtotime('+1 day'));
        $inicioMes = date('Y-m-01 00:00:00');
        $finMes = date('Y-m-01 00:00:00', strtotime('+1 month'));

        $consultasHoy = (int) $this->repo->contarAccesos($codUsuario, $epre, $idPrograma, $inicioDia, $finDia);
        $ultimo = $this->repo->obtenerUltimoAcceso($codUsuario, $epre, $idPrograma);
        $frecuente = $this->repo->obtenerMasFrecuenteMes($codUsuario, $epre, $idPrograma, $inicioMes, $finMes);
        $totalMes = (int) $this->repo->contarAccesos($codUsuario, $epre, $idPrograma, $inicioMes, $finMes);

        if ($frecuente) {
            $frecuente['total'] = (int) $frecuente['total'];
            $frecuente['porcentaje'] = $totalMes > 0
                ? (int) round(($frecuente['total'] / $totalMes) * 100)
                : 0;
        }

        return [
            'kpis' => [
                'modulosAsignados' => count($catalogo),
                'consultasHoy' => $consultasHoy,
                'ultimoConsultado' => $ultimo ?: null,
                'masFrecuente' => $frecuente ?: null
            ],
            'catalogo' => $catalogo
        ];
    }

    public function obtenerAccesos($codUsuario, $epre, $idPrograma = '5')
    {
        $catalogoPorCodigo = $this->indexarCatalogo($codUsuario, $epre, $idPrograma);
        $json = $this->repo->obtenerAccesos($codUsuario, $epre, $idPrograma);
        $slots = [];

        if (!empty($json)) {
            $decodificado = json_decode($json, true);
            if (is_array($decodificado)) {
                $slots = $decodificado;
            }
        }

        return $this->normalizarSlotsAcceso($slots, $catalogoPorCodigo);
    }

    public function guardarAccesos($codUsuario, $epre, $idPrograma, $accesos, $usuarioAccion)
    {
        $catalogoPorCodigo = $this->indexarCatalogo($codUsuario, $epre, $idPrograma);
        $slots = $this->normalizarSlotsAcceso(is_array($accesos) ? $accesos : [], $catalogoPorCodigo);

        $this->repo->guardarAccesos([
            'usuarioCodigo' => $codUsuario,
            'epre' => $epre,
            'id_programa' => $idPrograma,
            'accesosJson' => json_encode($slots, JSON_UNESCAPED_UNICODE),
            'usuarioRegistro' => $usuarioAccion,
            'fechaHoraRegistro' => date('Y-m-d H:i:s')
        ]);

        return $slots;
    }

    public function obtenerAccesosLateral($codUsuario, $epre, $idPrograma = '5')
    {
        $catalogoPorCodigo = $this->indexarCatalogo($codUsuario, $epre, $idPrograma);
        $inicio = date('Y-m-d H:i:s', strtotime('-30 days'));
        $top = $this->repo->obtenerTopModulos($codUsuario, $epre, $idPrograma, $inicio, 5);

        $resultado = [];
        $vistos = [];

        foreach ($top as $fila) {
            $codMod = $fila['cod_mod'] ?? '';

            if ($codMod === '' || !isset($catalogoPorCodigo[$codMod]) || isset($vistos[$codMod])) {
                continue;
            }

            $resultado[] = $this->construirItemLateral($catalogoPorCodigo[$codMod]);
            $vistos[$codMod] = true;

            if (count($resultado) >= 5) {
                break;
            }
        }

        if (count($resultado) < 5) {
            $configurados = $this->obtenerAccesos($codUsuario, $epre, $idPrograma);

            foreach ($configurados as $slot) {
                if (empty($slot['cod_mod'])) {
                    continue;
                }

                $codMod = $slot['cod_mod'];

                if (!isset($catalogoPorCodigo[$codMod]) || isset($vistos[$codMod])) {
                    continue;
                }

                $resultado[] = $this->construirItemLateral($catalogoPorCodigo[$codMod]);
                $vistos[$codMod] = true;

                if (count($resultado) >= 5) {
                    break;
                }
            }
        }

        return $resultado;
    }

    private function construirItemLateral($item)
    {
        $titulo = !empty($item['titulo']) ? $item['titulo'] : $item['nom_mod'];
        $icono = !empty($item['icono']) ? $item['icono'] : 'fa-solid fa-chart-line';

        if (strpos($icono, 'fa-circle') !== false) {
            $icono = !empty($item['categoria_icono']) ? $item['categoria_icono'] : 'fa-solid fa-chart-line';
        }

        return [
            'cod_mod' => $item['cod_mod'],
            'titulo' => $titulo,
            'icon' => $icono,
            'url' => $item['url'],
            'tipo_param' => $item['tipo_param'] ?? ''
        ];
    }

    private function indexarCatalogo($codUsuario, $epre, $idPrograma)
    {
        $catalogo = $this->obtenerCatalogo($codUsuario, $epre, $idPrograma);
        $catalogoPorCodigo = [];

        foreach ($catalogo as $item) {
            $catalogoPorCodigo[$item['cod_mod']] = $item;
        }

        return $catalogoPorCodigo;
    }

    private function normalizarSlotsAcceso($slots, $catalogoPorCodigo)
    {
        $resultado = [];
        $vistos = [];

        for ($i = 0; $i < 12; $i++) {
            $slot = $slots[$i] ?? null;
            $item = null;

            if (is_string($slot) && $slot !== '') {
                $item = $catalogoPorCodigo[$slot] ?? null;
            } elseif (is_array($slot) && !empty($slot['cod_mod'])) {
                $item = $catalogoPorCodigo[$slot['cod_mod']] ?? null;
            }

            if ($item && !isset($vistos[$item['cod_mod']])) {
                $vistos[$item['cod_mod']] = true;
                $resultado[] = $this->construirObjetoAcceso($item);
            } else {
                $resultado[] = null;
            }
        }

        return $resultado;
    }

    private function construirObjetoAcceso($item)
    {
        $titulo = !empty($item['titulo']) ? $item['titulo'] : $item['nom_mod'];
        $url = $item['url'];
        $tipoParam = $item['tipo_param'] ?? '';

        return [
            'titulo' => $titulo,
            'icon' => !empty($item['icono']) ? $item['icono'] : 'fa-solid fa-chart-line',
            'actionArgs' => "('" . $this->escaparComillaSimple($url) . "', '"
                . $this->escaparComillaSimple($tipoParam) . "', '"
                . $this->escaparComillaSimple($titulo) . "')",
            'cod_mod' => $item['cod_mod']
        ];
    }

    private function escaparComillaSimple($valor)
    {
        return str_replace("'", "\\'", (string) $valor);
    }

    public function registrarAcceso($codUsuario, $epre, $idPrograma, $datos)
    {
        $catalogo = $this->obtenerCatalogo($codUsuario, $epre, $idPrograma);

        $codMod = isset($datos['cod_mod']) ? trim((string) $datos['cod_mod']) : '';
        $url = isset($datos['url']) ? trim((string) $datos['url']) : '';

        $modulo = null;

        foreach ($catalogo as $item) {
            if ($codMod !== '' && $item['cod_mod'] === $codMod) {
                $modulo = $item;
                break;
            }

            if ($codMod === '' && $url !== '' && $item['url'] === $url) {
                $modulo = $item;
                break;
            }
        }

        if (!$modulo) {
            return [
                'success' => false,
                'message' => 'Módulo no permitido o inexistente'
            ];
        }

        $this->repo->insertarAcceso([
            'id_programa' => $idPrograma,
            'cod_usuario' => $codUsuario,
            'epre' => $epre,
            'cod_mod' => $modulo['cod_mod'],
            'nom_mod' => $modulo['nom_mod'],
            'url' => $modulo['url'],
            'fechaHora' => date('Y-m-d H:i:s'),
            'ip' => $_SERVER['REMOTE_ADDR'] ?? null,
            'user_agent' => $_SERVER['HTTP_USER_AGENT'] ?? null
        ]);

        return [
            'success' => true,
            'message' => 'Acceso registrado'
        ];
    }

    public function obtenerCatalogo($codUsuario, $epre, $idPrograma = '5')
    {
        $arbol = $this->menuService->obtenerMenuJerarquico($codUsuario, $epre, $idPrograma);

        if (empty($arbol)) {
            return [];
        }

        return $this->aplanarCatalogo($arbol, null, null);
    }

    private function aplanarCatalogo($nodos, $categoriaCod, $categoriaNom, $categoriaIcono = null)
    {
        $resultado = [];

        foreach ($nodos as $nodo) {
            $tipo = $nodo['tipo'] ?? '';
            $codMod = $nodo['cod_mod'] ?? '';

            if ($tipo === 'group') {
                if ($codMod === 'sg-group-config') {
                    continue;
                }

                $hijos = $nodo['children'] ?? [];

                $resultado = array_merge(
                    $resultado,
                    $this->aplanarCatalogo($hijos, $codMod, $nodo['nom_mod'] ?? '', $nodo['icono'] ?? null)
                );

                continue;
            }

            if ($tipo === 'main') {
                continue;
            }

            $url = trim($nodo['url'] ?? '');

            if ($url === '' || $url === '#') {
                continue;
            }

            $nomMod = trim($nodo['nom_mod'] ?? '');
            $titulo = trim(!empty($nodo['titulo']) ? $nodo['titulo'] : $nomMod);

            $resultado[] = [
                'cod_mod' => $codMod,
                'nom_mod' => $nomMod,
                'icono' => !empty($nodo['icono']) ? $nodo['icono'] : 'fa-solid fa-chart-line',
                'url' => $url,
                'tipo_param' => $nodo['tipo_param'] ?? '',
                'titulo' => $titulo,
                'categoria_cod' => $categoriaCod,
                'categoria_nom' => trim($categoriaNom ?? ''),
                'categoria_icono' => !empty($categoriaIcono) ? $categoriaIcono : 'fa-solid fa-chart-pie'
            ];
        }

        return $resultado;
    }
}
