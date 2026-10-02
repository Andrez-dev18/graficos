<?php

declare(strict_types=1);

session_start();

$loggedIn = !empty($_SESSION['active']);
$userDisplay = htmlspecialchars(
    (string) ($_SESSION['nombre'] ?? $_SESSION['usuario'] ?? ''),
    ENT_QUOTES,
    'UTF-8'
);

$scriptDir = str_replace('\\', '/', dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '')));
$appRoot = dirname($scriptDir, 4);
if ($appRoot === '/' || $appRoot === '.') {
    $appRoot = '';
}
$loginHandlerUrl = rtrim($appRoot, '/') . '/login_handler.php';
$logoutUrl = rtrim($appRoot, '/') . '/logout.php?return=' . rawurlencode(ltrim((string) ($_SERVER['SCRIPT_NAME'] ?? ''), '/'));
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>SIP — API Gráficas</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <style>
        html { box-sizing: border-box; }
        *, *::before, *::after { box-sizing: inherit; }
        body { margin: 0; background: #f1f5f9; font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif; }

        .sip-api-bar {
            background: linear-gradient(135deg, #003087 0%, #2563eb 100%);
            color: #fff;
            padding: 0.85rem 1rem;
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.75rem 1.25rem;
            box-shadow: 0 2px 12px rgba(0, 0, 0, 0.12);
        }

        .sip-api-brand { min-width: 0; flex: 1 1 12rem; }
        .sip-api-brand h1 {
            margin: 0;
            font-size: 1.15rem;
            font-weight: 800;
            letter-spacing: 0.06em;
        }
        .sip-api-brand p {
            margin: 0.15rem 0 0;
            font-size: 0.72rem;
            color: rgba(255, 255, 255, 0.88);
            line-height: 1.35;
        }

        .sip-api-auth {
            display: flex;
            flex-wrap: wrap;
            align-items: center;
            gap: 0.45rem;
            flex: 2 1 18rem;
            justify-content: flex-end;
        }

        .sip-api-auth input {
            border: 1px solid rgba(255, 255, 255, 0.35);
            background: rgba(255, 255, 255, 0.14);
            color: #fff;
            border-radius: 0.5rem;
            padding: 0.45rem 0.65rem;
            font-size: 0.82rem;
            min-width: 7rem;
        }
        .sip-api-auth input::placeholder { color: rgba(255, 255, 255, 0.65); }
        .sip-api-auth input:focus {
            outline: none;
            border-color: #fff;
            background: rgba(255, 255, 255, 0.22);
        }

        .sip-api-btn {
            border: 1px solid rgba(255, 255, 255, 0.35);
            background: rgba(255, 255, 255, 0.18);
            color: #fff;
            border-radius: 0.5rem;
            padding: 0.45rem 0.85rem;
            font-size: 0.82rem;
            font-weight: 600;
            cursor: pointer;
        }
        .sip-api-btn:hover { background: rgba(255, 255, 255, 0.28); }
        .sip-api-btn-primary { background: #fff; color: #1e3a8a; border-color: #fff; }
        .sip-api-btn-primary:hover { background: #eff6ff; }

        .sip-api-session {
            display: flex;
            align-items: center;
            gap: 0.65rem;
            font-size: 0.82rem;
        }
        .sip-api-session a { color: #fff; text-decoration: underline; }

        .sip-api-msg {
            width: 100%;
            font-size: 0.78rem;
            color: #fecaca;
            display: none;
        }
        .sip-api-msg.visible { display: block; }

        #swagger-ui { padding: 0 0 1rem; }
    </style>
</head>
<body>
    <header class="sip-api-bar">
        <div class="sip-api-brand">
            <h1>SIP</h1>
            <p>API Gráficas SIP</p>
        </div>

        <?php if ($loggedIn): ?>
        <div class="sip-api-auth sip-api-session">
            <span><i class="fas fa-user-check" aria-hidden="true"></i> Sesión: <strong><?= $userDisplay ?></strong></span>
            <a href="./openapi.php?format=yaml" target="_blank" rel="noopener">OpenAPI YAML</a>
            <a href="<?= htmlspecialchars($logoutUrl, ENT_QUOTES, 'UTF-8') ?>">Cerrar sesión</a>
        </div>
        <?php else: ?>
        <form class="sip-api-auth" id="sipApiLoginForm" autocomplete="on">
            <input type="text" id="sipApiUsuario" name="usuario" placeholder="Usuario" required autocomplete="username">
            <input type="password" id="sipApiClave" name="clave" placeholder="Contraseña" required autocomplete="current-password">
            <button type="submit" class="sip-api-btn sip-api-btn-primary">Ingresar</button>
        </form>
        <p class="sip-api-msg" id="sipApiLoginMsg" role="alert"></p>
        <?php endif; ?>
    </header>

    <div id="swagger-ui"></div>

    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js"></script>
    <script>
        (function () {
            var loginHandlerUrl = <?= json_encode($loginHandlerUrl, JSON_UNESCAPED_SLASHES) ?>;

            var loginForm = document.getElementById('sipApiLoginForm');
            if (loginForm) {
                loginForm.addEventListener('submit', async function (ev) {
                    ev.preventDefault();
                    var msg = document.getElementById('sipApiLoginMsg');
                    if (msg) {
                        msg.textContent = '';
                        msg.classList.remove('visible');
                    }
                    var fd = new FormData();
                    fd.append('usuario', document.getElementById('sipApiUsuario').value.trim());
                    fd.append('clave', document.getElementById('sipApiClave').value.trim());
                    try {
                        var res = await fetch(loginHandlerUrl, { method: 'POST', body: fd, credentials: 'include' });
                        var data = await res.json();
                        if (data.success) {
                            window.location.reload();
                            return;
                        }
                        if (msg) {
                            msg.textContent = data.message || 'No se pudo iniciar sesión';
                            msg.classList.add('visible');
                        }
                    } catch (e) {
                        if (msg) {
                            msg.textContent = 'Error de conexión';
                            msg.classList.add('visible');
                        }
                    }
                });
            }

            function initSwagger(spec) {
                SwaggerUIBundle({
                    spec: spec,
                    dom_id: '#swagger-ui',
                    deepLinking: true,
                    presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
                    layout: 'StandaloneLayout',
                    docExpansion: 'list',
                    requestInterceptor: function (req) {
                        req.credentials = 'include';
                        return req;
                    }
                });
            }

            fetch('./openapi.php?format=json', { credentials: 'include' })
                .then(function (res) { return res.json(); })
                .then(function (spec) {
                    if (!spec || !spec.openapi) {
                        throw new Error((spec && spec.message) ? spec.message : 'Respuesta OpenAPI inválida');
                    }
                    initSwagger(spec);
                })
                .catch(function (err) {
                    var el = document.getElementById('swagger-ui');
                    el.innerHTML = '<p style="padding:1rem;color:#b91c1c;">No se pudo cargar OpenAPI: '
                        + (err.message || 'error desconocido') + '</p>';
                });
        })();
    </script>
</body>
</html>
