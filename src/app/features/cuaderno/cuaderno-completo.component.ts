import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { Firestore, doc as fsDoc, setDoc, getDoc, getDocs, collection as fsCollection, deleteDoc, Timestamp } from '@core/firebase-shim';
import { ExportService, DetalleAlumno, ItemActividad, ApartadosCuaderno } from '@core/services/export.service';
import {
  AlumnosService, CalificacionesService, AsistenciaService,
  TareasService, ExamenesService, RecuperacionesService,
  ObservacionesService, AuthService, PeriodosEvaluacionService,
  BackupService, BackupHistorialService
} from '@core/services';
import { EventosProgramacionService } from '@core/services/entities.service';
import { OrlasService } from '@core/services/orlas.service';
import { ActiveModuleService } from '@core/services/active-module.service';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { TipoEvaluacion } from '@core/models';

const TODO_CURSO = 'TODO';

function fmtFecha(f: any): string {
  if (!f) return '—';
  const d = f?.toDate ? f.toDate() : (f?.seconds ? new Date(f.seconds * 1000) : new Date(f));
  return isNaN(d.getTime()) ? '—' : d.toLocaleDateString('es-ES');
}
function fechaDe(f: any): Date | null {
  if (!f) return null;
  const d = f?.toDate ? f.toDate() : (f?.seconds ? new Date(f.seconds * 1000) : new Date(f));
  return isNaN(d.getTime()) ? null : d;
}

