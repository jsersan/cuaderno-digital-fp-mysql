import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { PeriodosEvaluacionService, AuthService, ActiveModuleService } from '@core/services';
import { PeriodoEvaluacion, TipoEvaluacion } from '@core/models';
import { Timestamp } from '@core/firebase-shim';

interface FilaEval {
  tipo: TipoEvaluacion;
  id?: string;
  fechaInicio: Date | null;
  fechaFin: Date | null;
}

@Component({
  selector: 'app-periodos-evaluacion',
  standalone: true,
  imports: [CommonModule, FormsModule, MatCardModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatDatepickerModule, MatNativeDateModule, MatSnackBarModule],
  template: `
    <div class="page-header">
      <div><h2>Fechas de evaluación</h2><p class="sub">Periodos del curso {{ activeModule.cursoActual }} (comunes a todos los módulos)</p></div>
      <button mat-raised-button color="primary" (click)="guardar()" [disabled]="saving"><mat-icon>save</mat-icon> Guardar fechas</button>
    </div>

    <mat-card class="card">
      <table class="t">
        <thead><tr><th>Evaluación</th><th>Fecha de inicio</th><th>Fecha límite</th></tr></thead>
        <tbody>
          @for (f of filas; track f.tipo) {
            <tr>
              <td class="ev-name">{{ f.tipo }}</td>
              <td>
                <mat-form-field appearance="outline" class="date-field">
                  <input matInput [matDatepicker]="pi" [(ngModel)]="f.fechaInicio">
                  <mat-datepicker-toggle matIconSuffix [for]="pi"></mat-datepicker-toggle>
                  <mat-datepicker #pi></mat-datepicker>
                </mat-form-field>
              </td>
              <td>
                <mat-form-field appearance="outline" class="date-field">
                  <input matInput [matDatepicker]="pf" [(ngModel)]="f.fechaFin">
                  <mat-datepicker-toggle matIconSuffix [for]="pf"></mat-datepicker-toggle>
                  <mat-datepicker #pf></mat-datepicker>
                </mat-form-field>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </mat-card>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-header h2 { margin: 0; } .sub { color: #666; margin: 4px 0 0; }
    .card { padding: 24px; border-radius: 12px; }
    .t { width: 100%; border-collapse: collapse; }
    .t th { text-align: left; padding: 12px 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #666; border-bottom: 2px solid #e0e0e0; }
    .t td { padding: 8px; border-bottom: 1px solid #f0f0f0; vertical-align: middle; }
    .ev-name { font-weight: 600; min-width: 180px; }
    .date-field { width: 200px; margin-bottom: -1.25em; }
  `]
})
export class PeriodosEvaluacionComponent implements OnInit {
  private periodosService = inject(PeriodosEvaluacionService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  activeModule = inject(ActiveModuleService);

  filas: FilaEval[] = Object.values(TipoEvaluacion).map(t => ({ tipo: t, fechaInicio: null, fechaFin: null }));
  saving = false;

  async ngOnInit() {
    const user = this.auth.currentUser;
    if (!user) return;
    try {
      const periodos = await this.periodosService.queryByField('centroId', user.centroId);
      const delCurso = periodos.filter((p: any) => p.cursoAcademico === this.activeModule.cursoActual);
      for (const f of this.filas) {
        const p = delCurso.find((x: any) => x.tipo === f.tipo);
        if (p) {
          f.id = p.id;
          f.fechaInicio = p.fechaInicio?.toDate ? p.fechaInicio.toDate() : null;
          f.fechaFin = p.fechaFin?.toDate ? p.fechaFin.toDate() : null;
        }
      }
    } catch {}
  }

  async guardar() {
    const user = this.auth.currentUser;
    if (!user) return;
    this.saving = true;
    try {
      for (const f of this.filas) {
        if (!f.fechaInicio || !f.fechaFin) continue;
        const payload: any = {
          centroId: user.centroId, cursoAcademico: this.activeModule.cursoActual, tipo: f.tipo,
          fechaInicio: Timestamp.fromDate(new Date(f.fechaInicio)),
          fechaFin: Timestamp.fromDate(new Date(f.fechaFin)),
          activo: true, cerrado: false
        };
        if (f.id) { await this.periodosService.update(f.id, payload); }
        else { f.id = await this.periodosService.create(payload); }
      }
      this.snackBar.open('✓ Fechas de evaluación guardadas', 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
    this.saving = false;
  }
}
