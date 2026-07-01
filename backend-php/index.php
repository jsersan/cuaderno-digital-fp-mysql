<?php
// =============================================================================
//  INDEX.PHP  ·  Front controller / router REST
//  CORS se emite LO PRIMERO para que el preflight (OPTIONS) siempre responda,
//  aunque algo falle después. Parseo de ruta compatible con PHP 7 y tolerante
//  a que no haya mod_rewrite (admite index.php/... y ?path=...).
// =============================================================================

declare(strict_types=1);

// ---------- CORS (antes de cargar nada más) ----------
$__allowed = ['http://localhost:4200', 'http://127.0.0.1:4200'];
$__origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
header('Access-Control-Allow-Origin: ' . (in_array($__origin, $__allowed, true) ? $__origin : '*'));
header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');
header('Vary: Origin');
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$config = require __DIR__ . '/config.php';
require __DIR__ . '/helpers.php';
require __DIR__ . '/db.php';

DB::init($config);
Auth::init($config['jwt_secret'], $config['token_ttl']);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

// ---------- Resolver la ruta ----------
$uri    = parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?? '/';
$script = $_SERVER['SCRIPT_NAME'] ?? '';          // p.ej. /cuaderno-backend/index.php
$base   = rtrim(dirname($script), '/');           // p.ej. /cuaderno-backend
$path   = $uri;
if ($base !== '' && strpos($path, $base) === 0) {
    $path = substr($path, strlen($base));
}
$path = ltrim($path, '/');
// Si no hay mod_rewrite y se accede vía index.php/... o index.php
if (strpos($path, 'index.php') === 0) {
    $path = ltrim(substr($path, strlen('index.php')), '/');
}
// Alternativa explícita: ?path=coleccion/id
if (isset($_GET['path'])) {
    $path = trim((string) $_GET['path'], '/');
}
$path = trim($path, '/');

// Sufijo ":query"
$queryMode = false;
if (substr($path, -6) === ':query') {
    $queryMode = true;
    $path = substr($path, 0, -6);
}

$segments = $path === '' ? [] : explode('/', $path);

try {
    // ---------------- AUTH ----------------
    if (($segments[0] ?? '') === 'auth') {
        require __DIR__ . '/routes_auth.php';
        handle_auth($method, $segments, $config);
        exit;
    }

    // ---------------- DATOS (requiere login) ----------------
    Auth::requireAuth();

    if (count($segments) === 0) {
        Response::error(404, 'Ruta no encontrada');
    }

    $coleccion = $segments[0];

    // --- Subcolección: /{col}/{id}/{sub}[/{subId}] ---
    if (count($segments) >= 3) {
        $subPath = implode('/', array_slice($segments, 0, 3)); // col/id/sub
        $subId   = $segments[3] ?? null;
        switch ($method) {
            case 'GET':
                Response::json($subId ? SubRepo::get($subPath, $subId) : SubRepo::all($subPath));
            case 'PUT':
            case 'PATCH':
                if (!$subId) Response::error(400, 'Falta id del subdocumento');
                SubRepo::set($subPath, $subId, body_json());
                Response::json(['ok' => true]);
            case 'DELETE':
                if (!$subId) Response::error(400, 'Falta id del subdocumento');
                SubRepo::delete($subPath, $subId);
                Response::json(['ok' => true]);
            default:
                Response::error(405, 'Método no permitido');
        }
    }

    // --- Colección de primer nivel ---
    DB::assertCollection($coleccion);
    $id = $segments[1] ?? null;

    if ($queryMode && $method === 'POST') {
        $b = body_json();
        Response::json(Repo::query(
            $coleccion,
            $b['filters'] ?? [],
            $b['orderBy'] ?? [],
            isset($b['limit']) ? (int) $b['limit'] : null
        ));
    }

    switch ($method) {
        case 'GET':
            if ($id) {
                $doc = Repo::get($coleccion, $id);
                $doc ? Response::json($doc) : Response::error(404, 'No encontrado');
            }
            Response::json(Repo::all($coleccion));

        case 'POST':
            $newId = Repo::create($coleccion, body_json());
            Response::json(['id' => $newId], 201);

        case 'PUT':
            if (!$id) Response::error(400, 'Falta id');
            Repo::set($coleccion, $id, body_json());
            Response::json(['ok' => true, 'id' => $id]);

        case 'PATCH':
            if (!$id) Response::error(400, 'Falta id');
            Repo::merge($coleccion, $id, body_json());
            Response::json(['ok' => true, 'id' => $id]);

        case 'DELETE':
            if (!$id) Response::error(400, 'Falta id');
            Repo::delete($coleccion, $id);
            Response::json(['ok' => true]);

        default:
            Response::error(405, 'Método no permitido');
    }
} catch (PDOException $e) {
    Response::error(500, 'Error de base de datos: ' . $e->getMessage());
} catch (Throwable $e) {
    Response::error(500, 'Error: ' . $e->getMessage());
}