@Component({
  selector: 'app-cuaderno-completo',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatCheckboxModule, MatProgressSpinnerModule,
    MatSnackBarModule, TranslateModule
  ],
  template: `
    <div class="page-header">
      <h2>{{ 'notebook.title' | translate }}</h2>
      <p class="subtitle">{{ 'notebook.subtitle' | translate }}</p>
    </div>

    @if (ultimoPdf) {
      <div class="generated-banner">
        <mat-icon class="ok-icon">verified</mat-icon>
        <div class="generated-info">
          <strong>{{ 'notebook.generated' | translate }}</strong>
          <span>{{ 'notebook.last_generation' | translate }}: {{ ultimoPdf.fecha | date:'dd/MM/yyyy HH:mm' }}</span>
        </div>
        <button mat-raised-button color="primary" class="download-btn" (click)="descargarUltimo()" [disabled]="descargandoUltimo">
          @if (descargandoUltimo) {
            <mat-spinner diameter="18" style="display:inline-block;margin-right:6px;"></mat-spinner>
          } @else { <mat-icon>download</mat-icon> }
          {{ 'notebook.download_last' | translate }}
        </button>
        <p class="generated-warning">{{ 'notebook.last_warning' | translate }}</p>
      </div>
    }

    <mat-card class="filters-card">
      <div class="active-info">
        <mat-icon>menu_book</mat-icon>
        <span><strong>{{ activeModule.moduloNombre || ('notebook.no_module' | translate) }}</strong>
          @if (activeModule.grupoNombre) { · {{ activeModule.grupoNombre }} }
        </span>
      </div>
      <div class="filters-row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'notebook.up_to' | translate }}</mat-label>
          <mat-select [(ngModel)]="evaluacion">
            <mat-option [value]="TODO_CURSO">{{ 'notebook.whole_course' | translate }}</mat-option>
            @for (ev of evaluaciones; track ev) { <mat-option [value]="ev">{{ ev }}</mat-option> }
          </mat-select>
        </mat-form-field>
      </div>
    </mat-card>

    <mat-card class="apartados-card">
      <div class="ap-head">
        <h3>{{ 'notebook.sections_title' | translate }}</h3>
        <button mat-button (click)="toggleTodos()">
          <mat-icon>{{ todosMarcados() ? 'check_box_outline_blank' : 'check_box' }}</mat-icon>
          {{ (todosMarcados() ? 'notebook.unselect_all' : 'notebook.select_all') | translate }}
        </button>
      </div>
      <div class="ap-grid">
        @for (a of listaApartados; track a.key) {
          <mat-checkbox [(ngModel)]="apartados[a.key]">{{ a.labelKey | translate }}</mat-checkbox>
        }
      </div>
    </mat-card>

    <mat-card class="hero-card">
      <mat-icon class="hero-icon">menu_book</mat-icon>
      <h3>{{ 'notebook.card_title' | translate }}</h3>
      <p>{{ 'notebook.card_desc' | translate }}</p>
      <button mat-raised-button color="primary" (click)="generar()" [disabled]="cargando">
        @if (cargando) {
          <mat-spinner diameter="20" style="display:inline-block;margin-right:8px;"></mat-spinner>
          {{ 'notebook.generating' | translate }}
        } @else {
          <ng-container><mat-icon>picture_as_pdf</mat-icon> {{ 'notebook.generate' | translate }}</ng-container>
        }
      </button>
    </mat-card>

    <!-- ============ COPIA DE SEGURIDAD ============ -->
    <mat-card class="backup-card">
      <h3><mat-icon>backup</mat-icon> Copia de seguridad</h3>
      <p class="backup-hint">Crea o restaura una copia completa de todos los datos del cuaderno
        (alumnos, notas, tareas, fotos, asistencia, etc.).</p>

      <div class="backup-actions">
        <button mat-raised-button color="primary"
                (click)="crearBackup()" [disabled]="creandoBackup">
          @if (creandoBackup) {
            <mat-spinner diameter="18" style="display:inline-block;margin-right:8px;"></mat-spinner>
            Creando...
          } @else {
            <mat-icon>download</mat-icon> Crear y descargar copia
          }
        </button>

        <button mat-stroked-button color="warn"
                (click)="restoreInput.click()" [disabled]="restaurandoBackup">
          @if (restaurandoBackup) {
            <mat-spinner diameter="18" style="display:inline-block;margin-right:8px;"></mat-spinner>
            Restaurando...
          } @else {
            <mat-icon>upload_file</mat-icon> Restaurar desde archivo
          }
        </button>
        <input #restoreInput type="file" hidden accept=".json,application/json"
               (change)="onRestoreFile($event)">
      </div>
    </mat-card>
  `,
  styles: [`
    .generated-banner { display: flex; flex-wrap: wrap; align-items: center; gap: 12px 16px; background: #e8f5e9; border: 1px solid #a5d6a7; border-left: 5px solid #4caf50; border-radius: 12px; padding: 18px 24px; margin-bottom: 20px; }
    .generated-banner .ok-icon { color: #2e7d32; font-size: 32px; width: 32px; height: 32px; }
    .generated-info { display: flex; flex-direction: column; }
    .generated-info strong { color: #2e7d32; font-size: 16px; }
    .generated-info span { color: #555; font-size: 13px; }
    .generated-banner .download-btn { margin-left: auto; }
    .generated-warning { flex-basis: 100%; margin: 0; font-size: 12px; color: #888; }
    .page-header { margin-bottom: 20px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .filters-card { margin-bottom: 20px; padding: 16px; border-radius: 12px; }
    .active-info { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; color: #6a1b9a; font-size: 15px; }
    .active-info mat-icon { color: #6a1b9a; }
    .filters-row { display: flex; gap: 12px; flex-wrap: wrap; }
    .apartados-card { margin-bottom: 20px; padding: 16px 20px; border-radius: 12px; max-width: 720px; }
    .ap-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .ap-head h3 { margin: 0; font-size: 16px; }
    .ap-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 24px; }
    @media (max-width: 600px) { .ap-grid { grid-template-columns: 1fr; } }
    .hero-card {
      padding: 40px; border-radius: 16px; text-align: center; max-width: 520px;
      background: linear-gradient(135deg, #f5f3ff 0%, #faf5ff 100%);
    }
    .hero-icon { font-size: 56px; width: 56px; height: 56px; color: #6a1b9a; margin-bottom: 12px; }
    .hero-card h3 { margin: 0 0 8px; font-size: 20px; }
    .hero-card p { color: #666; font-size: 14px; margin: 0 0 24px; line-height: 1.6; }

    /* Copia de seguridad */
    .backup-card { margin-top: 24px; padding: 24px; border-radius: 14px; border-left: 4px solid #e65100; max-width: 520px; }
    .backup-card h3 { display: flex; align-items: center; gap: 8px; margin: 0 0 8px; font-size: 17px; }
    .backup-card h3 mat-icon { color: #e65100; }
    .backup-hint { color: #666; font-size: 14px; margin: 0 0 16px; }
    .backup-actions { display: flex; gap: 12px; flex-wrap: wrap; }
  `]
})
export class CuadernoCompletoComponent implements OnInit {
  private alumnosService = inject(AlumnosService);
  private califService = inject(CalificacionesService);
  private asistenciaService = inject(AsistenciaService);
  private tareasService = inject(TareasService);
  private examenesService = inject(ExamenesService);
  private recuperacionesService = inject(RecuperacionesService);
  private observacionesService = inject(ObservacionesService);
  private eventosService = inject(EventosProgramacionService);
  private periodosService = inject(PeriodosEvaluacionService);
  private orlasService = inject(OrlasService);
  private exportService = inject(ExportService);
  private auth = inject(AuthService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);
  activeModule = inject(ActiveModuleService);
  private firestore = inject(Firestore);
  private backupService = inject(BackupService);
  private histService = inject(BackupHistorialService);
  private confirm = inject(ConfirmService);

