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
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { Timestamp } from '@core/firebase-shim';
import { AlumnosService, GruposService, CiclosService, ModulosService, AuthService, ActiveModuleService } from '@core/services';
import { Alumno, EstadoAlumno, Grupo, CicloFormativo, ModuloProfesional } from '@core/models';

@Component({
  selector: 'app-alumno-form',
  standalone: true,
  imports: [
    CommonModule, ReactiveFormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatInputModule,
    MatSelectModule, MatCheckboxModule, MatDatepickerModule,
    MatNativeDateModule, MatButtonModule, MatIconModule, MatSnackBarModule, TranslateModule
  ],
  template: `
    <div class="page-header">
      <h2>{{ (isEditing ? 'students.form.title_edit' : 'students.form.title_new') | translate }}</h2>
    </div>

    <mat-card class="form-card">
      <form [formGroup]="form" (ngSubmit)="onSubmit()">

        <h3 class="section-title">{{ 'students.form.section_personal' | translate }}</h3>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'common.name' | translate }}</mat-label>
            <input matInput formControlName="nombre">
            <mat-error>{{ 'students.form.required' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'common.surname' | translate }}</mat-label>
            <input matInput formControlName="apellidos">
            <mat-error>{{ 'students.form.required' | translate }}</mat-error>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'students.form.dni' | translate }}</mat-label>
            <input matInput formControlName="dni">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'students.form.birth_date' | translate }}</mat-label>
            <input matInput [matDatepicker]="picker" formControlName="fechaNacimiento">
            <mat-datepicker-toggle matSuffix [for]="picker"></mat-datepicker-toggle>
            <mat-datepicker #picker></mat-datepicker>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'common.email' | translate }}</mat-label>
            <input matInput formControlName="email" type="email">
            <mat-error>{{ 'students.form.valid_email' | translate }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'common.phone' | translate }}</mat-label>
            <input matInput formControlName="telefono">
          </mat-form-field>
        </div>

        <h3 class="section-title">{{ 'students.form.section_tutor' | translate }}</h3>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'students.form.tutor_name' | translate }}</mat-label>
            <input matInput formControlName="nombreTutor">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'students.form.tutor_phone' | translate }}</mat-label>
            <input matInput formControlName="telefonoTutor">
          </mat-form-field>
        </div>

        <h3 class="section-title">{{ 'students.form.section_academic' | translate }}</h3>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'students.form.cycle' | translate }}</mat-label>
            <mat-select formControlName="cicloId" (selectionChange)="onCicloChange()">
              @for (ciclo of ciclos; track ciclo.id) {
                <mat-option [value]="ciclo.id">{{ ciclo.abreviatura }} - {{ ciclo.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'common.group' | translate }}</mat-label>
            <mat-select formControlName="grupoId">
              @for (grupo of gruposFiltrados; track grupo.id) {
                <mat-option [value]="grupo.id">{{ grupo.nombre }}</mat-option>
              }
            </mat-select>
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'students.form.course' | translate }}</mat-label>
            <mat-select formControlName="curso">
              <mat-option [value]="1">1º</mat-option>
              <mat-option [value]="2">2º</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'common.status' | translate }}</mat-label>
            <mat-select formControlName="estado">
              <mat-option value="activo">{{ 'students.status_active' | translate }}</mat-option>
              <mat-option value="baja">{{ 'students.status_inactive' | translate }}</mat-option>
              <mat-option value="trasladado">{{ 'students.status_transferred' | translate }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>

        <mat-checkbox formControlName="repetidor" class="check-field">
          {{ 'students.form.repeater' | translate }}
        </mat-checkbox>

        <h3 class="section-title">{{ 'students.form.section_modules' | translate }}</h3>
        <div class="modulos-list">
          @for (mod of modulosCiclo; track mod.id) {
            <mat-checkbox [checked]="isModuloSelected(mod.id!)"
                          (change)="toggleModulo(mod)">
              {{ mod.abreviatura }} - {{ mod.nombre }} ({{ mod.horasSemanales }}{{ 'dashboard.hours_week' | translate }})
            </mat-checkbox>
          }
          @if (modulosCiclo.length === 0) {
            <p class="hint-text">{{ 'students.form.select_cycle_hint' | translate }}</p>
          }
        </div>

        <h3 class="section-title">{{ 'students.form.section_address' | translate }}</h3>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'students.form.address' | translate }}</mat-label>
          <input matInput formControlName="direccion">
        </mat-form-field>
        <div class="form-row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'students.form.locality' | translate }}</mat-label>
            <input matInput formControlName="localidad">
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'students.form.postal_code' | translate }}</mat-label>
            <input matInput formControlName="codigoPostal">
          </mat-form-field>
        </div>

        <h3 class="section-title">{{ 'students.form.section_observations' | translate }}</h3>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'students.form.special_needs' | translate }}</mat-label>
          <textarea matInput formControlName="necesidadesEspeciales" rows="2"></textarea>
        </mat-form-field>
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>{{ 'students.form.general_obs' | translate }}</mat-label>
          <textarea matInput formControlName="observaciones" rows="3"></textarea>
        </mat-form-field>

        <!-- Botones -->
        <div class="form-actions">
          <button mat-button routerLink="/alumnos" type="button">{{ 'common.cancel' | translate }}</button>
          <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
            <mat-icon>save</mat-icon>
            {{ (isEditing ? 'students.form.save_changes' : 'students.form.title_new') | translate }}
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
    .check-field { margin: 8px 0 16px; }
    .modulos-list { display: flex; flex-direction: column; gap: 8px; padding: 8px 0; }
    .hint-text { color: #999; font-size: 13px; font-style: italic; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e0e0e0; }
    @media (max-width: 600px) { .form-row { flex-direction: column; gap: 0; } }
  `]
})
export class AlumnoFormComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private alumnosService = inject(AlumnosService);
  private gruposService = inject(GruposService);
  private ciclosService = inject(CiclosService);
  private modulosService = inject(ModulosService);
  private activeModule = inject(ActiveModuleService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);

  form!: FormGroup;
  isEditing = false;
  saving = false;
  alumnoId: string | null = null;

  ciclos: CicloFormativo[] = [];
  grupos: Grupo[] = [];
  gruposFiltrados: Grupo[] = [];
  modulosCiclo: ModuloProfesional[] = [];
  selectedModulos: Set<string> = new Set();

  ngOnInit() {
    this.alumnoId = this.route.snapshot.paramMap.get('id');
    this.isEditing = !!this.alumnoId;
    this.initForm();
    this.loadData();

    if (this.isEditing && this.alumnoId) {
      this.loadAlumno(this.alumnoId);
    }
  }

  initForm() {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      apellidos: ['', Validators.required],
      dni: [''],
      fechaNacimiento: [null],
      email: ['', [Validators.required, Validators.email]],
      telefono: [''],
      nombreTutor: [''],
      telefonoTutor: [''],
      cicloId: ['', Validators.required],
      grupoId: ['', Validators.required],
      curso: [1, Validators.required],
      estado: [EstadoAlumno.ACTIVO],
      repetidor: [false],
      direccion: [''],
      localidad: [''],
      codigoPostal: [''],
      necesidadesEspeciales: [''],
      observaciones: ['']
    });
  }

  async loadData() {
    const user = this.auth.currentUser;
    if (!user) return;
    this.ciclosService.getByCentro$(user.centroId).subscribe(c => this.ciclos = c);
    this.gruposService.getByCentro$(user.centroId, this.activeModule.cursoActual).subscribe(g => this.grupos = g);
  }

  async loadAlumno(id: string) {
    const alumno = await this.alumnosService.getById(id);
    if (!alumno) return;
    this.form.patchValue({
      ...alumno,
      fechaNacimiento: alumno.fechaNacimiento?.toDate()
    });
    alumno.matriculas?.forEach(m => this.selectedModulos.add(m.moduloId));
    this.onCicloChange();
  }

  onCicloChange() {
    const cicloId = this.form.get('cicloId')?.value;
    this.gruposFiltrados = this.grupos.filter(g => g.cicloId === cicloId);
    if (cicloId) {
      this.modulosService.getByCiclo$(cicloId).subscribe(m => this.modulosCiclo = m);
    }
  }

  isModuloSelected(moduloId: string): boolean {
    return this.selectedModulos.has(moduloId);
  }

  toggleModulo(mod: ModuloProfesional) {
    if (this.selectedModulos.has(mod.id!)) {
      this.selectedModulos.delete(mod.id!);
    } else {
      this.selectedModulos.add(mod.id!);
    }
  }

  async onSubmit() {
    if (this.form.invalid) return;
    this.saving = true;

    const formVal = this.form.value;
    const user = this.auth.currentUser;

    const matriculas = Array.from(this.selectedModulos).map(modId => {
      const mod = this.modulosCiclo.find(m => m.id === modId);
      return {
        moduloId: modId,
        moduloNombre: mod?.nombre || '',
        convocatoria: 1,
        estado: 'matriculado' as const
      };
    });

    const alumno: Partial<Alumno> = {
      ...formVal,
      centroId: user?.centroId || '',
      cursoAcademico: this.activeModule.cursoActual,
      matriculas,
      fechaNacimiento: formVal.fechaNacimiento ? Timestamp.fromDate(formVal.fechaNacimiento) : undefined
    };

    try {
      if (this.isEditing && this.alumnoId) {
        await this.alumnosService.update(this.alumnoId, alumno);
        this.snackBar.open(this.t.instant('students.form.updated'), 'OK', { duration: 3000 });
      } else {
        await this.alumnosService.create(alumno);
        this.snackBar.open(this.t.instant('students.form.created'), 'OK', { duration: 3000 });
      }
      this.router.navigate(['/alumnos']);
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    } finally {
      this.saving = false;
    }
  }
}
