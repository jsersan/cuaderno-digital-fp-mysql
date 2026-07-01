// probe5-proy.mjs — SOLO LECTURA. Lista las 12 tareas MÁS RECIENTES (por createdAt),
// con su moduloId y grupoId, para identificar la creada a mano desde el cuaderno PROI/SM2.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import admin from 'firebase-admin';
const __dirname = dirname(fileURLToPath(import.meta.url));
const sa = JSON.parse(readFileSync(join(__dirname, 'serviceAccount.json'), 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const NOMBRE_GRUPO = {
  '6FizW6wI8iHYzoSWCV8y':'SM2(6FizW6)','EtIYPCvquwkb1BX4Fspm':'SM2(EtI)←qjh',
  'MESWcuGHQO6yP7rxwFKh':'SM2(MESWcu)','PuFIWchb1TJ7SGEpxvUG':'SM2(PuFIWchb)',
  'SYj7pEqYEMWApdUwoVEI':'SM2(SYj7)','2O9LFMhQWHKVIZbIqmur':'2AW3(2O9L)←D78x',
};
const NOMBRE_MOD = {
  'qjhDxHpiyGQcoTWHyNXJ':'PROI «Proyecto Intermodular SM2»',
  'lJ0d3IFKltKuCXdfNzNd':'PROI «Proyecto»','FG3sFdVErRh26V7YaIAE':'PROY «Proyecto»',
  'D78x947gcFQnmcr66bz5':'PROY «Proyecto Intermodular DAW»',
};
const ms = v => v && v._seconds != null ? v._seconds*1000 : (typeof v === 'string' ? Date.parse(v) : 0);

async function main() {
  console.log('PROYECTO:', sa.project_id, '\n');
  const all = await db.collection('tareas').get();
  const docs = all.docs.map(d => ({ id:d.id, ...d.data() }))
    .sort((a,b) => ms(b.createdAt) - ms(a.createdAt))
    .slice(0, 12);
  console.log('Últimas 12 tareas creadas (la de arriba = la más reciente):\n');
  for (const t of docs) {
    const fecha = t.createdAt ? new Date(ms(t.createdAt)).toISOString().replace('T',' ').slice(0,19) : '?';
    console.log(`  [${fecha}]  "${t.titulo}"`);
    console.log(`       modulo=${NOMBRE_MOD[t.moduloId] || t.moduloId}`);
    console.log(`       grupo =${NOMBRE_GRUPO[t.grupoId] || t.grupoId}`);
  }
  await admin.app().delete();
}
main().catch(e=>{ console.error('Error:', e.message); process.exit(1); });
