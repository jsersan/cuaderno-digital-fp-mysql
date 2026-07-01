<?php
// =============================================================================
//  ROUTES_AUTH.PHP  ·  login / register / me
//  Sustituye a Firebase Auth. Contraseñas con password_hash() (bcrypt).
// =============================================================================

function handle_auth(string $method, array $segments, array $config): void
{
    $accion = $segments[1] ?? '';
    $pdo = DB::pdo();

    // ---------------- LOGIN ----------------
    if ($accion === 'login' && $method === 'POST') {
        $b = body_json();
        $email = trim((string) ($b['email'] ?? ''));
        $pass  = (string) ($b['password'] ?? '');
        if ($email === '' || $pass === '') Response::error(400, 'Email y contraseña requeridos');

        $stmt = $pdo->prepare("SELECT id, email, password_hash, data FROM usuarios WHERE email = ?");
        $stmt->execute([$email]);
        $row = $stmt->fetch();

        if (!$row || !$row['password_hash'] || !password_verify($pass, $row['password_hash'])) {
            Response::error(401, 'Credenciales incorrectas');
        }

        $user = json_decode($row['data'], true) ?: [];
        $user['id'] = $row['id'];
        $user['uid'] = $row['id'];
        $user['email'] = $row['email'];

        if (($user['activo'] ?? true) === false) {
            Response::error(403, 'Tu cuenta ha sido desactivada. Contacta con el administrador.');
        }

        $token = Auth::makeToken(['uid' => $row['id'], 'email' => $row['email']]);
        Response::json(['token' => $token, 'user' => $user]);
    }

    // ---------------- REGISTER ----------------
    if ($accion === 'register' && $method === 'POST') {
        $b = body_json();
        $email = trim((string) ($b['email'] ?? ''));
        $pass  = (string) ($b['password'] ?? '');
        if ($email === '' || strlen($pass) < 6) {
            Response::error(400, 'Email válido y contraseña de 6+ caracteres requeridos');
        }

        $stmt = $pdo->prepare("SELECT id FROM usuarios WHERE email = ?");
        $stmt->execute([$email]);
        if ($stmt->fetch()) Response::error(409, 'Este email ya está registrado.');

        $uid = $b['uid'] ?? Repo::pushId();
        $hash = password_hash($pass, PASSWORD_BCRYPT);

        // Perfil por defecto; se fusiona con lo que envíe el cliente
        $perfil = array_merge([
            'uid' => $uid,
            'email' => $email,
            'nombre' => $b['nombre'] ?? '',
            'apellidos' => $b['apellidos'] ?? '',
            'rol' => $b['rol'] ?? 'profesor',
            'centroId' => $b['centroId'] ?? 'default',
            'modulosIds' => [],
            'gruposIds' => [],
            'esTutor' => false,
            'activo' => true,
            'configuracion' => [
                'idioma' => 'es',
                'temaOscuro' => false,
                'notificacionesEmail' => true,
                'notificacionesPush' => false,
                'vistaCalificaciones' => 'tabla',
            ],
        ], array_diff_key($b, array_flip(['password'])));

        $stmt = $pdo->prepare(
            "INSERT INTO usuarios (id, email, password_hash, data) VALUES (?, ?, ?, ?)"
        );
        $stmt->execute([$uid, $email, $hash, json_encode($perfil, JSON_UNESCAPED_UNICODE)]);

        $perfil['id'] = $uid;
        $token = Auth::makeToken(['uid' => $uid, 'email' => $email]);
        Response::json(['token' => $token, 'user' => $perfil], 201);
    }

    // ---------------- ME ----------------
    if ($accion === 'me' && $method === 'GET') {
        $payload = Auth::requireAuth();
        $stmt = $pdo->prepare("SELECT id, email, data FROM usuarios WHERE id = ?");
        $stmt->execute([$payload['uid']]);
        $row = $stmt->fetch();
        if (!$row) Response::error(404, 'Usuario no encontrado');
        $user = json_decode($row['data'], true) ?: [];
        $user['id'] = $row['id'];
        $user['uid'] = $row['id'];
        $user['email'] = $row['email'];
        Response::json($user);
    }

    Response::error(404, 'Acción de auth no encontrada');
}
