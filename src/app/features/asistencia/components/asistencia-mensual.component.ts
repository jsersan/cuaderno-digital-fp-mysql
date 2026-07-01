import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { GruposService, ModulosService, AlumnosService, AuthService, ActiveModuleService } from '@core/services';
import { TranslateModule } from '@ngx-translate/core';
import { Grupo, ModuloProfesional, Alumno } from '@core/models';
import { Firestore, doc, getDoc, setDoc } from '@core/firebase-shim';

@Component({
  selector: 'app-asistencia-mensual',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, MatTooltipModule, MatSnackBarModule, TranslateModule],
  template: `
    <div class="page-header">
      <div><h2>Control de Asistencia Mensual</h2><p class="sub">Marca las faltas de cada alumno por día</p></div>
      <button mat-button routerLink="/asistencia"><mat-icon>arrow_back</mat-icon> Volver</button>
    </div>

    @if (!activeModule.moduloId) {
      <mat-card class="no-module">
        <mat-icon>menu_book</mat-icon>
        <p>{{ 'common.select_notebook' | translate }} <a routerLink="/dashboard">{{ 'common.dashboard' | translate }}</a> {{ 'attendance.no_module_monthly' | translate }}</p>
      </mat-card>
    } @else {
    <mat-card class="filters">
      <div class="filters-row">
        <div class="contexto">
          <span class="ctx-item"><mat-icon>class</mat-icon> {{ activeModule.grupoNombre || '—' }}</span>
          <span class="ctx-item"><mat-icon>menu_book</mat-icon> {{ activeModule.current?.abreviatura || '—' }}</span>
        </div>
        <span class="flex-spacer"></span>
        <div class="month-nav">
          <button mat-icon-button (click)="prevMonth()"><mat-icon>chevron_left</mat-icon></button>
          <span class="month-label">{{ monthNames[mes] }} {{ anio }}</span>
          <button mat-icon-button (click)="nextMonth()"><mat-icon>chevron_right</mat-icon></button>
        </div>
      </div>
    </mat-card>
    }

    @if (alumnos.length > 0 && grupoId && moduloId) {
      <mat-card class="grid-card">
        <div class="grid-scroll">
          <table class="asist-table">
            <thead>
              <tr>
                <th class="col-name">Alumno/a</th>
                @for (d of diasMes; track d) {
                  <th class="col-day" [class.weekend]="esFinDeSemana(d)"
                      [class.today]="esHoy(d)">{{ d }}</th>
                }
                <th class="col-total">Total</th>
              </tr>
            </thead>
            <tbody>
              @for (a of alumnos; track a.id; let i = $index) {
                <tr>
                  <td class="col-name">
                    <span class="num">{{ i+1 }}</span>
                    {{ a.apellidos }}, {{ a.nombre }}
                  </td>
                  @for (d of diasMes; track d) {
                    <td class="col-day" [class.weekend]="esFinDeSemana(d)"
                        (click)="!esFinDeSemana(d) && toggleFalta(a.id!, d)"
                        [class.falta]="getFalta(a.id!, d) === 'I'"
                        [class.justificada]="getFalta(a.id!, d) === 'J'"
                        [matTooltip]="getTooltip(a.id!, d)">
                      @if (getFalta(a.id!, d) === 'I') { <span class="mark">✕</span> }
                      @else if (getFalta(a.id!, d) === 'J') { <span class="mark-j">J</span> }
                    </td>
                  }
                  <td class="col-total" [class.warn]="contarFaltas(a.id!) > 0">
                    <strong>{{ contarFaltas(a.id!) }}</strong>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>

        <div class="legend">
          <span>Clic = Falta injust. (✕)</span>
          <span>Doble clic = Falta justif. (J)</span>
          <span>Triple clic = Quitar</span>
          <span class="spacer"></span>
          <button mat-raised-button color="primary" (click)="guardar()" [disabled]="saving">
            <mat-icon>save</mat-icon> Guardar asistencia
          </button>
        </div>
      </mat-card>
    }

    @if (alumnos.length === 0 && grupoId && moduloId) {
      <mat-card class="empty"><p>No hay alumnos en este grupo</p></mat-card>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; }
    .page-header h2 { margin: 0; } .sub { color: #666; margin: 4px 0 0; }
    .filters { padding: 16px; border-radius: 12px; margin-bottom: 16px; }
    .filters-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .flex-spacer { flex: 1; }
    .no-module { display: flex; align-items: center; gap: 12px; justify-content: center; text-align: center; padding: 32px; border-radius: 12px; color: #777; margin-bottom: 16px; border: 2px dashed #ddd; }
    .no-module mat-icon { font-size: 32px; width: 32px; height: 32px; color: #bbb; }
    .no-module a { color: #1565c0; font-weight: 600; }
    .contexto { display: flex; gap: 16px; }
    .ctx-item { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #1565c0; background: #e3f2fd; padding: 8px 14px; border-radius: 20px; font-size: 14px; }
    .ctx-item mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .month-nav { display: flex; align-items: center; gap: 4px; }
    .month-label { font-size: 16px; font-weight: 700; min-width: 160px; text-align: center; text-transform: capitalize; }
    .grid-card { border-radius: 12px; overflow: hidden; padding: 0; }
    .grid-scroll { overflow-x: auto; }
    .asist-table { border-collapse: collapse; width: max-content; min-width: 100%; }
    .asist-table th, .asist-table td { border: 1px solid #e8e8e8; text-align: center; }
    .asist-table th { padding: 8px 2px; font-size: 11px; font-weight: 600; color: #666; background: #fafafa; position: sticky; top: 0; }
    .asist-table td { padding: 0; }
    .col-name { text-align: left !important; padding: 8px 10px !important; min-width: 220px; font-size: 13px; font-weight: 500; position: sticky; left: 0; background: #fff; z-index: 1; white-space: nowrap; }
    .col-name .num { display: inline-block; width: 20px; color: #999; font-size: 11px; }
    thead .col-name { background: #fafafa; z-index: 2; }
    .col-day { width: 32px; min-width: 32px; height: 32px; cursor: pointer; transition: background 0.1s; }
    .col-day:hover:not(.weekend) { background: #e3f2fd; }
    .col-total { width: 50px; font-size: 13px; background: #fafafa; padding: 4px !important; }
    .col-total.warn { color: #c62828; }
    .weekend { background: #f5f5f5 !important; cursor: default !important; color: #ccc; }
    .today { background: #e8f5e9 !important; }
    .falta { background: #ffcdd2 !important; }
    .justificada { background: #fff3e0 !important; }
    .mark { color: #c62828; font-weight: 700; font-size: 14px; }
    .mark-j { color: #e65100; font-weight: 700; font-size: 12px; }
    .legend { display: flex; align-items: center; gap: 16px; padding: 12px 16px; font-size: 12px; color: #888; border-top: 1px solid #eee; flex-wrap: wrap; }
    .spacer { flex: 1; }
    .empty { text-align: center; padding: 48px; color: #999; }
  `]
})
export class AsistenciaMensualComponent implements OnInit {
  private gruposService = inject(GruposService);
  private modulosService = inject(ModulosService);
  private alumnosService = inject(AlumnosService);
  private auth = inject(AuthService);
  activeModule = inject(ActiveModuleService);
  private firestore = inject(Firestore);
  private snackBar = inject(MatSnackBar);

