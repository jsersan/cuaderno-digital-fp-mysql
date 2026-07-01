import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { FirestoreService } from './firestore.service';

// Registro ligero de una orla por grupo. El PDF no se almacena: se regenera
// al instante desde las fotos (alumno.fotoUrl) cuando el usuario lo descarga.
export interface OrlaRegistro {
  id?: string;
  grupoId: string;
  grupoNombre: string;
  cicloNombre: string;
  cursoTexto: string;
  totalAlumnos: number;
  conFoto: number;
  centroId: string;
  cursoAcademico: string;
  generadaEn: any;        // Timestamp / Date de la última generación
  createdAt?: any;
  updatedAt?: any;
}

@Injectable({ providedIn: 'root' })
export class OrlasService extends FirestoreService<OrlaRegistro> {
  protected collectionName = 'orlas';

  // Orlas de un centro y curso académico (para la pantalla de listado)
  getByCentro$(centroId: string, cursoAcademico: string): Observable<OrlaRegistro[]> {
    return this.queryByField$('centroId', centroId) as Observable<OrlaRegistro[]>;
  }

  // Busca el registro de orla de un grupo concreto (si existe)
  async getByGrupo(grupoId: string): Promise<OrlaRegistro | null> {
    const todas = await this.queryByField('grupoId', grupoId);
    return (todas[0] as OrlaRegistro) || null;
  }

  // Crea o actualiza el registro de orla de un grupo
  async upsert(reg: OrlaRegistro): Promise<void> {
    const existente = await this.getByGrupo(reg.grupoId);
    const now = new Date();
    if (existente?.id) {
      await this.update(existente.id, { ...reg, updatedAt: now } as any);
    } else {
      await this.create({ ...reg, createdAt: now, updatedAt: now } as any);
    }
  }
}