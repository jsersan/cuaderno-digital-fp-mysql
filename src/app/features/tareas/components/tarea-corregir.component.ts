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
import { TareasService, AlumnosService, AuthService } from '@core/services';
import { Tarea, Alumno, EntregaTarea, EstadoTarea } from '@core/models';
import { Timestamp } from '@core/firebase-shim';

interface AlumnoCalificacion {
  alumnoId: string;
  nombre: string;
  apellidos: string;
  nota: number | null;
  feedback: string;
  estado: EstadoTarea;
}

@Component({
  selector: 'app-tarea-corregir',
  standalone: true,
  imports: [
    CommonModule, RouterLink, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatInputModule, MatFormFieldModule, MatSnackBarModule, TranslateModule
  ],
  template: `
    @if (tarea) {
      <div class="page-header">
        <div>
          <h2>{{ 'tasks.correct_panel.title' | translate:{ titulo: tarea.titulo } }}</h2>
          <p class="subtitle">{{ 'tasks.correct_panel.subtitle' | translate:{ pts: tarea.puntuacionMaxima } }}</p>
        </div>
        <button mat-button [routerLink]="['/tareas', tarea.id]"><mat-icon>arrow_back</mat-icon> {{ 'common.back' | translate }}</button>
      </div>

      <mat-card class="corregir-card">
        @if (alumnos.length === 0) {
          <div class="empty"><mat-icon>people</mat-icon><p>{{ 'tasks.correct_panel.no_students' | translate }}</p></div>
        }

        @if (alumnos.length > 0) {
          <table class="corregir-table">
            <thead>
              <tr>
                <th class="col-num">#</th>
                <th class="col-alumno">{{ 'recovery.detail.student' | translate }}</th>
                <th class="col-nota">{{ 'exams.grade.grade_col' | translate:{ pts: tarea.puntuacionMaxima } }}</th>
                <th class="col-feedback">{{ 'tasks.correct_panel.comment' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (a of alumnos; track a.alumnoId; let i = $index) {
                <tr [class.aprobado]="a.nota !== null && a.nota >= 5"
                    [class.suspenso]="a.nota !== null && a.nota < 5">
                  <td class="col-num">{{ i + 1 }}</td>
                  <td class="col-alumno">{{ a.apellidos }}, {{ a.nombre }}</td>
                  <td class="col-nota">
                    <input type="number" [(ngModel)]="a.nota"
                           min="0" [max]="tarea.puntuacionMaxima" step="0.5"
                           class="nota-input" placeholder="—">
                  </td>
                  <td class="col-feedback">
                    <input type="text" [(ngModel)]="a.feedback"
                           class="feedback-input" [placeholder]="'tasks.correct_panel.comment_ph' | translate">
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div class="actions">
            <div class="quick-actions">
              <button mat-button (click)="ponerNotaATodos(0)">{{ 'tasks.correct_panel.set_all_0' | translate }}</button>
              <button mat-button (click)="ponerNotaATodos(5)">{{ 'tasks.correct_panel.set_all_5' | translate }}</button>
              <button mat-button (click)="ponerNotaATodos(tarea.puntuacionMaxima)">{{ 'tasks.correct_panel.set_all_max' | translate:{ pts: tarea.puntuacionMaxima } }}</button>
            </div>
            <button mat-raised-button color="primary" (click)="guardarCalificaciones()" [disabled]="saving">
              <mat-icon>save</mat-icon> {{ 'tasks.correct_panel.save_grades' | translate }}
            </button>
          </div>
        }
      </mat-card>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .corregir-card { padding: 20px; border-radius: 12px; }
    .corregir-table { width: 100%; border-collapse: collapse; }
    .corregir-table th { text-align: left; padding: 12px 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #666; border-bottom: 2px solid #e0e0e0; }
    .corregir-table td { padding: 8px; border-bottom: 1px solid #f0f0f0; }
    .corregir-table tbody tr:hover { background: #fafafa; }
    .col-num { width: 40px; text-align: center !important; color: #999; }
    .col-alumno { min-width: 200px; font-weight: 500; }
    .col-nota { width: 140px; }
    .col-feedback { min-width: 250px; }
    .nota-input { width: 80px; padding: 8px 12px; border: 2px solid #e0e0e0; border-radius: 8px; font-size: 16px; font-weight: 600; text-align: center; outline: none; transition: border-color 0.2s; }
    .nota-input:focus { border-color: #1565c0; }
    .feedback-input { width: 100%; padding: 8px 12px; border: 1px solid #e0e0e0; border-radius: 8px; font-size: 13px; outline: none; }
    .feedback-input:focus { border-color: #1565c0; }
    tr.aprobado .nota-input { border-color: #4caf50; background: #f1f8e9; }
    tr.suspenso .nota-input { border-color: #f44336; background: #ffebee; }
    .actions { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; padding-top: 16px; border-top: 2px solid #e0e0e0; flex-wrap: wrap; gap: 8px; }
    .quick-actions { display: flex; gap: 4px; }
    .empty { text-align: center; padding: 32px; color: #999; }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; }
  `]
})
export class TareaCorregirComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private tareasService = inject(TareasService);
  private alumnosService = inject(AlumnosService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);

  tarea: Tarea | null = null;
  alumnos: AlumnoCalificacion[] = [];
  saving = false;

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;
    this.tarea = await this.tareasService.getById(id);
    if (!this.tarea) return;

    const alumnosGrupo = await this.alumnosService.getByGrupo(this.tarea.grupoId);
    alumnosGrupo.sort((a, b) => a.apellidos.localeCompare(b.apellidos));

    const entregasMap = new Map<string, EntregaTarea>();
    (this.tarea.entregas || []).forEach(e => entregasMap.set(e.alumnoId, e));

    this.alumnos = alumnosGrupo.map(a => {
      const entrega = entregasMap.get(a.id!);
      return {
        alumnoId: a.id!,
        nombre: a.nombre,
        apellidos: a.apellidos,
        nota: entrega?.nota ?? null,
        feedback: entrega?.feedback || '',
        estado: entrega?.estado || EstadoTarea.PENDIENTE
      };
    });
  }

  ponerNotaATodos(nota: number) {
    this.alumnos.forEach(a => a.nota = nota);
  }

  async guardarCalificaciones() {
    if (!this.tarea?.id) return;
    this.saving = true;

    const user = this.auth.currentUser;
    const entregas: EntregaTarea[] = this.alumnos.map(a => ({
      alumnoId: a.alumnoId,
      alumnoNombre: `${a.apellidos}, ${a.nombre}`,
      nota: a.nota ?? 0,
      feedback: a.feedback,
      estado: a.nota !== null ? EstadoTarea.CORREGIDA : EstadoTarea.PENDIENTE,
      corregidoPor: user?.uid,
      fechaCorreccion: Timestamp.now(),
      archivos: []
    }));

    try {
      await this.tareasService.update(this.tarea.id, { entregas } as any);
      this.snackBar.open(this.t.instant('tasks.correct_panel.saved'), 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
    this.saving = false;
  }
}
