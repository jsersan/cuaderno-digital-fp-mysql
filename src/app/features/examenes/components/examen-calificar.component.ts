import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { ExamenesService, AlumnosService, AuthService, RecuperacionesService } from '@core/services';
import { Examen, Alumno, CalificacionExamen } from '@core/models';

interface AlumnoNota {
  alumnoId: string;
  nombre: string;
  apellidos: string;
  nota: number | null;
  observaciones: string;
}

@Component({
  selector: 'app-examen-calificar',
  standalone: true,
  imports: [CommonModule, RouterLink, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatInputModule, MatFormFieldModule, MatSnackBarModule, TranslateModule],
  template: `
    @if (examen) {
      <div class="page-header">
        <div>
          <h2>{{ 'exams.grade.title' | translate:{ titulo: examen.titulo } }}</h2>
          <p class="sub">{{ 'exams.grade.subtitle' | translate:{ pts: examen.puntuacionMaxima, min: examen.notaMinimaAprobado } }}</p>
        </div>
        <button mat-button [routerLink]="['/examenes', examen.id]"><mat-icon>arrow_back</mat-icon> {{ 'common.back' | translate }}</button>
      </div>

      <mat-card class="card">
        @if (alumnos.length > 0) {
          <table class="tabla">
            <thead><tr>
              <th class="c-num">#</th><th class="c-name">{{ 'recovery.detail.student' | translate }}</th>
              <th class="c-nota">{{ 'exams.grade.grade_col' | translate:{ pts: examen.puntuacionMaxima } }}</th>
              <th class="c-obs">{{ 'common.observations' | translate }}</th>
            </tr></thead>
            <tbody>
              @for (a of alumnos; track a.alumnoId; let i = $index) {
                <tr [class.aprobado]="a.nota !== null && a.nota >= examen.notaMinimaAprobado"
                    [class.suspenso]="a.nota !== null && a.nota < examen.notaMinimaAprobado">
                  <td class="c-num">{{ i + 1 }}</td>
                  <td class="c-name">{{ a.apellidos }}, {{ a.nombre }}</td>
                  <td class="c-nota">
                    <input type="number" [(ngModel)]="a.nota" min="0" [max]="examen.puntuacionMaxima" step="0.25" class="nota-input" placeholder="—">
                  </td>
                  <td class="c-obs">
                    <input type="text" [(ngModel)]="a.observaciones" class="obs-input" [placeholder]="'exams.grade.obs_ph' | translate">
                  </td>
                </tr>
              }
            </tbody>
          </table>
          <div class="actions">
            <div class="quick">
              <button mat-button (click)="ponerATodos(0)">{{ 'exams.grade.set_0' | translate }}</button>
              <button mat-button (click)="ponerATodos(examen.notaMinimaAprobado)">{{ 'exams.grade.set_min' | translate:{ min: examen.notaMinimaAprobado } }}</button>
              <button mat-button (click)="ponerATodos(examen.puntuacionMaxima)">{{ 'exams.grade.set_max' | translate:{ pts: examen.puntuacionMaxima } }}</button>
            </div>
            <button mat-raised-button color="primary" (click)="guardar()" [disabled]="saving">
              <mat-icon>save</mat-icon> {{ 'exams.grade.save' | translate }}
            </button>
          </div>
        }
      </mat-card>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; } .sub { color: #666; margin: 4px 0 0; }
    .card { padding: 20px; border-radius: 12px; }
    .tabla { width: 100%; border-collapse: collapse; }
    .tabla th { text-align: left; padding: 12px 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #666; border-bottom: 2px solid #e0e0e0; }
    .tabla td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
    .tabla tbody tr:hover { background: #fafafa; }
    .c-num { width: 40px; text-align: center !important; color: #999; }
    .c-name { min-width: 200px; font-weight: 500; } .c-nota { width: 140px; } .c-obs { min-width: 250px; }
    .nota-input { width: 80px; padding: 8px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; font-weight: 600; text-align: center; outline: none; }
    .nota-input:focus { border-color: #1565c0; }
    .obs-input { width: 100%; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 13px; outline: none; }
    .obs-input:focus { border-color: #1565c0; }
    tr.aprobado .nota-input { border-color: #4caf50; background: #f1f8e9; }
    tr.suspenso .nota-input { border-color: #f44336; background: #ffebee; }
    .actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 16px; border-top: 2px solid #e0e0e0; flex-wrap: wrap; gap: 8px; }
    .quick { display: flex; gap: 4px; }
  `]
})
export class ExamenCalificarComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private examenesService = inject(ExamenesService);
  private alumnosService = inject(AlumnosService);
  private auth = inject(AuthService);
  private recService = inject(RecuperacionesService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);

  examen: Examen | null = null;
  alumnos: AlumnoNota[] = [];
  saving = false;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.examen = await this.examenesService.getById(id);
    if (!this.examen) return;

    const alumnosGrupo = await this.alumnosService.getByGrupo(this.examen.grupoId);
    alumnosGrupo.sort((a, b) => a.apellidos.localeCompare(b.apellidos));

    const calsMap = new Map<string, CalificacionExamen>();
    (this.examen.calificaciones || []).forEach(c => calsMap.set(c.alumnoId, c));

    this.alumnos = alumnosGrupo.map(a => {
      const cal = calsMap.get(a.id!);
      return { alumnoId: a.id!, nombre: a.nombre, apellidos: a.apellidos, nota: cal?.nota ?? null, observaciones: cal?.observaciones || '' };
    });
  }

  ponerATodos(nota: number) { this.alumnos.forEach(a => a.nota = nota); }

  async guardar() {
    if (!this.examen?.id) return;
    this.saving = true;
    const calificaciones: CalificacionExamen[] = this.alumnos
      .filter(a => a.nota !== null)
      .map(a => ({
        alumnoId: a.alumnoId, alumnoNombre: `${a.apellidos}, ${a.nombre}`,
        nota: a.nota!, observaciones: a.observaciones,
        noPresente: false, necesitaRecuperacion: a.nota! < (this.examen?.notaMinimaAprobado || 5)
      }));
    try {
      await this.examenesService.update(this.examen.id, { calificaciones } as any);
      // Recargar el examen con las notas recién guardadas para evaluar suspensos
      this.examen = await this.examenesService.getById(this.examen.id);
      await this.sincronizarRecuperacion();
      this.snackBar.open(this.t.instant('exams.grade.saved'), 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
    this.saving = false;
  }

  // Si el examen NO tiene el 100% de aprobados, crea automáticamente la
  // recuperación (fecha = examen + 1 semana) convocando solo a los suspensos.
  // crearDesdeExamen guarda examenRecuperacionId en el examen, evitando duplicados.
  private async sincronizarRecuperacion() {
    const examen = this.examen;
    if (!examen?.id) return;
    if ((examen as any).examenRecuperacionId) return; // ya existe su recuperación

    const conNota = (examen.calificaciones || []).filter(c => !c.noPresente && c.nota != null);
    if (conNota.length === 0) return;

    const todosAprobados = conNota.every(c => (c.nota || 0) >= examen.notaMinimaAprobado);
    if (todosAprobados) return;

    const base = examen.fecha?.toDate ? examen.fecha.toDate() : new Date();
    const fechaRecup = new Date(base);
    fechaRecup.setDate(fechaRecup.getDate() + 7);

    try {
      await this.recService.crearDesdeExamen(examen, fechaRecup, 6);
      this.snackBar.open(this.t.instant('exams.recovery_created'), 'OK', { duration: 4000 });
    } catch (e) {
      console.warn('No se pudo crear la recuperación automática:', e);
    }
  }
}