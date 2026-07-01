// ============================================================
//  _proy-helpers.mjs
//  Utilidades compartidas para los scripts del módulo de Proyecto (PROY / DAW2)
//  - Inicializa Firebase Admin con serviceAccount.json
//  - Resuelve el módulo PROY y el grupo DAW2 por abreviatura/código
// ============================================================

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));

// --- Inicialización de Firebase Admin (igual que tus otros scripts) ---
const serviceAccount = JSON.parse(
  readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8')
);

if (!getApps().length) {
  initializeApp({ credential: cert(serviceAccount) });
}

export const db = getFirestore();
export { Timestamp };

// Abreviatura del módulo y nombre del grupo objetivo
export const MODULO_ABREV = 'PROY';
export const GRUPO_NOMBRE = 'DAW2';
export const CURSO_ACADEMICO = '2025-2026';

// ------------------------------------------------------------
//  Resolver el módulo PROY: primero por abreviatura, si no, por
//  flag esProyecto, si no, por coincidencia en el nombre.
// ------------------------------------------------------------
export async function resolverModuloProy() {
  const col = db.collection('modulos');

  // 1) Por abreviatura exacta
  let snap = await col.where('abreviatura', '==', MODULO_ABREV).get();
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

  // 2) Por flag esProyecto
  snap = await col.where('esProyecto', '==', true).get();
  if (!snap.empty) return { id: snap.docs[0].id, ...snap.docs[0].data() };

  // 3) Por nombre que contenga "Proyecto" (filtrado en cliente)
  const all = await col.get();
  const match = all.docs.find(d =>
    (d.data().nombre || '').toLowerCase().includes('proyecto')
  );
  if (match) return { id: match.id, ...match.data() };

  throw new Error(`No se encontró el módulo "${MODULO_ABREV}" en la colección 'modulos'.`);
}

// ------------------------------------------------------------
//  Resolver el grupo DAW2 por nombre exacto, si no por coincidencia.
// ------------------------------------------------------------
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

// Construye un Timestamp a partir de 'YYYY-MM-DD' (hora local 12:00 para evitar desfases UTC)
export function ts(fechaISO) {
  return Timestamp.fromDate(new Date(`${fechaISO}T12:00:00`));
}
