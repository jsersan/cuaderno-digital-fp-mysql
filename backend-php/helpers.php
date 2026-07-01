<?php
// =============================================================================
//  HELPERS  ·  Respuestas JSON, CORS y autenticación por token firmado
// =============================================================================

class Response
{
    public static function json($data, int $code = 200): void
    {
        http_response_code($code);
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode($data, JSON_UNESCAPED_UNICODE);
        exit;
    }

    public static function error(int $code, string $message): void
    {
        self::json(['error' => $message], $code);
    }
}

class Cors
{
    public static function handle(array $origins): void
    {
        $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
        if (in_array($origin, $origins, true)) {
            header("Access-Control-Allow-Origin: $origin");
        }
        header('Access-Control-Allow-Methods: GET, POST, PUT, PATCH, DELETE, OPTIONS');
        header('Access-Control-Allow-Headers: Content-Type, Authorization');
        header('Access-Control-Allow-Credentials: true');
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
            http_response_code(204);
            exit;
        }
    }
}

// -----------------------------------------------------------------------------
//  Token de sesión: base64url(payload).firmaHMAC   (sin dependencias externas)
// -----------------------------------------------------------------------------
class Auth
{
    private static string $secret = '';
    private static int $ttl = 604800;

    public static function init(string $secret, int $ttl): void
    {
        self::$secret = $secret;
        self::$ttl = $ttl;
    }

    private static function b64(string $s): string
    {
        return rtrim(strtr(base64_encode($s), '+/', '-_'), '=');
    }
    private static function unb64(string $s): string
    {
        return base64_decode(strtr($s, '-_', '+/'));
    }

    public static function makeToken(array $payload): string
    {
        $payload['exp'] = time() + self::$ttl;
        $body = self::b64(json_encode($payload, JSON_UNESCAPED_UNICODE));
        $sig  = self::b64(hash_hmac('sha256', $body, self::$secret, true));
        return "$body.$sig";
    }

    /** Devuelve el payload si el token es válido, o null. */
    public static function verify(?string $token): ?array
    {
        if (!$token) return null;
        $parts = explode('.', $token);
        if (count($parts) !== 2) return null;
        [$body, $sig] = $parts;
        $expected = self::b64(hash_hmac('sha256', $body, self::$secret, true));
        if (!hash_equals($expected, $sig)) return null;
        $payload = json_decode(self::unb64($body), true);
        if (!is_array($payload)) return null;
        if (($payload['exp'] ?? 0) < time()) return null;
        return $payload;
    }

    /** Lee el token de la cabecera Authorization: Bearer xxx */
    public static function bearer(): ?string
    {
        $headers = function_exists('getallheaders') ? getallheaders() : [];
        $auth = $headers['Authorization'] ?? $headers['authorization']
              ?? ($_SERVER['HTTP_AUTHORIZATION'] ?? '');
        if (stripos($auth, 'Bearer ') === 0) {
            return trim(substr($auth, 7));
        }
        return null;
    }

    /** Exige usuario autenticado; corta con 401 si no lo hay. */
    public static function requireAuth(): array
    {
        $payload = self::verify(self::bearer());
        if (!$payload) Response::error(401, 'No autenticado');
        return $payload;
    }
}

/** Lee y decodifica el cuerpo JSON de la petición. */
function body_json(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === '' || $raw === false) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}
