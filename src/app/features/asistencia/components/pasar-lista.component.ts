import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import {
  AsistenciaService, AlumnosService, GruposService,
  ModulosService, AuthService, ActiveModuleService, LanguageService
} from '@core/services';
import { Alumno, Grupo, ModuloProfesional, EstadoAsistencia, AsistenciaAlumno } from '@core/models';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-pasar-lista',
  standalone: true,
  imports: [
    CommonModule, FormsModule, RouterLink,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatSnackBarModule, MatTooltipModule,
    TranslateModule
  ],
  template: `
    <div class="page-header">
      <div><h2>{{ 'attendance.pass_list' | translate }}</h2><p class="subtitle">{{ hoy | date:'EEEE, d MMMM yyyy':'':langDate() }}</p></div>
      <button mat-button routerLink="/asistencia"><mat-icon>arrow_back</mat-icon> Volver</button>
    </div>

    @if (!activeModule.moduloId) {
      <mat-card class="no-module">
        <mat-icon>menu_book</mat-icon>
        <p>{{ 'common.select_notebook' | translate }} <a routerLink="/dashboard">{{ 'common.dashboard' | translate }}</a> {{ 'attendance.no_module_pass' | translate }}</p>
      </mat-card>
    } @else {
    <!-- Selección -->
    <mat-card class="selector-card">
      <div class="selector-row">
        <div class="contexto">
          <span class="ctx-item"><mat-icon>class</mat-icon> {{ activeModule.grupoNombre || '—' }}</span>
          <span class="ctx-item"><mat-icon>menu_book</mat-icon> {{ activeModule.current?.abreviatura || '—' }}</span>
        </div>

        @if (franjasDisponibles.length > 1) {
          <mat-form-field appearance="outline">
            <mat-label>{{ 'attendance.time_slot' | translate }}</mat-label>
            <mat-select [(ngModel)]="franja">
              @for (fr of franjasDisponibles; track fr) {
                <mat-option [value]="fr">
                  {{ fmtFranja(fr) }}
                  @if (esFranjaActual(fr)) { <span class="ahora-tag">● {{ 'attendance.now' | translate }}</span> }
                </mat-option>
              }
            </mat-select>
          </mat-form-field>
        } @else if (franjasDisponibles.length === 1) {
          <span class="ctx-item franja-chip" [class.franja-ahora]="esFranjaActual(franja)">
            <mat-icon>schedule</mat-icon> {{ fmtFranja(franja) }}
            @if (esFranjaActual(franja)) { <span class="ahora-mini">{{ 'attendance.now' | translate }}</span> }
          </span>
        }
      </div>
    </mat-card>
    }

    <!-- Lista de alumnos -->
    @if (alumnos.length > 0) {
      <div class="quick-actions">
        <button mat-button (click)="marcarTodos('presente')" color="primary">
          <mat-icon>done_all</mat-icon> {{ 'attendance.all_present' | translate }}
        </button>
        <div class="stat-chips">
          <span class="stat presente"><mat-icon>check_circle</mat-icon> {{ contar('presente') }}</span>
          <span class="stat justificada"><mat-icon>event_busy</mat-icon> {{ contar('ausente_justificada') }}</span>
          <span class="stat injustificada"><mat-icon>cancel</mat-icon> {{ contar('ausente_injustificada') }}</span>
          <span class="stat retraso"><mat-icon>schedule</mat-icon> {{ contar('retraso') }}</span>
        </div>
      </div>

      <div class="progress-wrap">
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="porcentajePresentes()"></div>
        </div>
        <span class="progress-label">{{ porcentajePresentes() }}% presentes ({{ getPresentes() }}/{{ alumnos.length }})</span>
      </div>

      <div class="alumnos-grid">
        @for (alumno of alumnos; track alumno.id; let i = $index) {
          <mat-card class="alumno-card" [class]="'estado-' + getEstado(alumno.id!)">
            <div class="alumno-info">
              <span class="alumno-num">{{ i + 1 }}</span>
              <div>
                <strong>{{ alumno.apellidos }}</strong><br>
                <span class="alumno-nombre">{{ alumno.nombre }}</span>
              </div>
            </div>

            <div class="estado-buttons">
              <button mat-icon-button (click)="setEstado(alumno.id!, 'presente')"
                      [class.active]="getEstado(alumno.id!) === 'presente'"
                      class="btn-presente" matTooltip="{{ 'attendance.state_present' | translate }}">
                <mat-icon>check_circle</mat-icon>
              </button>
              <button mat-icon-button (click)="setEstado(alumno.id!, 'ausente_justificada')"
                      [class.active]="getEstado(alumno.id!) === 'ausente_justificada'"
                      class="btn-justificada" matTooltip="{{ 'attendance.state_justified' | translate }}">
                <mat-icon>event_busy</mat-icon>
              </button>
              <button mat-icon-button (click)="setEstado(alumno.id!, 'ausente_injustificada')"
                      [class.active]="getEstado(alumno.id!) === 'ausente_injustificada'"
                      class="btn-injustificada" matTooltip="{{ 'attendance.state_unjustified' | translate }}">
                <mat-icon>cancel</mat-icon>
              </button>
              <button mat-icon-button (click)="setEstado(alumno.id!, 'retraso')"
                      [class.active]="getEstado(alumno.id!) === 'retraso'"
                      class="btn-retraso" matTooltip="{{ 'attendance.state_late' | translate }}">
                <mat-icon>schedule</mat-icon>
              </button>
            </div>
          </mat-card>
        }
      </div>

      <div class="save-bar">
        <button mat-raised-button color="primary" (click)="guardar()" [disabled]="saving"
                class="save-btn">
          <mat-icon>save</mat-icon> {{ 'attendance.save_attendance' | translate }}
        </button>
      </div>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; }
    .selector-card { padding: 16px; border-radius: 12px; margin-bottom: 16px; }
    .no-module { display: flex; align-items: center; gap: 12px; justify-content: center; text-align: center; padding: 32px; border-radius: 12px; color: #777; margin-bottom: 16px; border: 2px dashed #ddd; }
    .no-module mat-icon { font-size: 32px; width: 32px; height: 32px; color: #bbb; }
    .no-module a { color: #1565c0; font-weight: 600; }
    .selector-row { display: flex; gap: 12px; flex-wrap: wrap; align-items: center; }
    .contexto { display: flex; gap: 16px; }
    .ctx-item { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #1565c0; background: #e3f2fd; padding: 8px 14px; border-radius: 20px; font-size: 14px; }
    .ctx-item mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .franja-chip { color: #2e7d32 !important; background: #e8f5e9 !important; }
    .franja-ahora { box-shadow: 0 0 0 2px #2e7d32; animation: pulso 2s ease-in-out infinite; }
    @keyframes pulso { 0%,100% { box-shadow: 0 0 0 2px rgba(46,125,50,0.4); } 50% { box-shadow: 0 0 0 4px rgba(46,125,50,0.15); } }
    .ahora-mini { font-size: 10px; font-weight: 700; background: #2e7d32; color: white; padding: 1px 6px; border-radius: 8px; margin-left: 4px; }
    .ahora-tag { font-size: 11px; font-weight: 700; color: #2e7d32; margin-left: 8px; }
    .quick-actions { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px; }
    .counter { font-size: 15px; font-weight: 600; color: #1565c0; }
    .stat-chips { display: flex; gap: 8px; flex-wrap: wrap; }
    .stat { display: inline-flex; align-items: center; gap: 4px; font-weight: 700; font-size: 14px; padding: 4px 12px; border-radius: 16px; }
    .stat mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .stat.presente { background: #e8f5e9; color: #2e7d32; }
    .stat.justificada { background: #fff3e0; color: #e65100; }
    .stat.injustificada { background: #ffebee; color: #c62828; }
    .stat.retraso { background: #f3e5f5; color: #7b1fa2; }
    .progress-wrap { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
    .progress-bar { flex: 1; height: 10px; background: #eee; border-radius: 5px; overflow: hidden; }
    .progress-fill { height: 100%; background: linear-gradient(90deg, #66bb6a, #2e7d32); border-radius: 5px; transition: width 0.4s ease; }
    .progress-label { font-size: 13px; font-weight: 600; color: #555; white-space: nowrap; }

    .alumnos-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 8px; }

    .alumno-card {
      display: flex; justify-content: space-between; align-items: center;
      padding: 12px 16px; border-radius: 10px; transition: all 0.2s;
      border-left: 4px solid #e0e0e0;
    }
    .alumno-card.estado-presente { border-left-color: #4caf50; background: #f1f8e9; }
    .alumno-card.estado-ausente_justificada { border-left-color: #ff9800; background: #fff8e1; }
    .alumno-card.estado-ausente_injustificada { border-left-color: #f44336; background: #fce4ec; }
    .alumno-card.estado-retraso { border-left-color: #9c27b0; background: #f3e5f5; }

    .alumno-info { display: flex; align-items: center; gap: 12px; }
    .alumno-num { width: 28px; height: 28px; border-radius: 50%; background: #e0e0e0; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 600; }
    .alumno-nombre { color: #666; font-size: 13px; }

    .estado-buttons { display: flex; gap: 2px; }
    .estado-buttons button { opacity: 0.4; transition: opacity 0.2s; }
    .estado-buttons button.active { opacity: 1; transform: scale(1.15); }
    .btn-presente { color: #4caf50 !important; }
    .btn-justificada { color: #ff9800 !important; }
    .btn-injustificada { color: #f44336 !important; }
    .btn-retraso { color: #9c27b0 !important; }

    .save-bar { position: sticky; bottom: 24px; text-align: center; margin-top: 24px; }
    .save-btn { height: 48px; font-size: 16px; padding: 0 32px; border-radius: 24px; box-shadow: 0 4px 12px rgba(21,101,192,0.4); }
    @media (max-width: 600px) { .alumnos-grid { grid-template-columns: 1fr; } }
  `]
})
export class PasarListaComponent implements OnInit {
  private asistenciaService = inject(AsistenciaService);
  private alumnosService = inject(AlumnosService);
  private gruposService = inject(GruposService);
  private modulosService = inject(ModulosService);
  private auth = inject(AuthService);
  activeModule = inject(ActiveModuleService);
  language = inject(LanguageService);

