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
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { Firestore, collection, getDocs, query, where } from '@core/firebase-shim';
import { CalificacionesService, AlumnosService, GruposService, ModulosService, TareasService, ExamenesService, AsistenciaService, AuthService, ExportService, ActiveModuleService, RecuperacionesService } from '@core/services';
import { Calificacion, Alumno, Grupo, ModuloProfesional, TipoEvaluacion } from '@core/models';
import { EvalLabelPipe } from '../../../shared/pipes/eval-label.pipe';

@Component({
  selector: 'app-calificaciones-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatFormFieldModule, MatSelectModule, MatButtonModule, MatIconModule, MatTooltipModule, MatSnackBarModule, TranslateModule, EvalLabelPipe],
  template: `
    <div class="page-header">
      <div><h2>{{ 'grades.title' | translate }}</h2><p class="sub">{{ 'grades.subtitle' | translate }}</p></div>
      <div class="actions">
        @if (esProyecto) {
          @if (!esSegundaFinal) {
            <button mat-raised-button (click)="guardarCambios()" [disabled]="!moduloId || !grupoId || guardando" color="primary"><mat-icon>save</mat-icon> {{ 'grades.save_changes' | translate }}</button>
          }
        } @else {
          <button mat-raised-button (click)="calcularNotas()" [disabled]="!moduloId || !grupoId" color="accent"><mat-icon>calculate</mat-icon> {{ 'grades.calc' | translate }}</button>
        }
        <button mat-raised-button (click)="exportar()" [disabled]="calificaciones.length===0"><mat-icon>download</mat-icon> {{ 'common.export' | translate }}</button>
        <button mat-raised-button (click)="generarActa()" color="primary" [disabled]="generandoActa"><mat-icon>description</mat-icon> {{ 'grades.generate_record' | translate }}</button>
      </div>
    </div>
    <mat-card class="filters"><div class="filters-row">
      <mat-form-field appearance="outline"><mat-label>{{ 'common.evaluation' | translate }}</mat-label>
        <mat-select [(ngModel)]="evaluacion" (ngModelChange)="loadCalificaciones()">
          @for (e of evaluacionesDisponibles; track e) { <mat-option [value]="e">{{ e | evalLabel }}</mat-option> }
        </mat-select></mat-form-field>
    </div></mat-card>

    @if (alumnos.length > 0) {
      <div class="stats-bar">
        <span><strong>{{ alumnos.length }}</strong> {{ 'grades.students' | translate }}</span>
        <span class="aprobados"><strong>{{ aprobados }}</strong> {{ 'grades.approved' | translate }} ({{ pctAprobados }}%)</span>
        <span class="suspensos"><strong>{{ suspensos }}</strong> {{ 'grades.failed' | translate }}</span>
        <span><strong>{{ notaMedia | number:'1.1-1' }}</strong> {{ 'common.average' | translate }}</span>
      </div>

      <!-- ===================== VISTA PROYECTO ===================== -->
      @if (esProyecto) {
        @if (esSegundaFinal) {
          <mat-card class="info-card"><mat-icon>info</mat-icon><p>{{ 'grades.proy_2f_hint' | translate }}</p></mat-card>
        }
        <mat-card class="table-card"><table class="t">
          <thead><tr>
            <th class="n">{{ 'recovery.detail.student' | translate }}</th>
            <th class="v">{{ 'grades.note_col' | translate }}</th>
            <th class="v">{{ 'grades.attitude_col' | translate }}</th>
            <th class="v">{{ 'grades.final_col' | translate }}</th>
            <th class="i"></th>
          </tr></thead>
          <tbody>
            @for (a of alumnos; track a.id) {
              <tr>
                <td class="n"><a [routerLink]="['/alumnos',a.id]" class="link">{{ a.apellidos }}, {{ a.nombre }}</a></td>
                <td class="v">
                  @if (editable(a.id!)) {
                    <input type="number" [(ngModel)]="notaMap[a.id!]" min="0" max="10" step="0.1" class="ai" (ngModelChange)="recalcFinal(a.id!)">
                  } @else {
                    <span class="ro">{{ notaMap[a.id!] | number:'1.1-1' }}</span>
                  }
                </td>
                <td class="v">
                  @if (editable(a.id!)) {
                    <input type="number" [(ngModel)]="actitudMap[a.id!]" min="0" max="10" step="0.5" class="ai" (ngModelChange)="recalcFinal(a.id!)">
                  } @else {
                    <span class="ro">{{ actitudMap[a.id!] | number:'1.1-1' }}</span>
                  }
                </td>
                <td class="v"><strong [class.ok]="(finalMap[a.id!]||0)>=5" [class.ko]="(finalMap[a.id!]||0)<5">{{ finalMap[a.id!] | number:'1.1-1' }}</strong></td>
                <td class="i">@if ((finalMap[a.id!]||0)>=5) { <mat-icon class="ok">check_circle</mat-icon> } @else { <mat-icon class="ko">cancel</mat-icon> }</td>
              </tr>
            }
          </tbody>
        </table></mat-card>
      }
      @else {
        <!-- ===================== VISTA MÓDULOS NORMALES ===================== -->
        <mat-card class="table-card"><table class="t">
          <thead><tr><th class="n">{{ 'recovery.detail.student' | translate }}</th><th class="v">{{ 'grades.exams_col' | translate }}</th><th class="v">{{ 'grades.tasks_col' | translate }}</th><th class="v">{{ 'grades.attitude_col' | translate }}</th><th class="v" [matTooltip]="'grades.absences_tip' | translate">{{ 'grades.absences_col' | translate }}</th><th class="v">{{ 'grades.final_col' | translate }}</th><th class="i"></th></tr></thead>
          <tbody>
            @for (a of alumnos; track a.id) {
              <tr [class.pierde-row]="califMap[a.id!]?.pierdeEvaluacion">
                <td class="n"><a [routerLink]="['/alumnos',a.id]" class="link">{{ a.apellidos }}, {{ a.nombre }}</a></td>
                <td class="v">{{ califMap[a.id!]?.notaExamenes | number:'1.1-1' }}</td>
                <td class="v">{{ califMap[a.id!]?.notaTareas | number:'1.1-1' }}</td>
                <td class="v"><input type="number" [(ngModel)]="actitudMap[a.id!]" min="0" max="10" step="0.5" class="ai" (blur)="guardarActitudAlumno(a.id!)"></td>
                <td class="v">
                  @if (califMap[a.id!]?.pierdeEvaluacion) { <span class="ko">{{ califMap[a.id!]?.faltas }} 🚫</span> }
                  @else if (califMap[a.id!]?.pierdePuntoAsistencia) { <span class="warn">{{ califMap[a.id!]?.faltas }} (-1 asist.)</span> }
                  @else { {{ califMap[a.id!]?.faltas || 0 }} }
                </td>
                <td class="v"><strong [class.ok]="(califMap[a.id!]?.notaFinal||0)>=5" [class.ko]="(califMap[a.id!]?.notaFinal||0)<5">{{ califMap[a.id!]?.notaFinal | number:'1.1-1' }}</strong></td>
                <td class="i">@if (califMap[a.id!]?.aprobado) { <mat-icon class="ok">check_circle</mat-icon> } @else { <mat-icon class="ko">cancel</mat-icon> }</td>
              </tr>
            }
          </tbody>
        </table></mat-card>
      }
    }
    @if (alumnos.length===0 && grupoId && moduloId) { <mat-card class="empty"><mat-icon>grade</mat-icon><p>{{ 'grades.press_calc' | translate }}</p></mat-card> }
  `,
  styles: [`
    .page-header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;flex-wrap:wrap;gap:12px} .page-header h2{margin:0} .sub{color:#666;margin:4px 0 0}
    .actions{display:flex;gap:8px;flex-wrap:wrap} .filters{margin-bottom:16px;padding:16px;border-radius:12px} .filters-row{display:flex;gap:12px;flex-wrap:wrap}
    .stats-bar{display:flex;gap:24px;margin-bottom:12px;padding:12px 16px;background:#f5f5f5;border-radius:12px;flex-wrap:wrap;font-size:14px} .aprobados strong{color:#2e7d32} .suspensos strong{color:#c62828}
    .info-card{display:flex;align-items:center;gap:12px;padding:12px 16px;border-radius:12px;margin-bottom:12px;background:#e3f2fd} .info-card mat-icon{color:#1565c0} .info-card p{margin:0;font-size:14px;color:#0d47a1}
    .table-card{border-radius:12px;overflow:hidden;padding:0} .t{width:100%;border-collapse:collapse}
    .t th{text-align:left;padding:12px 8px;font-size:12px;font-weight:600;text-transform:uppercase;color:#666;border-bottom:2px solid #e0e0e0;background:#fafafa}
    .t td{padding:10px 8px;border-bottom:1px solid #f0f0f0} .t tbody tr:hover{background:#f9f9f9}
    .n{min-width:200px} .v{width:96px;text-align:center!important} .i{width:40px}
    .v .warn, .v .ko{white-space:nowrap}
    .link{color:#1565c0;text-decoration:none;font-weight:500}
    .ai{width:60px;padding:6px 8px;border:2px solid #e0e0e0;border-radius:8px;font-size:14px;font-weight:600;text-align:center;outline:none} .ai:focus{border-color:#7b1fa2}
    .ro{font-weight:600;color:#555}
    .ok{color:#2e7d32} .ko{color:#c62828} .warn{color:#e65100;font-weight:600}
    .pierde-row{background:#ffebee!important} .pierde-row td{color:#999} .pierde-row .ko{color:#c62828}
    .empty{text-align:center;padding:48px;color:#999;border-radius:12px} .empty mat-icon{font-size:48px;width:48px;height:48px}
  `]
})
export class CalificacionesPanelComponent implements OnInit {
  private califService = inject(CalificacionesService);
  private alumnosService = inject(AlumnosService);
  private gruposService = inject(GruposService);
  private modulosService = inject(ModulosService);
  private tareasService = inject(TareasService);
  private examenesService = inject(ExamenesService);
  private asistenciaService = inject(AsistenciaService);
  private auth = inject(AuthService);
  private exportService = inject(ExportService);
  private snackBar = inject(MatSnackBar);
  private firestore = inject(Firestore);
  private am = inject(ActiveModuleService);
  private recService = inject(RecuperacionesService);
  private t = inject(TranslateService);

