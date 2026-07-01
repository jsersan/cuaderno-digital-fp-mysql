import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatDividerModule } from '@angular/material/divider';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import {
  BackupService, BackupHistorialService, BackupRegistro, BackupFile,
  COLECCION_LABELS, COLECCION_ICONS
} from '@core/services';
import { AuthService } from '@core/services';
import { ActiveModuleService } from '@core/services/active-module.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';

interface ColeccionCheck {
  nombre: string;
  label: string;
  icon: string;
  cantidad: number;
  seleccionada: boolean;
}

@Component({
  selector: 'app-backup',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatCheckboxModule,
    MatProgressSpinnerModule, MatProgressBarModule,
    MatSnackBarModule, MatTooltipModule, MatDividerModule,
    TranslateModule
  ],
  template: `
    <div class="page-header">
      <h2>{{ 'backup.title' | translate }}</h2>
      <p class="subtitle">{{ 'backup.subtitle' | translate }}</p>
    </div>

    <!-- ============ CREAR COPIA ============ -->
    <mat-card class="bk-card">
      <h3><mat-icon>backup</mat-icon> {{ 'backup.create_title' | translate }}</h3>
      <p class="hint">{{ 'backup.create_hint' | translate }}</p>
      <mat-form-field appearance="outline" class="full">
        <mat-label>{{ 'backup.description' | translate }}</mat-label>
        <input matInput [(ngModel)]="descripcion"
               [placeholder]="'backup.description_ph' | translate">
      </mat-form-field>
      <button mat-raised-button color="primary" class="full-btn"
              (click)="crearBackup()" [disabled]="creando">
        @if (creando) {
          <mat-spinner diameter="18" style="display:inline-block;margin-right:8px"></mat-spinner>
          Creando...
        } @else {
          <mat-icon>download</mat-icon> {{ 'backup.create_btn' | translate }}
        }
      </button>
    </mat-card>

    <!-- ============ RESTAURAR DESDE ARCHIVO ============ -->
    <mat-card class="bk-card restore-card">
      <h3><mat-icon>restore</mat-icon> {{ 'backup.restore_title' | translate }}</h3>
      <p class="warn-text">
        <mat-icon class="warn-icon">warning</mat-icon>
        {{ 'backup.restore_warn' | translate }}
      </p>
      <button mat-stroked-button color="warn" class="full-btn"
              (click)="fileInput.click()" [disabled]="restaurando">
        <mat-icon>upload_file</mat-icon> {{ 'backup.restore_btn' | translate }}
      </button>
      <input #fileInput type="file" hidden accept=".json,application/json"
             (change)="onFileSelected($event)">
    </mat-card>

    <!-- ============ HISTORIAL DE COPIAS ============ -->
    <mat-card class="bk-card hist-card">
      <h3><mat-icon>history</mat-icon> {{ 'backup.history_title' | translate }}</h3>

      @if (historial.length === 0) {
        <p class="empty-hist">{{ 'backup.history_empty' | translate }}</p>
      }

      @for (reg of historial; track reg.id) {
        <div class="hist-item" [class.loading]="cargandoId === reg.id"
             (click)="onHistorialClick(reg)"
             [matTooltip]="reg.tienedatos ? 'Pulsa para ver opciones de restauración' : 'Esta copia no tiene datos almacenados (solo metadatos)'">
          <mat-icon class="hist-icon" [class.has-data]="reg.tienedatos">
            {{ reg.tienedatos ? 'cloud_done' : 'cloud_off' }}
          </mat-icon>
          <div class="hist-info">
            <strong>{{ reg.descripcion || ('backup.no_desc' | translate) }}</strong>
            <span class="hist-date">
              {{ formatFecha(reg.generadaEn) }} · {{ reg.totalDocs }} {{ 'backup.docs' | translate }}
            </span>
          </div>
          @if (cargandoId === reg.id) {
            <mat-spinner diameter="20"></mat-spinner>
          } @else if (reg.tienedatos) {
            <mat-icon class="hist-arrow">chevron_right</mat-icon>
          }
        </div>
      }
    </mat-card>

    <!-- ============ PANEL DE RESTAURACIÓN (se abre al seleccionar una copia) ============ -->
    @if (backupCargado) {
      <mat-card class="bk-card restore-panel">
        <div class="restore-header">
          <div>
            <h3><mat-icon>settings_backup_restore</mat-icon> Restaurar copia de seguridad</h3>
            <p class="restore-meta">
              {{ backupCargado.descripcion || '(sin descripción)' }}
              · {{ formatFechaISO(backupCargado.generadoEn) }}
            </p>
          </div>
          <button mat-icon-button (click)="cerrarPanel()" matTooltip="Cerrar">
            <mat-icon>close</mat-icon>
          </button>
        </div>

        <mat-divider></mat-divider>

        <div class="col-section">
          <div class="col-header">
            <p class="col-title">Selecciona las colecciones a restaurar:</p>
            <div class="col-actions">
              <button mat-button (click)="seleccionarTodas()">
                <mat-icon>check_box</mat-icon> Todas
              </button>
              <button mat-button (click)="deseleccionarTodas()">
                <mat-icon>check_box_outline_blank</mat-icon> Ninguna
              </button>
            </div>
          </div>

          <div class="col-grid">
            @for (col of coleccionesCheck; track col.nombre) {
              <div class="col-item" [class.disabled]="col.cantidad === 0">
                <mat-checkbox [(ngModel)]="col.seleccionada"
                              [disabled]="col.cantidad === 0"
                              color="primary">
                  <div class="col-label">
                    <mat-icon class="col-icon">{{ col.icon }}</mat-icon>
                    <span class="col-name">{{ col.label }}</span>
                    <span class="col-count">{{ col.cantidad }}</span>
                  </div>
                </mat-checkbox>
              </div>
            }
          </div>

          <div class="restore-summary">
            <mat-icon>info</mat-icon>
            <span>
              Se restaurarán
              <strong>{{ totalSeleccionados() }}</strong> registros de
              <strong>{{ coleccionesSeleccionadas().length }}</strong> colecciones.
              Los documentos existentes con el mismo ID serán sobrescritos.
            </span>
          </div>
        </div>

        <mat-divider></mat-divider>

        <div class="restore-actions">
          <button mat-button (click)="cerrarPanel()">Cancelar</button>
          <button mat-raised-button color="warn"
                  (click)="ejecutarRestauracion()"
                  [disabled]="restaurando || coleccionesSeleccionadas().length === 0">
            @if (restaurando) {
              <mat-spinner diameter="18" style="display:inline-block;margin-right:8px"></mat-spinner>
              Restaurando...
            } @else {
              <mat-icon>restore</mat-icon>
              Restaurar {{ coleccionesSeleccionadas().length }} colecciones
            }
          </button>
        </div>

        @if (restaurando) {
          <mat-progress-bar mode="indeterminate" color="warn" class="restore-progress"></mat-progress-bar>
        }
      </mat-card>
    }
  `,
  styles: [`
    .page-header { margin-bottom: 20px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; }

    .bk-card { margin-bottom: 20px; padding: 24px; border-radius: 14px; max-width: 720px; }
    .bk-card h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 17px; }
    .hint { color: #666; font-size: 14px; margin: 0 0 16px; }

    .full { width: 100%; }
    .full-btn { width: 100%; }

    /* Restaurar card */
    .restore-card { border-left: 4px solid #e65100; }
    .restore-card h3 mat-icon { color: #e65100; }
    .warn-text {
      display: flex; align-items: flex-start; gap: 8px;
      color: #e65100; font-size: 13px; margin: 0 0 16px;
      background: #fff3e0; padding: 10px 14px; border-radius: 8px;
    }
    .warn-icon { font-size: 20px; width: 20px; height: 20px; flex-shrink: 0; margin-top: 1px; }

    /* Historial */
    .hist-card h3 mat-icon { color: #1565c0; }
    .empty-hist { color: #999; font-style: italic; font-size: 14px; }

    .hist-item {
      display: flex; align-items: center; gap: 12px;
      padding: 14px 16px; margin: 4px 0; border-radius: 10px;
      border: 1px solid #e8e8e8; cursor: pointer;
      transition: all 0.2s;
    }
    .hist-item:hover { background: #e3f2fd; border-color: #90caf9; }
    .hist-item.loading { opacity: 0.6; pointer-events: none; }
    .hist-icon { font-size: 24px; width: 24px; height: 24px; color: #bbb; }
    .hist-icon.has-data { color: #1565c0; }
    .hist-info { flex: 1; display: flex; flex-direction: column; gap: 2px; }
    .hist-info strong { font-size: 14px; }
    .hist-date { font-size: 12px; color: #888; }
    .hist-arrow { color: #999; }

    /* Panel de restauración */
    .restore-panel { border-left: 4px solid #d32f2f; }
    .restore-header { display: flex; justify-content: space-between; align-items: flex-start; }
    .restore-header h3 mat-icon { color: #d32f2f; }
    .restore-meta { font-size: 13px; color: #666; margin: 4px 0 12px; }

    .col-section { padding: 16px 0; }
    .col-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; }
    .col-title { margin: 0; font-size: 14px; font-weight: 600; }
    .col-actions { display: flex; gap: 4px; }
    .col-actions button { font-size: 12px; min-width: 0; padding: 0 8px; }
    .col-actions mat-icon { font-size: 18px; width: 18px; height: 18px; margin-right: 4px; }

    .col-grid {
      display: grid; grid-template-columns: 1fr 1fr;
      gap: 6px; margin-top: 12px;
    }
    @media (max-width: 600px) { .col-grid { grid-template-columns: 1fr; } }

    .col-item { padding: 6px 8px; border-radius: 8px; transition: background 0.15s; }
    .col-item:hover { background: #f5f5f5; }
    .col-item.disabled { opacity: 0.4; }

    .col-label { display: flex; align-items: center; gap: 8px; }
    .col-icon { font-size: 18px; width: 18px; height: 18px; color: #666; }
    .col-name { font-size: 13px; flex: 1; }
    .col-count {
      background: #e0e0e0; color: #555;
      padding: 1px 8px; border-radius: 10px;
      font-size: 11px; font-weight: 700;
    }

    .restore-summary {
      display: flex; align-items: flex-start; gap: 8px;
      margin-top: 16px; padding: 10px 14px;
      background: #fff8e1; border-radius: 8px;
      font-size: 13px; color: #555;
    }
    .restore-summary mat-icon {
      font-size: 18px; width: 18px; height: 18px;
      color: #f9a825; flex-shrink: 0; margin-top: 1px;
    }

    .restore-actions {
      display: flex; justify-content: flex-end; gap: 12px;
      padding-top: 16px;
    }

    .restore-progress { margin-top: 12px; border-radius: 4px; }
  `]
})
export class BackupComponent implements OnInit {
  private backupService = inject(BackupService);
  private histService = inject(BackupHistorialService);
  private auth = inject(AuthService);
  private activeModule = inject(ActiveModuleService);
  private snackBar = inject(MatSnackBar);
  private confirm = inject(ConfirmService);
  private t = inject(TranslateService);

