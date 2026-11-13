<?php
// 1. Configuraciones iniciales y zona horaria
date_default_timezone_set('America/Lima');

// Sincronizamos el nombre de sesión
session_name('SESS_COREBI');
session_set_cookie_params(0, '/', '', false, true);

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

require_once __DIR__ . '/backend/config/database.php';
require_once __DIR__ . '/backend/modules/usuario/UsuarioService.php';


// FASE 0: LIMPIEZA RADICAL DE SEGURIDAD (FIX DEL BUG DE SESIÓN)
// Si alguien llega a este punto, la central está enviando un nuevo acceso.
// Asesinamos sin piedad cualquier sesión que haya estado abierta en este navegador.
session_unset();
session_destroy();

// Reiniciamos una sesión completamente en blanco para el nuevo proceso
session_start();
session_regenerate_id(true);
// =========================================================================

$isApiRequest = isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;

try {
    $tokenReq = $_REQUEST['token'] ?? null;

    if (!$tokenReq) {
        throw new Exception("Parámetros de autenticación incompletos. Se requiere un token.");
    }

    // =========================================================================
    // FASE 1: OBTENCIÓN DE CREDENCIALES GRS
    // =========================================================================
    $prodConfigFile = $_SERVER['DOCUMENT_ROOT'] . '/conexion_grs/configuracion.php';
    $localEnvFile   = __DIR__ . '/backend/config/.env';

    $hostGrs = $dbGrs = $userGrs = $passGrs = null;

    if (file_exists($prodConfigFile)) {
        require_once $prodConfigFile;

        $hostGrs = defined('DB_HOST_GRS') ? DB_HOST_GRS : null;
        $dbGrs   = defined('DB_NAME_GRS') ? DB_NAME_GRS : null;
        $userGrs = defined('DB_USER_GRS') ? DB_USER_GRS : null;
        $passGrs = defined('DB_PASSWORD_GRS') ? DB_PASSWORD_GRS : null;
    } elseif (file_exists($localEnvFile)) {
        $envVars = parse_ini_file($localEnvFile);
        $hostGrs = $envVars['DB_HOST_GRS'] ?? null;
        $dbGrs   = $envVars['DB_NAME_GRS'] ?? null;
        $userGrs = $envVars['DB_USER_GRS'] ?? null;
        $passGrs = $envVars['DB_PASSWORD_GRS'] ?? null;
    } else {
        throw new Exception("Error crítico: No se encontró configuración de base de datos externa.");
    }

    if (!$hostGrs || !$dbGrs || !$userGrs) {
        throw new Exception("Configuración de base de datos GRS incompleta.");
    }

    // =========================================================================
    // FASE 2: VALIDACIÓN DEL TOKEN EN LA BD CENTRAL (GRS)
    // =========================================================================
    $pdoGrs = new PDO("mysql:host={$hostGrs};dbname={$dbGrs};charset=utf8mb4", $userGrs, $passGrs, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false
    ]);

    $tiempoActual = time();
    $fechaHoraActual = date('Y-m-d H:i:s');

    $sqlToken = "SELECT id, usuario, expira, usado FROM sso_tokens 
                 WHERE token = :token 
                 AND modulo = 'Sistema Core BI' LIMIT 1";

    $stmtToken = $pdoGrs->prepare($sqlToken);
    $stmtToken->execute([':token' => $tokenReq]);
    $tokenData = $stmtToken->fetch();

    if (!$tokenData) {
        throw new Exception("Token de acceso inválido o no pertenece a este módulo.");
    }

    // Guardamos el ID del token actual para auditorías globales
    $tokenId = $tokenData['id'];

    if ((int)$tokenData['usado'] === 1) {
        throw new Exception("El token de acceso ya ha sido utilizado.");
    }

    if ((int)$tokenData['usado'] === 3) {
        throw new Exception("Este token de acceso fue rechazado previamente por expiración.");
    }

    // VALIDACIÓN DE EXPIRACIÓN AVANZADA: Si expiró, se quema con estado '3'
    if ((int)$tokenData['expira'] < $tiempoActual) {
        $sqlExpirar = "UPDATE sso_tokens SET usado = 3, utilizado = :utilizado WHERE id = :id";
        $stmtExpirar = $pdoGrs->prepare($sqlExpirar);
        $stmtExpirar->execute([
            ':utilizado' => $fechaHoraActual,
            ':id'        => $tokenId
        ]);
        throw new Exception("El token de acceso ha expirado.");
    }

    $usuarioGrs = $tokenData['usuario'];

    // TOKEN EXITOSO: Marcamos usado = 1 y registramos la fechahora en 'utilizado'
    $sqlQuemar = "UPDATE sso_tokens SET usado = 1, utilizado = :utilizado WHERE id = :id";
    $stmtQuemar = $pdoGrs->prepare($sqlQuemar);
    $stmtQuemar->execute([
        ':utilizado' => $fechaHoraActual,
        ':id'        => $tokenId
    ]);

    // Desconectamos GRS de forma limpia
    $pdoGrs = null;

    // =========================================================================
    // FASE 3: VALIDACIÓN DEL USUARIO EN LA BD LOCAL
    // =========================================================================
    $dbLocal = (new Database())->getConnection();

    $sqlUser = "SELECT codigo, nombre, epre, ruc, estado, rol_comercial, rol_flujo 
                FROM usuario 
                WHERE (codigo = :usuario1 OR libtri = :usuario2) 
                AND estado = 'A' LIMIT 1";

    $stmtUser = $dbLocal->prepare($sqlUser);
    $stmtUser->execute([
        ':usuario1' => $usuarioGrs,
        ':usuario2' => $usuarioGrs
    ]);

    $userData = $stmtUser->fetch(PDO::FETCH_ASSOC);

    if (!$userData) {
        throw new Exception("El usuario no existe o está inactivo.");
    }

    $usuarioService = new UsuarioService($dbLocal);

    $tieneRoles = $usuarioService->tieneRolesActivos($userData['codigo'], $userData['epre'], 2);

    if (!$tieneRoles) {
        throw new Exception("El usuario no tiene roles asignados para ingresar a Planta Beneficio.");
    }

    // =========================================================================
    // FASE 4: CREACIÓN DE SESIÓN EN "SESS_ALMACEN" Y REDIRECCIÓN
    // =========================================================================
    $_SESSION['usuario']       = $userData['codigo'];
    $_SESSION['nombre']        = $userData['nombre'];
    $_SESSION['epre']          = $userData['epre'];
    $_SESSION['ruc']           = $userData['ruc'] ?? '';
    $_SESSION['id_programa']   = '5';
    $_SESSION['rol_comercial'] = $userData['rol_comercial'] ?? '';
    $_SESSION['rol_flujo']     = $userData['rol_flujo'] ?? '';

    session_write_close();

    $historialService = new HistorialService($dbLocal);
    $historialService->logActionLogin(
        $userData['codigo'],
        $userData['nombre'],
        "SSO_LOGIN",                         
        "USUARIO - CONEMPRE",
        null,
        null,
        $userData,                           
        "INICIO DE SESION AUTOMATICO (SSO)",
        "ACCESO_SSO"
    );

    $jsonUserData = json_encode([
        'usuario'       => $userData['codigo'],
        'nombre'        => $userData['nombre'],
        'rol_comercial' => $userData['rol_comercial'] ?? '',
        'rol_flujo'     => $userData['rol_flujo'] ?? '',
        'ruc'           => $userData['ruc'] ?? '',
        'epre'          => $userData['epre']
    ]);

    if ($isApiRequest) {
        header('Content-Type: application/json');
        echo json_encode([
            "success" => true,
            "message" => "SSO Login exitoso",
            "data" => [
                "usuario" => $_SESSION['usuario'],
                "nombre" => $_SESSION['nombre']
            ]
        ]);
        exit();
    } else {
        echo "<!DOCTYPE html>
        <html lang='es'>
        <head>
            <meta charset='UTF-8'>
            <title>Autenticando SSO...</title>
            <style>
                body { background-color: #f3f4f6; display: flex; justify-content: center; align-items: center; height: 100vh; font-family: sans-serif; color: #374151; }
            </style>
        </head>
        <body>
            <h2>Validando credenciales corporativas...</h2>
            <script>
                const userData = {$jsonUserData};
                sessionStorage.setItem('usuario', JSON.stringify(userData));

                setTimeout(() => {
                    window.location.replace('index.html');
                }, 300);
            </script>
        </body>
        </html>";
        exit();
    }
} catch (Exception $e) {
    if ($isApiRequest) {
        header('Content-Type: application/json');
        http_response_code(400); 
        echo json_encode(["success" => false, "message" => $e->getMessage()]);
        exit();
    } else {
        // Mensaje genérico para el usuario
        $mensajePublico = urlencode("Session no valida");
        
        // Mensaje técnico para la consola
        $mensajeDebug = urlencode($e->getMessage());
        
        header("Location: login.html?error_sso=" . $mensajePublico . "&debug=" . $mensajeDebug);
        exit();
    }
}