  get moduloId() { return this.am.moduloId; }
  get grupoId() { return this.am.grupoId; }

  get esProyecto(): boolean {
    const m = this.am.current;
    return !!(m && ((m as any).esProyecto === true || (m.abreviatura || '').toUpperCase() === 'PROY'));
  }
  get esSegundaFinal(): boolean { return this.evaluacion === TipoEvaluacion.SEGUNDA_FINAL; }

  get evaluacionesDisponibles(): TipoEvaluacion[] {
    if (this.esProyecto) return [TipoEvaluacion.PRIMERA_FINAL, TipoEvaluacion.SEGUNDA_FINAL];
    return Object.values(TipoEvaluacion);
  }

  grupos: Grupo[] = []; modulos: ModuloProfesional[] = []; alumnos: Alumno[] = []; calificaciones: Calificacion[] = [];
  evaluacion: TipoEvaluacion = TipoEvaluacion.PRIMERA;
  califMap: { [id: string]: any } = {};
  actitudMap: { [id: string]: number } = {};
  // Vista Proyecto: notaMap = nota base (tareas), finalMap = 90% nota + 10% actitud
  notaMap: { [id: string]: number } = {};
  finalMap: { [id: string]: number } = {};
  // Alumnos suspensos en la 1ª Eval Final (para bloquear edición en 2ª Final)
  suspensos1F: Set<string> = new Set();
  guardando = false;