  ultimoPdf: { fecha: Date; fragmentos: number } | null = null;
  descargandoUltimo = false;
  creandoBackup = false;
  restaurandoBackup = false;

  readonly TODO_CURSO = TODO_CURSO;
  evaluaciones = Object.values(TipoEvaluacion);
  evaluacion: string = TODO_CURSO;
  cargando = false;

  listaApartados: { key: keyof ApartadosCuaderno; labelKey: string }[] = [
    { key: 'portada', labelKey: 'notebook.sec.cover' },
    { key: 'orla', labelKey: 'notebook.sec.orla' },
    { key: 'horario', labelKey: 'notebook.sec.schedule' },
    { key: 'fechasEval', labelKey: 'notebook.sec.eval_dates' },
    { key: 'actas', labelKey: 'notebook.sec.records' },
    { key: 'temporalizacion', labelKey: 'notebook.sec.timeline' },
    { key: 'asistencia', labelKey: 'notebook.sec.attendance' },
    { key: 'tareas', labelKey: 'notebook.sec.tasks' },
    { key: 'examenes', labelKey: 'notebook.sec.exams' },
    { key: 'recuperaciones', labelKey: 'notebook.sec.recovery' },
    { key: 'calificaciones', labelKey: 'notebook.sec.grades' }
  ];
  apartados: ApartadosCuaderno = {
    portada: true, orla: true, horario: true, fechasEval: true, actas: true,
    temporalizacion: true, asistencia: true, tareas: true, examenes: true,
    recuperaciones: true, calificaciones: true
  };

  todosMarcados(): boolean { return this.listaApartados.every(a => this.apartados[a.key] !== false); }
  toggleTodos() { const m = !this.todosMarcados(); this.listaApartados.forEach(a => this.apartados[a.key] = m); }

  async ngOnInit() { await this.cargarUltimoPdf(); }

  private docIdPdf(): string | null {
    const m = this.activeModule.moduloId, g = this.activeModule.grupoId;
    return (m && g) ? `${m}_${g}` : null;
  }

  private async cargarUltimoPdf() {
    this.ultimoPdf = null;
    const id = this.docIdPdf();
    if (!id) return;
    try {
      const snap = await getDoc(fsDoc(this.firestore, 'cuadernos_generados', id));
      if (snap.exists()) {
        const d: any = snap.data();
        const fecha = d.generadoEn?.toDate ? d.generadoEn.toDate() : (d.generadoEn ? new Date(d.generadoEn) : new Date());
        if (d.fragmentos > 0) this.ultimoPdf = { fecha, fragmentos: d.fragmentos };
      }
    } catch (e) { console.warn('No se pudo leer el último cuaderno guardado:', e); }
  }

