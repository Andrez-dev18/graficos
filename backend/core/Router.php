<?php
// backend/core/Router.php

class Router
{
    private $routes = [];

    // Carga TODOS los archivos routes.php sin importar qué tan anidados estén en subcarpetas
    public function loadModules()
    {
        $modulesPath = __DIR__ . '/../modules/';
        
        // Iterador recursivo para escanear directorios y subdirectorios
        $iterator = new RecursiveDirectoryIterator($modulesPath, RecursiveDirectoryIterator::SKIP_DOTS);
        $files = new RecursiveIteratorIterator($iterator);

        foreach ($files as $file) {
            if ($file->getFilename() === 'routes.php') {
                require $file->getPathname(); // Aquí $this estará disponible
            }
        }
    }

    // Registra una ruta GET
    public function get($path, $controllerAction)
    {
        $this->routes['GET'][$path] = $controllerAction;
    }

    // Registra una ruta POST
    public function post($path, $controllerAction)
    {
        $this->routes['POST'][$path] = $controllerAction;
    }

    // Ejecuta la ruta
    public function dispatch()
    {
        $uri = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        $method = $_SERVER['REQUEST_METHOD'];

        // 1. Limpiamos la ruta base
        $basePath = '/graficos/backend';
        $path = str_replace($basePath, '', $uri);

        if (isset($this->routes[$method][$path])) {
            $action = $this->routes[$method][$path];
            list($controllerName, $methodName) = explode('@', $action);

            // 2. Extraemos todas las partes de la URL
            $pathParts = explode('/', trim($path, '/'));
            $modulePath = '';
            $baseModulesPath = __DIR__ . '/../modules/';

            // 3. Magia Pura: Reconstruimos la ruta de la carpeta dinámicamente
            // El router avanzará carpeta por carpeta hasta chocar con el nombre de la acción (ej. 'listar')
            foreach ($pathParts as $part) {
                // Bloqueo de seguridad estricto contra Directory Traversal
                if ($part === '.' || $part === '..') {
                    continue; 
                }

                if (is_dir($baseModulesPath . $modulePath . $part)) {
                    $modulePath .= $part . '/';
                } else {
                    break; 
                }
            }

            // 4. Requerimos el archivo en su ubicación exacta anidada
            $controllerPath = $baseModulesPath . $modulePath . $controllerName . '.php';

            if (!file_exists($controllerPath)) {
                foreach ($pathParts as $part) {
                    $singular = rtrim($part, 's');
                    if (file_exists($baseModulesPath . $singular . '/' . $controllerName . '.php')) {
                        $controllerPath = $baseModulesPath . $singular . '/' . $controllerName . '.php';
                        break;
                    }
                }
            }

            if (file_exists($controllerPath)) {
                require_once $controllerPath;
                $controller = new $controllerName();
                $controller->$methodName();
            } else {
                http_response_code(500);
                echo json_encode(["error" => "Controlador {$controllerName} no encontrado en la ruta: modules/{$modulePath}"]);
            }
        } else {
            http_response_code(404);
            echo json_encode(["error" => "Ruta no encontrada: " . $path]);
        }
    }
}