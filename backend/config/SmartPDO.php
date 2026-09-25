<?php
/**
 * SmartPDO & SmartPDOStatement
 * Multi-Database Proxy con fallback automático entre conexiones (Principal, TA, TC) y caché en memoria.
 *
 * Compatible con PHP 7.x y PHP 8.x
 */

class SmartPDO extends PDO
{
    private $connections = [];
    private $credentials = [];
    
    // Caché estática en memoria de rutas de tablas: [nombre_tabla => connection_key]
    public static $tableRouteCache = [];

    public function __construct($dsn, $username = null, $password = null, $options = null)
    {
        $defaultOptions = [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false
        ];

        parent::__construct($dsn, $username, $password, $options !== null ? $options : $defaultOptions);
        $this->connections['principal'] = $this;
    }

    /**
     * Registra credenciales de una conexión secundaria para conexión bajo demanda (lazy-loading)
     */
    public function registerConnection($key, $creds)
    {
        $this->credentials[$key] = $creds;
    }

    /**
     * Obtiene o instancia la conexión PDO correspondiente
     */
    public function getConnection($key)
    {
        if ($key === 'principal') {
            return $this;
        }

        if (isset($this->connections[$key])) {
            return $this->connections[$key];
        }

        if (isset($this->credentials[$key])) {
            $c = $this->credentials[$key];
            if (empty($c['host']) || empty($c['db_name'])) {
                return null;
            }

            try {
                $pdo = new PDO(
                    "mysql:host=" . $c['host'] . ";dbname=" . $c['db_name'] . ";charset=utf8mb4",
                    isset($c['username']) ? $c['username'] : '',
                    isset($c['password']) ? $c['password'] : '',
                    [
                        PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                        PDO::ATTR_EMULATE_PREPARES   => false
                    ]
                );
                $this->connections[$key] = $pdo;
                return $pdo;
            } catch (Exception $e) {
                error_log("SmartPDO: No se pudo conectar a la BD secundaria [" . $key . "]: " . $e->getMessage());
                return null;
            }
        }

        return null;
    }

    /**
     * Prepara una sentencia PDOStatement nativa sobre la conexión especificada
     */
    public function prepareNative($key, $sql, $options = [])
    {
        if ($key === 'principal') {
            return parent::prepare($sql, $options !== null ? $options : []);
        }

        $pdo = $this->getConnection($key);
        if (!$pdo) {
            throw new PDOException("No se pudo obtener la conexión nativa [" . $key . "]");
        }

        return $pdo->prepare($sql, $options !== null ? $options : []);
    }

    /**
     * Retorna todas las claves de conexión configuradas en orden de prioridad
     */
    public function getAllAvailableConnectionKeys()
    {
        $keys = array_unique(array_merge(array_keys($this->connections), array_keys($this->credentials)));
        $order = ['principal', 'ta', 'tc'];
        usort($keys, function ($a, $b) use ($order) {
            $posA = array_search($a, $order);
            $posB = array_search($b, $order);
            $posA = ($posA === false) ? 99 : $posA;
            $posB = ($posB === false) ? 99 : $posB;
            return $posA <=> $posB;
        });
        return $keys;
    }

    /**
     * Sugiere la conexión preferida según los nombres de tablas conocidas
     */
    public static function getPreferredConnectionForTables(array $tables)
    {
        foreach ($tables as $tbl) {
            $tblLower = strtolower($tbl);
            // Tablas comerciales -> 'tc' (grs_dmcomercial)
            if (strpos($tblLower, 'dmdocventas') !== false ||
                strpos($tblLower, 'dmventas') !== false ||
                strpos($tblLower, 'dmmetas') !== false ||
                strpos($tblLower, 'dmclientes') !== false) {
                return 'tc';
            }
            // Tablas de almacén / producción / mermas / transporte -> 'ta' (grs_dmalmacen)
            if (strpos($tblLower, 'dmmerma') !== false ||
                strpos($tblLower, 'dmruta') !== false ||
                strpos($tblLower, 'dmagente') !== false ||
                strpos($tblLower, 'dmtransporte') !== false ||
                strpos($tblLower, 'dmcostofamilia') !== false ||
                strpos($tblLower, 'dmalmacen') !== false) {
                return 'ta';
            }
        }
        return null;
    }

