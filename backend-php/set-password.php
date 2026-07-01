<?php
// =============================================================================
//  SET-PASSWORD.PHP  ·  Pone/cambia la contraseña de un usuario EXISTENTE
//  buscándolo por su email, SIN tocar su uid (id) ni su perfil (data).
//
//  Úsalo para dar contraseña a los profesores migrados desde Firestore
//  (Firestore no guardaba contraseñas; las tenía Firebase Auth).
//
//  Uso:  php set-password.php  email@dominio.com  "contraseña"
//  Ej.:  php set-password.php  jsersan@gmail.com  "Jss12aoz#"
// =============================================================================

$config = require __DIR__ . '/config.php';
require __DIR__ . '/helpers.php';
require __DIR__ . '/db.php';
DB::init($config);

$email = $argv[1] ?? null;
$pass  = $argv[2] ?? null;
if (!$email || !$pass) {
    fwrite(STDERR, "Uso: php set-password.php email contraseña\n");
    exit(1);
}

$pdo = DB::pdo();

// 1) Comprobar que el usuario existe
$stmt = $pdo->prepare("SELECT id FROM usuarios WHERE email = ?");
$stmt->execute([$email]);
$row = $stmt->fetch();
if (!$row) {
    fwrite(STDERR, "⚠️  No existe ningún usuario con email '$email'.\n");
    fwrite(STDERR, "    ¿Has migrado la tabla 'usuarios'? (node scripts/firebase-to-mysql.mjs --commit --only=usuarios)\n");
    exit(1);
}

// 2) Actualizar la contraseña (bcrypt), sin tocar id ni data
$hash = password_hash($pass, PASSWORD_BCRYPT);
$upd = $pdo->prepare("UPDATE usuarios SET password_hash = ? WHERE email = ?");
$upd->execute([$hash, $email]);

echo "✅ Contraseña actualizada para $email  (uid: {$row['id']})\n";
