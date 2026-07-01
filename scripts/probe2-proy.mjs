// probe2-proy.mjs — SOLO LECTURA. Compara el cuaderno que funciona (DAW) con el que no (SMR).
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
console.log('PROYECTO Firebase:', sa.project_id);

const PARES = {
  'DAW (funciona)': { moduloId: 'D78x947gcFQnmcr66bz5', grupoId: '2O9LFMhQWHKVIZbIqmur' },
  'SMR (vacío)':    { moduloId: 'qjhDxHpiyGQcoTWHyNXJ', grupoId: 'EtIYPCvquwkb1BX4Fspm' },
};

const limpio = o => { const c = { ...o }; for (const k of Object.keys(c)) {
  const v = c[k];
  if (v && typeof v === 'object' && v._seconds != null) c[k] = `<ts ${new Date(v._seconds*1000).toISOString().slice(0,10)}>`;
  else if (Array.isArray(v)) c[k] = `[${v.length}]`;
  else if (v && typeof v === 'object') c[k] = '{...}';
} return c; };

async function main() {
  for (const [nombre, p] of Object.entries(PARES)) {
    console.log(`\n══════════ ${nombre} ══════════`);
    const mod = await db.collection('modulos').doc(p.moduloId).get();
    const gru = await db.collection('grupos').doc(p.grupoId).get();
    console.log('MÓDULO doc:', JSON.stringify(limpio(mod.data() || {})));
    console.log('GRUPO  doc:', JSON.stringify(limpio(gru.data() || {})));

    // ¿cuántas tareas/eventos hay por cada combinación de filtros posibles?
    const porMod = await db.collection('tareas').where('moduloId', '==', p.moduloId).get();
    const porGru = await db.collection('tareas').where('grupoId', '==', p.grupoId).get();
    const porModGru = porMod.docs.filter(d => d.data().grupoId === p.grupoId);
    console.log(`tareas por moduloId=${porMod.size}  por grupoId=${porGru.size}  por (modulo+grupo)=${porModGru.length}`);

    // muestra los campos de UNA tarea de (modulo+grupo)
    if (porModGru.length) {
      console.log('TAREA ejemplo (modulo+grupo):', JSON.stringify(limpio(porModGru[0].data())));
    } else if (porMod.size) {
      console.log('⚠ Hay tareas del módulo pero en OTRO grupo:',
        [...new Set(porMod.docs.map(d => d.data().grupoId))].join(', '));
      console.log('TAREA ejemplo (solo módulo):', JSON.stringify(limpio(porMod.docs[0].data())));
    } else {
      console.log('⚠ No hay tareas con ese moduloId.');
    }
  }
  await admin.app().delete();
}
main().catch(e => { console.error('Error:', e.message); process.exit(1); });
