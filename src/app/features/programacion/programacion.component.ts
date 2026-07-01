import { Component, inject, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { EventosProgramacionService, PeriodosEvaluacionService, AuthService, ActiveModuleService, TareasService, ExamenesService } from '@core/services';
import { EventoProgramacion, TipoEvento, TipoEvaluacion, PeriodoEvaluacion } from '@core/models';
import { Timestamp } from '@core/firebase-shim';
import { FullCalendarModule } from '@fullcalendar/angular';
import { CalendarOptions, EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';
import esLocale from '@fullcalendar/core/locales/es';
import euLocale from '@fullcalendar/core/locales/eu';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import { ConfirmService } from '../../shared/confirm/confirm.service';
import { EvalLabelPipe } from '../../shared/pipes/eval-label.pipe';

const TIPO_COLOR: { [k: string]: string } = { tema: '#1565c0', actividad: '#2e7d32', examen: '#c62828' };

// Paletas de tonos que se ALTERNAN por unidad didáctica, para que UD1, UD2, UD3...
// se distingan de un vistazo. Cada familia (tema/actividad/examen) mantiene su gama
// (azules / verdes / rojos) pero rota el tono según el índice de la UD.
const PALETA_TEMA = ['#1565c0', '#5e35b1', '#00838f', '#283593', '#0277bd', '#4527a0'];
const PALETA_ACTIVIDAD = ['#2e7d32', '#558b2f', '#00695c', '#33691e', '#1b5e20', '#827717'];
const PALETA_EXAMEN = ['#c62828', '#ad1457', '#d84315', '#b71c1c', '#c2185b', '#bf360c'];

function colorPorIndice(tipo: string, idx: number): string {
  const i = ((idx % 6) + 6) % 6;
  if (tipo === 'tema') return PALETA_TEMA[i];
  if (tipo === 'actividad') return PALETA_ACTIVIDAD[i];
  if (tipo === 'examen') return PALETA_EXAMEN[i];
  return TIPO_COLOR[tipo] || '#666';
}
const TIPO_ICON: { [k: string]: string } = { tema: 'menu_book', actividad: 'task_alt', examen: 'quiz' };

interface TimelineItem {
  origen: 'manual' | 'tarea' | 'examen';
  refId?: string;
  tipo: TipoEvento;
  titulo: string;
  descripcion: string;
  evaluacion: TipoEvaluacion;
  fecha: Date;
  fechaFin: Date | null;
  color: string;
  eventoOriginal?: EventoProgramacion;
}

@Component({
  selector: 'app-programacion',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatTooltipModule, MatSnackBarModule, TranslateModule, FullCalendarModule, EvalLabelPipe],
  template: `
    <div class="page-header">
      <div>
        <h2>{{ 'programming.title' | translate }}</h2>
        <p class="sub">{{ activeModule.moduloNombre || ('programming.select_notebook' | translate) }}@if (activeModule.grupoNombre) { · {{ activeModule.grupoNombre }} }</p>
      </div>
      @if (activeModule.moduloId) {
        <div class="header-actions">
          <div class="view-switch">
            <button class="vbtn" [class.active]="vista === 'lista'" (click)="vista = 'lista'" [matTooltip]="'programming.view_list' | translate">
              <mat-icon>view_list</mat-icon>
            </button>
            <button class="vbtn" [class.active]="vista === 'calendario'" (click)="setVistaCalendario()" [matTooltip]="'programming.view_calendar' | translate">
              <mat-icon>calendar_month</mat-icon>
            </button>
          </div>
          <button mat-raised-button color="primary" (click)="nuevoEvento()"><mat-icon>add</mat-icon> {{ 'programming.new_event' | translate }}</button>
        </div>
      }
    </div>

    @if (!activeModule.moduloId) {
      <mat-card class="no-module"><mat-icon>menu_book</mat-icon><p>{{ 'common.select_notebook' | translate }} <a routerLink="/dashboard">{{ 'common.dashboard' | translate }}</a></p></mat-card>
    } @else {
      <div class="eval-tabs">
        <button class="eval-tab" [class.active]="cursoCompleto" (click)="verCursoCompleto()">
          {{ 'programming.full_course' | translate }}
          <span class="eval-dates">{{ 'programming.all_evaluations' | translate }}</span>
        </button>
        @for (ev of evaluaciones; track ev) {
          <button class="eval-tab" [class.active]="!cursoCompleto && evalActiva === ev" (click)="cambiarEval(ev)">
            {{ ev | evalLabel }}
            @if (periodoDe(ev)) { <span class="eval-dates">{{ fmt(periodoDe(ev)!.fechaInicio) }} – {{ fmt(periodoDe(ev)!.fechaFin) }}</span> }
          </button>
        }
      </div>

      <div class="legend">
        <span class="leg"><i style="background:#1565c0"></i> {{ 'programming.type_topic' | translate }}</span>
        <span class="leg"><i style="background:#2e7d32"></i> {{ 'programming.type_activity' | translate }}</span>
        <span class="leg"><i style="background:#c62828"></i> {{ 'programming.type_exam' | translate }}</span>
      </div>

      <div class="type-filter">
        <button class="tf-btn" [class.active]="tipoActivo === 'todos'" (click)="cambiarTipo('todos')">
          {{ 'programming.filter_all' | translate }} <span class="tf-count">{{ conteos.todos }}</span>
        </button>
        <button class="tf-btn tf-tema" [class.active]="tipoActivo === 'tema'" (click)="cambiarTipo('tema')">
          <mat-icon>menu_book</mat-icon> {{ 'programming.type_topic' | translate }} <span class="tf-count">{{ conteos.tema }}</span>
        </button>
        <button class="tf-btn tf-actividad" [class.active]="tipoActivo === 'actividad'" (click)="cambiarTipo('actividad')">
          <mat-icon>task_alt</mat-icon> {{ 'programming.type_activity' | translate }} <span class="tf-count">{{ conteos.actividad }}</span>
        </button>
        <button class="tf-btn tf-examen" [class.active]="tipoActivo === 'examen'" (click)="cambiarTipo('examen')">
          <mat-icon>quiz</mat-icon> {{ 'programming.type_exam' | translate }} <span class="tf-count">{{ conteos.examen }}</span>
        </button>
      </div>

      @if (vista === 'lista') {
      <mat-card class="timeline-card">
        @if (itemsFiltrados.length === 0) {
          <div class="empty"><mat-icon>event_busy</mat-icon><p>{{ 'programming.empty' | translate:{ eval: evalActiva } }}</p></div>
        } @else {
          <div class="timeline">
            @for (it of itemsFiltrados; track it.origen + it.refId) {
              <div class="tl-row">
                <div class="tl-date">
                  <span class="tl-day">{{ it.fecha.getDate() }}</span>
                  <span class="tl-month">{{ mesCortoD(it.fecha) }}</span>
                </div>
                <div class="tl-line"><span class="tl-dot" [style.background]="it.color"></span></div>
                <div class="tl-content" [style.border-left-color]="it.color">
                  <div class="tl-head">
                    <mat-icon [style.color]="it.color">{{ icon(it.tipo) }}</mat-icon>
                    <span class="tl-tipo" [style.color]="it.color">{{ label(it.tipo) }}</span>
                    @if (it.origen === 'tarea') { <span class="origen-badge tarea">{{ 'programming.badge_task' | translate }}</span> }
                    @if (it.origen === 'examen') { <span class="origen-badge examen">{{ 'programming.badge_exam' | translate }}</span> }
                    @if (it.fechaFin) { <span class="tl-range">{{ 'programming.until' | translate }} {{ fmtD(it.fechaFin) }}</span> }
                    <span class="tl-spacer"></span>
                    @if (it.origen === 'manual') {
                      <button mat-icon-button (click)="editarEvento(it.eventoOriginal!)" [matTooltip]="'common.edit' | translate"><mat-icon>edit</mat-icon></button>
                      <button mat-icon-button (click)="borrarEvento(it.eventoOriginal!)" [matTooltip]="'common.delete' | translate"><mat-icon>delete</mat-icon></button>
                    } @else if (it.origen === 'tarea') {
                      <button mat-icon-button [routerLink]="['/tareas', it.refId]" [matTooltip]="'programming.view_task' | translate"><mat-icon>open_in_new</mat-icon></button>
                    } @else if (it.origen === 'examen') {
                      <button mat-icon-button [routerLink]="['/examenes', it.refId]" [matTooltip]="'programming.view_exam' | translate"><mat-icon>open_in_new</mat-icon></button>
                    }
                  </div>
                  <h4 class="tl-title">{{ it.titulo }}</h4>
                  @if (it.descripcion) { <p class="tl-desc">{{ it.descripcion }}</p> }
                </div>
              </div>
            }
          </div>
        }
      </mat-card>
      } @else {
        <mat-card class="calendar-card">
          <full-calendar [options]="calendarOptions"></full-calendar>
        </mat-card>
      }
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-header h2 { margin: 0; } .sub { color: #666; margin: 4px 0 0; }
    .no-module { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .no-module mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .eval-tabs { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .eval-tab { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; padding: 10px 16px; border: 2px solid #e0e0e0; border-radius: 12px; background: white; cursor: pointer; font-size: 14px; font-weight: 600; color: #555; transition: all 0.15s; }
    .eval-tab:hover { border-color: #1565c0; }
    .eval-tab.active { border-color: #1565c0; background: #e3f2fd; color: #1565c0; }
    .eval-dates { font-size: 11px; font-weight: 400; color: #888; }
    .legend { display: flex; gap: 16px; margin-bottom: 12px; font-size: 13px; color: #666; }
    .leg { display: flex; align-items: center; gap: 6px; }
    .leg i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
    .type-filter { display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap; }
    .tf-btn { display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border: 2px solid #e0e0e0; border-radius: 20px; background: white; cursor: pointer; font-size: 13px; font-weight: 600; color: #666; transition: all 0.15s; }
    .tf-btn mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .tf-btn:hover { border-color: #bdbdbd; background: #fafafa; }
    .tf-count { font-size: 11px; font-weight: 700; background: #eee; color: #777; border-radius: 10px; padding: 1px 7px; min-width: 18px; text-align: center; }
    .tf-btn.active { color: white; }
    .tf-btn.active .tf-count { background: rgba(255,255,255,0.3); color: white; }
    .tf-btn.active:not(.tf-tema):not(.tf-actividad):not(.tf-examen) { background: #455a64; border-color: #455a64; }
    .tf-tema.active { background: #1565c0; border-color: #1565c0; }
    .tf-actividad.active { background: #2e7d32; border-color: #2e7d32; }
    .tf-examen.active { background: #c62828; border-color: #c62828; }
    .timeline-card { padding: 24px; border-radius: 12px; }
    .empty { text-align: center; padding: 32px; color: #999; }
    .empty mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .timeline { position: relative; }
    .tl-row { display: flex; gap: 16px; align-items: stretch; }
    .tl-date { width: 48px; text-align: center; flex-shrink: 0; padding-top: 4px; }
    .tl-day { display: block; font-size: 22px; font-weight: 800; color: #333; line-height: 1; }
    .tl-month { display: block; font-size: 11px; text-transform: uppercase; color: #999; }
    .tl-line { width: 24px; display: flex; flex-direction: column; align-items: center; flex-shrink: 0; }
    .tl-dot { width: 14px; height: 14px; border-radius: 50%; margin-top: 8px; z-index: 1; border: 3px solid white; box-shadow: 0 0 0 2px currentColor; }
    .tl-line::after { content: ''; flex: 1; width: 2px; background: #e0e0e0; margin-top: -2px; }
    .tl-row:last-child .tl-line::after { display: none; }
    .tl-content { flex: 1; border-left: 4px solid; background: #fafafa; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; }
    .tl-head { display: flex; align-items: center; gap: 8px; }
    .tl-head mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .tl-tipo { font-size: 12px; font-weight: 700; text-transform: uppercase; }
    .origen-badge { font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: 10px; text-transform: uppercase; }
    .origen-badge.tarea { background: #e8f5e9; color: #2e7d32; }
    .origen-badge.examen { background: #ffebee; color: #c62828; }
    .tl-range { font-size: 12px; color: #888; }
    .tl-spacer { flex: 1; }
    .tl-head button { width: 32px; height: 32px; line-height: 32px; }
    .tl-title { margin: 6px 0 0; font-size: 16px; }
    .tl-desc { margin: 4px 0 0; color: #666; font-size: 14px; }
    .header-actions { display: flex; align-items: center; gap: 12px; }
    .view-switch { display: inline-flex; border: 2px solid #e0e0e0; border-radius: 10px; overflow: hidden; }
    .view-switch .vbtn { border: none; background: white; padding: 6px 12px; cursor: pointer; color: #777; display: flex; align-items: center; transition: all 0.15s; }
    .view-switch .vbtn:hover { background: #f5f5f5; }
    .view-switch .vbtn.active { background: #1565c0; color: white; }
    .calendar-card { padding: 16px; border-radius: 12px; }
    /* FullCalendar: ajustes ligeros para encajar con Material */
    .calendar-card ::ng-deep .fc { font-size: 13px; }
    .calendar-card ::ng-deep .fc .fc-button-primary { background: #1565c0; border-color: #1565c0; text-transform: capitalize; }
    .calendar-card ::ng-deep .fc .fc-button-primary:hover { background: #0d47a1; border-color: #0d47a1; }
    .calendar-card ::ng-deep .fc .fc-button-primary:disabled { background: #90caf9; border-color: #90caf9; }
    .calendar-card ::ng-deep .fc .fc-toolbar-title { font-size: 18px; font-weight: 700; text-transform: lowercase; }
    .calendar-card ::ng-deep .fc .fc-toolbar-title::first-letter { text-transform: uppercase; }
    .calendar-card ::ng-deep .fc-daygrid-day.fc-day-today { background: #e3f2fd; }
    .calendar-card ::ng-deep .fc-event { cursor: pointer; border: none; padding: 3px 8px; font-weight: 600; border-radius: 5px; margin: 1px 2px; line-height: 1.3; }
    .calendar-card ::ng-deep .fc-event.evt-fijo { cursor: default; opacity: 0.95; }
    /* Las barras de UD (tema) ocupan el ancho completo y destacan como banda de fondo */
    .calendar-card ::ng-deep .fc-daygrid-block-event .fc-event-title { font-weight: 700; letter-spacing: .2px; }
    .calendar-card ::ng-deep .fc-daygrid-event-harness { margin-top: 2px; }
    .calendar-card ::ng-deep .fc-daygrid-day-events { padding-bottom: 2px; }
    .calendar-card ::ng-deep .fc-daygrid-day { cursor: pointer; }
  `]
})
export class ProgramacionComponent implements OnInit {
  private eventosService = inject(EventosProgramacionService);
  private periodosService = inject(PeriodosEvaluacionService);
  private auth = inject(AuthService);
  activeModule = inject(ActiveModuleService);
  private tareasService = inject(TareasService);
  private examenesService = inject(ExamenesService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);
  private confirm = inject(ConfirmService);
  private router = inject(Router);

