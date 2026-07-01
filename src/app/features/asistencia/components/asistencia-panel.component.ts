import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { AsistenciaService, GruposService, AuthService, ActiveModuleService, LanguageService } from '@core/services';
import { RegistroAsistencia, Grupo, EstadoAsistencia } from '@core/models';
import { TranslateModule } from '@ngx-translate/core';

@Component({
  selector: 'app-asistencia-panel',
  standalone: true,
  imports: [CommonModule, RouterLink, MatCardModule, MatListModule, MatIconModule, MatButtonModule, MatChipsModule, MatTooltipModule, MatSnackBarModule, TranslateModule],
  template: `
    <div class="page-header">
      <div><h2>{{ 'attendance.title' | translate }}</h2><p class="sub">{{ 'attendance.subtitle' | translate }}</p></div>
      <div class="actions">
        <button mat-raised-button color="primary" routerLink="/asistencia/pasar-lista"><mat-icon>how_to_reg</mat-icon> {{ 'attendance.pass_list' | translate }}</button>
        <button mat-raised-button routerLink="/asistencia/resumen"><mat-icon>bar_chart</mat-icon> {{ 'attendance.summary' | translate }}</button>
        <button mat-stroked-button routerLink="/horario"><mat-icon>schedule</mat-icon> {{ 'attendance.schedule' | translate }}</button>
      </div>
    </div>

    @if (!activeModule.moduloId) {
      <mat-card class="no-module">
        <mat-icon>menu_book</mat-icon>
        <p>{{ 'common.select_notebook' | translate }} <a routerLink="/dashboard">{{ 'common.dashboard' | translate }}</a> {{ 'attendance.no_module_panel' | translate }}</p>
      </mat-card>
    } @else {
      <div class="ctx-bar">
        <span class="ctx-item"><mat-icon>class</mat-icon> {{ activeModule.grupoNombre }}</span>
        <span class="ctx-item"><mat-icon>menu_book</mat-icon> {{ activeModule.current?.abreviatura }}</span>
      </div>
    }

    <div class="content-grid">
      <mat-card class="action-card" routerLink="/asistencia/pasar-lista">
        <mat-icon class="action-icon" style="color: #4caf50">how_to_reg</mat-icon>
        <h3>{{ 'attendance.pass_list' | translate }}</h3>
        <p>Registro rápido de asistencia para la sesión actual</p>
      </mat-card>
      <mat-card class="action-card" routerLink="/asistencia/resumen">
        <mat-icon class="action-icon" style="color: #2196f3">assessment</mat-icon>
        <h3>{{ 'attendance.summary_by_student' | translate }}</h3>
        <p>Estadísticas de asistencia por módulo y alumno</p>
      </mat-card>
      <mat-card class="action-card" routerLink="/asistencia/mensual">
        <mat-icon class="action-icon" style="color: #7b1fa2">calendar_month</mat-icon>
        <h3>{{ 'attendance.monthly' | translate }}</h3>
        <p>Tabla mensual de faltas por alumno y día</p>
      </mat-card>
    </div>

    <!-- Registros de hoy -->
    @if (registrosHoy.length > 0) {
      <mat-card class="today-card">
        <div class="today-head">
          <h3><mat-icon>today</mat-icon> {{ 'attendance.today_records' | translate }} · {{ hoy | date:'EEEE, d MMMM yyyy':'':langDate() }}</h3>
          @if (hayDuplicados()) {
            <button mat-stroked-button color="warn" (click)="limpiarDuplicados()" [disabled]="limpiando">
              <mat-icon>cleaning_services</mat-icon> {{ 'attendance.clean_duplicates' | translate }}
            </button>
          }
        </div>
        <p class="hint-edit">{{ 'attendance.click_to_edit' | translate }}</p>
        @for (reg of registrosHoy; track reg.id) {
          <div class="reg-item" (click)="toggleEdit(reg)">
            <div class="reg-header">
              <mat-icon [style.color]="editingId === reg.id ? '#1565c0' : '#4caf50'">
                {{ editingId === reg.id ? 'edit' : 'check_circle' }}
              </mat-icon>
              <span class="reg-title">{{ reg.franjaHoraria }} · {{ getGrupoNombre(reg.grupoId) }}</span>
              <span class="reg-modulo"><mat-icon>menu_book</mat-icon>{{ getModuloAbrev(reg) }}</span>
              <span class="reg-fecha">{{ fechaDe(reg) | date:'d MMM':'':'es' }}</span>
              <span class="reg-mini">
                @if (contarReg(reg, 'presente') > 0) {
                  <span class="pill p"><span class="dot"></span>{{ contarReg(reg, 'presente') }} {{ contarReg(reg, 'presente') === 1 ? 'presente' : 'presentes' }}</span>
                }
                @if (contarReg(reg, 'ausente_justificada') > 0) {
                  <span class="pill j"><span class="dot"></span>{{ contarReg(reg, 'ausente_justificada') }} {{ contarReg(reg, 'ausente_justificada') === 1 ? 'justificada' : 'justificadas' }}</span>
                }
                @if (contarReg(reg, 'ausente_injustificada') > 0) {
                  <span class="pill i"><span class="dot"></span>{{ contarReg(reg, 'ausente_injustificada') }} {{ contarReg(reg, 'ausente_injustificada') === 1 ? 'injustificada' : 'injustificadas' }}</span>
                }
                @if (contarReg(reg, 'retraso') > 0) {
                  <span class="pill r"><span class="dot"></span>{{ contarReg(reg, 'retraso') }} {{ contarReg(reg, 'retraso') === 1 ? 'retraso' : 'retrasos' }}</span>
                }
              </span>
              <button mat-icon-button class="reg-del" (click)="borrarRegistro(reg, $event)" matTooltip="Eliminar este registro">
                <mat-icon>delete_outline</mat-icon>
              </button>
              <mat-icon class="expand-icon">{{ editingId === reg.id ? 'expand_less' : 'expand_more' }}</mat-icon>
            </div>

            @if (editingId === reg.id) {
              <div class="edit-panel" (click)="$event.stopPropagation()">
                <table class="edit-table">
                  <thead><tr><th>Alumno/a</th><th class="estado-col">Estado</th></tr></thead>
                  <tbody>
                    @for (a of reg.registros; track a.alumnoId) {
                      <tr>
                        <td>{{ a.alumnoNombre || a.alumnoId }}</td>
                        <td class="estado-col">
                          <div class="estado-btns">
                            <button class="btn-estado" [class.active-p]="a.estado === 'presente'" (click)="cambiarEstado(reg, a.alumnoId, 'presente')" title="Presente">✅</button>
                            <button class="btn-estado" [class.active-j]="a.estado === 'ausente_justificada'" (click)="cambiarEstado(reg, a.alumnoId, 'ausente_justificada')" title="Justificada">📋</button>
                            <button class="btn-estado" [class.active-i]="a.estado === 'ausente_injustificada'" (click)="cambiarEstado(reg, a.alumnoId, 'ausente_injustificada')" title="Injustificada">❌</button>
                            <button class="btn-estado" [class.active-r]="a.estado === 'retraso'" (click)="cambiarEstado(reg, a.alumnoId, 'retraso')" title="Retraso">🕐</button>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
                <div class="edit-actions">
                  <button mat-raised-button color="primary" (click)="guardarCambios(reg)">
                    <mat-icon>save</mat-icon> Guardar cambios
                  </button>
                </div>
              </div>
            }
          </div>
        }
      </mat-card>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; flex-wrap: wrap; gap: 12px; }
    .page-header h2 { margin: 0; } .sub { color: #666; margin: 4px 0 0; }
    .actions { display: flex; gap: 8px; }
    .content-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; margin-bottom: 24px; }
    .no-module { display: flex; align-items: center; gap: 12px; justify-content: center; text-align: center; padding: 32px; border-radius: 12px; color: #777; margin-bottom: 16px; border: 2px dashed #ddd; }
    .no-module mat-icon { font-size: 32px; width: 32px; height: 32px; color: #bbb; }
    .no-module a { color: #1565c0; font-weight: 600; }
    .ctx-bar { display: flex; gap: 16px; margin-bottom: 16px; }
    .ctx-item { display: flex; align-items: center; gap: 6px; font-weight: 600; color: #1565c0; background: #e3f2fd; padding: 8px 14px; border-radius: 20px; font-size: 14px; }
    .ctx-item mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .action-card { padding: 32px; border-radius: 12px; cursor: pointer; text-align: center; transition: transform 0.2s, box-shadow 0.2s; }
    .action-card:hover { transform: translateY(-4px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
    .action-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }
    .action-card h3 { margin: 0 0 8px; } .action-card p { color: #666; font-size: 14px; margin: 0; }

    .today-card { padding: 20px; border-radius: 12px; }
    .today-head { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .today-head h3 { margin: 0; display: flex; align-items: center; gap: 8px; text-transform: capitalize; }
    .hint-edit { font-size: 12px; color: #999; margin: 4px 0 12px; }
    .reg-fecha { font-size: 12px; color: #1565c0; background: #e3f2fd; padding: 2px 10px; border-radius: 10px; }
    .reg-modulo { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; font-weight: 700; color: #5e35b1; background: #ede7f6; padding: 2px 10px; border-radius: 10px; }
    .reg-modulo mat-icon { font-size: 14px; width: 14px; height: 14px; }
    .reg-del { color: #c62828; }
    .reg-del mat-icon { font-size: 20px; width: 20px; height: 20px; }
    .reg-mini { display: inline-flex; gap: 6px; flex-wrap: wrap; }
    .pill { display: inline-flex; align-items: center; gap: 5px; font-size: 12px; font-weight: 600; padding: 3px 10px; border-radius: 12px; white-space: nowrap; }
    .pill .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .pill.p { background: #e8f5e9; color: #2e7d32; }
    .pill.p .dot { background: #4caf50; }
    .pill.j { background: #fff3e0; color: #e65100; }
    .pill.j .dot { background: #ff9800; }
    .pill.i { background: #ffebee; color: #c62828; }
    .pill.i .dot { background: #f44336; }
    .pill.r { background: #f3e5f5; color: #7b1fa2; }
    .pill.r .dot { background: #9c27b0; }
    .today-card h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 12px; }

    .reg-item { border: 1px solid #e0e0e0; border-radius: 12px; margin-bottom: 8px; cursor: pointer; transition: border-color 0.2s; }
    .reg-item:hover { border-color: #1565c0; }
    .reg-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px; flex-wrap: wrap; }
    .reg-title { font-weight: 600; flex: 1; }
    .reg-count { font-size: 13px; color: #888; }
    .expand-icon { color: #999; }

    .edit-panel { padding: 0 16px 16px; border-top: 1px solid #e8e8e8; }
    .edit-table { width: 100%; border-collapse: collapse; margin-top: 12px; }
    .edit-table th { text-align: left; padding: 8px; font-size: 12px; font-weight: 600; text-transform: uppercase; color: #666; border-bottom: 1px solid #e0e0e0; }
    .edit-table td { padding: 6px 8px; border-bottom: 1px solid #f5f5f5; }
    .estado-col { width: 200px; }
    .estado-btns { display: flex; gap: 4px; }
    .btn-estado { width: 36px; height: 36px; border: 2px solid #e0e0e0; border-radius: 8px; background: white; cursor: pointer; font-size: 16px; transition: all 0.15s; display: flex; align-items: center; justify-content: center; }
    .btn-estado:hover { border-color: #999; transform: scale(1.1); }
    .active-p { border-color: #4caf50; background: #e8f5e9; }
    .active-j { border-color: #ff9800; background: #fff3e0; }
    .active-i { border-color: #f44336; background: #ffebee; }
    .active-r { border-color: #2196f3; background: #e3f2fd; }
    .edit-actions { display: flex; justify-content: flex-end; margin-top: 12px; }
  `]
})
export class AsistenciaPanelComponent implements OnInit {
  private asistenciaService = inject(AsistenciaService);
  private gruposService = inject(GruposService);
  private auth = inject(AuthService);
  activeModule = inject(ActiveModuleService);
  private snackBar = inject(MatSnackBar);
  language = inject(LanguageService);

