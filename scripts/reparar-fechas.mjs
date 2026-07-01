#!/usr/bin/env node
/**
 * reparar-fechas.mjs
 * Repara campos de fecha que quedaron como TEXTO (string ISO) tras una restauración,
 * convirtiéndolos de vuelta a Timestamp de Firestore.
 *
 * Uso:
 *   node reparar-fechas.mjs            -> SIMULACIÓN (no escribe, solo muestra qué haría)
 *   node reparar-fechas.mjs --apply    -> APLICA los cambios en Firestore
 *
 * Requiere serviceAccount.json en la misma carpeta.
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';

const APPLY = process.argv.includes('--apply');

const serviceAccount = JSON.parse(readFileSync(new URL('./serviceAccount.json', import.meta.url)));
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

// Colecciones a revisar y, en cada una, qué campos pueden ser fechas.
// Si un campo es string ISO, se convierte a Timestamp.
const COLECCIONES = [
  'tareas', 'examenes', 'recuperaciones', 'calificaciones',
  'eventos_programacion', 'asistencia', 'asistencia_mensual', 'orlas', 'alumnos'
];

// Detecta si un valor parece una fecha ISO
function esFechaISO(v) {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) && !isNaN(new Date(v).getTime());
}
// Detecta Timestamp serializado como objeto {seconds, nanoseconds}
function esTimestampObj(v) {
  return v && typeof v === 'object' && typeof v.seconds === 'number'
    && Object.keys(v).every(k => k === 'seconds' || k === 'nanoseconds');
}

// Recorre un objeto y devuelve una copia con las fechas convertidas; cuenta cambios
function repararObjeto(obj, contador) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(x => repararObjeto(x, contador));

  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (esFechaISO(v)) {
      out[k] = Timestamp.fromDate(new Date(v));
      contador.n++;
    } else if (esTimestampObj(v) && !(v instanceof Timestamp)) {
      out[k] = new Timestamp(v.seconds, v.nanoseconds || 0);
      contador.n++;
    } else if (v && typeof v === 'object') {
      out[k] = repararObjeto(v, contador);
    } else {
      out[k] = v;
    }
  }
  return out;
}

async function main() {
  console.log(APPLY ? '== MODO APLICAR ==' : '== SIMULACIÓN (usa --apply para escribir) ==');
  let totalDocs = 0, totalCambios = 0;

  for (const col of COLECCIONES) {
    const snap = await db.collection(col).get();
    let docsTocados = 0, cambiosCol = 0;

    for (const docSnap of snap.docs) {
      const data = docSnap.data();
      const contador = { n: 0 };
      const reparado = repararObjeto(data, contador);

      if (contador.n > 0) {
        docsTocados++;
        cambiosCol += contador.n;
        if (APPLY) {
          await db.collection(col).doc(docSnap.id).set(reparado, { merge: false });
        }
      }
    }

    if (docsTocados > 0) {
      console.log(`  ${col}: ${docsTocados} documentos, ${cambiosCol} campos de fecha ${APPLY ? 'reparados' : 'a reparar'}`);
      totalDocs += docsTocados;
      totalCambios += cambiosCol;
    } else {
      console.log(`  ${col}: nada que reparar`);
    }
  }

  console.log(`\nTotal: ${totalDocs} documentos, ${totalCambios} campos ${APPLY ? 'reparados' : 'a reparar'}.`);
  if (!APPLY && totalCambios > 0) console.log('Vuelve a ejecutar con --apply para aplicarlo.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