  evaluaciones = Object.values(TipoEvaluacion);
  evalActiva: TipoEvaluacion = TipoEvaluacion.PRIMERA;
  cursoCompleto = false;   // si true, muestra todos los eventos del curso sin filtrar por evaluación
  tipoActivo: 'todos' | 'tema' | 'actividad' | 'examen' = 'todos';  // filtro por tipo de evento
  eventos: EventoProgramacion[] = [];
  periodos: PeriodoEvaluacion[] = [];
  items: TimelineItem[] = [];

  // Conteo de elementos por tipo (respeta el filtro de evaluación activo, no el de tipo)
  get conteos(): { todos: number; tema: number; actividad: number; examen: number } {
    const base = this.items.filter(i => this.cursoCompleto || i.evaluacion === this.evalActiva);
    return {
      todos: base.length,
      tema: base.filter(i => i.tipo === 'tema').length,
      actividad: base.filter(i => i.tipo === 'actividad').length,
      examen: base.filter(i => i.tipo === 'examen').length
    };
  }

  cambiarTipo(tipo: 'todos' | 'tema' | 'actividad' | 'examen') {
    this.tipoActivo = tipo;
    this.refrescarCalendario();
  }

  vista: 'lista' | 'calendario' = 'lista';

  calendarOptions: CalendarOptions = {
    plugins: [dayGridPlugin, interactionPlugin],
    initialView: 'dayGridMonth',
    locales: [esLocale, euLocale],
    locale: this.t.currentLang === 'eu' ? 'eu' : 'es',
    firstDay: 1,
    height: 'auto',
    headerToolbar: { left: 'prev,next today', center: 'title', right: '' },
    selectable: true,
    editable: true,
    eventStartEditable: true,
    eventDurationEditable: false,
    dayMaxEvents: 4,
    eventOrder: 'order,start,title',
    events: [],
    select: (arg: DateSelectArg) => this.onDayClick(arg),
    eventClick: (arg: EventClickArg) => this.onEventClick(arg),
    eventDrop: (arg: EventDropArg) => this.onEventDrop(arg)
  };

