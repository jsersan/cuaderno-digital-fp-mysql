// ============================================================================
//  firebase-to-mysql.mjs
//  Volcado directo de Firestore a MySQL para el Cuaderno Digital FP.
//
//  Lee cada colección de Firestore y la inserta en su tabla de MySQL
//  (id + data JSON), convirtiendo los Timestamp de Firestore al formato
//  { seconds, nanoseconds } que espera la app (firebase-shim).
//
//  Requisitos:
//    - serviceAccount.json en esta misma carpeta (scripts/)
//    - La BBDD y las tablas ya creadas (cuaderno_digital_fp.sql importado)
//    - Dependencias:  npm install firebase-admin mysql2
//
//  Uso:
//    node scripts/firebase-to-mysql.mjs                 (DRY-RUN: solo cuenta)
//    node scripts/firebase-to-mysql.mjs --commit        (escribe en MySQL)
//    node scripts/firebase-to-mysql.mjs --commit --only=alumnos,grupos
// ============================================================================

import admin from 'firebase-admin';
import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';

// ---------- CONFIG MySQL (ajusta a tu MAMP si hace falta) ----------
const MYSQL = {
  host: '127.0.0.1',
  port: 8889,            // MySQL de MAMP
  user: 'root',
  password: 'root',
  database: 'cuaderno_digital_fp',
};

// ---------- Colecciones a migrar (= tablas del .sql) ----------
const COLECCIONES = [
  'usuarios', 'centros', 'ciclos', 'modulos', 'grupos', 'alumnos',
  'tareas', 'examenes', 'recuperaciones', 'calificaciones', 'asistencia',
  'asistencia_mensual', 'observaciones', 'periodos_evaluacion',
  'eventos_programacion', 'orlas', 'backups', 'cuadernos_generados',
];

// ---------- Flags ----------
const args = process.argv.slice(2);
const COMMIT = args.includes('--commit') || args.includes('--apply');
const onlyArg = args.find(a => a.startsWith('--only='));
const ONLY = onlyArg ? onlyArg.split('=')[1].split(',').map(s => s.trim()) : null;

// ---------- Conversión de tipos de Firestore ----------
function convertir(value) {
  if (value === null || value === undefined) return value;
  // Timestamp de Firestore -> { seconds, nanoseconds }
  if (value instanceof admin.firestore.Timestamp ||
      (value && typeof value.toDate === 'function' && typeof value.seconds === 'number')) {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  }
  // GeoPoint -> { latitude, longitude }
  if (value instanceof admin.firestore.GeoPoint) {
    return { latitude: value.latitude, longitude: value.longitude };
  }
  // Referencia a documento -> su ruta
  if (value && typeof value.path === 'string' && typeof value.id === 'string' && value.firestore) {
    return value.path;
  }
  if (Array.isArray(value)) return value.map(convertir);
  if (typeof value === 'object') {
    const out = {};
    for (const k of Object.keys(value)) out[k] = convertir(value[k]);
    return out;
  }
  return value;
}

async function main() {
  // --- Inicializar Firebase Admin ---
  const saPath = new URL('./serviceAccount.json', import.meta.url);
  const serviceAccount = JSON.parse(readFileSync(saPath, 'utf8'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const fs = admin.firestore();

  console.log(COMMIT
    ? '🟢 MODO COMMIT: se escribirá en MySQL.\n'
    : '🟡 DRY-RUN: solo cuento documentos. Añade --commit para escribir.\n');

  // --- Conectar a MySQL (solo si vamos a escribir) ---
  let conn = null;
  if (COMMIT) {
    conn = await mysql.createConnection(MYSQL);
    console.log(`Conectado a MySQL ${MYSQL.host}:${MYSQL.port}/${MYSQL.database}\n`);
  }

  const resumen = [];

  for (const col of COLECCIONES) {
    if (ONLY && !ONLY.includes(col)) continue;

    const snap = await fs.collection(col).get();
    let n = 0;

    for (const doc of snap.docs) {
      const data = convertir(doc.data());
      const json = JSON.stringify(data);

      if (COMMIT) {
        if (col === 'usuarios') {
          // No tocamos password_hash; sincronizamos email desde el perfil.
          const email = data.email || `${doc.id}@local`;
          await conn.execute(
            `INSERT INTO usuarios (id, email, data) VALUES (?, ?, ?)
             ON DUPLICATE KEY UPDATE email = VALUES(email), data = VALUES(data)`,
            [doc.id, email, json]
          );
        } else {
          await conn.execute(
            `INSERT INTO \`${col}\` (id, data) VALUES (?, ?)
             ON DUPLICATE KEY UPDATE data = VALUES(data)`,
            [doc.id, json]
          );
        }
      }
      n++;
    }

    resumen.push({ coleccion: col, documentos: n });
    console.log(`${COMMIT ? '✅' : '·'} ${col.padEnd(22)} ${n} doc(s)`);
  }

  console.log('\n─── Resumen ───');
  console.table(resumen);
  const total = resumen.reduce((s, r) => s + r.documentos, 0);
  console.log(`Total: ${total} documentos${COMMIT ? ' migrados.' : ' (dry-run, no escrito).'}`);

  if (conn) await conn.end();
  await admin.app().delete();
}

main().catch(err => {
  console.error('\n❌ Error:', err.message);
  process.exit(1);
});