    #[\ReturnTypeWillChange]
    public function prepare($query, $options = [])
    {
        return new SmartPDOStatement($this, $query, $options !== null ? $options : []);
    }

    #[\ReturnTypeWillChange]
    public function query($statement, ...$args)
    {
        $stmt = new SmartPDOStatement($this, $statement);
        $stmt->execute();
        return $stmt;
    }

    #[\ReturnTypeWillChange]
    public function exec($statement)
    {
        $stmt = new SmartPDOStatement($this, $statement);
        $stmt->execute();
        return $stmt->rowCount();
    }
}

class SmartPDOStatement
{
    private $smartPDO;
    private $sql;
    private $options;
    private $boundValues = [];
    private $boundParams = [];
    private $activeStmt = null;
    private $activeConnectionKey = null;

    public function __construct($smartPDO, $sql, $options = [])
    {
        $this->smartPDO = $smartPDO;
        $this->sql = $sql;
        $this->options = $options;
    }

    public function bindValue($param, $value, $type = PDO::PARAM_STR)
    {
        $this->boundValues[$param] = [$value, $type];
        return true;
    }

    public function bindParam($param, &$var, $type = PDO::PARAM_STR, $maxLength = null, $driverOptions = null)
    {
        $this->boundParams[$param] = [&$var, $type, $maxLength, $driverOptions];
        return true;
    }

    private function extractTables($sql)
    {
        $tables = [];
        if (preg_match_all('/(?:FROM|JOIN|INTO|UPDATE)\s+[`]?([a-zA-Z0-9_\.]+)[`]?/i', $sql, $matches)) {
            foreach ($matches[1] as $tbl) {
                $parts = explode('.', $tbl);
                $tables[] = strtolower(end($parts));
            }
        }
        return array_unique($tables);
    }

    private function isWriteQuery($sql)
    {
        $trimmed = ltrim($sql);
        return (bool) preg_match('/^(INSERT|UPDATE|DELETE|REPLACE|CREATE|DROP|ALTER|TRUNCATE)/i', $trimmed);
    }

