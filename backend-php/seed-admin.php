<?php
// =============================================================================
//  SEED-ADMIN.PHP  ·  Crea (o actualiza) un usuario administrador.
//  Uso:  php seed-admin.php  email@dominio.com  "contraseña"  ["Nombre"] ["Apellidos"] [uid]
//  Ej.:  php seed-admin.php jsersan@gmail.com "MiClave123" "Txema" "Serrano" 21m6mMuCAieZ7ZpcR2xfm9kH9yc2
// =============================================================================

$config = require __DIR__ . '/config.php';
require __DIR__ . '/helpers.php';
require __DIR__ . '/db.php';
DB::init($config);

$email = $argv[1] ?? null;
$pass  = $argv[2] ?? null;
if (!$email || !$pass) {
    fwrite(STDERR, "Uso: php seed-admin.php email contraseña [nombre] [apellidos] [uid]\n");
    exit(1);
}
$nombre    = $argv[3] ?? 'Admin';
$apellidos = $argv[4] ?? '';
$uid       = $argv[5] ?? Repo::pushId();

$hash = password_hash($pass, PASSWORD_BCRYPT);

$perfil = [
    'uid' => $uid, 'email' => $email, 'nombre' => $nombre, 'apellidos' => $apellidos,
    'rol' => 'admin', 'centroId' => 'default',
    'modulosIds' => [], 'gruposIds' => [], 'esTutor' => false, 'activo' => true,
    'configuracion' => [
        'idioma' => 'es', 'temaOscuro' => false,
        'notificacionesEmail' => true, 'notificacionesPush' => false,
        'vistaCalificaciones' => 'tabla',
    ],
];

$pdo = DB::pdo();
$stmt = $pdo->prepare(
    "INSERT INTO usuarios (id, email, password_hash, data) VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE email = VALUES(email), password_hash = VALUES(password_hash), data = VALUES(data)"
);
$stmt->execute([$uid, $email, $hash, json_encode($perfil, JSON_UNESCAPED_UNICODE)]);

echo "✅ Admin listo: $email  (uid: $uid)\n";