  get itemsFiltrados(): TimelineItem[] {
    const ordenTipo = (t: string) => t === 'tema' ? 1 : t === 'actividad' ? 2 : 3;
    return this.items
      .filter(i => this.cursoCompleto || i.evaluacion === this.evalActiva)
      .filter(i => this.tipoActivo === 'todos' || i.tipo === this.tipoActivo)
      .sort((a, b) => {
        const d = a.fecha.getTime() - b.fecha.getTime();
        if (d !== 0) return d;
        return ordenTipo(a.tipo) - ordenTipo(b.tipo);   // misma fecha: UD → actividad → examen
      });
  }

  // Etiqueta de tipo traducida
  private TIPO_LABEL_KEY: { [k: string]: string } = {
    tema: 'programming.type_topic', actividad: 'programming.type_activity', examen: 'programming.type_exam'
  };

  async ngOnInit() {
    await this.activeModule.restore();
    const user = this.auth.currentUser;
    if (user) {
      try { this.periodosService.getByCentro$(user.centroId, this.activeModule.cursoActual).subscribe(p => this.periodos = p); } catch {}
    }
    await this.loadEventos();
  }

  async loadEventos() {
    if (!this.activeModule.moduloId || !this.activeModule.grupoId) return;
    const modId = this.activeModule.moduloId;
    const grpId = this.activeModule.grupoId;

    try { this.eventos = await this.eventosService.getByModuloGrupo(modId, grpId); } catch { this.eventos = []; }

    const items: TimelineItem[] = [];

    for (const e of this.eventos) {
      const f = e.fechaInicio?.toDate ? e.fechaInicio.toDate() : new Date((e.fechaInicio as any)?.seconds * 1000);
      items.push({
        origen: 'manual', refId: e.id, tipo: e.tipo, titulo: e.titulo, descripcion: e.descripcion || '',
        evaluacion: e.evaluacion, fecha: f, fechaFin: e.fechaFin?.toDate ? e.fechaFin.toDate() : null,
        color: e.color || TIPO_COLOR[e.tipo], eventoOriginal: e
      });
    }

    try {
      let tareas = await this.tareasService.queryByField('moduloId', modId);
      tareas = tareas.filter((t: any) => t.grupoId === grpId && !t.archivada);
      for (const t of tareas) {
        const f = (t.fechaEntrega as any)?.toDate ? (t.fechaEntrega as any).toDate() : new Date((t.fechaEntrega as any)?.seconds * 1000);
        if (!f || isNaN(f.getTime())) continue;
        items.push({
          origen: 'tarea', refId: t.id, tipo: TipoEvento.ACTIVIDAD,
          titulo: t.titulo, descripcion: `${this.t.instant('tasks.delivery')} · ${t.puntuacionMaxima} pts`,
          evaluacion: t.evaluacion, fecha: f, fechaFin: null, color: TIPO_COLOR['actividad']
        });
      }
    } catch {}

    try {
      let examenes = await this.examenesService.queryByField('moduloId', modId);
      examenes = examenes.filter((e: any) => e.grupoId === grpId);
      for (const ex of examenes) {
        const f = (ex.fecha as any)?.toDate ? (ex.fecha as any).toDate() : new Date((ex.fecha as any)?.seconds * 1000);
        if (!f || isNaN(f.getTime())) continue;
        items.push({
          origen: 'examen', refId: ex.id, tipo: TipoEvento.EXAMEN,
          titulo: ex.titulo, descripcion: `${ex.tipo} · ${ex.puntuacionMaxima} pts${ex.aula ? ' · ' + ex.aula : ''}`,
          evaluacion: ex.evaluacion, fecha: f, fechaFin: null, color: TIPO_COLOR['examen']
        });
      }
    } catch {}

    this.items = items;
    this.refrescarCalendario();
  }

