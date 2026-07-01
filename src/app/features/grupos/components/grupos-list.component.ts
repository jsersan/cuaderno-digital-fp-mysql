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
import { MatMenuModule } from '@angular/material/menu';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { GruposService, AlumnosService, CiclosService, AuthService } from '@core/services';
import { Grupo, CicloFormativo } from '@core/models';
import { ActiveModuleService } from '../../../core/services/active-module.service';

@Component({
  selector: 'app-grupos-list',
  standalone: true,
  imports: [
    CommonModule, RouterLink, ReactiveFormsModule,
    MatCardModule, MatFormFieldModule, MatInputModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatChipsModule, MatMenuModule, MatSnackBarModule
  ],
  template: `
    <div class="page-header">
      <div><h2>Grupos</h2><p class="subtitle">Gestión de grupos del centro</p></div>
      <button mat-raised-button color="primary" (click)="showForm = !showForm">
        <mat-icon>{{ showForm ? 'close' : 'add' }}</mat-icon>
        {{ showForm ? 'Cancelar' : 'Nuevo grupo' }}
      </button>
    </div>

    @if (showForm) {
      <mat-card class="form-card">
        <h3><mat-icon>group_add</mat-icon> Crear nuevo grupo</h3>
        <form [formGroup]="form" (ngSubmit)="crearGrupo()">
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Nombre del grupo</mat-label>
              <input matInput formControlName="nombre" placeholder="Ej: 1º DAW A">
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Ciclo Formativo</mat-label>
              <mat-select formControlName="cicloId">
                @for (c of ciclos; track c.id) {
                  <mat-option [value]="c.id">{{ c.abreviatura }} - {{ c.nombre }}</mat-option>
                }
                <mat-option value="__new__">+ Crear ciclo nuevo...</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          @if (form.get('cicloId')?.value === '__new__') {
            <div class="form-row">
              <mat-form-field appearance="outline">
                <mat-label>Nombre del ciclo</mat-label>
                <input matInput formControlName="cicloNuevoNombre" placeholder="Ej: Desarrollo de Aplicaciones Web">
              </mat-form-field>
              <mat-form-field appearance="outline">
                <mat-label>Abreviatura</mat-label>
                <input matInput formControlName="cicloNuevoAbrev" placeholder="Ej: DAW">
              </mat-form-field>
            </div>
          }
          <div class="form-row">
            <mat-form-field appearance="outline">
              <mat-label>Curso</mat-label>
              <mat-select formControlName="curso">
                <mat-option [value]="1">1º</mat-option>
                <mat-option [value]="2">2º</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Letra</mat-label>
              <mat-select formControlName="letra">
                <mat-option value="A">A</mat-option>
                <mat-option value="B">B</mat-option>
                <mat-option value="C">C</mat-option>
              </mat-select>
            </mat-form-field>
            <mat-form-field appearance="outline">
              <mat-label>Turno</mat-label>
              <mat-select formControlName="turno">
                <mat-option value="mañana">Mañana</mat-option>
                <mat-option value="tarde">Tarde</mat-option>
              </mat-select>
            </mat-form-field>
          </div>
          <mat-form-field appearance="outline">
            <mat-label>Aula</mat-label>
            <input matInput formControlName="aula" placeholder="Ej: A-201">
          </mat-form-field>
          <div class="form-actions">
            <button mat-button type="button" (click)="showForm = false">Cancelar</button>
            <button mat-raised-button color="primary" type="submit" [disabled]="form.invalid || saving">
              <mat-icon>save</mat-icon> {{ saving ? 'Creando...' : 'Crear grupo' }}
            </button>
          </div>
        </form>
      </mat-card>
    }

    <div class="grupos-grid">
      @for (grupo of grupos; track grupo.id) {
        <mat-card class="grupo-card">
          <div class="grupo-card-link" [routerLink]="['/grupos', grupo.id]">
            <div class="grupo-icon" [style.background]="getColor(grupo)">
              <mat-icon>groups</mat-icon>
            </div>
            <div class="grupo-info">
              <h3>{{ grupo.nombre }}</h3>
              <p class="ciclo-text">{{ grupo.cicloNombre || '' }}</p>
              <div class="grupo-meta">
                <mat-chip>{{ grupo.curso }}º curso</mat-chip>
                @if (grupo.turno) { <mat-chip>{{ grupo.turno | titlecase }}</mat-chip> }
                <span class="alumno-count">
                  <mat-icon>person</mat-icon> {{ alumnosCounts[grupo.id!] || 0 }} alumnos
                </span>
              </div>
            </div>
          </div>
          <button mat-icon-button [matMenuTriggerFor]="grupoMenu" class="menu-btn"
                  (click)="$event.stopPropagation()">
            <mat-icon>more_vert</mat-icon>
          </button>
          <mat-menu #grupoMenu="matMenu">
            <button mat-menu-item [routerLink]="['/grupos', grupo.id]">
              <mat-icon>visibility</mat-icon> Ver detalle
            </button>
            <button mat-menu-item (click)="eliminarGrupo(grupo)">
              <mat-icon color="warn">delete</mat-icon> Eliminar grupo
            </button>
          </mat-menu>
        </mat-card>
      }
      @if (grupos.length === 0 && !showForm) {
        <mat-card class="empty-card">
          <mat-icon>group_add</mat-icon>
          <p>No hay grupos configurados</p>
          <button mat-raised-button color="primary" (click)="showForm = true">
            <mat-icon>add</mat-icon> Crear primer grupo
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
    .form-row { display: flex; gap: 16px; }
    .form-row mat-form-field { flex: 1; }
    .form-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 8px; padding-top: 16px; border-top: 1px solid #eee; }
    .grupos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(380px, 1fr)); gap: 16px; }
    .grupo-card { display: flex; align-items: center; padding: 20px; border-radius: 12px; position: relative; transition: transform 0.2s, box-shadow 0.2s; }
    .grupo-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
    .grupo-card-link { display: flex; align-items: center; gap: 16px; flex: 1; cursor: pointer; text-decoration: none; color: inherit; }
    .grupo-icon { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; color: white; flex-shrink: 0; }
    .grupo-icon mat-icon { font-size: 28px; width: 28px; height: 28px; }
    .grupo-info { flex: 1; }
    .grupo-info h3 { margin: 0 0 4px; font-size: 17px; }
    .ciclo-text { margin: 0 0 8px; font-size: 13px; color: #666; }
    .grupo-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .alumno-count { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #666; }
    .alumno-count mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .menu-btn { color: #999; }
    .empty-card { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .empty-card mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }
    @media (max-width: 600px) { .grupos-grid { grid-template-columns: 1fr; } .form-row { flex-direction: column; gap: 0; } }
  `]
})
export class GruposListComponent implements OnInit {
  private gruposService = inject(GruposService);
  private alumnosService = inject(AlumnosService);
  private ciclosService = inject(CiclosService);
  private auth = inject(AuthService);
  private fb = inject(FormBuilder);
  private snackBar = inject(MatSnackBar);
  private activeModule = inject(ActiveModuleService);

