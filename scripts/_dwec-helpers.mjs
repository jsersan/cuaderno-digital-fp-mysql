// ============================================================
//  _dwec-helpers.mjs
//  Utilidades compartidas para los scripts del módulo DWEC (DAW2)
//  - Inicializa Firebase Admin con serviceAccount.json
//  - Resuelve el módulo DWEC y el grupo DAW2 por abreviatura/nombre
//  (Mismo estilo que _proy-helpers.mjs)
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8')
);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

export const db = getFirestore();
export { Timestamp };

export const MODULO_ABREV = 'DWEC';
export const GRUPO_NOMBRE = 'DAW2';
export const CURSO_ACADEMICO = '2025-2026';

// Resolver el módulo DWEC: por abreviatura exacta, si no por nombre.
export async function resolverModuloDwec() {
  const col = db.collection('modulos');

  let snap = await col.where('abreviatura', '==', MODULO_ABREV).get();
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

  const all = await col.get();
  const match = all.docs.find(d =>
    (d.data().nombre || '').toLowerCase().includes('cliente') ||   // "Desarrollo Web en Entorno Cliente"
    (d.data().abreviatura || '').toUpperCase() === 'DWEC'
  );
  if (match) return { id: match.id, ...match.data() };

  throw new Error(`No se encontró el módulo "${MODULO_ABREV}" en la colección 'modulos'.`);
}

// Resolver el grupo DAW2 por nombre exacto, si no por coincidencia.
export async function resolverGrupoDaw2() {
  const col = db.collection('grupos');

  let snap = await col.where('nombre', '==', GRUPO_NOMBRE).get();
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

  const all = await col.get();
  const match = all.docs.find(d =>
    (d.data().nombre || '').replace(/\s+/g, '').toUpperCase().includes('DAW2')
  );
  if (match) return { id: match.id, ...match.data() };

  throw new Error(`No se encontró el grupo "${GRUPO_NOMBRE}" en la colección 'grupos'.`);
}

// Timestamp desde 'YYYY-MM-DD' (12:00 local para evitar desfases UTC)
export function ts(fechaISO) {
  return Timestamp.fromDate(new Date(`${fechaISO}T12:00:00`));
}

// ------------------------------------------------------------
//  Distribución de NIVELES para 14 alumnos con ~27% de suspensos.
//  14 × 0.27 ≈ 3,8 → 4 suspensos (nivel < 5). El resto reparte
//  niveles realistas. Se asignan por orden alfabético de apellidos.
//  Índices suspensos (4): 3, 7, 10, 13 (0-based) → notas < 5.
// ------------------------------------------------------------
export const NIVELES_14 = [
  6.5,  // 0
  7.0,  // 1
  8.5,  // 2
  4.0,  // 3  ← suspende
  9.0,  // 4
  5.5,  // 5
  7.5,  // 6
  3.5,  // 7  ← suspende
  8.0,  // 8
  6.0,  // 9
  4.5,  // 10 ← suspende
  7.0,  // 11
  9.5,  // 12
  3.0   // 13 ← suspende
];

export function clamp(n) { return Math.max(0, Math.min(10, Math.round((n ?? 0) * 10) / 10)); }

// Devuelve un mapa alumnoId -> nivel, asignado por orden alfabético de apellidos.
export function nivelesPorAlumno(alumnosOrdenados) {
  const m = {};
  alumnosOrdenados.forEach((a, i) => { m[a.id] = NIVELES_14[i] ?? 6.0; });
  return m;
}
