#!/usr/bin/env node
/**
 * copiar-dewc-2025-2026.mjs
 * ========================================================================
 * Copia TODO lo de DEWC del curso 2026-2027 al 2025-2026:
 *   eventos_programacion, tareas, examenes, recuperaciones y calificaciones
 *   — CON las notas/entregas del año origen — restando 1 año a las fechas.
 *
 * Antes de copiar, BORRA lo que hubiera de DEWC en 2025-2026 (evita duplicados).
 *
 * USO:
 *   node scripts/copiar-dewc-2025-2026.mjs            # DRY-RUN
 *   node scripts/copiar-dewc-2025-2026.mjs --commit    # ESCRIBE
 * ========================================================================
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');

const CURSO_ORIGEN = '2026-2027';
const CURSO_DESTINO = '2025-2026';
const ANIOS = -1; // 2026-2027 → 2025-2026: restar un año
const nowTs = () => Timestamp.now();
const norm = s => (s || '').toLowerCase().trim();

const COLECCIONES = ['eventos_programacion', 'tareas', 'examenes', 'recuperaciones', 'calificaciones'];

let db;
function initFirebase() {
  const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

// Desplaza N años cualquier campo cuyo nombre contenga "fecha" (recursivo).
// createdAt / updatedAt NO se tocan (no contienen "fecha").
function desplazarFechas(obj, anios) {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj?.toDate === 'function') return obj;
  if (Array.isArray(obj)) return obj.map(x => desplazarFechas(x, anios));
  if (typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (/fecha/i.test(k) && v && typeof v.toDate === 'function') {
        const d = v.toDate();
        d.setFullYear(d.getFullYear() + anios);
        out[k] = Timestamp.fromDate(d);
      } else if (v && typeof v === 'object') {
        out[k] = desplazarFechas(v, anios);
      } else {
        out[k] = v;
      }
    }
    return out;
  }
  return obj;
}

async function run() {
  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  COPIAR DEWC · ${CURSO_ORIGEN} → ${CURSO_DESTINO} (fechas ${ANIOS} año)`);
  console.log(`  Modo: ${COMMIT ? '✍️  COMMIT (escribe)' : '🔍 DRY-RUN (no escribe)'}`);
  console.log(`${'═'.repeat(64)}`);
  initFirebase();

  // ── Localizar DEWC ──
  let dewc = null;
  (await db.collection('modulos').get()).forEach(d => {
    const m = d.data();
    if (!dewc && (norm(m.abreviatura) === 'dewc' || norm(m.abreviatura) === 'dwec'))
      dewc = { id: d.id, ...m };
  });
  if (!dewc) { console.error('❌ No se encontró el módulo DEWC/DWEC'); process.exit(1); }
  console.log(`\n✓ DEWC: ${dewc.id}`);

  // ── Localizar grupos DAW2 origen y destino ──
  const daw2 = {};
  (await db.collection('grupos').get()).forEach(d => {
    const g = d.data();
    if (norm(g.nombre) === 'daw2') daw2[g.cursoAcademico] = { id: d.id, ref: d.ref, ...g };
  });
  const grupoOrigen = daw2[CURSO_ORIGEN];
  const grupoDestino = daw2[CURSO_DESTINO];
  if (!grupoOrigen) { console.error(`❌ No hay grupo DAW2 de ${CURSO_ORIGEN} (origen)`); process.exit(1); }
  if (!grupoDestino) { console.error(`❌ No hay grupo DAW2 de ${CURSO_DESTINO} (destino)`); process.exit(1); }
  console.log(`✓ DAW2 ${CURSO_ORIGEN}: ${grupoOrigen.id} (origen)`);
  console.log(`✓ DAW2 ${CURSO_DESTINO}: ${grupoDestino.id} (destino)`);

  console.log(`\n── Copia ${CURSO_ORIGEN} → ${CURSO_DESTINO} ──`);
  for (const col of COLECCIONES) {
    const srcSnap = await db.collection(col)
      .where('moduloId', '==', dewc.id).where('grupoId', '==', grupoOrigen.id).get();
    const dstSnap = await db.collection(col)
      .where('moduloId', '==', dewc.id).where('grupoId', '==', grupoDestino.id).get();

    console.log(`\n   ${col}: ${srcSnap.size} en origen, ${dstSnap.size} en destino (se borrarán)`);

    if (COMMIT) {
      // Borrar destino
      if (!dstSnap.empty) {
        let b = db.batch(), n = 0;
        for (const d of dstSnap.docs) { b.delete(d.ref); if (++n % 400 === 0) { await b.commit(); b = db.batch(); } }
        if (n % 400 !== 0) await b.commit();
      }
      // Copiar origen → destino con fechas -1 año
      let b = db.batch(), n = 0;
      for (const d of srcSnap.docs) {
        const data = d.data();
        const copia = desplazarFechas(data, ANIOS);
        copia.grupoId = grupoDestino.id;
        copia.cursoAcademico = CURSO_DESTINO;
        copia.updatedAt = nowTs();
        copia.createdAt = data.createdAt || nowTs();
        b.set(db.collection(col).doc(), copia);
        if (++n % 400 === 0) { await b.commit(); b = db.batch(); }
      }
      if (n % 400 !== 0) await b.commit();
      console.log(`      ✓ ${srcSnap.size} copiados a ${CURSO_DESTINO}`);
    }
  }

  console.log(`\n${'═'.repeat(64)}`);
  if (!COMMIT) {
    console.log('  🔍 DRY-RUN: no se ha escrito nada. Revisa los recuentos.');
    console.log('  Si cuadran, ejecuta con --commit.\n');
  } else {
    console.log(`  ✅ DEWC copiado de ${CURSO_ORIGEN} a ${CURSO_DESTINO} (con notas).`);
    console.log('  Las fechas del curso destino están desplazadas -1 año.\n');
  }
}

run().catch(e => { console.error('\n❌ Error:', e.message || e); process.exit(1); });