  // Construye los eventos de FullCalendar para la evaluación activa.
  private refrescarCalendario() {
    const delaEval = this.items
      .filter(i => this.cursoCompleto || i.evaluacion === this.evalActiva)
      .filter(i => this.tipoActivo === 'todos' || i.tipo === this.tipoActivo);

    // 1) Ordenar los TEMAS (UD) por fecha y darles un índice incremental.
    //    Mapa unidadId(refId del tema) -> índice, y lista ordenada para resolver por fecha.
    const temas = delaEval
      .filter(i => i.tipo === 'tema')
      .sort((a, b) => a.fecha.getTime() - b.fecha.getTime());
    const idxPorUnidad = new Map<string, number>();
    temas.forEach((t, idx) => { if (t.refId) idxPorUnidad.set(t.refId, idx); });

    // Devuelve el índice de UD vigente en una fecha (la última UD que empezó en o antes de esa fecha)
    const indicePorFecha = (f: Date): number => {
      let idx = 0;
      for (let k = 0; k < temas.length; k++) {
        if (temas[k].fecha.getTime() <= f.getTime()) idx = k; else break;
      }
      return idx;
    };

    // 2) Índice de UD para CUALQUIER evento: por su unidadId si lo tiene; si no, por fecha.
    const indiceDe = (i: any): number => {
      if (i.tipo === 'tema' && i.refId && idxPorUnidad.has(i.refId)) return idxPorUnidad.get(i.refId)!;
      const uid = i.eventoOriginal?.unidadId;
      if (uid && idxPorUnidad.has(uid)) return idxPorUnidad.get(uid)!;
      return indicePorFecha(i.fecha);
    };

    // 2b) Fin CONTINUO de cada UD: para que la temporalización no tenga huecos,
    //     cada UD se extiende hasta el inicio de la siguiente (end exclusivo en FullCalendar).
    //     La última UD llega hasta el fin del periodo de la evaluación (si se conoce),
    //     o hasta su propio fechaFin.
    const evalParaCierre = this.cursoCompleto
      ? (temas[temas.length - 1]?.evaluacion ?? this.evalActiva)   // curso completo: eval. del último tema
      : this.evalActiva;
    const periodo = this.periodos.find(p => (p as any).tipo === evalParaCierre || (p as any).evaluacion === evalParaCierre);
    const finEval = periodo?.fechaFin?.toDate ? periodo.fechaFin.toDate()
      : (periodo?.fechaFin ? new Date((periodo.fechaFin as any).seconds * 1000) : null);
    const finContinuo = new Map<string, Date>();
    temas.forEach((t, idx) => {
      if (!t.refId) return;
      const siguiente = temas[idx + 1];
      let fin: Date;
      if (siguiente) {
        fin = new Date(siguiente.fecha);            // hasta el día en que empieza la siguiente UD
      } else if (finEval) {
        fin = new Date(finEval); fin.setDate(fin.getDate() + 1); // incluir el último día
      } else {
        fin = t.fechaFin ? new Date(t.fechaFin) : new Date(t.fecha);
        fin.setDate(fin.getDate() + 1);
      }
      finContinuo.set(t.refId, fin);
    });

    const eventos = delaEval.map(i => {
        const esManual = i.origen === 'manual';
        const idxUD = indiceDe(i);
        const color = colorPorIndice(i.tipo, idxUD);
        // Las UD (tema) usan el fin continuo para que no queden días vacíos entre unidades
        const endTema = (i.tipo === 'tema' && i.refId && finContinuo.has(i.refId))
          ? finContinuo.get(i.refId) : (i.fechaFin ?? undefined);
        // Orden dentro del día: la UD (tema) arriba, luego actividades, luego exámenes
        const ordenTipo = i.tipo === 'tema' ? 1 : i.tipo === 'actividad' ? 2 : 3;
        return {
          id: `${i.origen}:${i.refId}`,
          title: i.titulo,
          start: i.fecha,
          end: i.tipo === 'tema' ? endTema : (i.fechaFin ?? undefined),
          allDay: true,
          order: ordenTipo,
          backgroundColor: color,
          borderColor: color,
          display: i.tipo === 'tema' ? 'block' : 'auto',  // las UD como banda completa
          editable: esManual,            // solo los manuales se pueden arrastrar
          classNames: esManual ? [] : ['evt-fijo'],
          extendedProps: { origen: i.origen, refId: i.refId, evento: i.eventoOriginal }
        };
      });
    this.calendarOptions = { ...this.calendarOptions, events: eventos };
  }