  grupos: Grupo[] = [];
  modulos: ModuloProfesional[] = [];
  alumnos: Alumno[] = [];
  get grupoId() { return this.activeModule.grupoId; }
  get moduloId() { return this.activeModule.moduloId; }
  mes: number; anio: number;
  diasMes: number[] = [];
  saving = false;
  monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

  // faltas[alumnoId][dia] = 'I' (injustificada) | 'J' (justificada) | undefined
  faltas: { [alumnoId: string]: { [dia: number]: string } } = {};

  constructor() {
    const hoy = new Date();
    this.mes = hoy.getMonth();
    this.anio = hoy.getFullYear();
  }

  async ngOnInit() {
    await this.activeModule.restore();
    this.actualizarDias();
    if (this.grupoId) await this.onFilterChange();
  }

  actualizarDias() {
    const numDias = new Date(this.anio, this.mes + 1, 0).getDate();
    this.diasMes = Array.from({ length: numDias }, (_, i) => i + 1);
  }

  esFinDeSemana(dia: number): boolean {
    const d = new Date(this.anio, this.mes, dia).getDay();
    return d === 0 || d === 6;
  }

  esHoy(dia: number): boolean {
    const hoy = new Date();
    return dia === hoy.getDate() && this.mes === hoy.getMonth() && this.anio === hoy.getFullYear();
  }

