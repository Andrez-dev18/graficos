<?php

// 1. Configuración de Sesión (Siempre al inicio)
session_name('SESS_GRAFICOS'); // ponerle nombre a la sesión para evitar conflictos con otras aplicaciones
session_start();

// === CONTROL DE INACTIVIDAD (10 minutos = 600 segundos) ===
if (isset($_SESSION['usuario'])) {
    $tiempoMaximoInactividad = 600; // 10 minutos en segundos

    if (isset($_SESSION['ultimo_acceso'])) {
        $vidaSesion = time() - $_SESSION['ultimo_acceso'];
        if ($vidaSesion > $tiempoMaximoInactividad) {
            // Destruir la sesión limpiamente
            session_unset();
            session_destroy();

            // Responder con un error 401 (No Autorizado)
            http_response_code(401);
            echo json_encode([
                "success" => false,
                "message" => "Sesión expirada por inactividad"
            ]);
            exit;
        }
    }
    // Si la sesión sigue vigente, actualizamos la hora de última actividad
    $_SESSION['ultimo_acceso'] = time();
}

// 2. Cabeceras de Seguridad y CORS
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *"); // Cámbialo a tu dominio en producción
header("Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization");
header("Cache-Control: no-cache, must-revalidate");
header("Expires: Sat, 26 Jul 1997 05:00:00 GMT");

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// 3. Encender el Enrutador Principal
require_once __DIR__ . '/core/Router.php';

$router = new Router();
$router->loadModules(); // Esto leerá automáticamente todos tus módulos
$router->dispatch();    // Ejecuta la ruta solicitada
?>