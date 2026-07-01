import { Injectable, inject } from '@angular/core';
import { where, orderBy, QueryConstraint, Timestamp } from '@core/firebase-shim';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { Recuperacion, AlumnoRecuperacion, Examen } from '@core/models';
import { ExamenesService } from './examenes.service';

@Injectable({ providedIn: 'root' })
export class RecuperacionesService extends FirestoreService<Recuperacion> {
  protected collectionName = 'recuperaciones';
  private examenesService = inject(ExamenesService);

  getByModuloYGrupo$(moduloId: string, grupoId: string): Observable<Recuperacion[]> {
    return this.queryByField$('moduloId', moduloId).pipe(
      map(recs => recs.filter(r => r.grupoId === grupoId).sort((a: any, b: any) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0)))
    );
  }

  getByProfesor$(profesorId: string): Observable<Recuperacion[]> {
    return this.queryByField$('profesorId', profesorId).pipe(
      map(recs => recs.sort((a: any, b: any) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0)))
    );
  }

  getPendientes$(profesorId: string): Observable<Recuperacion[]> {
    return this.queryByField$('profesorId', profesorId).pipe(
      map(recs => recs.filter((r: any) => !r.resultadosPublicados))
    );
  }

  // Elimina recursivamente las claves con valor undefined (Firestore no las admite)
  private sinUndefined<T>(obj: T): T {
    return JSON.parse(JSON.stringify(obj, (_k, v) => (v === undefined ? null : v)));
  }

  async crearDesdeExamen(examen: Examen, fecha: Date, notaMaxima: number = 6, configuracion?: Partial<Recuperacion>): Promise<string> {
    const alumnosSuspensos = this.examenesService.getAlumnosParaRecuperacion(examen);
    const alumnosConvocados: AlumnoRecuperacion[] = alumnosSuspensos.map(cal => ({
      alumnoId: cal.alumnoId, alumnoNombre: cal.alumnoNombre, notaOriginal: cal.nota || 0, estado: 'convocado' as const
    }));
    const recuperacion: Partial<Recuperacion> = {
      titulo: `Recuperación: ${examen.titulo}`, moduloId: examen.moduloId, grupoId: examen.grupoId,
      profesorId: examen.profesorId, examenOriginalId: examen.id, evaluacion: examen.evaluacion,
      tipoRecuperacion: 'examen', resultadosAprendizajeIds: examen.resultadosAprendizajeIds,
      criteriosEvaluacionIds: examen.criteriosEvaluacionIds, fecha: Timestamp.fromDate(fecha),
      puntuacionMaxima: examen.puntuacionMaxima, notaMaximaRecuperacion: notaMaxima,
      notaMinimaAprobado: examen.notaMinimaAprobado, alumnosConvocados,
      publicada: false, resultadosPublicados: false, ...configuracion
    };
    const recId = await this.create(recuperacion);
    if (examen.id) await this.examenesService.update(examen.id, { examenRecuperacionId: recId } as any);
    return recId;
  }

  async calificarAlumno(recuperacionId: string, alumnoId: string, nota: number, observaciones?: string): Promise<void> {
    const rec = await this.getById(recuperacionId);
    if (!rec) throw new Error('Recuperación no encontrada');
    const alumnos = rec.alumnosConvocados.map(a => {
      if (a.alumnoId === alumnoId) {
        const notaFinal = Math.min(nota, rec.notaMaximaRecuperacion);
        const actualizado: any = {
          ...a,
          notaRecuperacion: notaFinal,
          estado: (nota >= rec.notaMinimaAprobado ? 'aprobado' : 'suspenso') as any
        };
        // Solo añadir observaciones si vienen con valor; nunca undefined (Firestore lo rechaza)
        if (observaciones !== undefined && observaciones !== null) {
          actualizado.observaciones = observaciones;
        }
        return actualizado;
      }
      return a;
    });
    await this.update(recuperacionId, { alumnosConvocados: this.sinUndefined(alumnos) } as any);
  }

  async marcarNoPresentado(recuperacionId: string, alumnoId: string): Promise<void> {
    const rec = await this.getById(recuperacionId);
    if (!rec) throw new Error('Recuperación no encontrada');
    const alumnos = rec.alumnosConvocados.map(a => a.alumnoId === alumnoId ? { ...a, estado: 'no_presentado' as const, notaRecuperacion: 0 } : a);
    await this.update(recuperacionId, { alumnosConvocados: this.sinUndefined(alumnos) } as any);
  }

  async publicarResultados(recuperacionId: string): Promise<void> {
    await this.update(recuperacionId, { resultadosPublicados: true } as any);
  }
}