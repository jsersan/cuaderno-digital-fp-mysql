import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  Firestore, collection, getDocs, doc, setDoc, getDoc, deleteDoc,
  writeBatch, Timestamp
} from '@core/firebase-shim';
import { FirestoreService } from './firestore.service';

// ---- Colecciones que se incluyen en el backup (excluyendo 'usuarios' por seguridad) ----
const COLECCIONES_BACKUP = [
  'ciclos', 'grupos', 'modulos', 'alumnos',
  'tareas', 'examenes', 'recuperaciones', 'calificaciones',
  'eventos_programacion', 'asistencia', 'asistencia_mensual',
  'orlas', 'periodos_evaluacion', 'observaciones'
];

// ---- Etiquetas legibles para la UI ----
export const COLECCION_LABELS: { [key: string]: string } = {
  ciclos: 'Ciclos formativos',
  grupos: 'Grupos',
  modulos: 'Módulos profesionales',
  alumnos: 'Alumnos',
  tareas: 'Tareas',
  examenes: 'Exámenes',
  recuperaciones: 'Recuperaciones',
  calificaciones: 'Calificaciones',
  eventos_programacion: 'Programación temporal',
  asistencia: 'Asistencia',
  asistencia_mensual: 'Asistencia mensual',
  orlas: 'Orlas',
  periodos_evaluacion: 'Periodos de evaluación',
  observaciones: 'Observaciones'
};

export const COLECCION_ICONS: { [key: string]: string } = {
  ciclos: 'school', grupos: 'groups', modulos: 'menu_book',
  alumnos: 'person', tareas: 'assignment', examenes: 'quiz',
  recuperaciones: 'refresh', calificaciones: 'grade',
  eventos_programacion: 'event_note', asistencia: 'event_available',
  asistencia_mensual: 'calendar_month', orlas: 'photo_library',
  periodos_evaluacion: 'date_range', observaciones: 'notes'
};

export interface BackupFile {
  formato: 'cuaderno-fp-backup';
  version: number;
  generadoEn: string;
  descripcion: string;
  centroId: string;
  colecciones: { [c: string]: any[] };
  resumen: { [c: string]: number };
}

export interface BackupRegistro {
  id?: string;
  descripcion: string;
  generadaEn: any;
  centroId: string;
  totalDocs: number;
  detalle: { [c: string]: number };
  tienedatos?: boolean;    // true si los datos están almacenados en Firestore
  updatedAt?: any;
}

@Injectable({ providedIn: 'root' })
export class BackupHistorialService extends FirestoreService<BackupRegistro> {
  protected collectionName = 'backups';

  getByCentro$(centroId: string): Observable<BackupRegistro[]> {
    return this.queryByField$('centroId', centroId) as Observable<BackupRegistro[]>;
  }
}

@Injectable({ providedIn: 'root' })
export class BackupService {
  private firestore = inject(Firestore);

  /** Genera una copia de seguridad completa. */
  async generarBackup(descripcion: string, centroId: string): Promise<BackupFile> {
    const colecciones: { [c: string]: any[] } = {};
    const resumen: { [c: string]: number } = {};

    for (const nombre of COLECCIONES_BACKUP) {
      const snap = await getDocs(collection(this.firestore, nombre));
      const docs = snap.docs.map(d => ({ _id: d.id, ...d.data() }));
      colecciones[nombre] = docs;
      resumen[nombre] = docs.length;
    }

    return {
      formato: 'cuaderno-fp-backup',
      version: 1,
      generadoEn: new Date().toISOString(),
      descripcion: descripcion || '',
      centroId,
      colecciones,
      resumen
    };
  }

  // ================================================================
  //  ALMACENAR / CARGAR BACKUP EN FIRESTORE (chunking)
  // ================================================================

