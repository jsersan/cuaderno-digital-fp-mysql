import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ModulosService, CiclosService, AuthService } from '@core/services';
import { ModuloProfesional, CicloFormativo } from '@core/models';

@Component({
  selector: 'app-modulos-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatChipsModule, MatSnackBarModule
  ],
  template: `
    <div class="page-header">
      <div><h2>Módulos Profesionales</h2><p class="subtitle">Módulos asignados</p></div>
      <button mat-raised-button color="primary" (click)="showForm = !showForm">
        <mat-icon>{{ showForm ? 'close' : 'add' }}</mat-icon>
        {{ showForm ? 'Cancelar' : 'Nuevo módulo' }}
      </button>
    </div>

    @if (showForm) {
      <mat-card class="form-card">
        <h3><mat-icon>menu_book</mat-icon> Crear nuevo módulo profesional</h3>
        <form [formGroup]="form" (ngSubmit)="crearModulo()">
          <div class="form-row">
            <mat-form-field appearance="outline" class="flex2">
              <mat-label>Nombre del módulo</mat-label>
              <input matInput formControlName="nombre" placeholder="Ej: Programación">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Abreviatura</mat-label>
              <input matInput formControlName="abreviatura" placeholder="Ej: PROG" maxlength="8">
            </mat-form-field>
          </div>
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Ciclo Formativo</mat-label>
              <mat-select formControlName="cicloId">
                @for (c of ciclos; track c.id) {
                  <mat-option [value]="c.id">{{ c.abreviatura }} - {{ c.nombre }}</mat-option>
                }
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Curso</mat-label>
              <mat-select formControlName="curso">
                <mat-option [value]="1">1º</mat-option>
                <mat-option [value]="2">2º</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Horas semanales</mat-label>
              <input matInput type="number" formControlName="horasSemanales" min="1" max="12">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Horas totales</mat-label>
              <input matInput type="number" formControlName="horasTotales" min="1">
            </mat-form-field>
          </div>

          <h4 class="sub-title">Criterios de calificación (%)</h4>
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Exámenes %</mat-label>
              <input matInput type="number" formControlName="pctExamenes" min="0" max="100">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Tareas %</mat-label>
              <input matInput type="number" formControlName="pctTareas" min="0" max="100">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Actitud %</mat-label>
              <input matInput type="number" formControlName="pctActitud" min="0" max="100">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Asistencia %</mat-label>
              <input matInput type="number" formControlName="pctAsistencia" min="0" max="100">
            </mat-form-field>
          </div>

          <div class="form-actions">
            <button mat-button type="button" (click)="showForm = false">Cancelar</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
              <mat-icon>save</mat-icon> {{ saving ? 'Creando...' : 'Crear módulo' }}
            </button>
          </div>
        </form>
      </mat-card>
    }

    <div class="modulos-grid">
      @for (mod of modulos; track mod.id) {
        <mat-card class="modulo-card" [routerLink]="['/modulos', mod.id]">
          <div class="mod-top">
            <span class="mod-abrev">{{ mod.abreviatura }}</span>
            <mat-chip>{{ mod.curso }}º</mat-chip>
          </div>
          <h3>{{ mod.nombre }}</h3>
          <div class="mod-details">
            <span><mat-icon>schedule</mat-icon> {{ mod.horasSemanales }}h/sem</span>
            <span><mat-icon>hourglass_full</mat-icon> {{ mod.horasTotales }}h totales</span>
          </div>
          <div class="mod-ra">
            {{ mod.resultadosAprendizaje.length || 0 }} Resultados de Aprendizaje
          </div>
        </mat-card>
      }
      @if (modulos.length === 0 && !showForm) {
        <mat-card class="empty-card">
          <mat-icon>menu_book</mat-icon>
          <p>No hay módulos creados</p>
          <button mat-raised-button color="primary" (click)="showForm = true">
            <mat-icon>add</mat-icon> Crear primer módulo
          </button>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .form-card { margin-bottom: 20px; padding: 24px; border-radius: 12px; border-left: 4px solid #1565c0; }
    .form-card h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 16px; color: #1565c0; }
    .sub-title { font-size: 14px; color: #666; margin: 16px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
    .form-row { display: flex; gap: 16px; }
    .form-row mat-form-field { flex: 1; }
    .flex2 { flex: 2 !important; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; padding-top: 16px; border-top: 1px solid #eee; }
    .modulos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
    .modulo-card { padding: 20px; border-radius: 12px; cursor: pointer; transition: transform 0.2s, box-shadow 0.2s; border-top: 4px solid #1565c0; }
    .modulo-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
    .mod-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .mod-abrev { font-weight: 700; font-size: 18px; color: #1565c0; }
    .modulo-card h3 { margin: 0 0 12px; font-size: 15px; }
    .mod-details { display: flex; gap: 16px; margin-bottom: 12px; }
    .mod-details span { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #666; }
    .mod-details mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .mod-ra { font-size: 12px; color: #999; padding-top: 8px; border-top: 1px solid #eee; }
    .empty-card { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .empty-card mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }
    @media (max-width: 600px) { .form-row { flex-direction: column; gap: 0; } }
  `]
})
export class ModulosListComponent implements OnInit {
  private modulosService = inject(ModulosService);
  private ciclosService = inject(CiclosService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);

