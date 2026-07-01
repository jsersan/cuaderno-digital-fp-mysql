#!/usr/bin/env node
/**
 * detalle-grupos-daw2.mjs  (SOLO LEE)
 * Muestra el detalle completo de cada grupo llamado DAW2: campos del grupo,
 * y cuántos documentos cuelgan de él en TODAS las colecciones relevantes
 * (de cualquier módulo, no solo DEWC). Sirve para decidir con seguridad
 * cuál conservar antes de unificar/borrar duplicados.
 *
 * USO:  node scripts/detalle-grupos-daw2.mjs
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const norm = s => (s || '').toLowerCase().trim();
const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
initializeApp({ credential: cert(sa) });
const db = getFirestore();

// Colecciones que se vinculan a un grupo por campo grupoId
const COLS_GRUPO = [
  'alumnos', 'eventos_programacion', 'tareas', 'examenes',
  'recuperaciones', 'calificaciones', 'asistencia', 'asistencia_mensual',
  'orlas', 'observaciones'
];

function fmt(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts.seconds ? ts.seconds * 1000 : ts);
  return isNaN(d) ? '—' : d.toLocaleString('es-ES');
}

async function run() {
  // Mapa de módulos id→abreviatura para etiquetar
  const modAbrev = {};
  (await db.collection('modulos').get()).forEach(d => { modAbrev[d.id] = d.data().abreviatura || d.id; });

  // Localizar todos los grupos DAW2
  const grupos = [];
  (await db.collection('grupos').get()).forEach(d => {
    if (norm(d.data().nombre) === 'daw2') grupos.push({ id: d.id, ...d.data() });
  });

  console.log(`\n${'═'.repeat(64)}`);
  console.log(`  DETALLE DE ${grupos.length} GRUPOS "DAW2"`);
  console.log(`${'═'.repeat(64)}`);

  for (const g of grupos) {
    console.log(`\n┌─ GRUPO ${g.id}`);
    console.log(`│  cursoAcademico : ${g.cursoAcademico || '(sin)'}`);
    console.log(`│  cicloId        : ${g.cicloId || '(sin)'}`);
    console.log(`│  cicloNombre    : ${g.cicloNombre || '(sin)'}`);
    console.log(`│  tutorId        : ${g.tutorId || '(sin)'}`);
    console.log(`│  curso          : ${g.curso ?? '(sin)'}`);
    console.log(`│  alumnosIds     : ${(g.alumnosIds || []).length}`);
    console.log(`│  horario        : ${g.horario ? 'sí (' + Object.values(g.horario).flat().length + ' franjas)' : 'no'}`);
    console.log(`│  createdAt      : ${fmt(g.createdAt)}`);
    console.log(`│  updatedAt      : ${fmt(g.updatedAt)}`);
    console.log(`│`);
    console.log(`│  Documentos vinculados (grupoId == ${g.id}):`);

    let totalDocs = 0;
    for (const col of COLS_GRUPO) {
      const snap = await db.collection(col).where('grupoId', '==', g.id).get();
      if (snap.empty) continue;
      totalDocs += snap.size;
      // Desglose por módulo
      const porMod = {};
      snap.forEach(d => {
        const mid = d.data().moduloId;
        const ab = mid ? (modAbrev[mid] || mid) : '(sin módulo)';
        porMod[ab] = (porMod[ab] || 0) + 1;
      });
      const desglose = Object.entries(porMod).map(([ab, n]) => `${ab}:${n}`).join(', ');
      console.log(`│    ${col.padEnd(22)}: ${String(snap.size).padStart(3)}  [${desglose}]`);
    }
    if (totalDocs === 0) console.log(`│    (ningún documento vinculado — grupo vacío)`);
    console.log(`└─ TOTAL documentos vinculados: ${totalDocs}`);
  }

  console.log(`\n${'═'.repeat(64)}`);
  console.log('  Resumen: el grupo "bueno" es el que tiene más documentos vinculados.');
  console.log('  El/los vacíos son candidatos a borrar.');
  console.log(`${'═'.repeat(64)}\n`);
}
run().catch(e => { console.error('❌', e.message); process.exit(1); });