  langDate(): string { return this.language.current() === 'eu' ? 'eu' : 'es'; }
  private snackBar = inject(MatSnackBar);

  hoy = new Date();
  grupos: Grupo[] = [];
  modulos: ModuloProfesional[] = [];
  alumnos: Alumno[] = [];
  get grupoId() { return this.activeModule.grupoId; }
  get moduloId() { return this.activeModule.moduloId; }
  franja = '08:30-09:25';
  franjasDisponibles: string[] = [];
  franjaActual = '';   // la franja que contiene la hora actual (si la hay)
  estados: { [alumnoId: string]: EstadoAsistencia } = {};
  saving = false;

  private readonly FRANJAS_GENERICAS = ['08:30-09:25','09:25-10:20','10:20-11:15','11:45-12:40','12:40-13:35','13:35-14:30'];

  async ngOnInit() {
    await this.activeModule.restore();
    this.calcularFranjas();
    if (this.grupoId) await this.cargarAlumnos();
  }

  // Convierte "HH:MM" en minutos desde medianoche
  private aMinutos(hhmm: string): number {
    const [h, m] = hhmm.split(':').map(Number);
    return h * 60 + (m || 0);
  }

  // Calcula las franjas de HOY en las que se imparte el módulo activo, según el horario del grupo
  calcularFranjas() {
    const dias = ['domingo','lunes','martes','miercoles','jueves','viernes','sabado'];
    const diaHoy = dias[this.hoy.getDay()];
    const horario = this.activeModule.currentGrupo?.horario;
    let franjas: string[] = [];

    if (horario && horario[diaHoy]) {
      franjas = horario[diaHoy]
        .filter(fr => fr.moduloId === this.moduloId)
        .map(fr => `${fr.horaInicio}-${fr.horaFin}`);
    }

    // Fallback: si no hay horario definido para el módulo hoy, ofrecer las genéricas
    this.franjasDisponibles = franjas.length > 0 ? franjas : this.FRANJAS_GENERICAS;

    // Determinar la franja que contiene la hora actual
    const ahora = this.hoy.getHours() * 60 + this.hoy.getMinutes();
    this.franjaActual = '';
    let mejorFranja = this.franjasDisponibles[0];
    let menorDistancia = Infinity;

    for (const fr of this.franjasDisponibles) {
      const [ini, fin] = fr.split('-');
      const ms = this.aMinutos(ini), me = this.aMinutos(fin);
      if (ahora >= ms && ahora < me) {
        // Estamos dentro de esta franja → es la actual
        this.franjaActual = fr;
        mejorFranja = fr;
        menorDistancia = 0;
        break;
      }
      // Si no estamos dentro, guardar la más cercana al inicio
      const dist = Math.abs(ms - ahora);
      if (dist < menorDistancia) { menorDistancia = dist; mejorFranja = fr; }
    }

    // Pre-seleccionar la franja actual si existe, si no la más cercana a la hora
    this.franja = mejorFranja;
  }