  // ---- Estadísticas: SIEMPRE sobre los alumnos del grupo (1 calificación por alumno) ----
  get aprobados(): number {
    if (this.esProyecto) return this.alumnos.filter(a => (this.finalMap[a.id!] || 0) >= 5).length;
    return this.alumnos.filter(a => this.califMap[a.id!]?.aprobado === true).length;
  }
  get suspensos(): number {
    if (this.esProyecto) return this.alumnos.filter(a => (this.finalMap[a.id!] || 0) < 5).length;
    // Solo cuentan como suspensos los que tienen calificación calculada y no aprueban
    return this.alumnos.filter(a => this.califMap[a.id!] && this.califMap[a.id!].aprobado !== true).length;
  }
  get pctAprobados(): number { return this.alumnos.length ? Math.round((this.aprobados / this.alumnos.length) * 100) : 0; }
  get notaMedia(): number {
    if (this.esProyecto) {
      const n = this.alumnos.map(a => this.finalMap[a.id!] || 0);
      return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0;
    }
    const n = this.alumnos
      .map(a => this.califMap[a.id!]?.notaFinal)
      .filter((v): v is number => v != null);
    return n.length ? n.reduce((a, b) => a + b, 0) / n.length : 0;
  }

  async ngOnInit() {
    if (!this.evaluacionesDisponibles.includes(this.evaluacion)) this.evaluacion = this.evaluacionesDisponibles[0];
    if (this.moduloId && this.grupoId) await this.loadCalificaciones();
  }

