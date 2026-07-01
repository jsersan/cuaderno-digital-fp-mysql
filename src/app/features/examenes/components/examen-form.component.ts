// ============= EXAMEN FORM =============
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Timestamp } from '@core/firebase-shim';
import { ExamenesService, GruposService, ModulosService, AuthService, ActiveModuleService } from '@core/services';
import { TipoExamen, TipoEvaluacion, Grupo, ModuloProfesional } from '@core/models';

@Component({
  selector: 'app-examen-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, TranslateModule
  ],
  template: `
    <div class="page-header"><h2>{{ 'exams.form.title_new' | translate }}</h2></div>
    <mat-card class="form-card">
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <h3 class="section-title">{{ 'exams.form.section_info' | translate }}</h3>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'exams.form.exam_title' | translate }}</mat-label>
          <input matInput formControlName="titulo" [placeholder]="'exams.form.exam_title_ph' | translate">
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'common.description' | translate }}</mat-label>
          <textarea matInput formControlName="descripcion" rows="3"></textarea>
        </mat-form-field>
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>{{ 'common.group' | translate }}</mat-label>
            <mat-select formControlName="grupoId">
              @for (g of grupos; track g.id) { <mat-option [value]="g.id">{{ g.nombre }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'common.module' | translate }}</mat-label>
            <mat-select formControlName="moduloId">
              @for (m of modulos; track m.id) { <mat-option [value]="m.id">{{ m.abreviatura }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>{{ 'exams.type' | translate }}</mat-label>
            <mat-select formControlName="tipo">
              @for (t of tipos; track t) { <mat-option [value]="t">{{ t | titlecase }}</mat-option> }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'common.evaluation' | translate }}</mat-label>
            <mat-select formControlName="evaluacion">
              @for (e of evaluaciones; track e) { <mat-option [value]="e">{{ e }}</mat-option> }
            </mat-select>
          </mat-form-field>
        </div>

        <h3 class="section-title">{{ 'exams.form.section_place' | translate }}</h3>
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>{{ 'common.date' | translate }}</mat-label>
            <input matInput [matDatepicker]="dp" formControlName="fecha">
            <mat-datepicker-toggle matSuffix [for]="dp"></mat-datepicker-toggle>
            <mat-datepicker #dp></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'exams.form.start_time' | translate }}</mat-label>
            <input matInput formControlName="horaInicio" placeholder="08:30">
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'exams.form.end_time' | translate }}</mat-label>
            <input matInput formControlName="horaFin" placeholder="10:20">
          </mat-form-field>
        </div>
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>{{ 'exams.form.classroom' | translate }}</mat-label>
            <input matInput formControlName="aula">
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'exams.form.duration' | translate }}</mat-label>
            <input matInput type="number" formControlName="duracionMinutos">
          </mat-form-field>
        </div>

        <h3 class="section-title">{{ 'exams.form.section_grading' | translate }}</h3>
        <div class="form-row">
          <mat-form-field appearance="outline"><mat-label>{{ 'common.max_score' | translate }}</mat-label>
            <input matInput type="number" formControlName="puntuacionMaxima">
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'common.min_pass' | translate }}</mat-label>
            <input matInput type="number" formControlName="notaMinimaAprobado" step="0.1">
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'exams.form.weight' | translate }}</mat-label>
            <input matInput type="number" formControlName="porcentajeNotaFinal">
          </mat-form-field>
        </div>
        <mat-checkbox formControlName="permiteRecuperacion">{{ 'exams.form.allow_recovery' | translate }}</mat-checkbox>

        <div class="form-actions">
          <button mat-button routerLink="/examenes" type="button">{{ 'common.cancel' | translate }}</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid">
            <mat-icon>save</mat-icon> {{ 'common.create' | translate }}
          </button>
        </div>
      </form>
    </mat-card>
  `,
  styles: [`
    .page-header h2 { font-size: 24px; font-weight: 700; }
    .form-card { padding: 24px; border-radius: 12px; max-width: 800px; }
    .section-title { font-size: 16px; font-weight: 600; color: #1565c0; margin: 24px 0 12px; border-bottom: 1px solid #e0e0e0; padding-bottom: 8px; }
    .form-row { display: flex; gap: 16px; }
    .form-row mat-form-field { flex: 1; }
    .full-width { width: 100%; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0; }
  `]
})
export class ExamenFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private examenesService = inject(ExamenesService);
  private gruposService = inject(GruposService);
  private modulosService = inject(ModulosService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);
  private activeModule = inject(ActiveModuleService);

  form!: FormGroup;
  grupos: Grupo[] = [];
  modulos: ModuloProfesional[] = [];
  tipos = Object.values(TipoExamen);
  evaluaciones = Object.values(TipoEvaluacion);

  ngOnInit() {
    this.form = this.fb.group({
      titulo: ['', Validators.required], descripcion: [''],
      grupoId: ['', Validators.required], moduloId: ['', Validators.required],
      tipo: [TipoExamen.PARCIAL], evaluacion: [TipoEvaluacion.PRIMERA],
      fecha: ['', Validators.required], horaInicio: ['08:30'], horaFin: ['10:20'],
      aula: [''], duracionMinutos: [110],
      puntuacionMaxima: [10, Validators.required], notaMinimaAprobado: [5],
      porcentajeNotaFinal: [30], permiteRecuperacion: [true]
    });
    const user = this.auth.currentUser;
    if (!user) return;
    this.gruposService.getByCentro$(user.centroId, this.activeModule.cursoActual).subscribe(g => this.grupos = g);
    this.modulosService.getByProfesor$(user.uid).subscribe(m => this.modulos = m);
  }

  async onSubmit() {
    if (this.form.invalid) return;
    const v = this.form.value;
    try {
      await this.examenesService.create({
        ...v, profesorId: this.auth.currentUser?.uid,
        fecha: Timestamp.fromDate(v.fecha),
        publicado: true, resultadosPublicados: false,
        tienePonderacion: false, calificaciones: [],
        resultadosAprendizajeIds: [], criteriosEvaluacionIds: []
      });
      this.snackBar.open(this.t.instant('exams.form.created'), 'OK', { duration: 3000 });
      this.router.navigate(['/examenes']);
    } catch (e: any) { this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 }); }
  }
}