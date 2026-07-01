import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Timestamp } from '@core/firebase-shim';
import { TareasService, GruposService, ModulosService, AuthService, ActiveModuleService } from '@core/services';
import { Grupo, ModuloProfesional, TipoEvaluacion } from '@core/models';

@Component({
  selector: 'app-tarea-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatCheckboxModule, MatDatepickerModule, MatNativeDateModule,
    MatButtonModule, MatIconModule, MatSliderModule, MatSnackBarModule, TranslateModule
  ],
  template: `
    <div class="page-header">
      <h2>{{ (isEditing ? 'tasks.form.title_edit' : 'tasks.form.title_new') | translate }}</h2>
    </div>

    <mat-card class="form-card">
      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <h3 class="section-title">{{ 'tasks.form.section_general' | translate }}</h3>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'tasks.form.task_title' | translate }}</mat-label>
          <input matInput formControlName="titulo" [placeholder]="'tasks.form.task_title_ph' | translate">
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'tasks.form.statement' | translate }}</mat-label>
          <textarea matInput formControlName="descripcion" rows="5"
                    [placeholder]="'tasks.form.statement_ph' | translate"></textarea>
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'common.group' | translate }}</mat-label>
            <mat-select formControlName="grupoId">
              @for (g of grupos; track g.id) {
                <mat-option [value]="g.id">{{ g.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'common.module' | translate }}</mat-label>
            <mat-select formControlName="moduloId">
              @for (m of modulos; track m.id) {
                <mat-option [value]="m.id">{{ m.abreviatura }} - {{ m.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.evaluation' | translate }}</mat-label>
          <mat-select formControlName="evaluacion">
            @for (ev of evaluaciones; track ev) {
              <mat-option [value]="ev">{{ ev }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        <h3 class="section-title">{{ 'tasks.form.section_dates' | translate }}</h3>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'tasks.form.pub_date' | translate }}</mat-label>
            <input matInput [matDatepicker]="pickPub" formControlName="fechaPublicacion">
            <mat-datepicker-toggle matSuffix [for]="pickPub"></mat-datepicker-toggle>
            <mat-datepicker #pickPub></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'tasks.form.due_date' | translate }}</mat-label>
            <input matInput [matDatepicker]="pickEnt" formControlName="fechaEntrega">
            <mat-datepicker-toggle matSuffix [for]="pickEnt"></mat-datepicker-toggle>
            <mat-datepicker #pickEnt></mat-datepicker>
          </mat-form-field>
        </div>

        <mat-checkbox formControlName="permiteEntregaTardia">
          {{ 'tasks.form.allow_late' | translate }}
        </mat-checkbox>

        @if (form.get('permiteEntregaTardia')?.value) {
          <div class="form-row" style="margin-top: 12px">
            <mat-form-field appearance="outline">
              <mat-label>{{ 'tasks.form.late_limit' | translate }}</mat-label>
              <input matInput [matDatepicker]="pickTard" formControlName="fechaLimiteRetraso">
              <mat-datepicker-toggle matSuffix [for]="pickTard"></mat-datepicker-toggle>
              <mat-datepicker #pickTard></mat-datepicker>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>{{ 'tasks.form.penalty' | translate }}</mat-label>
              <input matInput type="number" formControlName="penalizacionRetraso" min="0" max="100">
              <mat-hint>{{ 'tasks.form.penalty_hint' | translate }}</mat-hint>
            </mat-form-field>
          </div>
        }

        <h3 class="section-title">{{ 'tasks.form.section_grading' | translate }}</h3>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'common.max_score' | translate }}</mat-label>
            <input matInput type="number" formControlName="puntuacionMaxima" min="1">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'tasks.form.weight' | translate }}</mat-label>
            <input matInput type="number" formControlName="porcentajeNotaFinal" min="0" max="100">
          </mat-form-field>
        </div>

        <h3 class="section-title">{{ 'tasks.form.section_options' | translate }}</h3>
        <div class="options-row">
          <mat-checkbox formControlName="esGrupal">{{ 'tasks.form.group_task' | translate }}</mat-checkbox>
          <mat-checkbox formControlName="requiereArchivo">{{ 'tasks.form.requires_file' | translate }}</mat-checkbox>
          <mat-checkbox formControlName="publicada">{{ 'tasks.form.publish_now' | translate }}</mat-checkbox>
        </div>

        <div class="form-actions">
          <button mat-button routerLink="/tareas" type="button">{{ 'common.cancel' | translate }}</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
            <mat-icon>save</mat-icon> {{ (isEditing ? 'common.save' : 'common.create') | translate }}
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
    .options-row { display: flex; gap: 24px; flex-wrap: wrap; margin: 8px 0; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0; }
    @media (max-width: 600px) { .form-row { flex-direction: column; gap: 0; } .options-row { flex-direction: column; gap: 8px; } }
  `]
})
export class TareaFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private tareasService = inject(TareasService);
  private gruposService = inject(GruposService);
  private modulosService = inject(ModulosService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);
  private activeModule = inject(ActiveModuleService);

  form!: FormGroup;
  isEditing = false;
  saving = false;
  grupos: Grupo[] = [];
  modulos: ModuloProfesional[] = [];
  evaluaciones = Object.values(TipoEvaluacion);

  ngOnInit() {
    const id = this.route.snapshot.paramMap.get('id');
    this.isEditing = !!id;
    this.initForm();
    this.loadData();
    if (id) this.loadTarea(id);
  }

  initForm() {
    this.form = this.fb.group({
      titulo: ['', Validators.required],
      descripcion: ['', Validators.required],
      grupoId: ['', Validators.required],
      moduloId: ['', Validators.required],
      evaluacion: [TipoEvaluacion.PRIMERA, Validators.required],
      fechaPublicacion: [new Date(), Validators.required],
      fechaEntrega: ['', Validators.required],
      fechaLimiteRetraso: [null],
      permiteEntregaTardia: [false],
      penalizacionRetraso: [20],
      puntuacionMaxima: [10, [Validators.required, Validators.min(1)]],
      porcentajeNotaFinal: [10, [Validators.required, Validators.min(0), Validators.max(100)]],
      esGrupal: [false],
      requiereArchivo: [true],
      publicada: [true]
    });
  }

  loadData() {
    const user = this.auth.currentUser;
    if (!user) return;
    this.gruposService.getByCentro$(user.centroId, this.activeModule.cursoActual).subscribe(g => this.grupos = g);
    this.modulosService.getByProfesor$(user.uid).subscribe(m => this.modulos = m);
  }

  async loadTarea(id: string) {
    const tarea = await this.tareasService.getById(id);
    if (tarea) {
      this.form.patchValue({
        ...tarea,
        fechaPublicacion: tarea.fechaPublicacion?.toDate(),
        fechaEntrega: tarea.fechaEntrega?.toDate(),
        fechaLimiteRetraso: tarea.fechaLimiteRetraso?.toDate()
      });
    }
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const user = this.auth.currentUser;
    const data: any = {
      ...v,
      profesorId: user?.uid,
      fechaPublicacion: Timestamp.fromDate(v.fechaPublicacion),
      fechaEntrega: Timestamp.fromDate(v.fechaEntrega),
      fechaLimiteRetraso: v.fechaLimiteRetraso ? Timestamp.fromDate(v.fechaLimiteRetraso) : null,
      archivada: false,
      entregas: [],
      adjuntos: [],
      resultadosAprendizajeIds: [],
      criteriosEvaluacionIds: []
    };
    try {
      const id = this.route.snapshot.paramMap.get('id');
      if (this.isEditing && id) {
        await this.tareasService.update(id, data);
        this.snackBar.open(this.t.instant('tasks.form.updated'), 'OK', { duration: 3000 });
      } else {
        await this.tareasService.create(data);
        this.snackBar.open(this.t.instant('tasks.form.created'), 'OK', { duration: 3000 });
      }
      this.router.navigate(['/tareas']);
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    } finally { this.saving = false; }
  }
}