  // ¿Es editable la fila de este alumno?
  //  - Módulo Proyecto en 2ª Eval Final → solo lectura (las notas vienen de Recuperaciones)
  //  - Proyecto en 1ª Eval Final → todos editables
  editable(alumnoId: string): boolean {
    if (!this.esProyecto) return true;
    if (this.esSegundaFinal) return false;
    return true;
  }

  recalcFinal(alumnoId: string) {
    const nota = Number(this.notaMap[alumnoId] ?? 0);
    const actitud = Number(this.actitudMap[alumnoId] ?? 0);
    this.finalMap[alumnoId] = Math.round((nota * 0.9 + actitud * 0.1) * 10) / 10;
  }

  async loadCalificaciones() {
    if (!this.moduloId || !this.grupoId || !this.evaluacion) return;
    this.alumnos = await this.alumnosService.getByGrupo(this.grupoId);
    this.alumnos.sort((a, b) => a.apellidos.localeCompare(b.apellidos) || a.nombre.localeCompare(b.nombre));

    let todas: any[] = [];
    try { todas = (await this.califService.queryByField('moduloId', this.moduloId)).filter((c: any) => c.grupoId === this.grupoId); } catch { todas = []; }
    // Quedarse con UNA sola calificación por alumno para esta evaluación (evita duplicados que inflaban las estadísticas)
    const porAlumno = new Map<string, any>();
    for (const c of todas.filter((c: any) => c.evaluacion === this.evaluacion)) {
      const prev = porAlumno.get(c.alumnoId);
      // Si hubiera duplicados, conservar el más reciente
      if (!prev || (c.updatedAt?.seconds || 0) >= (prev.updatedAt?.seconds || 0)) {
        porAlumno.set(c.alumnoId, c);
      }
    }
    this.calificaciones = Array.from(porAlumno.values());

    this.califMap = {}; this.actitudMap = {}; this.notaMap = {}; this.finalMap = {}; this.suspensos1F = new Set();
    for (const c of this.calificaciones) {
      this.califMap[c.alumnoId] = c;
      this.actitudMap[c.alumnoId] = (c as any).notaActitud ?? null;
      this.notaMap[c.alumnoId] = (c as any).notaTareas ?? 0;
      this.finalMap[c.alumnoId] = (c as any).notaFinal ?? 0;
    }
    for (const a of this.alumnos) {
      if (this.actitudMap[a.id!] === undefined) this.actitudMap[a.id!] = null as any;
      if (this.notaMap[a.id!] === undefined) this.notaMap[a.id!] = 0;
      if (this.finalMap[a.id!] === undefined) this.finalMap[a.id!] = 0;
    }

    // Para Proyecto en 2ª Eval Final, marcar quién suspendió la 1ª Eval Final
    // y traer su nota de recuperación para reflejarla como nota final.
    if (this.esProyecto && this.esSegundaFinal) {
      const cals1F = todas.filter((c: any) => c.evaluacion === TipoEvaluacion.PRIMERA_FINAL);
      for (const c of cals1F) { if ((c.notaFinal ?? 0) < 5) this.suspensos1F.add(c.alumnoId); }

      // Leer la recuperación de PROY/DAW2 en la 2ª Eval Final y aplicar notaRecuperacion
      try {
        const recs = await firstValueFrom(this.recService.getByModuloYGrupo$(this.moduloId, this.grupoId));
        const recs2F = (recs || []).filter((r: any) => r.evaluacion === TipoEvaluacion.SEGUNDA_FINAL);
        for (const rec of recs2F) {
          const notaMax = (rec as any).notaMaximaRecuperacion ?? 6;
          for (const conv of ((rec as any).alumnosConvocados || [])) {
            if (conv.notaRecuperacion == null) continue;
            const notaRec = Math.min(Number(conv.notaRecuperacion), notaMax);
            // La nota de recuperación manda sobre la nota final del suspenso
            this.notaMap[conv.alumnoId] = notaRec;
            this.finalMap[conv.alumnoId] = Math.round(notaRec * 10) / 10;
          }
        }
      } catch { /* sin recuperaciones, se queda la nota de 1ª Final */ }
    }
  }

