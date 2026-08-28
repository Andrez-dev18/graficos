<?php
require_once __DIR__ . '/HistorialRepository.php';

class HistorialService
{
    private $repo;

    public function __construct($db)
    {
        $this->repo = new HistorialRepository($db);
    }

    private function getUsuarioSesion()
    {
        return [
            'codigo' => $_SESSION['usuario'] ?? null,
            'nombre' => $_SESSION['nombre'] ?? null,
        ];
    }

    private function getFechaHora()
    {
        return date("Y-m-d H:i:s");
    }

    public function logAction($accion, $tabla, $registroId = null, $previos = null, $nuevos = null, $descripcion = null)
    {
        $usuario = $this->getUsuarioSesion();

        $data = [
            'id_programa'       => 2,
            'cod_usuario'    => $usuario['codigo'],
            'nom_usuario'    => $usuario['nombre'],
            'accion'         => $accion,
            'tabla_afectada' => $tabla,
            'registro_id'    => $registroId,
            'datos_previos'  => $previos ? json_encode($previos) : null,
            'datos_nuevos'   => $nuevos ? json_encode($nuevos) : null,
            'descripcion'    => $descripcion,
            'fechaHora'      => $this->getFechaHora(),
            'ip' => "-",
            'ubicacion_gps' => "-",
            'dispositivo' => "-",
            'sistema_operativo' => "-",
            'navegador' => "-",
            'user_agent' => "-"
        ];

        return $this->repo->registrar($data);
    }

    public function logActionLogin($cod, $nom, $accion, $tabla, $registroId = null, $previos = null, $nuevos = null, $descripcion = null, $ubicacionGPS = null)
    {
        $client = $this->getClientData();
        $client['ubicacion_gps'] = $ubicacionGPS; // Sobrescribir con la real

        $data = [
            'id_programa'       => 2,
            'cod_usuario'       => $cod,
            'nom_usuario'       => $nom,
            'accion'            => $accion,
            'tabla_afectada'    => $tabla,
            'registro_id'       => $registroId,
            'datos_previos'     => $previos ? json_encode($previos) : null,
            'datos_nuevos'      => $nuevos ? json_encode($nuevos) : null,
            'descripcion'       => $descripcion,
            'fechaHora'         => $this->getFechaHora(),
            'ip'                => $client['ip'],
            'ubicacion_gps'     => $client['ubicacion_gps'],
            'dispositivo'       => $client['dispositivo'],
            'sistema_operativo' => $client['sistema_operativo'],
            'navegador'         => $client['navegador'],
            'user_agent'        => $client['user_agent'],
        ];

        return $this->repo->registrar($data);
    }


    private function getClientData()
    {
        $userAgent = $_SERVER['HTTP_USER_AGENT'] ?? null;

        return [
            'ip'               => $_SERVER['REMOTE_ADDR'] ?? null,
            'user_agent'       => $userAgent,
            'dispositivo'      => preg_match('/Mobi|Android/i', $userAgent) ? 'Móvil' : 'PC',
            'sistema_operativo' => php_uname('s'),
            'navegador'        => $this->obtenerNavegador($userAgent),
            'ubicacion_gps'    => null // opcional si decides implementarlo
        ];
    }

    private function obtenerNavegador($ua)
    {
        $ua = strtolower($ua);

        // Orden correcto: primero los navegadores basados en Chrome
        if (strpos($ua, 'edg/') !== false) return 'Microsoft Edge';
        if (strpos($ua, 'opr/') !== false || strpos($ua, 'opera') !== false) return 'Opera';
        if (strpos($ua, 'brave') !== false) return 'Brave';
        if (strpos($ua, 'chrome') !== false) return 'Chrome';

        // Después Safari y Firefox
        if (strpos($ua, 'safari') !== false) return 'Safari';
        if (strpos($ua, 'firefox') !== false) return 'Firefox';

        return 'Desconocido';
    }

    public function procesarDatatable($request)
    {
        // Parámetros por defecto de DataTables
        $draw        = isset($request['draw']) ? intval($request['draw']) : 1;
        $start       = isset($request['start']) ? intval($request['start']) : 0;
        $length      = isset($request['length']) ? intval($request['length']) : 10;
        $searchValue = isset($request['search']['value']) ? $request['search']['value'] : '';
        
        // Mapeo de índices de columnas a nombres reales de base de datos
        // Asegúrate de que el JS de DataTables envíe las columnas en este orden
        $columnasMap = [
            0 => 'id',
            1 => 'nombre_programa',
            2 => 'id_programa',
            3 => 'cod_usuario',
            4 => 'nom_usuario',
            5 => 'accion',
            6 => 'tabla_afectada',
            7 => 'registro_id',
            8 => 'datos_previos',
            9 => 'datos_nuevos',
            10 => 'descripcion',
            11 => 'fechaHora',
            12 => 'ip',
            13 => 'ubicacion_gps',
            14 => 'dispositivo',
            15 => 'sistema_operativo',
            16 => 'navegador'
        ];

        $orderIndex  = isset($request['order'][0]['column']) ? intval($request['order'][0]['column']) : 6; // Default fechaHora
        $orderColumn = $columnasMap[$orderIndex] ?? 'fechaHora';
        $orderDir    = isset($request['order'][0]['dir']) ? $request['order'][0]['dir'] : 'desc';

        // Filtros personalizados enviados desde tu frontend
        $filtros = [
            'id_programa'       => $request['id_programa'] ?? '',
            'accion'            => $request['accion'] ?? '',
            'tabla_afectada'    => $request['tabla_afectada'] ?? '',
            'fecha_inicio'      => $request['fecha_inicio'] ?? '',
            'fecha_fin'         => $request['fecha_fin'] ?? '',
            'dispositivo'       => $request['dispositivo'] ?? '',
            'sistema_operativo' => $request['sistema_operativo'] ?? '',
            'navegador'         => $request['navegador'] ?? ''
        ];

        $resultado = $this->repo->getHistorialDatatable($start, $length, $searchValue, $orderColumn, $orderDir, $filtros);

        // Estructura estricta que exige DataTables para pintar la tabla
        return [
            "draw"            => $draw,
            "recordsTotal"    => $resultado['recordsTotal'],
            "recordsFiltered" => $resultado['recordsFiltered'],
            "data"            => $resultado['data']
        ];
    }

    public function obtenerFiltrosUnicos()
    {
        return $this->repo->getFiltrosDisponibles();
    }

}
