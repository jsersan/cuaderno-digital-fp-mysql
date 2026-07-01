// probe-proy.mjs — SOLO LECTURA. No escribe nada.
// Vuelca módulos de proyecto, grupos SM2/2AW3 y dónde viven los eventos/tareas,
// para localizar el par (moduloId, grupoId) EXACTO que usa el cuaderno PROI/SM2.
//   node scripts/probe-proy.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const short = o => JSON.stringify(o);

async function main() {
  // 1) Ciclos
  const ciclos = await db.collection('ciclos').get();
  const cicloById = {};
  console.log('\n===== CICLOS =====');
  ciclos.forEach(d => { cicloById[d.id] = d.data().abreviatura || d.data().nombre;
    console.log(`  ${d.id}  ${d.data().abreviatura || ''}  «${d.data().nombre || ''}»`); });

  // 2) Módulos de proyecto (PROY/PROI o nombre con "Proyecto")
  console.log('\n===== MÓDULOS DE PROYECTO =====');
  const mods = await db.collection('modulos').get();
  const proyMods = mods.docs.filter(d => {
    const m = d.data();
    return /^pro[yi]$/i.test(m.abreviatura || '') || /proyecto/i.test(m.nombre || '');
  });
  for (const d of proyMods) {
    const m = d.data();
    console.log(`  ID=${d.id}`);
    console.log(`     abrev=${m.abreviatura}  nombre=«${m.nombre}»`);
    console.log(`     cicloId=${m.cicloId} (${cicloById[m.cicloId] || '?'})  cursoAcademico=${m.cursoAcademico || '-'}`);
    // ¿tiene algún campo que enlace a grupo?
    const linkFields = Object.keys(m).filter(k => /grupo|cuaderno/i.test(k));
    if (linkFields.length) console.log(`     enlaces: ${linkFields.map(k => `${k}=${short(m[k])}`).join('  ')}`);
    // cuántos eventos/tareas hay por grupo en este módulo
    const ev = await db.collection('eventos_programacion').where('moduloId', '==', d.id).get();
    const ta = await db.collection('tareas').where('moduloId', '==', d.id).get();
    const porGrupoEv = {}; ev.forEach(x => { const g = x.data().grupoId; porGrupoEv[g] = (porGrupoEv[g] || 0) + 1; });
    const porGrupoTa = {}; ta.forEach(x => { const g = x.data().grupoId; porGrupoTa[g] = (porGrupoTa[g] || 0) + 1; });
    console.log(`     eventos=${ev.size}  por grupo: ${short(porGrupoEv)}`);
    console.log(`     tareas =${ta.size}  por grupo: ${short(porGrupoTa)}`);
  }

  // 3) Grupos SM2 y 2AW3
  console.log('\n===== GRUPOS SM2 / 2AW3 =====');
  for (const nombre of ['SM2', '2AW3']) {
    const gs = await db.collection('grupos').where('nombre', '==', nombre).get();
    gs.forEach(d => {
      const g = d.data();
      const linkFields = Object.keys(g).filter(k => /modulo|cuaderno/i.test(k));
      console.log(`  ID=${d.id}  nombre=${g.nombre}  cicloId=${g.cicloId} (${cicloById[g.cicloId] || '?'})  cursoAcademico=${g.cursoAcademico || '-'}`);
      if (linkFields.length) console.log(`     enlaces: ${linkFields.map(k => `${k}=${short(g[k])}`).join('  ')}`);
    });
  }

  // 4) ¿Existe una colección 'cuadernos'?
  console.log('\n===== COLECCIÓN cuadernos (si existe) =====');
  try {
    const cu = await db.collection('cuadernos').limit(25).get();
    if (cu.empty) console.log('  (vacía o no existe)');
    cu.forEach(d => {
      const c = d.data();
      const rel = Object.fromEntries(Object.entries(c).filter(([k]) => /modulo|grupo|ciclo|curso|nombre/i.test(k)));
      console.log(`  ID=${d.id}  ${short(rel)}`);
    });
  } catch (e) { console.log('  (no accesible:', e.message, ')'); }

  await admin.app().delete();
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
