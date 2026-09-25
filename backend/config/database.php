<?php
class Database {
    private $host;
    private $db_name;
    private $username;
    private $password;
    private $conn;

    public function __construct() {
        
        // 1. Ruta del archivo en el servidor de producción (Granja Rinconada del Sur)
        $prodConfigFile = $_SERVER['DOCUMENT_ROOT'] . '/conexion_grs/configuracion.ph';
        
        // 2. Ruta de tu archivo local (.env)
        $localEnvFile = __DIR__ . '/.env'; 

        // Verificamos en qué entorno estamos
        if (file_exists($prodConfigFile)) {
            // ==========================================
            // ENTORNO DE PRODUCCIÓN
            // ==========================================
            require_once $prodConfigFile;
            $this->host     = DB_HOST_AQP;
            $this->db_name  = DB_NAME_AQP;
            $this->username = DB_USER_AQP;
            $this->password = DB_PASSWORD_AQP;

        } elseif (file_exists($localEnvFile)) {
            // ==========================================
            // ENTORNO LOCAL (Desarrollo)
            // ==========================================
            $env = parse_ini_file($localEnvFile);
            $this->host     = $env['DB_HOST'];
            $this->db_name  = $env['DB_NAME'];
            $this->username = $env['DB_USER'];
            $this->password = $env['DB_PASS'];

        } else {
            // Si no encuentra ninguno, detenemos todo por seguridad
            die("Error crítico: No se encontró configuración de base de datos ni en producción ni en local.");
        }
    }

    public function getConnection() {
        $this->conn = null;
        try {
            // He fusionado tu conexión con los atributos de seguridad que ellos usan
            // utf8mb4 es mejor que utf8 porque soporta todos los caracteres (incluso emojis)
            $this->conn = new PDO(
                "mysql:host={$this->host};dbname={$this->db_name};charset=utf8mb4",
                $this->username,
                $this->password,
                [
                    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC, // Trae los datos limpios sin índices numéricos
                    PDO::ATTR_EMULATE_PREPARES   => false             // Mayor seguridad contra inyecciones SQL
                ]
            );
        } catch (PDOException $e) {
            // Usamos die() en vez de echo para que el script muera y no intente hacer consultas sin conexión
            die("Error de conexión a la BD."); 
            // Nota: En producción evita poner $e->getMessage() en el die() para no exponer la IP del host al público si falla
        }
        return $this->conn;
    }
}
?>