  setVistaCalendario() {
    this.vista = 'calendario';
    this.refrescarCalendario();
  }

  // Clic en un día vacío del calendario → crear evento con esa fecha
  private onDayClick(arg: DateSelectArg) {
    this.openDialog({
      tipo: TipoEvento.TEMA, titulo: '', descripcion: '',
      evaluacion: this.evalActiva, fechaInicio: arg.start, fechaFin: null
    });
  }

  // Clic en un evento → editar (manual) o navegar (tarea/examen)
  private onEventClick(arg: EventClickArg) {
    const props = arg.event.extendedProps as any;
    if (props['origen'] === 'manual' && props['evento']) {
      this.editarEvento(props['evento']);
    } else if (props['origen'] === 'tarea') {
      this.router.navigate(['/tareas', props['refId']]);
    } else if (props['origen'] === 'examen') {
      this.router.navigate(['/examenes', props['refId']]);
    }
  }

  // Arrastrar un evento manual a otra fecha → actualizar fechaInicio en Firestore
  private async onEventDrop(arg: EventDropArg) {
    const props = arg.event.extendedProps as any;
    const evento: EventoProgramacion | undefined = props['evento'];
    if (props['origen'] !== 'manual' || !evento?.id || !arg.event.start) {
      arg.revert();
      return;
    }
    try {
      await this.eventosService.update(evento.id, { fechaInicio: Timestamp.fromDate(arg.event.start) } as any);
      this.snackBar.open(this.t.instant('programming.date_updated'), 'OK', { duration: 2500 });
      await this.loadEventos();
    } catch (e: any) {
      arg.revert();
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
  }

  periodoDe(ev: TipoEvaluacion): PeriodoEvaluacion | null { return this.periodos.find(p => p.tipo === ev) || null; }

  cambiarEval(ev: TipoEvaluacion) {
    this.cursoCompleto = false;
    this.evalActiva = ev;
    this.refrescarCalendario();
  }
  verCursoCompleto() {
    this.cursoCompleto = true;
    this.refrescarCalendario();
  }
  color(t: string) { return TIPO_COLOR[t] || '#666'; }
  icon(t: string) { return TIPO_ICON[t] || 'event'; }
  label(t: string) { return this.t.instant(this.TIPO_LABEL_KEY[t] || t); }
  fmt(ts: any) { if (!ts) return ''; const d = ts.toDate ? ts.toDate() : new Date(ts.seconds * 1000); return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); }
  fmtD(d: Date) { return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' }); }
  mesCortoD(d: Date) { return d.toLocaleDateString('es-ES', { month: 'short' }); }

  nuevoEvento() {
    this.openDialog({ tipo: TipoEvento.TEMA, titulo: '', descripcion: '', evaluacion: this.evalActiva, fechaInicio: new Date(), fechaFin: null });
  }
  editarEvento(ev: EventoProgramacion) {
    this.openDialog({
      id: ev.id, tipo: ev.tipo, titulo: ev.titulo, descripcion: ev.descripcion || '', evaluacion: ev.evaluacion,
      fechaInicio: ev.fechaInicio?.toDate ? ev.fechaInicio.toDate() : new Date(),
      fechaFin: ev.fechaFin?.toDate ? ev.fechaFin.toDate() : null
    });
  }

  private openDialog(data: any) {
    const ref = this.dialog.open(EventoDialogComponent, { width: '480px', data: { ...data, evaluaciones: this.evaluaciones } });
    ref.afterClosed().subscribe(async (result) => {
      if (!result) return;
      const user = this.auth.currentUser; if (!user) return;
      const payload: any = {
        moduloId: this.activeModule.moduloId, grupoId: this.activeModule.grupoId, cursoAcademico: this.activeModule.cursoActual,
        evaluacion: result.evaluacion, tipo: result.tipo, titulo: result.titulo, descripcion: result.descripcion || '',
        color: TIPO_COLOR[result.tipo], fechaInicio: Timestamp.fromDate(new Date(result.fechaInicio))
      };
      if (result.fechaFin) payload.fechaFin = Timestamp.fromDate(new Date(result.fechaFin));
      try {
        if (result.id) { await this.eventosService.update(result.id, payload); this.snackBar.open(this.t.instant('programming.updated'), 'OK', { duration: 3000 }); }
        else { await this.eventosService.create(payload); this.snackBar.open(this.t.instant('programming.created'), 'OK', { duration: 3000 }); }
        await this.loadEventos();
      } catch (e: any) { this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 }); }
    });
  }

  async borrarEvento(ev: EventoProgramacion) {
    if (!ev.id) return;
    const ok = await this.confirm.ask({
      title: this.t.instant('common.delete'),
      message: this.t.instant('programming.confirm_delete', { titulo: ev.titulo }),
      confirmText: this.t.instant('common.delete'),
      variant: 'danger'
    });
    if (!ok) return;
    await this.eventosService.delete(ev.id);
    await this.loadEventos();
    this.snackBar.open(this.t.instant('programming.deleted'), 'OK', { duration: 2000 });
  }
}

