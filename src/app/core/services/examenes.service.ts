import { Injectable } from '@angular/core';
import { where, orderBy, QueryConstraint, Timestamp } from '@core/firebase-shim';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { Examen, CalificacionExamen, TipoEvaluacion } from '@core/models';

@Injectable({ providedIn: 'root' })
export class ExamenesService extends FirestoreService<Examen> {
  protected collectionName = 'examenes';

  getByModuloYGrupo(moduloId: string, grupoId: string): Observable<Examen[]> {
    return this.queryByField$('moduloId', moduloId).pipe(
      map(exs => exs.filter(e => e.grupoId === grupoId).sort((a: any, b: any) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0)))
    );
  }

  getByProfesor$(profesorId: string): Observable<Examen[]> {
    return this.queryByField$('profesorId', profesorId).pipe(
      map(exs => exs.sort((a: any, b: any) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0)))
    );
  }

  async getProximosExamenes(profesorId: string): Promise<Examen[]> {
    const todos = await this.queryByField('profesorId', profesorId);
    const ahora = Date.now() / 1000;
    const enUnaSemana = ahora + 7 * 24 * 3600;
    return todos.filter((e: any) => { const s = e.fecha?.seconds || 0; return s >= ahora && s <= enUnaSemana; });
  }

  // Alias for dashboard compatibility
  async getProximos(profesorId: string): Promise<Examen[]> {
    return this.getProximosExamenes(profesorId);
  }

  getByEvaluacion(moduloId: string, grupoId: string, evaluacion: TipoEvaluacion): Observable<Examen[]> {
    return this.queryByField$('moduloId', moduloId).pipe(
      map(exs => exs.filter(e => e.grupoId === grupoId && e.evaluacion === evaluacion))
    );
  }

  async calificarAlumno(examenId: string, calificacion: CalificacionExamen): Promise<void> {
    const examen = await this.getById(examenId);
    if (!examen) throw new Error('Examen no encontrado');
    const calificaciones = [...(examen.calificaciones || [])];
    const idx = calificaciones.findIndex(c => c.alumnoId === calificacion.alumnoId);
    if (idx >= 0) calificaciones[idx] = { ...calificaciones[idx], ...calificacion };
    else calificaciones.push(calificacion);
    await this.update(examenId, { calificaciones } as any);
  }

  async calificarMasivo(examenId: string, calificaciones: CalificacionExamen[]): Promise<void> {
    const examen = await this.getById(examenId);
    if (!examen) throw new Error('Examen no encontrado');
    const existentes = [...(examen.calificaciones || [])];
    for (const cal of calificaciones) {
      const idx = existentes.findIndex(c => c.alumnoId === cal.alumnoId);
      if (idx >= 0) existentes[idx] = { ...existentes[idx], ...cal };
      else existentes.push(cal);
    }
    await this.update(examenId, { calificaciones: existentes } as any);
  }

  getAlumnosParaRecuperacion(examen: Examen): CalificacionExamen[] {
    return (examen.calificaciones || []).filter(c => c.nota !== undefined && c.nota < examen.notaMinimaAprobado);
  }

  getEstadisticas(examen: Examen): { total: number; corregidos: number; aprobados: number; suspensos: number; notaMedia: number } {
    const cals = examen.calificaciones || [];
    const conNota = cals.filter(c => c.nota !== undefined);
    const aprobados = conNota.filter(c => (c.nota || 0) >= examen.notaMinimaAprobado);
    const notas = conNota.map(c => c.nota || 0);
    return {
      total: cals.length,
      corregidos: conNota.length,
      aprobados: aprobados.length,
      suspensos: conNota.length - aprobados.length,
      notaMedia: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 100) / 100 : 0
    };
  }
}