  /** Guarda los datos del backup en Firestore para poder restaurarlo desde el historial. */
  async guardarEnFirestore(backupId: string, backup: BackupFile): Promise<void> {
    const json = JSON.stringify(backup);
    const CHUNK = 800_000; // ~800KB por fragmento
    const partes: string[] = [];
    for (let i = 0; i < json.length; i += CHUNK) {
      partes.push(json.slice(i, i + CHUNK));
    }

    // Limpiar fragmentos viejos si existiesen
    const fragCol = collection(this.firestore, 'backups', backupId, 'fragmentos');
    const oldSnap = await getDocs(fragCol);
    await Promise.all(oldSnap.docs.map(d => deleteDoc(d.ref)));

    // Escribir nuevos fragmentos
    for (let i = 0; i < partes.length; i++) {
      await setDoc(
        doc(this.firestore, 'backups', backupId, 'fragmentos', String(i)),
        { data: partes[i] }
      );
    }

    // Marcar el registro como que tiene datos
    await setDoc(
      doc(this.firestore, 'backups', backupId),
      { tienedatos: true, fragmentos: partes.length },
      { merge: true }
    );
  }

  /** Carga un backup completo desde Firestore (leyendo sus fragmentos). */
  async cargarDesdeFirestore(backupId: string): Promise<BackupFile | null> {
    // Leer el registro padre para saber cuántos fragmentos tiene
    const regSnap = await getDoc(doc(this.firestore, 'backups', backupId));
    if (!regSnap.exists()) return null;
    const reg = regSnap.data() as any;
    const numFragmentos = reg.fragmentos || 0;
    if (!numFragmentos) return null;

    let json = '';
    for (let i = 0; i < numFragmentos; i++) {
      const fragSnap = await getDoc(
        doc(this.firestore, 'backups', backupId, 'fragmentos', String(i))
      );
      json += (fragSnap.data() as any)?.data || '';
    }

    try {
      const backup = JSON.parse(json) as BackupFile;
      if (backup?.formato !== 'cuaderno-fp-backup') return null;
      return backup;
    } catch {
      return null;
    }
  }

  // ================================================================
  //  RESTAURACIÓN (completa o parcial)
  // ================================================================

  /** Restaura una copia completa (todas las colecciones). */
  async restaurarBackup(backup: BackupFile): Promise<{ [c: string]: number }> {
    return this.restaurarBackupParcial(backup, Object.keys(backup.colecciones));
  }

  /** Restaura solo las colecciones seleccionadas. */
  async restaurarBackupParcial(
    backup: BackupFile,
    coleccionesSeleccionadas: string[]
  ): Promise<{ [c: string]: number }> {
    if (backup?.formato !== 'cuaderno-fp-backup') {
      throw new Error('El archivo no es una copia de seguridad válida del cuaderno.');
    }

    const resultado: { [c: string]: number } = {};

    for (const nombre of coleccionesSeleccionadas) {
      const docs = backup.colecciones[nombre];
      if (!docs?.length) { resultado[nombre] = 0; continue; }

      let count = 0;
      const batchSize = 400;

      for (let i = 0; i < docs.length; i += batchSize) {
        const batch = writeBatch(this.firestore);
        const chunk = docs.slice(i, i + batchSize);

        for (const d of chunk) {
          const id = d._id || d.id;
          if (!id) continue;
          const { _id, id: _id2, ...data } = d;
          const normalizado = this.normalizarFechas(data);
          batch.set(doc(this.firestore, nombre, id), normalizado);
          count++;
        }

        await batch.commit();
      }

      resultado[nombre] = count;
    }

    return resultado;
  }

  // ================================================================
  //  NORMALIZACIÓN DE FECHAS (recursiva)
  // ================================================================

  /** Convierte recursivamente strings ISO y objetos {seconds,nanoseconds} a Timestamp. */
  private normalizarFechas(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    // String ISO → Timestamp
    if (typeof obj === 'string') {
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(obj)) {
        const d = new Date(obj);
        if (!isNaN(d.getTime())) return Timestamp.fromDate(d);
      }
      return obj;
    }

    // {seconds, nanoseconds} → Timestamp
    if (typeof obj === 'object' && !Array.isArray(obj) &&
        'seconds' in obj && 'nanoseconds' in obj &&
        Object.keys(obj).length === 2) {
      return new Timestamp(obj.seconds, obj.nanoseconds);
    }

    // Arrays
    if (Array.isArray(obj)) {
      return obj.map(item => this.normalizarFechas(item));
    }

    // Objetos normales: recursión
    if (typeof obj === 'object') {
      const result: any = {};
      for (const [k, v] of Object.entries(obj)) {
        result[k] = this.normalizarFechas(v);
      }
      return result;
    }

    return obj;
  }
}