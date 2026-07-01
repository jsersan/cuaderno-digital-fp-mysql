import { Injectable, inject } from '@angular/core';
import { where, orderBy, QueryConstraint, Timestamp, Firestore, collection, getDocs, query } from '@core/firebase-shim';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { RegistroAsistencia, AsistenciaAlumno, EstadoAsistencia, ResumenAsistencia } from '@core/models';

@Injectable({ providedIn: 'root' })
export class AsistenciaService extends FirestoreService<RegistroAsistencia> {
  protected collectionName = 'asistencia';
  private db = inject(Firestore);

  getByModuloGrupoFechas(moduloId: string, grupoId: string, fechaDesde: Date, fechaHasta: Date): Observable<RegistroAsistencia[]> {
    return this.queryByField$('moduloId', moduloId).pipe(
      map(regs => regs.filter((r: any) => {
        const s = r.fecha?.seconds || 0;
        return r.grupoId === grupoId && s >= fechaDesde.getTime()/1000 && s <= fechaHasta.getTime()/1000;
      }).sort((a: any, b: any) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0)))
    );
  }

  getByGrupoHoy$(grupoId: string): Observable<RegistroAsistencia[]> {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const manana = new Date(hoy); manana.setDate(manana.getDate()+1);
    return this.queryByField$('grupoId', grupoId).pipe(
      map(regs => regs.filter((r: any) => {
        const s = r.fecha?.seconds || 0;
        return s >= hoy.getTime()/1000 && s < manana.getTime()/1000;
      }))
    );
  }

  async pasarLista(moduloId: string, grupoId: string, profesorId: string, franjaHoraria: string, registros: AsistenciaAlumno[], moduloAbreviatura?: string): Promise<string> {
    // Anti-duplicados: si ya existe un registro de este grupo+módulo+franja+día de HOY, actualizarlo
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
    try {
      const existentes = await this.queryByField('grupoId', grupoId);
      const yaExiste = existentes.find((r: any) => {
        const s = r.fecha?.seconds || 0;
        const esHoy = s >= hoy.getTime() / 1000 && s < manana.getTime() / 1000;
        return esHoy && r.moduloId === moduloId && r.franjaHoraria === franjaHoraria;
      });
      if (yaExiste?.id) {
        await this.update(yaExiste.id, { registros, profesorId } as any);
        return yaExiste.id;
      }
    } catch { /* si falla la búsqueda, creamos uno nuevo */ }
    const doc: any = { fecha: Timestamp.now(), moduloId, grupoId, profesorId, franjaHoraria, registros };
    if (moduloAbreviatura) doc.moduloAbreviatura = moduloAbreviatura;
    return this.create(doc);
  }

  async actualizarRegistro(registroId: string, alumnoId: string, estado: EstadoAsistencia, justificante?: string): Promise<void> {
    const registro = await this.getById(registroId);
    if (!registro) throw new Error('Registro no encontrado');
    const registros = registro.registros.map(r => r.alumnoId === alumnoId ? { ...r, estado, justificante } : r);
    await this.update(registroId, { registros } as any);
  }

  // ---------------------------------------------------------------------------
  // Lee las faltas de la colección 'asistencia_mensual' para un grupo+módulo.
  // Devuelve, por alumno, las faltas injustificadas (I) y justificadas (J),
  // además del total de días lectivos (lunes-viernes) registrados en esos meses.
  // ---------------------------------------------------------------------------
  private async getFaltasMensuales(moduloId: string, grupoId: string): Promise<{
    porAlumno: { [alumnoId: string]: { injustificadas: number; justificadas: number } };
    totalDiasLectivos: number;
  }> {
    const porAlumno: { [alumnoId: string]: { injustificadas: number; justificadas: number } } = {};
    let totalDiasLectivos = 0;
    try {
      const snap = await getDocs(query(
        collection(this.db, 'asistencia_mensual'),
        where('grupoId', '==', grupoId),
        where('moduloId', '==', moduloId)
      ));
      snap.forEach(d => {
        const data: any = d.data();
        const faltas = data['faltas'] || {};
        const anio = data['anio'];
        const mes = (data['mes'] || 1) - 1; // mes guardado en base 1
        // Contar días lectivos del mes (lunes a viernes)
        if (anio != null && mes != null) {
          const numDias = new Date(anio, mes + 1, 0).getDate();
          for (let dia = 1; dia <= numDias; dia++) {
            const dow = new Date(anio, mes, dia).getDay();
            if (dow !== 0 && dow !== 6) totalDiasLectivos++;
          }
        }
        for (const [alumnoId, dias] of Object.entries(faltas)) {
          if (!porAlumno[alumnoId]) porAlumno[alumnoId] = { injustificadas: 0, justificadas: 0 };
          const valores = Object.values(dias as any);
          porAlumno[alumnoId].injustificadas += valores.filter(v => v === 'I').length;
          porAlumno[alumnoId].justificadas += valores.filter(v => v === 'J').length;
        }
      });
    } catch { /* sin datos mensuales */ }
    return { porAlumno, totalDiasLectivos };
  }

  // ---------------------------------------------------------------------------
  // Resumen COMBINADO: usa los registros de 'asistencia' (pasar lista por franjas)
  // y los suma a las faltas de 'asistencia_mensual'. Para evitar dobles llamadas
  // a Firestore por alumno, se pueden precargar ambas fuentes y pasarlas como
  // argumentos opcionales (lo hace calcularResumenGrupo).
  // ---------------------------------------------------------------------------
  async calcularResumen(
    alumnoId: string,
    moduloId: string,
    grupoId: string,
    registrosFranja?: RegistroAsistencia[],
    mensual?: { porAlumno: { [id: string]: { injustificadas: number; justificadas: number } }; totalDiasLectivos: number }
  ): Promise<ResumenAsistencia> {
    // 1) Datos de pasar lista (colección 'asistencia')
    const registros = registrosFranja
      ?? (await this.queryByField('moduloId', moduloId)).filter((r: any) => r.grupoId === grupoId);

    let totalClases = 0, presencias = 0, ausenciasJustificadas = 0, ausenciasInjustificadas = 0, retrasos = 0;
    registros.forEach(reg => {
      const a = reg.registros.find(r => r.alumnoId === alumnoId);
      if (a) {
        totalClases++;
        if (a.estado === EstadoAsistencia.PRESENTE) presencias++;
        else if (a.estado === EstadoAsistencia.AUSENTE_JUSTIFICADA) ausenciasJustificadas++;
        else if (a.estado === EstadoAsistencia.AUSENTE_INJUSTIFICADA) ausenciasInjustificadas++;
        else if (a.estado === EstadoAsistencia.RETRASO) { retrasos++; presencias++; }
      }
    });

    // 2) Datos de la tabla mensual ('asistencia_mensual')
    const men = mensual ?? await this.getFaltasMensuales(moduloId, grupoId);
    const faltasMen = men.porAlumno[alumnoId] || { injustificadas: 0, justificadas: 0 };

    // 3) Combinar: las clases del mes que no son falta se cuentan como presencia.
    //    Se añaden los días lectivos del mes al total y las faltas a sus contadores.
    totalClases += men.totalDiasLectivos;
    ausenciasInjustificadas += faltasMen.injustificadas;
    ausenciasJustificadas += faltasMen.justificadas;
    const presenciasMensuales = Math.max(0, men.totalDiasLectivos - faltasMen.injustificadas - faltasMen.justificadas);
    presencias += presenciasMensuales;

    const porcentaje = totalClases > 0 ? Math.round((presencias / totalClases) * 10000) / 100 : 100;
    return {
      alumnoId, moduloId, totalClases, presencias,
      ausenciasJustificadas, ausenciasInjustificadas, retrasos,
      porcentajeAsistencia: porcentaje, superaMinimo: porcentaje >= 85
    };
  }

  async calcularResumenGrupo(moduloId: string, grupoId: string, alumnosIds: string[]): Promise<ResumenAsistencia[]> {
    // Precargar ambas fuentes UNA sola vez y reutilizarlas para todos los alumnos
    const registrosFranja = (await this.queryByField('moduloId', moduloId)).filter((r: any) => r.grupoId === grupoId);
    const mensual = await this.getFaltasMensuales(moduloId, grupoId);

    const resumenes: ResumenAsistencia[] = [];
    for (const alumnoId of alumnosIds) {
      resumenes.push(await this.calcularResumen(alumnoId, moduloId, grupoId, registrosFranja, mensual));
    }
    return resumenes;
  }

  async getAlumnosBajaAsistencia(moduloId: string, grupoId: string, alumnosIds: string[]): Promise<ResumenAsistencia[]> {
    return (await this.calcularResumenGrupo(moduloId, grupoId, alumnosIds)).filter(r => !r.superaMinimo);
  }
}