@Component({
  selector: 'app-evento-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatDatepickerModule, MatNativeDateModule, TranslateModule],
  template: `
    <h2 mat-dialog-title>{{ (data.id ? 'programming.dialog.title_edit' : 'programming.dialog.title_new') | translate }}</h2>
    <mat-dialog-content>
      <div class="form">
        <mat-form-field appearance="outline"><mat-label>{{ 'programming.dialog.type' | translate }}</mat-label>
          <mat-select [(ngModel)]="data.tipo">
            <mat-option value="tema">📘 {{ 'programming.type_topic' | translate }}</mat-option>
            <mat-option value="actividad">✅ {{ 'programming.type_activity' | translate }}</mat-option>
            <mat-option value="examen">📝 {{ 'programming.type_exam' | translate }}</mat-option>
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>{{ 'common.evaluation' | translate }}</mat-label>
          <mat-select [(ngModel)]="data.evaluacion">
            @for (e of data.evaluaciones; track e) { <mat-option [value]="e">{{ e }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>{{ 'programming.dialog.title' | translate }}</mat-label>
          <input matInput [(ngModel)]="data.titulo" [placeholder]="'programming.dialog.title_ph' | translate">
        </mat-form-field>
        <mat-form-field appearance="outline"><mat-label>{{ 'programming.dialog.description' | translate }}</mat-label>
          <textarea matInput [(ngModel)]="data.descripcion" rows="2"></textarea>
        </mat-form-field>
        <div class="dates">
          <mat-form-field appearance="outline"><mat-label>{{ 'programming.dialog.start_date' | translate }}</mat-label>
            <input matInput [matDatepicker]="p1" [(ngModel)]="data.fechaInicio">
            <mat-datepicker-toggle matIconSuffix [for]="p1"></mat-datepicker-toggle>
            <mat-datepicker #p1></mat-datepicker>
          </mat-form-field>
          <mat-form-field appearance="outline"><mat-label>{{ 'programming.dialog.end_date' | translate }}</mat-label>
            <input matInput [matDatepicker]="p2" [(ngModel)]="data.fechaFin">
            <mat-datepicker-toggle matIconSuffix [for]="p2"></mat-datepicker-toggle>
            <mat-datepicker #p2></mat-datepicker>
          </mat-form-field>
        </div>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="cerrar()">{{ 'common.cancel' | translate }}</button>
      <button mat-raised-button color="primary" [disabled]="!data.titulo" (click)="guardar()">{{ 'common.save' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form { display: flex; flex-direction: column; gap: 4px; padding-top: 8px; min-width: 400px; }
    .form mat-form-field { width: 100%; }
    .dates { display: flex; gap: 12px; }
    .dates mat-form-field { flex: 1; }
  `]
})
export class EventoDialogComponent {
  constructor(public ref: MatDialogRef<EventoDialogComponent>, @Inject(MAT_DIALOG_DATA) public data: any) {}
  cerrar() { this.ref.close(); }
  guardar() { this.ref.close(this.data); }
}