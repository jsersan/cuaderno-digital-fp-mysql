import { Injectable } from '@angular/core';
import { where, orderBy, QueryConstraint, Timestamp } from '@core/firebase-shim';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { FirestoreService } from './firestore.service';
import { Calificacion, TipoEvaluacion } from '@core/models';

@Injectable({ providedIn: 'root' })
export class CalificacionesService extends FirestoreService<Calificacion> {
  protected collectionName = 'calificaciones';

  getByAlumnoModulo(alumnoId: string, moduloId: string): Observable<Calificacion[]> {
    return this.queryByField$('alumnoId', alumnoId).pipe(
      map(cals => cals.filter(c => c.moduloId === moduloId))
    );
  }

  getByModuloGrupoEvaluacion$(moduloId: string, grupoId: string, evaluacion: TipoEvaluacion): Observable<Calificacion[]> {
    return this.queryByField$('moduloId', moduloId).pipe(
      map(cals => cals.filter(c => c.grupoId === grupoId && c.evaluacion === evaluacion))
    );
  }

  // Alias
  getByModuloGrupoEval(moduloId: string, grupoId: string, evaluacion: TipoEvaluacion): Observable<Calificacion[]> {
    return this.getByModuloGrupoEvaluacion$(moduloId, grupoId, evaluacion);
  }

  getByAlumno$(alumnoId: string): Observable<Calificacion[]> {
    return this.queryByField$('alumnoId', alumnoId);
  }

  async guardarCalificacion(calificacion: Partial<Calificacion>): Promise<string> {
    const existentes = await this.queryByField('alumnoId', calificacion.alumnoId || '');
    const existente = existentes.find(c => c.moduloId === calificacion.moduloId && c.evaluacion === calificacion.evaluacion);
    if (existente?.id) { await this.update(existente.id, calificacion); return existente.id; }
    return this.create(calificacion);
  }

  async calcularNotaFinal(alumnoId: string, moduloId: string): Promise<number> {
    const califs = await this.queryByField('alumnoId', alumnoId);
    const delModulo = califs.filter(c => c.moduloId === moduloId);
    if (delModulo.length === 0) return 0;
    const sum = delModulo.reduce((acc, c) => acc + ((c.notaFinal || 0) * ((c as any).porcentajePeso || 1)), 0);
    const totalPeso = delModulo.reduce((acc, c) => acc + ((c as any).porcentajePeso || 1), 0);
    return totalPeso > 0 ? Math.round((sum / totalPeso) * 100) / 100 : 0;
  }
}