  langDate(): string { return this.language.current() === 'eu' ? 'eu' : 'es'; }

  registrosHoy: RegistroAsistencia[] = [];
  grupos: Grupo[] = [];
  editingId: string | null = null;
  hoy = new Date();
  limpiando = false;

  async ngOnInit() {
    await this.activeModule.restore();
    const user = this.auth.currentUser;
    if (!user) return;
    if (!this.activeModule.grupoId || !this.activeModule.moduloId) return;

    try {
      // Para mostrar el nombre del grupo activo
      if (this.activeModule.currentGrupo) this.grupos = [this.activeModule.currentGrupo];

      // Solo registros del grupo + módulo del cuaderno activo, y solo de hoy
      const regs = await this.asistenciaService.queryByField('grupoId', this.activeModule.grupoId);
      const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
      const manana = new Date(hoy); manana.setDate(manana.getDate() + 1);
      this.registrosHoy = regs.filter((r: any) => {
        const s = r.fecha?.seconds || 0;
        const esHoy = s >= hoy.getTime() / 1000 && s < manana.getTime() / 1000;
        const esModulo = r.moduloId === this.activeModule.moduloId;
        return esHoy && esModulo;
      });
    } catch (e) { console.error('Error cargando registros:', e); }
  }

  getGrupoNombre(id: string): string {
    return this.grupos.find(g => g.id === id)?.nombre || id;
  }