  // Guardar todos los cambios de la vista Proyecto (nota + actitud + final)
  async guardarCambios() {
    if (!this.moduloId || !this.grupoId || !this.evaluacion) return;
    this.guardando = true;
    this.snackBar.open(this.t.instant('grades.saving'), '', { duration: 1000 });
    try {
      for (const a of this.alumnos) {
        // En 2ª Final solo se guardan los editables (suspensos 1ª Final); el resto arrastra su nota sin tocar
        if (this.esSegundaFinal && !this.editable(a.id!)) continue;
        this.recalcFinal(a.id!);
        const nota = Number(this.notaMap[a.id!] ?? 0);
        const actitud = Number(this.actitudMap[a.id!] ?? 0);
        const notaFinal = this.finalMap[a.id!] ?? 0;
        await this.califService.guardarCalificacion({
          alumnoId: a.id!, moduloId: this.moduloId, grupoId: this.grupoId, evaluacion: this.evaluacion,
          notaExamenes: 0, notaTareas: nota, notaActitud: actitud,
          faltas: 0, penalizacion: 0, pierdeEvaluacion: false,
          notaFinal, aprobado: notaFinal >= 5
        } as any);
      }
      await this.loadCalificaciones();
      this.snackBar.open(this.t.instant('grades.saved'), 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open(e.message || this.t.instant('grades.save_error'), 'Cerrar', { duration: 5000 });
    } finally { this.guardando = false; }
  }

  async guardarActitudAlumno(id: string) {
    const n = this.actitudMap[id]; if (n == null) return;
    await this.califService.guardarCalificacion({ alumnoId: id, moduloId: this.moduloId, grupoId: this.grupoId, evaluacion: this.evaluacion, notaActitud: n } as any);
  }

  async calcularNotas() {
    if (!this.moduloId || !this.grupoId || !this.evaluacion) return;
    this.snackBar.open(this.t.instant('grades.calculating'), '', { duration: 1000 });

    const tareas = (await this.tareasService.queryByField('moduloId', this.moduloId)).filter((t: any) => t.grupoId === this.grupoId && t.evaluacion === this.evaluacion);
    const examenes = (await this.examenesService.queryByField('moduloId', this.moduloId)).filter((e: any) => e.grupoId === this.grupoId && e.evaluacion === this.evaluacion);

    const faltasMap: { [id: string]: number } = {};
    let totalDias = 0;
    try {
      const snap = await getDocs(query(collection(this.firestore, 'asistencia_mensual'), where('grupoId', '==', this.grupoId), where('moduloId', '==', this.moduloId)));
      snap.forEach(d => {
        const data = d.data(); const faltas = data['faltas'] || {};
        const anio = data['anio']; const mes = data['mes'] - 1;
        const numDias = new Date(anio, mes + 1, 0).getDate();
        for (let dia = 1; dia <= numDias; dia++) { if (new Date(anio, mes, dia).getDay() % 6 !== 0) totalDias++; }
        for (const [alumnoId, dias] of Object.entries(faltas)) {
          if (!faltasMap[alumnoId]) faltasMap[alumnoId] = 0;
          faltasMap[alumnoId] += Object.values(dias as any).filter(v => v === 'I').length;
        }
      });
    } catch {}
    if (totalDias === 0) totalDias = 1;

    // Ponderaciones: Examen 60%, Tareas 20%, Actitud 10%, Asistencia 10%
    const PESO_EXAMEN = 0.6;
    const PESO_TAREAS = 0.2;
    const PESO_ACTITUD = 0.1;
    const PESO_ASISTENCIA = 0.1;

    for (const alumno of this.alumnos) {
      let sE = 0, nE = 0;
      for (const ex of examenes) { const c = (ex.calificaciones || []).find((x: any) => x.alumnoId === alumno.id); if (c?.nota != null) { sE += (c.nota / ex.puntuacionMaxima) * 10; nE++; } }
      const mediaEx = nE > 0 ? Math.round((sE / nE) * 100) / 100 : 0;

      let sT = 0, nT = 0;
      for (const t of tareas) { const e = (t.entregas || []).find((x: any) => x.alumnoId === alumno.id); if (e?.nota != null) { sT += (e.nota / t.puntuacionMaxima) * 10; nT++; } }
      const mediaTar = nT > 0 ? Math.round((sT / nT) * 100) / 100 : 0;

      const actitud = this.actitudMap[alumno.id!] ?? 5;
      const faltas = faltasMap[alumno.id!] || 0;
      const pctFaltas = (faltas / totalDias) * 100;

      // ≥20% de faltas → pierde la evaluación
      const pierdeEval = pctFaltas >= 20;
      // >10% de faltas → pierde el punto de asistencia (nota de asistencia = 0); si no, asistencia = 10
      const pierdePuntoAsistencia = !pierdeEval && pctFaltas > 10;
      const notaAsistencia = pierdePuntoAsistencia ? 0 : 10;

      // Nota ponderada sobre 10: examen 60% + tareas 20% + actitud 10% + asistencia 10%
      const notaPonderada =
        mediaEx * PESO_EXAMEN +
        mediaTar * PESO_TAREAS +
        actitud * PESO_ACTITUD +
        notaAsistencia * PESO_ASISTENCIA;

      const notaFinal = pierdeEval ? 0 : Math.round(notaPonderada * 100) / 100;

      await this.califService.guardarCalificacion({
        alumnoId: alumno.id!, moduloId: this.moduloId, grupoId: this.grupoId, evaluacion: this.evaluacion,
        notaExamenes: mediaEx, notaTareas: mediaTar, notaActitud: actitud,
        notaAsistencia,
        faltas, penalizacion: 0, pierdeEvaluacion: pierdeEval, pierdePuntoAsistencia,
        notaFinal, aprobado: notaFinal >= 5 && !pierdeEval
      } as any);
    }
    await this.loadCalificaciones();
    this.snackBar.open(this.t.instant('grades.calculated'), 'OK', { duration: 3000 });
  }

  exportar() { this.exportService.exportarCalificacionesExcel(this.calificaciones, this.alumnos, this.modulos.find(m => m.id === this.moduloId)?.abreviatura || '', this.evaluacion); }

  generandoActa = false;

  // Genera el ACTA en PDF directamente (mismo documento que Informes > Acta de Evaluación),
  // sin pasar por la pantalla intermedia. Itera SOLO los alumnos del grupo, por lo que
  // las calificaciones huérfanas (alumnoId que ya no existe en el grupo) no aparecen.
  generarActa() {
    if (!this.moduloId || !this.grupoId) return;
    if (this.alumnos.length === 0) {
      this.snackBar.open(this.t.instant('grades.press_calc'), 'OK', { duration: 3000 });
      return;
    }
    this.generandoActa = true;
    try {
      const modulo = this.modulos.find(m => m.id === this.moduloId);
      const grupo = this.grupos.find(g => g.id === this.grupoId);

      // Una fila por alumno del grupo, en orden alfabético (this.alumnos ya viene ordenado)
      const filas = this.alumnos.map(a => {
        const nota = this.esProyecto ? (this.finalMap[a.id!] ?? 0) : (this.califMap[a.id!]?.notaFinal ?? 0);
        const tieneCalif = this.esProyecto
          ? this.finalMap[a.id!] != null
          : this.califMap[a.id!] != null;
        const aprobado = this.esProyecto
          ? (this.finalMap[a.id!] ?? 0) >= 5
          : this.califMap[a.id!]?.aprobado === true;
        return {
          alumnoNombre: `${a.apellidos}, ${a.nombre}`,
          nota: tieneCalif ? Math.round((nota ?? 0) * 100) / 100 : 0,
          aprobado,
          observaciones: this.califMap[a.id!]?.observaciones || ''
        };
      });

      const conNota = filas.filter(f => f.nota != null);
      const aprobados = filas.filter(f => f.aprobado).length;
      const suspensos = filas.length - aprobados;
      const media = conNota.length ? conNota.reduce((s, f) => s + (f.nota || 0), 0) / conNota.length : 0;

      this.exportService.exportarActaPDF({
        centro: 'Cuaderno Digital FP · Euskadi',
        grupo: (grupo as any)?.nombre || this.am.grupoNombre || '—',
        modulo: modulo?.abreviatura || this.am.current?.abreviatura || '—',
        cursoAcademico: (modulo as any)?.cursoAcademico || '2025-2026',
        evaluacion: this.evaluacion,
        profesor: this.nombreProfesor(),
        filas,
        estadisticas: {
          totalAlumnos: filas.length,
          aprobados,
          suspensos,
          noEvaluados: 0,
          notaMedia: Math.round(media * 100) / 100,
          porcentajeAprobados: filas.length ? Math.round((aprobados / filas.length) * 100) : 0
        }
      });
    } catch (e: any) {
      this.snackBar.open('Error generando el acta: ' + (e?.message || e), 'Cerrar', { duration: 5000 });
    }
    this.generandoActa = false;
  }

  private nombreProfesor(): string {
    const u: any = (this.auth as any).currentUser || (this.auth as any).usuario || (this.auth as any).user;
    if (u) {
      if (u.nombre || u.apellidos) return `${u.nombre || ''} ${u.apellidos || ''}`.trim();
      if (u.displayName) return u.displayName;
    }
    return '';
  }
}