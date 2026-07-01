// probe6-proy.mjs — SOLO LECTURA. Compara, para los módulos SM2 del panel
// (APIN, DASP, DBDR, PROI) y PROY, el grupo que enlaza por modulosIds frente al
// grupo donde están realmente sus tareas/eventos. Revela cómo empareja la app.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function main() {
  console.log('PROYECTO:', sa.project_id, '\n');

  // Mapa grupoId -> {nombre, cursoAcademico, modulosIds, nAlumnos}
  const grupos = {};
  (await db.collection('grupos').get()).forEach(d => {
    const g = d.data();
    grupos[d.id] = { nombre: g.nombre, curso: g.cursoAcademico, mods: g.modulosIds || [], al: (g.alumnosIds||[]).length };
  });
  // Para cada módulo: qué grupos lo enlazan (modulosIds array-contains)
  function gruposQueEnlazan(modId) {
    return Object.entries(grupos).filter(([,g]) => g.mods.includes(modId))
      .map(([id,g]) => `${id}[${g.nombre}/${g.curso}/al:${g.al}]`);
  }

  const mods = await db.collection('modulos').get();
  const objetivo = ['APIN','DASP','DBDR','PROI','PROY'];
  for (const abrev of objetivo) {
    const cands = mods.docs.filter(d => (d.data().abreviatura||'') === abrev);
    for (const d of cands) {
      const m = d.data();
      const ev = await db.collection('eventos_programacion').where('moduloId','==',d.id).get();
      const ta = await db.collection('tareas').where('moduloId','==',d.id).get();
      const gEv = {}; ev.forEach(x=>{const g=x.data().grupoId; gEv[g]=(gEv[g]||0)+1;});
      const gTa = {}; ta.forEach(x=>{const g=x.data().grupoId; gTa[g]=(gTa[g]||0)+1;});
      const fmt = o => Object.entries(o).map(([g,n])=>`${grupos[g]?.nombre||'?'}(${g.slice(0,6)}):${n}`).join(' ') || '∅';
      console.log(`\n=== ${abrev} «${m.nombre}» (${d.id})  ciclo=${m.cicloId.slice(0,6)} ===`);
      console.log(`   grupos que lo enlazan (modulosIds): ${gruposQueEnlazan(d.id).join('  ') || '∅ NINGUNO'}`);
      console.log(`   eventos por grupo: ${fmt(gEv)}`);
      console.log(`   tareas  por grupo: ${fmt(gTa)}`);
    }
  }
  await admin.app().delete();
}
main().catch(e=>{ console.error('Error:', e.message); process.exit(1); });