  // Abreviatura del módulo del registro. Usa la guardada si existe;
  // si no, la del cuaderno activo (el panel solo muestra registros de ese módulo).
  getModuloAbrev(reg: any): string {
    return reg?.moduloAbreviatura || this.activeModule.current?.abreviatura || '—';
  }

  // Borra un registro de asistencia completo (p. ej. una franja creada por error)
  async borrarRegistro(reg: any, event: Event) {
    event.stopPropagation();   // no desplegar el panel de edición
    if (!reg.id) return;
    const cuando = `${reg.franjaHoraria} · ${this.getModuloAbrev(reg)}`;
    if (!confirm(`¿Eliminar el registro de asistencia "${cuando}"? Esta acción no se puede deshacer.`)) return;
    try {
      await this.asistenciaService.delete(reg.id);
      this.registrosHoy = this.registrosHoy.filter(r => r.id !== reg.id);
      this.snackBar.open('Registro eliminado', 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error al eliminar: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }

  toggleEdit(reg: RegistroAsistencia) {
    this.editingId = this.editingId === reg.id ? null : reg.id!;
  }

  cambiarEstado(reg: RegistroAsistencia, alumnoId: string, nuevoEstado: string) {
    const alumno = reg.registros.find(r => r.alumnoId === alumnoId);
    if (alumno) {
      alumno.estado = nuevoEstado as EstadoAsistencia;
    }
  }

  async guardarCambios(reg: RegistroAsistencia) {
    if (!reg.id) return;
    try {
      await this.asistenciaService.update(reg.id, { registros: reg.registros } as any);
      this.snackBar.open('✓ Registro actualizado', 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }

  fechaDe(reg: any): Date {
    const s = reg.fecha?.seconds || 0;
    return s ? new Date(s * 1000) : new Date();
  }

  // Cuenta alumnos de un registro en un estado dado
  contarReg(reg: any, estado: string): number {
    return (reg.registros || []).filter((r: any) => r.estado === estado).length;
  }

  // Una clave única por sesión: grupo + módulo + fecha(día) + franja
  private claveSesion(reg: any): string {
    const d = this.fechaDe(reg);
    const dia = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
    return `${reg.grupoId}_${reg.moduloId}_${dia}_${reg.franjaHoraria}`;
  }

  hayDuplicados(): boolean {
    const vistas = new Set<string>();
    for (const reg of this.registrosHoy) {
      const k = this.claveSesion(reg);
      if (vistas.has(k)) return true;
      vistas.add(k);
    }
    return false;
  }

  async limpiarDuplicados() {
    if (!confirm('Se conservará el registro más reciente de cada franja y se borrarán los duplicados. ¿Continuar?')) return;
    this.limpiando = true;
    try {
      // Agrupar por clave de sesión
      const grupos = new Map<string, any[]>();
      for (const reg of this.registrosHoy) {
        const k = this.claveSesion(reg);
        if (!grupos.has(k)) grupos.set(k, []);
        grupos.get(k)!.push(reg);
      }
      let borrados = 0;
      for (const [, regs] of grupos) {
        if (regs.length <= 1) continue;
        // Conservar el más reciente (mayor fecha.seconds), borrar el resto
        regs.sort((a, b) => (b.fecha?.seconds || 0) - (a.fecha?.seconds || 0));
        const aBorrar = regs.slice(1);
        for (const r of aBorrar) {
          if (r.id) { await this.asistenciaService.delete(r.id); borrados++; }
        }
      }
      this.snackBar.open(`✓ ${borrados} registro(s) duplicado(s) eliminado(s)`, 'OK', { duration: 4000 });
      await this.ngOnInit(); // recargar
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
    this.limpiando = false;
  }
}