  grupos: Grupo[] = [];
  ciclos: CicloFormativo[] = [];
  alumnosCounts: { [grupoId: string]: number } = {};
  showForm = false;
  saving = false;
  form!: FormGroup;
  private colors = ['#1565c0', '#2e7d32', '#e65100', '#6a1b9a', '#c62828', '#00838f'];

  ngOnInit() {
    this.form = this.fb.group({
      nombre: ['', Validators.required],
      cicloId: ['', Validators.required],
      cicloNuevoNombre: [''],
      cicloNuevoAbrev: [''],
      curso: [1, Validators.required],
      letra: ['A', Validators.required],
      turno: ['mañana'],
      aula: ['']
    });

    const user = this.auth.currentUser;
    if (!user) return;
    this.ciclosService.getByCentro$(user.centroId).subscribe(c => this.ciclos = c);
    this.loadGrupos();
  }

  async loadGrupos() {
    const user = this.auth.currentUser;
    if (!user) return;
    try {
      // Usar getDocs directo en vez de listener para mayor fiabilidad
      const allGrupos = await this.gruposService.queryByField('centroId', user.centroId);
      this.grupos = allGrupos
        .filter(g => g.cursoAcademico === this.activeModule.cursoActual && g.activo !== false)
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

      console.log('Grupos cargados:', this.grupos.length, this.grupos);

      for (const grupo of this.grupos) {
        if (grupo.id) {
          const alumnos = await this.alumnosService.getByGrupo(grupo.id);
          this.alumnosCounts[grupo.id] = alumnos.length;
        }
      }
    } catch (e: any) {
      console.error('Error cargando grupos:', e);
    }
  }

  getColor(grupo: Grupo): string {
    return this.colors[this.grupos.indexOf(grupo) % this.colors.length];
  }

  async eliminarGrupo(grupo: Grupo) {
    if (!confirm(`¿Eliminar el grupo "${grupo.nombre}"? Esta acción no se puede deshacer.`)) return;
    try {
      await this.gruposService.delete(grupo.id!);
      this.snackBar.open(`Grupo "${grupo.nombre}" eliminado`, 'OK', { duration: 3000 });
      await this.loadGrupos();
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }

  async crearGrupo() {
    if (this.form.invalid) return;
    this.saving = true;
    const v = this.form.value;
    const user = this.auth.currentUser;
    if (!user) return;

    try {
      let cicloId = v.cicloId;
      let cicloNombre = '';

      // Si es ciclo nuevo, crearlo primero
      if (cicloId === '__new__') {
        const newCiclo = await this.ciclosService.create({
          nombre: v.cicloNuevoNombre,
          abreviatura: v.cicloNuevoAbrev,
          centroId: user.centroId,
          nivel: 'grado_superior',
          duracionHoras: 2000,
          modulosIds: [],
          activo: true
        } as any);
        cicloId = newCiclo;
        cicloNombre = v.cicloNuevoNombre;
      } else {
        cicloNombre = this.ciclos.find(c => c.id === cicloId)?.nombre || '';
      }

      await this.gruposService.create({
        nombre: v.nombre,
        curso: v.curso,
        letra: v.letra,
        cicloId: cicloId,
        cicloNombre: cicloNombre,
        centroId: user.centroId,
        tutorId: user.uid,
        cursoAcademico: this.activeModule.cursoActual,
        turno: v.turno,
        aula: v.aula,
        alumnosIds: [],
        modulosIds: [],
        activo: true
      });

      this.snackBar.open(`✓ Grupo "${v.nombre}" creado`, 'OK', { duration: 3000 });
      this.form.reset({ curso: 1, letra: 'A', turno: 'mañana' });
      this.showForm = false;
      // Recargar la lista explícitamente
      await this.loadGrupos();
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    } finally { this.saving = false; }
  }
}
