<?php
// =============================================================================
//  CONFIGURACIÓN  ·  Cuaderno Digital FP — backend MySQL
//  Ajusta estos valores a tu instalación de MAMP si hace falta.
//  MAMP por defecto:  host 127.0.0.1 · puerto 8889 · root / root
// =============================================================================

return [
    'db' => [
        'host'    => '127.0.0.1',
        'port'    => '8889',                 // MAMP MySQL (Apache PHP usa 8888)
        'name'    => 'cuaderno_digital_fp',
        'user'    => 'root',
        'pass'    => 'root',
        'charset' => 'utf8mb4',
    ],

    // Secreto para firmar los tokens de sesión. CÁMBIALO por una cadena larga
    // y aleatoria. (Para localhost no es crítico, pero es buena costumbre.)
    'jwt_secret' => 'cambia-esto-por-una-cadena-larga-y-secreta-2026',
    'token_ttl'  => 60 * 60 * 24 * 7,        // 7 días en segundos

    // Orígenes permitidos por CORS (donde corre tu Angular en local).
    'cors_origins' => [
        'http://localhost:4200',
        'http://127.0.0.1:4200',
    ],

    // Colecciones permitidas (= tablas creadas en el .sql). Seguridad: evita
    // que se pueda escribir en tablas arbitrarias.
    'collections' => [
        'usuarios', 'centros', 'ciclos', 'modulos', 'grupos', 'alumnos',
        'tareas', 'examenes', 'recuperaciones', 'calificaciones', 'asistencia',
        'asistencia_mensual', 'observaciones', 'periodos_evaluacion',
        'eventos_programacion', 'orlas', 'backups', 'cuadernos_generados',
    ],
];