  esFranjaActual(fr: string): boolean {
    return fr === this.franjaActual;
  }

  async cargarAlumnos() {
    if (!this.grupoId) return;
    this.alumnos = await this.alumnosService.getByGrupo(this.grupoId);
    // Solo los matriculados en el módulo activo
    if (this.moduloId) {
      this.alumnos = this.alumnos.filter(a => (a.matriculas || []).some(m => m.moduloId === this.moduloId));
    }
    this.alumnos.sort((a, b) => a.apellidos.localeCompare(b.apellidos));
    this.alumnos.forEach(a => this.estados[a.id!] = EstadoAsistencia.PRESENTE);
  }

  fmtFranja(fr: string): string {
    return fr ? fr.replace('-', ' - ') : '';
  }

  getEstado(alumnoId: string): string {
    return this.estados[alumnoId] || '';
  }
  setEstado(alumnoId: string, estado: string) {
    this.estados[alumnoId] = estado as EstadoAsistencia;
  }

  marcarTodos(estado: string) {
    this.alumnos.forEach(a => this.estados[a.id!] = estado as EstadoAsistencia);
  }

  getPresentes(): number {
    return Object.values(this.estados).filter(
      e => e === EstadoAsistencia.PRESENTE || e === EstadoAsistencia.RETRASO
    ).length;
  }

  // Cuenta alumnos en un estado concreto (solo los de la lista actual)
  contar(estado: string): number {
    return this.alumnos.filter(a => this.estados[a.id!] === estado).length;
  }

  porcentajePresentes(): number {
    if (this.alumnos.length === 0) return 0;
    return Math.round((this.getPresentes() / this.alumnos.length) * 100);
  }

  async guardar() {
    if (!this.grupoId || !this.moduloId) {
      this.snackBar.open('Selecciona grupo y módulo', 'Cerrar', { duration: 3000 });
      return;
    }
    this.saving = true;
    const registros: AsistenciaAlumno[] = this.alumnos.map(a => ({
      alumnoId: a.id!,
      alumnoNombre: `${a.apellidos}, ${a.nombre}`,
      estado: this.estados[a.id!] || EstadoAsistencia.PRESENTE
    }));

    try {
      await this.asistenciaService.pasarLista(
        this.moduloId, this.grupoId,
        this.auth.currentUser?.uid || '',
        this.franja, registros,
        this.activeModule.current?.abreviatura || ''
      );
      this.snackBar.open('✓ Asistencia guardada correctamente', 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    } finally { this.saving = false; }
  }
}