  private async guardarPdfGenerado(blob: Blob) {
    const id = this.docIdPdf();
    if (!id) return;
    try {
      const base64 = await this.blobABase64(blob);
      const TROZO = 800_000;
      const partes: string[] = [];
      for (let i = 0; i < base64.length; i += TROZO) partes.push(base64.slice(i, i + TROZO));
      const baseRef = fsDoc(this.firestore, 'cuadernos_generados', id);
      const viejos = await getDocs(fsCollection(this.firestore, 'cuadernos_generados', id, 'fragmentos'));
      await Promise.all(viejos.docs.map(d => deleteDoc(d.ref)));
      for (let i = 0; i < partes.length; i++) {
        await setDoc(fsDoc(this.firestore, 'cuadernos_generados', id, 'fragmentos', String(i)), { data: partes[i] });
      }
      await setDoc(baseRef, {
        generadoEn: Timestamp.now(), fragmentos: partes.length,
        moduloId: this.activeModule.moduloId, grupoId: this.activeModule.grupoId,
        nombre: `Cuaderno_${this.activeModule.current?.abreviatura || ''}_${this.activeModule.grupoNombre || ''}`.replace(/[,\s]+/g, '_')
      });
      this.ultimoPdf = { fecha: new Date(), fragmentos: partes.length };
    } catch (e) { console.warn('No se pudo guardar el cuaderno en Firestore:', e); }
  }

