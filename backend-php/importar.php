<?php
// =============================================================================
//  IMPORTAR.PHP  ·  Carga un backup JSON (array de documentos) en una tabla.
//  Tus backups de Firestore son arrays  [ { id, ...campos }, ... ].
//
//  Uso:   php importar.php  <coleccion>  <fichero.json>
//  Ej.:   php importar.php  alumnos  ../alumnos-backup-2026-06-21T15-51-54-422Z.json
//
//  - Respeta el "id" de cada documento (mantiene los IDs de Firestore).
//  - Si el documento ya existe, lo reemplaza (upsert).
//  - Para 'usuarios' NO establece contraseña (usa seed-admin.php para eso).
// =============================================================================

$config = require __DIR__ . '/config.php';
require __DIR__ . '/helpers.php';
require __DIR__ . '/db.php';
DB::init($config);

$coleccion = $argv[1] ?? null;
$fichero   = $argv[2] ?? null;
if (!$coleccion || !$fichero) {
    fwrite(STDERR, "Uso: php importar.php <coleccion> <fichero.json>\n");
    exit(1);
}
if (!is_file($fichero)) {
    fwrite(STDERR, "No existe el fichero: $fichero\n");
    exit(1);
}

DB::assertCollection($coleccion);

$docs = json_decode(file_get_contents($fichero), true);
if (!is_array($docs)) {
    fwrite(STDERR, "El JSON no es un array de documentos.\n");
    exit(1);
}

$pdo = DB::pdo();
$n = 0;

foreach ($docs as $doc) {
    if (!is_array($doc)) continue;
    $id = $doc['id'] ?? Repo::pushId();
    unset($doc['id']);

    if ($coleccion === 'usuarios') {
        // Inserta el perfil sin tocar la contraseña existente.
        $email = $doc['email'] ?? ($id . '@local');
        $stmt = $pdo->prepare(
            "INSERT INTO usuarios (id, email, data) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE email = VALUES(email), data = VALUES(data)"
        );
        $stmt->execute([$id, $email, json_encode($doc, JSON_UNESCAPED_UNICODE)]);
    } else {
        Repo::set($coleccion, $id, $doc);
    }
    $n++;
}

echo "✅ Importados $n documentos en '$coleccion'.\n";