  prevMonth() { if (this.mes === 0) { this.mes = 11; this.anio--; } else { this.mes--; } this.actualizarDias(); this.loadFaltas(); }
  nextMonth() { if (this.mes === 11) { this.mes = 0; this.anio++; } else { this.mes++; } this.actualizarDias(); this.loadFaltas(); }

  async onFilterChange() {
    if (!this.grupoId) return;
    this.alumnos = await this.alumnosService.getByGrupo(this.grupoId);
    if (this.moduloId) {
      this.alumnos = this.alumnos.filter(a => (a.matriculas || []).some(m => m.moduloId === this.moduloId));
    }
    this.alumnos.sort((a, b) => a.apellidos.localeCompare(b.apellidos));
    await this.loadFaltas();
  }

  // Almacenamiento: documento por grupo/módulo/mes en colección 'asistencia_mensual'
  private getDocId(): string {
    return `${this.grupoId}_${this.moduloId}_${this.anio}-${String(this.mes + 1).padStart(2, '0')}`;
  }

  async loadFaltas() {
    if (!this.grupoId || !this.moduloId) return;
    this.faltas = {};
    try {
      const docRef = doc(this.firestore, 'asistencia_mensual', this.getDocId());
      const snap = await getDoc(docRef);
      if (snap.exists()) { this.faltas = snap.data()['faltas'] || {}; }
    } catch (e) { console.warn('Error cargando faltas:', e); }
    // Inicializar alumnos sin datos
    for (const a of this.alumnos) { if (!this.faltas[a.id!]) this.faltas[a.id!] = {}; }
  }

  toggleFalta(alumnoId: string, dia: number) {
    if (!this.faltas[alumnoId]) this.faltas[alumnoId] = {};
    const current = this.faltas[alumnoId][dia];
    if (!current) this.faltas[alumnoId][dia] = 'I';       // vacío → injustificada
    else if (current === 'I') this.faltas[alumnoId][dia] = 'J';  // injust → justificada
    else delete this.faltas[alumnoId][dia];                // justif → quitar
  }

  getFalta(alumnoId: string, dia: number): string {
    return this.faltas[alumnoId]?.[dia] || '';
  }

  getTooltip(alumnoId: string, dia: number): string {
    const f = this.getFalta(alumnoId, dia);
    if (f === 'I') return 'Falta injustificada';
    if (f === 'J') return 'Falta justificada';
    return '';
  }

  contarFaltas(alumnoId: string): number {
    const f = this.faltas[alumnoId];
    if (!f) return 0;
    return Object.values(f).filter(v => v === 'I').length;
  }

  async guardar() {
    if (!this.grupoId || !this.moduloId) return;
    this.saving = true;
    try {
      const docRef = doc(this.firestore, 'asistencia_mensual', this.getDocId());
      await setDoc(docRef, {
        grupoId: this.grupoId, moduloId: this.moduloId,
        anio: this.anio, mes: this.mes + 1,
        faltas: this.faltas,
        updatedAt: new Date()
      }, { merge: true });
      this.snackBar.open(`✓ Asistencia de ${this.monthNames[this.mes]} guardada`, 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
    this.saving = false;
  }
}
