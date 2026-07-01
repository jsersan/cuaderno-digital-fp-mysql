import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { RecuperacionesService } from '@core/services';
import { Recuperacion, AlumnoRecuperacion } from '@core/models';

@Component({
  selector: 'app-recuperacion-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule, MatChipsModule, MatTooltipModule, MatSnackBarModule, TranslateModule],
  template: `
    @if (rec) {
      <div class="page-header">
        <div>
          <h2>{{ rec.titulo }}</h2>
          <p class="subtitle">{{ 'recovery.detail.subtitle' | translate:{ max: rec.notaMaximaRecuperacion, min: rec.notaMinimaAprobado } }}</p>
        </div>
        <button mat-button routerLink="/recuperaciones"><mat-icon>arrow_back</mat-icon> {{ 'common.back' | translate }}</button>
      </div>

      <mat-card class="calificar-card">
        <div class="row header-row">
          <span class="col-alumno">{{ 'recovery.detail.student' | translate }}</span>
          <span class="col-orig">{{ 'recovery.detail.original_grade' | translate }}</span>
          <span class="col-nota">{{ 'recovery.detail.recovery_grade' | translate }}</span>
          <span class="col-estado">{{ 'common.status' | translate }}</span>
          <span class="col-action"></span>
        </div>

        @for (alumno of rec.alumnosConvocados; track alumno.alumnoId) {
          <div class="row" [class.aprobado]="alumno.estado === 'aprobado'" [class.suspenso]="alumno.estado === 'suspenso'">
            <span class="col-alumno">{{ alumno.alumnoNombre }}</span>
            <span class="col-orig">{{ alumno.notaOriginal | number:'1.1-1' }}</span>
            <div class="col-nota">
              <input type="number" [(ngModel)]="notasRec[alumno.alumnoId]"
                     [min]="0" [max]="rec.notaMaximaRecuperacion" step="0.1"
                     class="nota-input">
            </div>
            <span class="col-estado">
              <mat-chip [class]="'estado-' + alumno.estado">{{ alumno.estado | titlecase }}</mat-chip>
            </span>
            <div class="col-action">
              <button mat-icon-button color="primary" (click)="calificar(alumno)"
                      [matTooltip]="'recovery.detail.save' | translate" [disabled]="notasRec[alumno.alumnoId] === undefined">
                <mat-icon>check</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="marcarNP(alumno)" [matTooltip]="'recovery.detail.not_present' | translate">
                <mat-icon>person_off</mat-icon>
              </button>
            </div>
          </div>
        }
      </mat-card>

      <div class="actions-bottom">
        <button mat-raised-button color="accent" (click)="publicar()" [disabled]="rec.resultadosPublicados">
          <mat-icon>publish</mat-icon> {{ 'recovery.detail.publish' | translate }}
        </button>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; }
    .subtitle { color: #666; }
    .calificar-card { border-radius: 12px; overflow: hidden; max-width: 900px; }
    .row { display: flex; align-items: center; padding: 10px 16px; border-bottom: 1px solid #f0f0f0; }
    .header-row { background: #ff9800; color: white; font-weight: 500; font-size: 13px; }
    .row.aprobado { border-left: 3px solid #4caf50; }
    .row.suspenso { border-left: 3px solid #f44336; }
    .col-alumno { flex: 2; font-weight: 500; }
    .col-orig { flex: 0 0 80px; text-align: center; color: #999; }
    .col-nota { flex: 0 0 100px; }
    .col-estado { flex: 0 0 120px; }
    .col-action { flex: 0 0 100px; display: flex; gap: 4px; }
    .nota-input { width: 80px; padding: 8px; border: 1px solid #ddd; border-radius: 6px; font-size: 16px; font-weight: 700; text-align: center; }
    .estado-convocado { background: #fff3e0 !important; color: #e65100 !important; }
    .estado-aprobado { background: #e8f5e9 !important; color: #2e7d32 !important; }
    .estado-suspenso { background: #ffebee !important; color: #c62828 !important; }
    .estado-no_presentado { background: #f5f5f5 !important; color: #999 !important; }
    .actions-bottom { margin-top: 16px; }
  `]
})
export class RecuperacionDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private recService = inject(RecuperacionesService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);

  rec: Recuperacion | null = null;
  notasRec: { [id: string]: number } = {};

  async ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.rec = await this.recService.getById(id);
      (this.rec?.alumnosConvocados || []).forEach(a => {
        if (a.notaRecuperacion !== undefined) this.notasRec[a.alumnoId] = a.notaRecuperacion;
      });
    }
  }

  async calificar(alumno: AlumnoRecuperacion) {
    if (!this.rec?.id) return;
    try {
      await this.recService.calificarAlumno(this.rec.id, alumno.alumnoId, this.notasRec[alumno.alumnoId]);
      this.rec = await this.recService.getById(this.rec.id);
      this.snackBar.open(this.t.instant('recovery.detail.grade_saved'), 'OK', { duration: 2000 });
    } catch (e: any) { this.snackBar.open(e.message, 'Cerrar', { duration: 5000 }); }
  }

  async marcarNP(alumno: AlumnoRecuperacion) {
    if (!this.rec?.id) return;
    await this.recService.marcarNoPresentado(this.rec.id, alumno.alumnoId);
    this.rec = await this.recService.getById(this.rec.id);
    this.snackBar.open(this.t.instant('recovery.detail.marked_np'), 'OK', { duration: 2000 });
  }

  async publicar() {
    if (!this.rec?.id) return;
    await this.recService.publicarResultados(this.rec.id);
    this.snackBar.open(this.t.instant('recovery.detail.published'), 'OK', { duration: 3000 });
  }
}