  modulos: ModuloProfesional[] = [];
  ciclos: CicloFormativo[] = [];
  showForm = false;
  saving = false;
  form!: FormGroup;

  ngOnInit() {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      abreviatura: ['', Validators.required],
      cicloId: ['', Validators.required],
      curso: [1, Validators.required],
      horasSemanales: [6, [Validators.required, Validators.min(1)]],
      horasTotales: [192, [Validators.required, Validators.min(1)]],
      pctExamenes: [50], pctTareas: [30], pctActitud: [10], pctAsistencia: [10]
    });

    const user = this.auth.currentUser;
    if (!user) return;
    this.ciclosService.getByCentro$(user.centroId).subscribe(c => this.ciclos = c);
    this.loadModulos();
  }

  async loadModulos() {
    const user = this.auth.currentUser;
    if (!user) return;
    try {
      this.modulos = await this.modulosService.queryByField('profesorId', user.uid);
      console.log('Módulos cargados:', this.modulos.length, this.modulos);
    } catch (e: any) {
      console.error('Error cargando módulos:', e);
    }
  }

  async crearModulo() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const user = this.auth.currentUser;
    if (!user) return;

    const total = v.pctExamenes + v.pctTareas + v.pctActitud + v.pctAsistencia;
    if (total !== 100) {
      this.snackBar.open(`Los porcentajes suman ${total}%, deben sumar 100%`, 'Cerrar', { duration: 4000 });
      this.saving = false;
      return;
    }

    try {
      await this.modulosService.create({
        nombre: v.nombre,
        abreviatura: v.abreviatura.toUpperCase(),
        cicloId: v.cicloId,
        curso: v.curso,
        horasSemanales: v.horasSemanales,
        horasTotales: v.horasTotales,
        profesorId: user.uid,
        criteriosCalificacion: {
          porcentajeExamenes: v.pctExamenes,
          porcentajeTareas: v.pctTareas,
          porcentajeActitud: v.pctActitud,
          porcentajeAsistencia: v.pctAsistencia,
          notaMinimaAprobado: 5,
          porcentajeMinimoAsistencia: 85,
          requiereAprobadoExamen: false,
          recuperacionDisponible: true
        },
        resultadosAprendizaje: [],
        activo: true
      } as any);

      this.snackBar.open(`✓ Módulo "${v.abreviatura} - ${v.nombre}" creado`, 'OK', { duration: 3000 });
      this.form.reset({ curso: 1, horasSemanales: 6, horasTotales: 192, pctExamenes: 50, pctTareas: 30, pctActitud: 10, pctAsistencia: 10 });
      this.showForm = false;
      await this.loadModulos();
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    } finally { this.saving = false; }
  }
}