    public function execute($params = null)
    {
        $tables = $this->extractTables($this->sql);
        $availableKeys = $this->smartPDO->getAllAvailableConnectionKeys();

        // 1. Si es consulta de escritura, se ejecuta directamente en la BD Principal (o la conexión conocida)
        if ($this->isWriteQuery($this->sql)) {
            $stmt = $this->smartPDO->prepareNative('principal', $this->sql, $this->options);
            $this->applyBindings($stmt, $params);
            $result = $stmt->execute($params);
            $this->activeStmt = $stmt;
            $this->activeConnectionKey = 'principal';
            return $result;
        }

        // 2. Ordenar conexiones candidatas según caché y dominio de tablas
        $orderedKeys = $availableKeys;
        $cachedKey = null;

        foreach ($tables as $tbl) {
            if (isset(SmartPDO::$tableRouteCache[$tbl])) {
                $cachedKey = SmartPDO::$tableRouteCache[$tbl];
                break;
            }
        }

        if ($cachedKey && in_array($cachedKey, $orderedKeys)) {
            $orderedKeys = array_diff($orderedKeys, [$cachedKey]);
            array_unshift($orderedKeys, $cachedKey);
        } else {
            $preferredKey = SmartPDO::getPreferredConnectionForTables($tables);
            if ($preferredKey && in_array($preferredKey, $orderedKeys)) {
                $orderedKeys = array_diff($orderedKeys, [$preferredKey]);
                array_unshift($orderedKeys, $preferredKey);
            }
        }

        // 3. Ejecución en cascada (resolución y fallback dinámico)
        $lastException = null;

        foreach ($orderedKeys as $connKey) {
            try {
                $stmt = $this->smartPDO->prepareNative($connKey, $this->sql, $this->options);
                $this->applyBindings($stmt, $params);
                $stmt->execute($params);

                // ¡Éxito! Esta base de datos tiene la tabla y ejecutó la consulta
                $this->activeStmt = $stmt;
                $this->activeConnectionKey = $connKey;

                // Memorizar la ruta ganadora para las tablas involucradas
                foreach ($tables as $tbl) {
                    SmartPDO::$tableRouteCache[$tbl] = $connKey;
                }
                return true;

            } catch (PDOException $e) {
                $lastException = $e;
                $msg = $e->getMessage();
                $errCode = isset($e->errorInfo[1]) ? (int)$e->errorInfo[1] : (int)$e->getCode();
                $sqlState = isset($e->errorInfo[0]) ? (string)$e->errorInfo[0] : '';
                
                // 1146 = Table doesn't exist, 42S02 = Base table or view not found
                $isTableNotFound = ($errCode === 1146 || $sqlState === '42S02' || stripos($msg, "doesn't exist") !== false || stripos($msg, "Base table or view not found") !== false);
                // 1054 = Unknown column, 42S22 = Column not found
                $isColumnNotFound = ($errCode === 1054 || $sqlState === '42S22' || stripos($msg, "Unknown column") !== false || stripos($msg, "Column not found") !== false);
                // 1142 = command denied, 1044/1045 = access denied
                $isPermissionDenied = ($errCode === 1142 || $sqlState === '42000' || stripos($msg, "command denied") !== false || stripos($msg, "Access denied") !== false);
                // 2002/2003 = Connection failed / host unreachable
                $isConnectionFailed = ($errCode === 2002 || $errCode === 2003 || stripos($msg, "No se pudo obtener la conexión") !== false);

                if ($isTableNotFound || $isColumnNotFound || $isPermissionDenied || $isConnectionFailed) {
                    // Saltar inmediatamente a la siguiente conexión candidata
                    continue;
                }

                // Si es otro tipo de error (ej. error de sintaxis SQL real), lanzarlo
                throw $e;
            }
        }

        // Si falló en todas las conexiones disponibles, lanzar la excepción final
        if ($lastException) {
            throw $lastException;
        }

        return false;
    }

    private function applyBindings($stmt, $params)
    {
        // Si no se pasaron $params en execute(), aplicamos los bindValue registrados
        if ($params === null && !empty($this->boundValues)) {
            foreach ($this->boundValues as $param => $info) {
                $stmt->bindValue($param, $info[0], $info[1]);
            }
        }

        // Aplicamos los bindParam registrados
        if (!empty($this->boundParams)) {
            foreach ($this->boundParams as $param => &$info) {
                $stmt->bindParam($param, $info[0], $info[1], isset($info[2]) ? $info[2] : 0, isset($info[3]) ? $info[3] : null);
            }
        }
    }

    public function fetchAll(...$args)
    {
        if (!$this->activeStmt) return [];
        return $this->activeStmt->fetchAll(...$args);
    }

    public function fetch(...$args)
    {
        if (!$this->activeStmt) return false;
        return $this->activeStmt->fetch(...$args);
    }

    public function fetchColumn($column = 0)
    {
        if (!$this->activeStmt) return false;
        return $this->activeStmt->fetchColumn($column);
    }

    public function rowCount()
    {
        if (!$this->activeStmt) return 0;
        return $this->activeStmt->rowCount();
    }

    public function closeCursor()
    {
        if (!$this->activeStmt) return true;
        return $this->activeStmt->closeCursor();
    }

    public function columnCount()
    {
        if (!$this->activeStmt) return 0;
        return $this->activeStmt->columnCount();
    }
}