  descripcion = '';
  creando = false;
  restaurando = false;
  cargandoId = '';
  historial: BackupRegistro[] = [];

  // Panel de restauración
  backupCargado: BackupFile | null = null;
  coleccionesCheck: ColeccionCheck[] = [];

  async ngOnInit() {
    await this.cargarHistorial();
  }

  private async cargarHistorial() {
    const user = this.auth.currentUser;
    if (!user) return;
    try {
      const all = await firstValueFrom(this.histService.getByCentro$(user.centroId));
      this.historial = (all || []).sort((a, b) => {
        const fa = this.toDate(a.generadaEn)?.getTime() || 0;
        const fb = this.toDate(b.generadaEn)?.getTime() || 0;
        return fb - fa;
      });
    } catch { this.historial = []; }
  }

  // ================================================================
  //  CREAR COPIA
  // ================================================================
  async crearBackup() {
    const user = this.auth.currentUser;
    if (!user) return;
    this.creando = true;
    try {
      const desc = this.descripcion.trim() ||
        `${this.activeModule.current?.abreviatura || 'Cuaderno'} ${new Date().toLocaleDateString('es-ES')}`;

      const backup = await this.backupService.generarBackup(desc, user.centroId);

      // 1. Descargar como JSON
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${desc.replace(/[^a-zA-Z0-9_-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      // 2. Guardar registro en historial
      const totalDocs = Object.values(backup.resumen).reduce((s, n) => s + n, 0);
      const registroId = await this.histService.create({
        descripcion: desc, generadaEn: new Date(), centroId: user.centroId,
        totalDocs, detalle: backup.resumen, tienedatos: true
      } as any);

      // 3. Guardar datos completos en Firestore (fragmentados)
      await this.backupService.guardarEnFirestore(registroId, backup);

      this.snackBar.open(
        this.t.instant('backup.created_ok') + ` (${totalDocs} registros)`,
        'OK', { duration: 4000 }
      );
      this.descripcion = '';
      await this.cargarHistorial();
    } catch (e: any) {
      this.snackBar.open(
        this.t.instant('backup.created_err', { msg: e.message || e }),
        'Cerrar', { duration: 5000 }
      );
    } finally { this.creando = false; }
  }

  // ================================================================
  //  RESTAURAR DESDE ARCHIVO (upload)
  // ================================================================
  async onFileSelected(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    let backup: BackupFile;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      this.snackBar.open(this.t.instant('backup.invalid_file'), 'Cerrar', { duration: 4000 });
      return;
    }
    if (backup?.formato !== 'cuaderno-fp-backup') {
      this.snackBar.open(this.t.instant('backup.invalid_file'), 'Cerrar', { duration: 4000 });
      return;
    }

    this.abrirPanelRestauracion(backup);
  }

  // ================================================================
  //  RESTAURAR DESDE HISTORIAL (clic en ítem)
  // ================================================================
  async onHistorialClick(reg: BackupRegistro) {
    if (!reg.tienedatos) {
      this.snackBar.open(
        'Esta copia solo tiene metadatos. Los datos completos no están almacenados en Firestore. ' +
        'Usa "Seleccionar archivo de copia" con el JSON descargado.',
        'Entendido', { duration: 6000 }
      );
      return;
    }

    if (!reg.id) return;
    this.cargandoId = reg.id;
    try {
      const backup = await this.backupService.cargarDesdeFirestore(reg.id);
      if (!backup) {
        this.snackBar.open('No se pudieron cargar los datos de esta copia', 'Cerrar', { duration: 4000 });
        return;
      }
      this.abrirPanelRestauracion(backup);
    } catch (e: any) {
      this.snackBar.open('Error al cargar: ' + (e.message || e), 'Cerrar', { duration: 5000 });
    } finally { this.cargandoId = ''; }
  }

  // ================================================================
  //  PANEL DE RESTAURACIÓN (común para archivo e historial)
  // ================================================================
  private abrirPanelRestauracion(backup: BackupFile) {
    this.backupCargado = backup;

    // Construir lista de colecciones con checkboxes
    this.coleccionesCheck = Object.entries(backup.resumen)
      .filter(([, n]) => true) // incluir todas, incluso con 0
      .map(([nombre, cantidad]) => ({
        nombre,
        label: COLECCION_LABELS[nombre] || nombre,
        icon: COLECCION_ICONS[nombre] || 'folder',
        cantidad,
        seleccionada: cantidad > 0
      }))
      .sort((a, b) => b.cantidad - a.cantidad);

    // Scroll al panel
    setTimeout(() => {
      document.querySelector('.restore-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }

  cerrarPanel() {
    this.backupCargado = null;
    this.coleccionesCheck = [];
  }

  seleccionarTodas() {
    this.coleccionesCheck.forEach(c => { if (c.cantidad > 0) c.seleccionada = true; });
  }

  deseleccionarTodas() {
    this.coleccionesCheck.forEach(c => c.seleccionada = false);
  }

  coleccionesSeleccionadas(): string[] {
    return this.coleccionesCheck.filter(c => c.seleccionada).map(c => c.nombre);
  }

  totalSeleccionados(): number {
    return this.coleccionesCheck.filter(c => c.seleccionada).reduce((s, c) => s + c.cantidad, 0);
  }

  async ejecutarRestauracion() {
    if (!this.backupCargado) return;
    const selected = this.coleccionesSeleccionadas();
    if (selected.length === 0) return;

    const total = this.totalSeleccionados();
    const cols = selected.map(n => COLECCION_LABELS[n] || n).join(', ');

    const ok = await this.confirm.ask({
      title: 'Confirmar restauración',
      message:
        `Se van a restaurar ${total} registros de ${selected.length} colecciones:\n\n` +
        `${cols}\n\n` +
        `Los datos existentes con el mismo ID serán sobrescritos. ` +
        `Esta acción no se puede deshacer.\n\n` +
        `¿Estás seguro de que quieres continuar?`,
      confirmText: 'Restaurar',
      variant: 'danger',
      icon: 'restore'
    });
    if (!ok) return;

    this.restaurando = true;
    try {
      const resultado = await this.backupService.restaurarBackupParcial(
        this.backupCargado, selected
      );
      const totalRestaurado = Object.values(resultado).reduce((s, n) => s + n, 0);

      // Detalle por colección
      const detalle = Object.entries(resultado)
        .filter(([, n]) => n > 0)
        .map(([c, n]) => `${COLECCION_LABELS[c] || c}: ${n}`)
        .join(' · ');

      this.snackBar.open(
        `✓ ${totalRestaurado} registros restaurados (${detalle})`,
        'OK', { duration: 6000 }
      );
      this.cerrarPanel();
    } catch (e: any) {
      this.snackBar.open(
        this.t.instant('backup.restored_err', { msg: e.message || e }),
        'Cerrar', { duration: 6000 }
      );
    } finally { this.restaurando = false; }
  }

  // ================================================================
  //  UTILIDADES
  // ================================================================
  formatFecha(f: any): string {
    const d = this.toDate(f);
    if (!d) return '—';
    return d.toLocaleDateString('es-ES') + ', ' +
           d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }

  formatFechaISO(iso: string): string {
    try {
      const d = new Date(iso);
      return d.toLocaleDateString('es-ES') + ' ' +
             d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    } catch { return iso; }
  }

  private toDate(f: any): Date | null {
    if (!f) return null;
    if (f.toDate) return f.toDate();
    if (f.seconds) return new Date(f.seconds * 1000);
    const d = new Date(f);
    return isNaN(d.getTime()) ? null : d;
  }
}