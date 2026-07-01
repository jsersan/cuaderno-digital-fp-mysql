#!/usr/bin/env node
/**
 * borrar-alumnos-sin-matricula.mjs
 * --------------------------------------------------------------------------
 * Borra los alumnos de un grupo que tienen matriculas VACÍAS (resultado de
 * la importación fallida). Triple protección:
 *   1) Solo del grupo indicado (por defecto DAW2).
 *   2) Solo si matriculas está vacío o no existe.
 *   3) Dry-run por defecto: lista qué borraría sin tocar nada.
 *
 * NO toca alumnos con matrículas (los buenos), ni de otros grupos.
 *
 * USO:
 *   node scripts/borrar-alumnos-sin-matricula.mjs                 # DRY-RUN (DAW2)
 *   node scripts/borrar-alumnos-sin-matricula.mjs --commit        # borra (DAW2)
 *   node scripts/borrar-alumnos-sin-matricula.mjs --grupo SM2     # otro grupo
 * --------------------------------------------------------------------------
 */
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMIT = process.argv.includes('--commit');
const gi = process.argv.indexOf('--grupo');
const NOMBRE_GRUPO = gi !== -1 ? process.argv[gi + 1] : 'DAW2';

let db;
function initFirebase(){
  const sa = JSON.parse(readFileSync(join(__dirname,'serviceAccount.json'),'utf8'));
  initializeApp({ credential: cert(sa) });
  db = getFirestore();
}

async function run(){
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  BORRAR ALUMNOS SIN MATRÍCULA del grupo ${NOMBRE_GRUPO}`);
  console.log(`  Modo: ${COMMIT?'COMMIT (BORRA)':'DRY-RUN (no borra)'}`);
  console.log(`${'='.repeat(60)}\n`);
  initFirebase();

  // 1) Localizar el grupo por nombre
  const gruposSnap = await db.collection('grupos').get();
  let grupo = null;
  gruposSnap.forEach(d=>{
    const g = d.data();
    if ((g.nombre||'').toUpperCase() === NOMBRE_GRUPO.toUpperCase()) grupo = { id:d.id, ...g };
  });
  if (!grupo){ console.log(`❌ No se encontró el grupo "${NOMBRE_GRUPO}".\n`); return; }
  console.log(`Grupo: ${grupo.nombre} (id: ${grupo.id})\n`);

  // 2) Alumnos del grupo con matriculas vacías
  const alumnosSnap = await db.collection('alumnos').where('grupoId','==',grupo.id).get();
  const aBorrar = [];
  alumnosSnap.forEach(d=>{
    const a = d.data();
    const sinMatricula = !a.matriculas || (Array.isArray(a.matriculas) && a.matriculas.length === 0);
    if (sinMatricula) aBorrar.push({ ref:d.ref, id:d.id, nombre:`${a.nombre||''} ${a.apellidos||''}`.trim(), email:a.email||'' });
  });

  console.log(`Alumnos del grupo: ${alumnosSnap.size} · sin matrícula (candidatos a borrar): ${aBorrar.length}\n`);
  if(!aBorrar.length){ console.log('✅ No hay alumnos sin matrícula. Nada que borrar.\n'); return; }

  console.log('Se borrarían:');
  aBorrar.forEach((a,i)=>console.log(`   ${(i+1).toString().padStart(2)}. ${a.nombre.padEnd(28)} ${a.email}`));
  console.log('');

  if(!COMMIT){ console.log('🔍 DRY-RUN: no se ha borrado nada. Ejecuta con --commit para borrar.\n'); return; }

  const batch = db.batch();
  for(const a of aBorrar) batch.delete(a.ref);
  await batch.commit();
  console.log(`✅ Borrados ${aBorrar.length} alumnos sin matrícula de ${grupo.nombre}.`);
  console.log('   Ahora reimporta el Excel con DAW2 seleccionado en el filtro.\n');
}
run().catch(e=>{console.error('❌',e.message);process.exit(1);});
