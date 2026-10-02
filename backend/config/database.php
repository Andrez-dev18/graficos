<?php
require_once __DIR__ . '/SmartPDO.php';

class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    private $secondaryConnections = [];
    private $conn;

    public function __construct() {
        
        // 1. Ruta del archivo en el servidor de producción (Granja Rinconada del Sur)
        $docRoot = isset($_SERVER['DOCUMENT_ROOT']) ? rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') : '/var/www/html';
        $prodConfigFile1 = $docRoot . '/conexion_grs/configuracion.ph';
        $prodConfigFile2 = $docRoot . '/conexion_grs/configuracion.php';
        $prodConfigFile3 = dirname(__DIR__, 3) . '/conexion_grs/configuracion.php';
        
        // 2. Ruta de tu archivo local (.env)
        $localEnvFile = __DIR__ . '/.env'; 

        // Verificamos en qué entorno estamos
        if (file_exists($prodConfigFile1)) {
            require_once $prodConfigFile1;
            $this->loadProdConfig();
        } elseif (file_exists($prodConfigFile2)) {
            require_once $prodConfigFile2;
            $this->loadProdConfig();
        } elseif (file_exists($prodConfigFile3)) {
            require_once $prodConfigFile3;
            $this->loadProdConfig();
        } elseif (file_exists($localEnvFile)) {
            $this->loadLocalConfig($localEnvFile);
        } else {
            die("Error crítico: No se encontró configuración de base de datos ni en producción ni en local.");
        }
    }

    private function loadProdConfig() {
        // 1. BD Principal (Sistema / Administración - cia2026)
        $this->host     = defined('DB_HOST_AQP') ? DB_HOST_AQP : (defined('DB_HOST') ? DB_HOST : 'localhost');
        $this->db_name  = defined('DB_NAME_AQP') ? DB_NAME_AQP : (defined('DB_NAME') ? DB_NAME : '');
        $this->username = defined('DB_USER_AQP') ? DB_USER_AQP : (defined('DB_USER') ? DB_USER : 'root');
        $this->password = defined('DB_PASSWORD_AQP') ? DB_PASSWORD_AQP : (defined('DB_PASSWORD') ? DB_PASSWORD : '');

        // 2. BD Almacén (TA - grs_dmalmacen)
        $dbNameTA = defined('DB_NAME_AQP_TA') ? DB_NAME_AQP_TA : (defined('DB_NAME_TA') ? DB_NAME_TA : (defined('DB_NAME_ALMACEN') ? DB_NAME_ALMACEN : ''));
        if (!empty($dbNameTA)) {
            $this->secondaryConnections['ta'] = [
                'host'     => defined('DB_HOST_AQP_TA') ? DB_HOST_AQP_TA : (defined('DB_HOST_TA') ? DB_HOST_TA : (defined('DB_HOST_ALMACEN') ? DB_HOST_ALMACEN : $this->host)),
                'db_name'  => $dbNameTA,
                'username' => defined('DB_USER_AQP_TA') ? DB_USER_AQP_TA : (defined('DB_USER_TA') ? DB_USER_TA : (defined('DB_USER_ALMACEN') ? DB_USER_ALMACEN : $this->username)),
                'password' => defined('DB_PASSWORD_AQP_TA') ? DB_PASSWORD_AQP_TA : (defined('DB_PASSWORD_TA') ? DB_PASSWORD_TA : (defined('DB_PASSWORD_ALMACEN') ? DB_PASSWORD_ALMACEN : $this->password))
            ];
        }

        // 3. BD Comercial (TC - grs_dmcomercial)
        $dbNameTC = defined('DB_NAME_AQP_TC') ? DB_NAME_AQP_TC : (defined('DB_NAME_TC') ? DB_NAME_TC : (defined('DB_NAME_COMERCIAL') ? DB_NAME_COMERCIAL : ''));
        if (!empty($dbNameTC)) {
            $this->secondaryConnections['tc'] = [
                'host'     => defined('DB_HOST_AQP_TC') ? DB_HOST_AQP_TC : (defined('DB_HOST_TC') ? DB_HOST_TC : (defined('DB_HOST_COMERCIAL') ? DB_HOST_COMERCIAL : $this->host)),
                'db_name'  => $dbNameTC,
                'username' => defined('DB_USER_AQP_TC') ? DB_USER_AQP_TC : (defined('DB_USER_TC') ? DB_USER_TC : (defined('DB_USER_COMERCIAL') ? DB_USER_COMERCIAL : $this->username)),
                'password' => defined('DB_PASSWORD_AQP_TC') ? DB_PASSWORD_AQP_TC : (defined('DB_PASSWORD_TC') ? DB_PASSWORD_TC : (defined('DB_PASSWORD_COMERCIAL') ? DB_PASSWORD_COMERCIAL : $this->password))
            ];
        }

        // 4. BD Ventas 2024 (cia2024)
        $dbName24 = defined('DB_NAME_AQP24') ? DB_NAME_AQP24 : (defined('DB_NAME_2024') ? DB_NAME_2024 : '');
        if (!empty($dbName24)) {
            $this->secondaryConnections['2024'] = [
                'host'     => defined('DB_HOST_AQP24') ? DB_HOST_AQP24 : (defined('DB_HOST_2024') ? DB_HOST_2024 : $this->host),
                'db_name'  => $dbName24,
                'username' => defined('DB_USER_AQP24') ? DB_USER_AQP24 : (defined('DB_USER_2024') ? DB_USER_2024 : $this->username),
                'password' => defined('DB_PASSWORD_AQP24') ? DB_PASSWORD_AQP24 : (defined('DB_PASSWORD_2024') ? DB_PASSWORD_2024 : $this->password)
            ];
        }

        // 5. BD Ventas 2025 (cia2025)
        $dbName25 = defined('DB_NAME_AQP25') ? DB_NAME_AQP25 : (defined('DB_NAME_2025') ? DB_NAME_2025 : '');
        if (!empty($dbName25)) {
            $this->secondaryConnections['2025'] = [
                'host'     => defined('DB_HOST_AQP25') ? DB_HOST_AQP25 : (defined('DB_HOST_2025') ? DB_HOST_2025 : $this->host),
                'db_name'  => $dbName25,
                'username' => defined('DB_USER_AQP25') ? DB_USER_AQP25 : (defined('DB_USER_2025') ? DB_USER_2025 : $this->username),
                'password' => defined('DB_PASSWORD_AQP25') ? DB_PASSWORD_AQP25 : (defined('DB_PASSWORD_2025') ? DB_PASSWORD_2025 : $this->password)
            ];
        }
    }

    private function loadLocalConfig($localEnvFile) {
        // ENTORNO LOCAL (Desarrollo)
        $env = parse_ini_file($localEnvFile);
        $this->host     = isset($env['DB_HOST']) ? $env['DB_HOST'] : '127.0.0.1';
        $this->db_name  = isset($env['DB_NAME']) ? $env['DB_NAME'] : '';
        $this->username = isset($env['DB_USER']) ? $env['DB_USER'] : 'root';
        $this->password = isset($env['DB_PASS']) ? $env['DB_PASS'] : '';

        // Conexiones secundarias opcionales en local si se configuran en .env
        if (!empty($env['DB_NAME_TA'])) {
            $this->secondaryConnections['ta'] = [
                'host'     => isset($env['DB_HOST_TA']) ? $env['DB_HOST_TA'] : $this->host,
                'db_name'  => $env['DB_NAME_TA'],
                'username' => isset($env['DB_USER_TA']) ? $env['DB_USER_TA'] : $this->username,
                'password' => isset($env['DB_PASS_TA']) ? $env['DB_PASS_TA'] : $this->password
            ];
        }

        if (!empty($env['DB_NAME_TC'])) {
            $this->secondaryConnections['tc'] = [
                'host'     => isset($env['DB_HOST_TC']) ? $env['DB_HOST_TC'] : $this->host,
                'db_name'  => $env['DB_NAME_TC'],
                'username' => isset($env['DB_USER_TC']) ? $env['DB_USER_TC'] : $this->username,
                'password' => isset($env['DB_PASS_TC']) ? $env['DB_PASS_TC'] : $this->password
            ];
        }

        if (!empty($env['DB_NAME_2024'])) {
            $this->secondaryConnections['2024'] = [
                'host'     => isset($env['DB_HOST_2024']) ? $env['DB_HOST_2024'] : $this->host,
                'db_name'  => $env['DB_NAME_2024'],
                'username' => isset($env['DB_USER_2024']) ? $env['DB_USER_2024'] : $this->username,
                'password' => isset($env['DB_PASS_2024']) ? $env['DB_PASS_2024'] : $this->password
            ];
        }

        if (!empty($env['DB_NAME_2025'])) {
            $this->secondaryConnections['2025'] = [
                'host'     => isset($env['DB_HOST_2025']) ? $env['DB_HOST_2025'] : $this->host,
                'db_name'  => $env['DB_NAME_2025'],
                'username' => isset($env['DB_USER_2025']) ? $env['DB_USER_2025'] : $this->username,
                'password' => isset($env['DB_PASS_2025']) ? $env['DB_PASS_2025'] : $this->password
            ];
        }
    }

    public function getConnection() {
        if ($this->conn !== null) {
            return $this->conn;
        }

        try {
            $this->conn = new SmartPDO(
                "mysql:host=" . $this->host . ";dbname=" . $this->db_name . ";charset=utf8mb4",
                $this->username,
                $this->password,
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                    PDO::ATTR_EMULATE_PREPARES   => false
                ]
            );

            foreach ($this->secondaryConnections as $key => $creds) {
                $this->conn->registerConnection($key, $creds);
            }

        } catch (PDOException $e) {
            die("Error de conexión a la BD: " . $e->getMessage());
        }

        return $this->conn;
    }
}