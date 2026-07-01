import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Timestamp } from '@core/firebase-shim';
import { RecuperacionesService, ExamenesService, GruposService, ModulosService, AuthService } from '@core/services';
import { Examen, TipoEvaluacion, Grupo, ModuloProfesional } from '@core/models';
import { ActiveModuleService } from '../../../core/services/active-module.service';

@Component({
  selector: 'app-recuperacion-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule, 
    MatDatepickerModule, MatNativeDateModule, MatButtonModule, MatIconModule, MatSnackBarModule, TranslateModule
  ],
  template: `
    <div class="page-header"><h2>{{ (isEditing ? 'recovery.form.title_edit' : 'recovery.form.title_new') | translate }}</h2></div>
    <mat-card class="form-card">
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'exams.form.exam_title' | translate }}</mat-label>
          <input matInput formControlName="titulo">
        </mat-form-field>

        @if (!isEditing) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>{{ 'recovery.form.original_exam' | translate }}</mat-label>
            <mat-select formControlName="examenOriginalId" (selectionChange)="onExamenChange()">
              <mat-option value="">{{ 'recovery.form.manual' | translate }}</mat-option>
              @for (ex of examenes; track ex.id) { <mat-option [value]="ex.id">{{ ex.titulo }}</mat-option> }
            </mat-select>
            <mat-hint>{{ 'recovery.form.original_exam_hint' | translate }}</mat-hint>
          </mat-form-field>
        }

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
          <mat-form-field appearance="outline"><mat-label>{{ 'common.date' | translate }}</mat-label>
            <input matInput [matDatepicker]="dp" formControlName="fecha">
            <mat-datepicker-toggle matSuffix [for]="dp"></mat-datepicker-toggle>
            <mat-datepicker #dp></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'recovery.form.max_grade' | translate }}</mat-label>
            <input matInput type="number" formControlName="notaMaximaRecuperacion" step="0.5">
            <mat-hint>{{ 'recovery.form.max_grade_hint' | translate }}</mat-hint>
          </mat-form-field>
        </div>

        <div class="form-actions">
          <button mat-button routerLink="/recuperaciones" type="button">{{ 'common.cancel' | translate }}</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid">
            <mat-icon>save</mat-icon> {{ (isEditing ? 'common.save' : 'common.create') | translate }}
          </button>
        </div>
      </form>
    </mat-card>
  `,
  styles: [`
    .page-header h2 { font-size: 24px; font-weight: 700; }
    .form-card { padding: 24px; border-radius: 12px; max-width: 700px; }
    .form-row { display: flex; gap: 16px; }
    .form-row mat-form-field { flex: 1; }
    .full-width { width: 100%; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0; }
  `]
})
export class RecuperacionFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private recService = inject(RecuperacionesService);
  private examenesService = inject(ExamenesService);
  private gruposService = inject(GruposService);
  private modulosService = inject(ModulosService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private activeModule = inject(ActiveModuleService);
  private t = inject(TranslateService);

  form!: FormGroup;
  examenes: Examen[] = [];
  grupos: Grupo[] = [];
  modulos: ModuloProfesional[] = [];
  isEditing = false;
  recuperacionId: string | null = null;

  ngOnInit() {
    this.form = this.fb.group({
      titulo: ['', Validators.required],
      examenOriginalId: [''],
      grupoId: ['', Validators.required],
      moduloId: ['', Validators.required],
      fecha: ['', Validators.required],
      notaMaximaRecuperacion: [6, [Validators.required, Validators.min(1)]]
    });
    const user = this.auth.currentUser;
    if (!user) return;
    this.examenesService.getByProfesor$(user.uid).subscribe(e => this.examenes = e);
    this.gruposService.getByCentro$(user.centroId, this.activeModule.cursoActual).subscribe(g => this.grupos = g);
    this.modulosService.getByProfesor$(user.uid).subscribe(m => this.modulos = m);

    this.recuperacionId = this.route.snapshot.paramMap.get('id');
    this.isEditing = !!this.recuperacionId;
    if (this.isEditing && this.recuperacionId) {
      this.loadRecuperacion(this.recuperacionId);
    }
  }

  async loadRecuperacion(id: string) {
    const rec = await this.recService.getById(id);
    if (!rec) return;
    this.form.patchValue({
      titulo: rec.titulo,
      grupoId: rec.grupoId,
      moduloId: rec.moduloId,
      fecha: rec.fecha?.toDate ? rec.fecha.toDate() : null,
      notaMaximaRecuperacion: rec.notaMaximaRecuperacion
    });
  }

  onExamenChange() {
    const exId = this.form.get('examenOriginalId')?.value;
    const examen = this.examenes.find(e => e.id === exId);
    if (examen) {
      this.form.patchValue({
        titulo: `${this.t.instant('recovery.title')}: ${examen.titulo}`,
        grupoId: examen.grupoId,
        moduloId: examen.moduloId
      });
    }
  }

  async onSubmit() {
    if (this.form.invalid) return;
    const v = this.form.value;
    try {
      if (this.isEditing && this.recuperacionId) {
        // Edición: actualizar solo los campos editables (no toca los alumnos convocados ni sus notas)
        await this.recService.update(this.recuperacionId, {
          titulo: v.titulo,
          grupoId: v.grupoId,
          moduloId: v.moduloId,
          fecha: Timestamp.fromDate(new Date(v.fecha)),
          notaMaximaRecuperacion: v.notaMaximaRecuperacion
        } as any);
        this.snackBar.open(this.t.instant('recovery.form.updated'), 'OK', { duration: 3000 });
      } else if (v.examenOriginalId) {
        const examen = this.examenes.find(e => e.id === v.examenOriginalId);
        if (examen) {
          await this.recService.crearDesdeExamen(examen, v.fecha, v.notaMaximaRecuperacion);
        }
        this.snackBar.open(this.t.instant('recovery.form.created'), 'OK', { duration: 3000 });
      } else {
        await this.recService.create({
          titulo: v.titulo, moduloId: v.moduloId, grupoId: v.grupoId,
          profesorId: this.auth.currentUser?.uid,
          fecha: Timestamp.fromDate(v.fecha),
          tipoRecuperacion: 'examen', evaluacion: TipoEvaluacion.PRIMERA,
          puntuacionMaxima: 10, notaMaximaRecuperacion: v.notaMaximaRecuperacion,
          notaMinimaAprobado: 5, alumnosConvocados: [],
          publicada: true, resultadosPublicados: false,
          resultadosAprendizajeIds: [], criteriosEvaluacionIds: []
        } as any);
        this.snackBar.open(this.t.instant('recovery.form.created'), 'OK', { duration: 3000 });
      }
      this.router.navigate(['/recuperaciones']);
    } catch (e: any) { this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 }); }
  }
}