  async descargarUltimo() {
    const id = this.docIdPdf();
    if (!id || !this.ultimoPdf) return;
    this.descargandoUltimo = true;
    try {
      let base64 = '';
      for (let i = 0; i < this.ultimoPdf.fragmentos; i++) {
        const snap = await getDoc(fsDoc(this.firestore, 'cuadernos_generados', id, 'fragmentos', String(i)));
        base64 += (snap.data() as any)?.data || '';
      }
      const blob = this.base64ABlob(base64, 'application/pdf');
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Cuaderno_${this.activeModule.current?.abreviatura || 'DWEC'}_${this.activeModule.grupoNombre || ''}.pdf`.replace(/[,\s]+/g, '_');
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      console.error('Error descargando el cuaderno guardado:', e);
      this.snackBar.open(this.t.instant('notebook.error'), 'OK', { duration: 4000 });
    } finally { this.descargandoUltimo = false; }
  }

  private blobABase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => { const res = r.result as string; const c = res.indexOf(','); resolve(c >= 0 ? res.slice(c + 1) : res); };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  private base64ABlob(base64: string, tipo: string): Blob {
    const bin = atob(base64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: tipo });
  }

  // ================================================================
  //  COPIA DE SEGURIDAD
  // ================================================================
  async crearBackup() {
    const user = this.auth.currentUser;
    if (!user) return;
    this.creandoBackup = true;
    try {
      const descripcion = `${this.activeModule.current?.abreviatura || 'Cuaderno'} ${new Date().toLocaleDateString('es-ES')}`;
      const backup = await this.backupService.generarBackup(descripcion, user.centroId);

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${this.activeModule.current?.abreviatura || 'cuaderno'}_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const totalDocs = Object.values(backup.resumen).reduce((s, n) => s + n, 0);
      await this.histService.create({
        descripcion, generadaEn: new Date(), centroId: user.centroId,
        totalDocs, detalle: backup.resumen
      } as any);

      this.snackBar.open(`✓ Copia creada (${totalDocs} registros)`, 'OK', { duration: 4000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + (e.message || e), 'Cerrar', { duration: 5000 });
    } finally { this.creandoBackup = false; }
  }

  async onRestoreFile(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;

    let backup: any;
    try {
      backup = JSON.parse(await file.text());
    } catch {
      this.snackBar.open('El archivo no es JSON válido', 'Cerrar', { duration: 4000 });
      return;
    }
    if (backup?.formato !== 'cuaderno-fp-backup') {
      this.snackBar.open('El archivo no es una copia de seguridad válida del cuaderno', 'Cerrar', { duration: 4000 });
      return;
    }

    const totalDocs = Object.values(backup.resumen as Record<string, number>).reduce((s, n) => s + n, 0);
    const colecciones = Object.entries(backup.resumen as Record<string, number>)
      .map(([c, n]) => `${c}: ${n}`).join(', ');

    const ok = await this.confirm.ask({
      title: 'Restaurar copia de seguridad',
      message:
        `Se restaurarán ${totalDocs} registros de la copia "${backup.descripcion || '—'}" ` +
        `(${new Date(backup.generadoEn).toLocaleDateString('es-ES')}).\n\n` +
        `Colecciones: ${colecciones}\n\n` +
        `Los datos existentes con el mismo ID serán sobrescritos.`,
      confirmText: 'Restaurar',
      variant: 'danger',
      icon: 'restore'
    });
    if (!ok) return;

    this.restaurandoBackup = true;
    try {
      const res = await this.backupService.restaurarBackup(backup);
      const total = Object.values(res).reduce((s, n) => s + n, 0);
      this.snackBar.open(`✓ ${total} registros restaurados correctamente`, 'OK', { duration: 5000 });
    } catch (e: any) {
      this.snackBar.open('Error al restaurar: ' + (e.message || e), 'Cerrar', { duration: 5000 });
    } finally { this.restaurandoBackup = false; }
  }

  // ================================================================
  //  GENERAR PDF COMPLETO
  // ================================================================
  async generar() {
    const moduloId = this.activeModule.moduloId;
    const grupoId = this.activeModule.grupoId;
    if (!grupoId || !moduloId) {
      this.snackBar.open(this.t.instant('notebook.no_module'), 'OK', { duration: 3000 });
      return;
    }
    this.cargando = true;
    const todoCurso = this.evaluacion === TODO_CURSO;
    const nombre = (a: any) => `${a.apellidos}, ${a.nombre}`;
    const cursoAcademico = this.activeModule.cursoActual;

    try {
      const alumnos = await this.alumnosService.getByGrupo(grupoId);
      alumnos.sort((a, b) => nombre(a).localeCompare(nombre(b), 'es', { sensitivity: 'base' }));
      const idsValidos = new Set(alumnos.map(a => a.id));
      const mapNombre = (id: string) => { const a = alumnos.find(x => x.id === id); return a ? nombre(a) : id; };

      const eventosRaw: any[] = await this.eventosService.getByModuloGrupo(moduloId, grupoId).catch(() => []);
      const unidades = (eventosRaw || []).filter(e => e.tipo === 'tema');
      const tituloUD = (unidadId?: string) => {
        if (!unidadId) return '(Sin unidad)';
        const u = unidades.find(x => x.id === unidadId);
        return u ? u.titulo : '(Sin unidad)';
      };

      const califsPorEval: { [ev: string]: any[] } = {};
      for (const ev of this.evaluaciones) {
        const raw = await firstValueFrom(this.califService.getByModuloGrupoEvaluacion$(moduloId, grupoId, ev)).catch(() => []) || [];
        califsPorEval[ev] = raw.filter((c: any) => idsValidos.has(c.alumnoId));
      }
      let califs: any[] = [];
      if (todoCurso) { for (const ev of this.evaluaciones) califs = califs.concat(califsPorEval[ev]); }
      else { califs = califsPorEval[this.evaluacion] || []; }

      const alumnosIds = alumnos.map(a => a.id!).filter(Boolean);
      let resumenes: any[] = [];
      try { resumenes = await this.asistenciaService.calcularResumenGrupo(moduloId, grupoId, alumnosIds); } catch { resumenes = []; }
      const asistencia = alumnos.map(a => {
        const r = resumenes.find(x => x.alumnoId === a.id) || {} as any;
        return { alumno: nombre(a), porcentaje: r.porcentajeAsistencia ?? 0, justificadas: r.ausenciasJustificadas ?? 0, injustificadas: r.ausenciasInjustificadas ?? 0, faltas: (r.ausenciasJustificadas || 0) + (r.ausenciasInjustificadas || 0), superaMinimo: r.superaMinimo ?? true };
      }).sort((a, b) => a.alumno.localeCompare(b.alumno, 'es', { sensitivity: 'base' }));

      const asistenciaDetalle = alumnos.map(a => {
        const r = resumenes.find(x => x.alumnoId === a.id) || {} as any;
        return { alumno: nombre(a), totalClases: r.totalClases ?? 0, presencias: r.presencias ?? 0, justificadas: r.ausenciasJustificadas ?? 0, injustificadas: r.ausenciasInjustificadas ?? 0, retrasos: r.retrasos ?? 0, porcentaje: r.porcentajeAsistencia ?? 0, superaMinimo: r.superaMinimo ?? true };
      }).sort((a, b) => a.alumno.localeCompare(b.alumno, 'es', { sensitivity: 'base' }));

      const tareasRaw: any[] = await firstValueFrom(this.tareasService.getByModuloYGrupo(moduloId, grupoId)).catch(() => []) || [];
      const examenesRaw: any[] = await firstValueFrom(this.examenesService.getByModuloYGrupo(moduloId, grupoId)).catch(() => []) || [];
      const recRaw: any[] = await firstValueFrom(this.recuperacionesService.getByModuloYGrupo$(moduloId, grupoId)).catch(() => []) || [];

      const filtraEval = <T extends { evaluacion?: string }>(arr: T[]) => todoCurso ? arr : arr.filter(x => x.evaluacion === this.evaluacion);
      const tareasF = filtraEval(tareasRaw).sort((a: any, b: any) => (a.titulo || '').localeCompare(b.titulo || '', 'es', { numeric: true, sensitivity: 'base' }));
      const examenesF = filtraEval(examenesRaw);
      const recF = filtraEval(recRaw);

      const agrupar = (arr: any[], fechaCampo: string, extra: (x: any) => string) => {
        const evals = todoCurso ? this.evaluaciones.map(String) : [String(this.evaluacion)];
        return evals.map(ev => {
          const delEv = arr.filter(x => x.evaluacion === ev);
          const porUD = new Map<string, ItemActividad[]>();
          for (const x of delEv) {
            const udTitulo = tituloUD(x.unidadId);
            if (!porUD.has(udTitulo)) porUD.set(udTitulo, []);
            porUD.get(udTitulo)!.push({ titulo: x.titulo, fecha: fmtFecha(x[fechaCampo]), evaluacion: ev, unidad: udTitulo, extra: extra(x) });
          }
          const unidadesArr = Array.from(porUD.entries()).map(([unidad, items]) => ({
            unidad, items: items.sort((a, b) => a.titulo.localeCompare(b.titulo, 'es', { numeric: true, sensitivity: 'base' }))
          }));
          return { evaluacion: ev, unidades: unidadesArr };
        }).filter(g => g.unidades.length);
      };

      const tareasAgrupadas = agrupar(tareasF, 'fechaEntrega', t => `${t.puntuacionMaxima ?? '?'} pts`);
      const examenesAgrupados = agrupar(examenesF, 'fecha', e => `${e.tipo || ''} · ${e.puntuacionMaxima ?? '?'} pts`);
      const recuperacionesAgrupadas = agrupar(recF, 'fecha', r => `${r.tipoRecuperacion || ''}`);

      const fechaHora = (x: any) => {
        const f = fmtFecha(x.fecha);
        const h = x.horaInicio ? ` ${x.horaInicio}${x.horaFin ? '-' + x.horaFin : ''}` : '';
        return f + h;
      };
      const ordenarPorNombre = (arr: { alumno: string }[]) =>
        arr.sort((a, b) => a.alumno.localeCompare(b.alumno, 'es', { sensitivity: 'base' }));

      const evalsAct = todoCurso ? this.evaluaciones.map(String) : [String(this.evaluacion)];
      const actividadesPorEval = evalsAct.map(ev => ({
        evaluacion: ev,
        examenes: examenesF.filter((e: any) => e.evaluacion === ev).map((ex: any) => ({
          titulo: ex.titulo, fechaHora: fechaHora(ex), unidad: tituloUD(ex.unidadId),
          notaMax: ex.puntuacionMaxima, notaMin: ex.notaMinimaAprobado,
          alumnos: ordenarPorNombre(alumnos.map(al => {
            const c = (ex.calificaciones || []).find((x: any) => x.alumnoId === al.id);
            return { alumno: nombre(al), nota: c?.nota, noPresente: !!c?.noPresente };
          }))
        })),
        recuperaciones: recF.filter((r: any) => r.evaluacion === ev).map((r: any) => ({
          titulo: r.titulo, fechaHora: fechaHora(r), unidad: tituloUD(r.unidadId),
          notaMax: r.notaMaximaRecuperacion,
          alumnos: ordenarPorNombre((r.alumnosConvocados || []).map((c: any) => ({
            alumno: mapNombre(c.alumnoId), nota: c.notaRecuperacion, estado: c.estado
          })))
        }))
      }));

      const detallePorAlumno: DetalleAlumno[] = alumnos.map((al): DetalleAlumno => {
        const aid = al.id!;
        return {
          alumno: nombre(al),
          tareas: tareasF.map((t: any) => { const e = (t.entregas || []).find((x: any) => x.alumnoId === aid); return { titulo: t.titulo, nota: e?.nota }; }),
          examenes: examenesF.map((ex: any) => { const c = (ex.calificaciones || []).find((x: any) => x.alumnoId === aid); return { titulo: ex.titulo, nota: c?.nota, noPresente: c?.noPresente }; }),
          recuperaciones: recF.filter((r: any) => (r.alumnosConvocados || []).some((x: any) => x.alumnoId === aid)).map((r: any) => { const c = (r.alumnosConvocados || []).find((x: any) => x.alumnoId === aid); return { titulo: r.titulo, nota: c?.notaRecuperacion, estado: c?.estado }; })
        };
      });

      const evalsTemporal = todoCurso ? this.evaluaciones.map(String) : [String(this.evaluacion)];
      const temporalizacionPorEval = evalsTemporal.map(ev => ({
        evaluacion: ev,
        eventos: (eventosRaw || []).filter(e => e.evaluacion === ev)
          .sort((a: any, b: any) => (a.fechaInicio?.seconds || 0) - (b.fechaInicio?.seconds || 0))
          .map(e => ({ titulo: e.titulo, tipo: e.tipo, fecha: fmtFecha(e.fechaInicio), fechaFin: e.fechaFin ? fmtFecha(e.fechaFin) : undefined }))
      })).filter(g => g.eventos.length);

      const programacion = (eventosRaw || []).map((e: any) => ({ titulo: e.titulo || '—', tipo: e.tipo || '—', fecha: fmtFecha(e.fechaInicio), evaluacion: e.evaluacion }));

      const obsRaw: any[] = await firstValueFrom(this.observacionesService.getByGrupo$(grupoId)).catch(() => []) || [];
      const observaciones = obsRaw.map((o: any) => ({ fecha: fmtFecha(o.fecha), tipo: o.tipo || '—', titulo: o.titulo || '—' }));

      const grupo: any = this.activeModule.currentGrupo;
      const horario: any[] = [];
      if (grupo?.horario) {
        for (const dia of ['lunes', 'martes', 'miercoles', 'jueves', 'viernes']) {
          for (const fr of (grupo.horario[dia] || [])) {
            horario.push({ dia, horaInicio: fr.horaInicio, horaFin: fr.horaFin, modulo: fr.moduloAbreviatura || '¿?', aula: fr.aula || '', esDelModulo: fr.moduloId === moduloId });
          }
        }
      }

      // Nombre y acrónimo del ciclo + nombre completo del módulo (para la portada y el pie del PDF)
      let cicloNombre = grupo?.cicloNombre || '';
      let cicloAbrev = grupo?.cicloAbreviatura || grupo?.cicloAbrev || '';
      if ((!cicloNombre || !cicloAbrev) && grupo?.cicloId) {
        try {
          const cSnap = await getDoc(fsDoc(this.firestore, 'ciclos', grupo.cicloId));
          if (cSnap.exists()) {
            const c: any = cSnap.data();
            cicloNombre = cicloNombre || c.nombre || '';
            cicloAbrev = cicloAbrev || c.abreviatura || c.abrev || '';
          }
        } catch { /* si falla, se usan los fallbacks de abajo */ }
      }
      const moduloNombreCompleto = this.activeModule.current?.nombre || this.activeModule.moduloNombre || '';

      const user = this.auth.currentUser;
      let periodosRaw: any[] = [];
      try { periodosRaw = await firstValueFrom(this.periodosService.getByCentro$(user!.centroId, cursoAcademico)); } catch { periodosRaw = []; }
      const periodos = (periodosRaw || []).map((p: any) => ({ evaluacion: p.tipo || p.evaluacion || '—', inicio: fmtFecha(p.fechaInicio), fin: fmtFecha(p.fechaFin) }));

      const construirEvalConCalif = (ev: string) => {
        const lista = (califsPorEval[ev] || []);
        const filas = lista.map((c: any) => ({ alumno: mapNombre(c.alumnoId), nota: c.notaFinal, aprobado: !!c.aprobado }))
          .sort((a, b) => a.alumno.localeCompare(b.alumno, 'es', { sensitivity: 'base' }));
        const conNota = filas.filter(f => f.nota != null);
        const aprobados = filas.filter(f => f.aprobado).length;
        const suspensos = filas.filter(f => f.nota != null && !f.aprobado).length;
        const noEvaluados = Math.max(0, alumnos.length - filas.length);
        const media = conNota.length ? Math.round(conNota.reduce((s, f) => s + (f.nota || 0), 0) / conNota.length * 100) / 100 : 0;
        return { evaluacion: ev, filas, estadisticas: { aprobados, suspensos, noEvaluados, notaMedia: media } };
      };
      const evalsCalif = todoCurso ? this.evaluaciones.map(String) : [String(this.evaluacion)];
      const actasPorEval = evalsCalif.map(construirEvalConCalif);
      const calificacionesPorEval = actasPorEval;

      const resumenPorEval = evalsCalif.map(ev => {
        const lista = califsPorEval[ev] || [];
        const filas = lista.map((c: any) => ({
          alumno: mapNombre(c.alumnoId), tareas: c.notaTareas, examenes: c.notaExamenes,
          actitud: c.notaActitud, asistencia: c.notaAsistencia, final: c.notaFinal, aprobado: !!c.aprobado
        })).sort((a, b) => a.alumno.localeCompare(b.alumno, 'es', { sensitivity: 'base' }));
        return { evaluacion: ev, filas };
      });

      let orlaReg = null;
      try { orlaReg = await this.orlasService.getByGrupo(grupoId); } catch { orlaReg = null; }

      const notas = (califs || []).map((c: any) => c.notaFinal).filter((n: any) => n != null);
      const aprobadosKpi = (califs || []).filter((c: any) => c.aprobado).length;
      const asistMedia = asistencia.length ? Math.round(asistencia.reduce((s, a) => s + a.porcentaje, 0) / asistencia.length * 10) / 10 : 0;
      const enRiesgo = asistencia.filter(a => !a.superaMinimo).length;
      const etiquetaEval = todoCurso ? this.t.instant('notebook.whole_course') : String(this.evaluacion);

      const blobPdf = this.exportService.exportarCuadernoCompletoPDF({
        centro: 'Cuaderno Digital FP · Euskadi',
        grupo: this.activeModule.grupoNombre || '',
        modulo: this.activeModule.current?.abreviatura || this.activeModule.moduloNombre || '',
        cicloNombre,
        cicloAbrev,
        moduloNombre: moduloNombreCompleto,
        cursoAcademico,
        evaluacion: etiquetaEval,
        profesor: (user as any)?.nombre || user?.email || '',
        alumnos: alumnos.map(a => ({ apellidos: a.apellidos, nombre: a.nombre, email: a.email, estado: a.estado, fotoUrl: (a as any).fotoUrl })),
        calificaciones: (califs || []).map((c: any) => ({ alumno: mapNombre(c.alumnoId), nota: c.notaFinal, aprobado: c.aprobado })),
        asistencia, detallePorAlumno, programacion, observaciones,
        kpis: {
          totalAlumnos: alumnos.length, asistenciaMedia: asistMedia,
          notaMedia: notas.length ? Math.round(notas.reduce((a: number, b: number) => a + b, 0) / notas.length * 10) / 10 : 0,
          porcentajeAprobados: (califs && califs.length) ? Math.round(aprobadosKpi / califs.length * 100) : 0,
          enRiesgo
        },
        horario, periodos, actasPorEval, calificacionesPorEval, temporalizacionPorEval,
        tareasAgrupadas, examenesAgrupados, recuperacionesAgrupadas,
        actividadesPorEval, asistenciaDetalle, resumenPorEval, apartados: this.apartados
      });

      await this.guardarPdfGenerado(blobPdf);
      this.snackBar.open(this.t.instant('notebook.exported'), 'OK', { duration: 3000 });
    } catch (e) {
      console.error('Error generando cuaderno:', e);
      this.snackBar.open(this.t.instant('notebook.error'), 'OK', { duration: 4000 });
    } finally { this.cargando = false; }
  }
}