// probe3-proy.mjs — SOLO LECTURA. Vuelca los módulos COMPLETOS (sin colapsar arrays)
// para comparar cursosArchivados / cursoActual / esProyecto entre DAW (ok) y SMR (vacío).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const MODS = {
  'DAW PROY (ok)':  'D78x947gcFQnmcr66bz5',
  'SMR PROI (vacío)': 'qjhDxHpiyGQcoTWHyNXJ',
};
const GRUPOS = {
  'DAW 2AW3 (ok)':  '2O9LFMhQWHKVIZbIqmur',
  'SMR SM2 (vacío)': 'EtIYPCvquwkb1BX4Fspm',
};

function ts(o){ // reemplaza Timestamps por ISO para legibilidad
  return JSON.parse(JSON.stringify(o, (k,v)=> (v && v._seconds!=null) ? new Date(v._seconds*1000).toISOString() : v));
}

async function main() {
  console.log('PROYECTO:', sa.project_id, '\n');
  console.log('################ MÓDULOS (campos relevantes) ################');
  for (const [n,id] of Object.entries(MODS)) {
    const d = (await db.collection('modulos').doc(id).get()).data() || {};
    console.log(`\n--- ${n}  (${id}) ---`);
    console.log('  esProyecto      :', d.esProyecto);
    console.log('  esFCT           :', d.esFCT);
    console.log('  activo          :', d.activo);
    console.log('  cursoActual     :', JSON.stringify(d.cursoActual));
    console.log('  cursoAcademico  :', JSON.stringify(d.cursoAcademico));
    console.log('  cursosArchivados:', JSON.stringify(d.cursosArchivados));
    console.log('  cursos / cursosActivos / anios (si existen):',
      JSON.stringify({cursos:d.cursos, cursosActivos:d.cursosActivos, anios:d.anios, años:d['años']}));
    // por si hay más claves con "curso" o "anio"
    const otras = Object.keys(d).filter(k=>/curso|anio|año|archiv|activ/i.test(k));
    console.log('  claves relacionadas:', otras.join(', '));
  }
  console.log('\n################ GRUPOS (doc completo) ################');
  for (const [n,id] of Object.entries(GRUPOS)) {
    const d = (await db.collection('grupos').doc(id).get()).data() || {};
    console.log(`\n--- ${n}  (${id}) ---`);
    console.log(JSON.stringify(ts(d), null, 1));
  }
  await admin.app().delete();
}
main().catch(e=>{ console.error('Error:', e.message); process.exit(1); });
