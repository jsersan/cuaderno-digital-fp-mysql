import { Component, inject, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import { DragDropModule, CdkDragDrop, moveItemInArray } from '@angular/cdk/drag-drop';
import { firstValueFrom } from 'rxjs';
import { Timestamp } from '@core/firebase-shim';
import {
  AuthService, ModulosService, GruposService, CiclosService, ActiveModuleService,
  TareasService, ExamenesService, EventosProgramacionService
} from '@core/services';
import { ModuloProfesional, Grupo, CicloFormativo } from '@core/models';
import { ConfirmService } from '../../shared/confirm/confirm.service';

const COLORS = ['#1565c0','#2e7d32','#c62828','#6a1b9a','#e65100','#00838f','#4527a0','#ad1457'];

// ================================================================
//  DIÁLOGO: CREAR CUADERNO NUEVO
// ================================================================
@Component({
  selector: 'app-nuevo-cuaderno-dialog',
  standalone: true,
  imports: [
    CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule,
    MatFormFieldModule, MatInputModule, MatSelectModule, TranslateModule
  ],
  template: `
    <h2 mat-dialog-title>{{ 'dashboard.new_notebook' | translate }}</h2>
    <mat-dialog-content>
      <div class="form">
        @if (d.modulosClonables?.length) {
          <mat-form-field appearance="outline" class="clonar">
            <mat-label>{{ 'dashboard.nn_clone_from' | translate }}</mat-label>
            <mat-select [(ngModel)]="d.clonarModuloId" (ngModelChange)="onClonar($event)">
              <mat-option [value]="''">{{ 'dashboard.nn_from_scratch' | translate }}</mat-option>
              @for (m of d.modulosClonables; track m.id) {
                <mat-option [value]="m.id">{{ m.abreviatura }} — {{ m.nombre }} ({{ m.cursoOrigen }})</mat-option>
              }
            </mat-select>
            @if (d.clonarModuloId) {
              <mat-hint>{{ 'dashboard.nn_clone_hint' | translate:{ year: d.cursoOrigen } }}</mat-hint>
            }
          </mat-form-field>
        }
        <div class="row">
          <mat-form-field appearance="outline" class="abrev">
            <mat-label>{{ 'dashboard.nn_abbrev' | translate }}</mat-label>
            <input matInput [(ngModel)]="d.abreviatura" placeholder="DWEC" maxlength="8"
                   [disabled]="!!d.clonarModuloId"
                   (ngModelChange)="d.abreviatura = $event.toUpperCase()">
          </mat-form-field>
          <mat-form-field appearance="outline" class="flex">
            <mat-label>{{ 'dashboard.nn_module_name' | translate }}</mat-label>
            <input matInput [(ngModel)]="d.nombre" placeholder="Desarrollo Web Entorno Cliente"
                   [disabled]="!!d.clonarModuloId">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'dashboard.nn_cycle' | translate }}</mat-label>
          <mat-select [(ngModel)]="d.cicloId" [disabled]="!!d.clonarModuloId">
            @for (c of d.ciclos; track c.id) {
              <mat-option [value]="c.id">{{ c.abreviatura }} - {{ c.nombre }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        <div class="row">
          <mat-form-field appearance="outline">
            <mat-label>{{ 'dashboard.nn_course' | translate }}</mat-label>
            <mat-select [(ngModel)]="d.curso" [disabled]="!!d.clonarModuloId">
              <mat-option [value]="1">1º</mat-option>
              <mat-option [value]="2">2º</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>{{ 'dashboard.nn_hours_week' | translate }}</mat-label>
            <input matInput type="number" [(ngModel)]="d.horasSemanales" min="1" max="12"
                   [disabled]="!!d.clonarModuloId">
          </mat-form-field>
        </div>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'dashboard.nn_group_name' | translate }}</mat-label>
          <input matInput [(ngModel)]="d.grupoNombre" placeholder="DAW2">
          <mat-hint>{{ 'dashboard.nn_group_hint' | translate:{ year: d.cursoAcademico } }}</mat-hint>
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button (click)="ref.close()">{{ 'common.cancel' | translate }}</button>
      <button mat-raised-button color="primary" (click)="ref.close(d)"
              [disabled]="!d.abreviatura || !d.nombre || !d.cicloId || !d.grupoNombre">
        <mat-icon>{{ d.clonarModuloId ? 'content_copy' : 'add' }}</mat-icon>
        {{ (d.clonarModuloId ? 'dashboard.nn_clone' : 'dashboard.nn_create') | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .form { display:flex; flex-direction:column; gap:4px; min-width:420px; padding-top:8px; }
    .form mat-form-field { width:100%; }
    .row { display:flex; gap:12px; }
    .row mat-form-field { flex:1; }
    .abrev { max-width:120px; flex:0 0 120px !important; }
    .flex { flex:1 !important; }
  `]
})
export class NuevoCuadernoDialog {
  constructor(
    public ref: MatDialogRef<NuevoCuadernoDialog>,
    @Inject(MAT_DIALOG_DATA) public d: any
  ) {}

  onClonar(id: string) {
    const m = (this.d.modulosClonables || []).find((x: any) => x.id === id);
    if (m) {
      this.d.abreviatura = m.abreviatura;
      this.d.nombre = m.nombre;
      this.d.cicloId = m.cicloId;
      this.d.curso = m.curso;
      this.d.horasSemanales = m.horasSemanales;
      this.d.cursoOrigen = m.cursoOrigen;
      if (!this.d.grupoNombre) this.d.grupoNombre = m.grupoOrigenNombre || '';
    } else {
      this.d.clonarModuloId = '';
      this.d.cursoOrigen = '';
    }
  }
}

// ================================================================
//  COMPONENTE PRINCIPAL: DASHBOARD
// ================================================================
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule, RouterLink, MatCardModule, MatIconModule, MatButtonModule,
    MatChipsModule, MatTooltipModule, MatMenuModule, MatProgressSpinnerModule, MatSnackBarModule,
    MatDialogModule, TranslateModule, DragDropModule
  ],
  template: `
    <div class="welcome">
      <h1>{{ 'dashboard.greeting' | translate }}, {{ auth.currentUser?.nombre }}! 👋</h1>
      <p>{{ 'dashboard.subtitle' | translate }}</p>
    </div>

    <!-- SELECTOR DE CURSO -->
    <div class="curso-selector">
      <span class="curso-label"><mat-icon>calendar_today</mat-icon> Ikasturtea / Curso</span>
      @for (curso of cursosDisponibles; track curso) {
        <button class="curso-pill" [class.active]="curso === cursoSeleccionado" (click)="onCursoChange(curso)">
          {{ curso }}
          @if (contarNotebooks(curso) > 0) { <span class="curso-count">{{ contarNotebooks(curso) }}</span> }
        </button>
      }
    </div>

    <!-- GRID CON DRAG & DROP -->
    <div class="notebooks-grid" cdkDropList [cdkDropListData]="notebooks" (cdkDropListDropped)="onDrop($event)">
      @for (item of notebooks; track item.modulo.id; let i = $index) {
        <div class="notebook" cdkDrag
             [style.--color]="colors[i % colors.length]"
             [class.sin-grupo]="!item.grupo"
             (click)="item.grupo ? selectNotebook(item) : null">

          <!-- Drag preview (mini) -->
          <div class="drag-placeholder" *cdkDragPlaceholder></div>

          <div class="notebook-cover">
            <mat-icon class="nb-icon">menu_book</mat-icon>
            @if (item.modulo.curso) { <div class="nb-badge">{{ item.modulo.curso }}º</div> }
            <!-- Menú contextual (esquina sup. izq.) + drag + delete -->
            <div class="card-toolbar">
              @if (getSourceYear(item.modulo)) {
                <mat-icon class="menu-handle" [matMenuTriggerFor]="cardMenu"
                          (click)="$event.stopPropagation()" matTooltip="{{ 'dashboard.tooltip_options' | translate }}">more_vert</mat-icon>
                <mat-menu #cardMenu="matMenu">
                  <button mat-menu-item (click)="copiarCuaderno(item.modulo, $event)" [disabled]="copiando">
                    <mat-icon>content_copy</mat-icon>
                    <span>{{ (item.grupo ? 'dashboard.reimport_from' : 'dashboard.import_from') | translate }} {{ getSourceYear(item.modulo) }}</span>
                  </button>
                </mat-menu>
              }
              <mat-icon class="drag-handle" cdkDragHandle matTooltip="{{ 'dashboard.tooltip_drag' | translate }}">drag_indicator</mat-icon>
              <mat-icon class="delete-handle" (click)="eliminarCuaderno(item, $event)" matTooltip="{{ 'dashboard.tooltip_delete' | translate }}">close</mat-icon>
            </div>
            @if (copiando && copiandoModuloId === item.modulo.id) {
              <div class="copy-overlay"><mat-spinner diameter="26"></mat-spinner></div>
            }
          </div>

          <div class="nb-body">
            <h3 class="nb-title">{{ item.modulo.abreviatura }}</h3>
            <p class="nb-name">{{ item.modulo.nombre }}</p>
            <div class="nb-meta">
              <span>{{ item.modulo.horasSemanales }}{{ 'dashboard.hours_week' | translate }}</span>
              @if (item.grupo) {
                <mat-chip>{{ item.grupo.nombre }}</mat-chip>
              } @else {
                <span class="nb-sin-grupo">{{ 'dashboard.no_group_this_year' | translate }}</span>
              }
            </div>
            @if ($any(item.modulo).resultadosAprendizaje?.length) {
              <span class="nb-ra">{{ $any(item.modulo).resultadosAprendizaje?.length }} {{ 'dashboard.ras' | translate }}</span>
            }
          </div>
        </div>
      }

      <!-- TARJETA "+" PARA CREAR -->
      <div class="notebook add-notebook" (click)="crearCuaderno()">
        <div class="add-content">
          <mat-icon>add_circle_outline</mat-icon>
          <span>{{ 'dashboard.new_notebook' | translate }}</span>
        </div>
      </div>
    </div>

    @if (notebooks.length === 0 && todosModulos.length === 0) {
      <mat-card class="empty">
        <mat-icon>menu_book</mat-icon>
        <h3>{{ 'dashboard.no_notebooks' | translate }}</h3>
        <p>{{ 'dashboard.no_notebooks_hint' | translate }}</p>
        <button mat-raised-button color="primary" (click)="crearCuaderno()">
          <mat-icon>add</mat-icon> {{ 'dashboard.create_first' | translate }}
        </button>
      </mat-card>
    }
  `,
  styles: [`
    .welcome { margin-bottom: 24px; }
    .welcome h1 { font-size: 28px; margin: 0; }
    .welcome p { color: #666; margin: 8px 0 0; font-size: 16px; }

    .curso-selector { display:flex; align-items:center; gap:8px; margin-bottom:28px; flex-wrap:wrap; }
    .curso-label { display:flex; align-items:center; gap:6px; font-size:14px; font-weight:600; color:#666; margin-right:4px; }
    .curso-label mat-icon { font-size:20px; width:20px; height:20px; color:#999; }
    .curso-pill { display:flex; align-items:center; gap:6px; padding:8px 18px; border:2px solid #e0e0e0; border-radius:24px; background:white; cursor:pointer; font-size:14px; font-weight:600; color:#555; transition:all .2s; }
    .curso-pill:hover { border-color:#1565c0; color:#1565c0; }
    .curso-pill.active { border-color:#1565c0; background:#1565c0; color:white; box-shadow:0 2px 8px rgba(21,101,192,.3); }
    .curso-count { background:rgba(0,0,0,.08); padding:1px 8px; border-radius:12px; font-size:12px; font-weight:700; }
    .curso-pill.active .curso-count { background:rgba(255,255,255,.25); }

    .notebooks-grid { display:flex; flex-wrap:wrap; gap:24px; }

    .notebook { width:calc(33.333% - 16px); min-width:240px; border-radius:16px; overflow:hidden; box-shadow:0 4px 16px rgba(0,0,0,.08); transition:transform .2s, box-shadow .2s; background:white; cursor:pointer; }
    .notebook:hover { transform:translateY(-6px); box-shadow:0 12px 32px rgba(0,0,0,.15); }
    .notebook.sin-grupo { opacity:.65; cursor:default; }
    .notebook.sin-grupo:hover { opacity:.85; transform:translateY(-2px); }

    /* Drag & Drop */
    .notebook.cdk-drag-animating { transition:transform 250ms cubic-bezier(0,0,.2,1); }
    .drag-placeholder { width:100%; min-height:280px; border:2px dashed #1565c0; border-radius:16px; background:rgba(21,101,192,.06); }
    .cdk-drag-preview { box-shadow:0 16px 40px rgba(0,0,0,.25); border-radius:16px; opacity:.9; }

    .notebook-cover { background:var(--color); padding:32px 24px; display:flex; align-items:center; justify-content:center; position:relative; }
    .nb-icon { font-size:64px; width:64px; height:64px; color:rgba(255,255,255,.3); }
    .nb-badge { position:absolute; top:12px; right:12px; background:rgba(255,255,255,.25); color:white; padding:4px 12px; border-radius:12px; font-size:13px; font-weight:600; }

    /* Toolbar: menú + drag handle + delete */
    .card-toolbar { position:absolute; top:8px; left:8px; display:flex; align-items:center; gap:4px; }
    .menu-handle { color:rgba(255,255,255,.9); cursor:pointer; font-size:20px; width:20px; height:20px; }
    .menu-handle:hover { color:#fff; }
    .drag-handle, .delete-handle { color:rgba(255,255,255,.7); cursor:grab; font-size:20px; width:20px; height:20px; opacity:0; transition:opacity .2s; }
    .notebook:hover .drag-handle, .notebook:hover .delete-handle { opacity:1; }
    .drag-handle:active { cursor:grabbing; }
    .delete-handle { cursor:pointer; }
    .delete-handle:hover { color:#fff; }
    .copy-overlay { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,.18); }

    .nb-body { padding:20px; }
    .nb-title { font-size:22px; font-weight:800; margin:0; color:var(--color); letter-spacing:1px; }
    .nb-name { font-size:14px; color:#555; margin:4px 0 12px; line-height:1.4; }
    .nb-meta { display:flex; align-items:center; gap:8px; font-size:13px; color:#888; }
    .nb-sin-grupo { font-size:12px; color:#bbb; font-style:italic; }
    .nb-ra { font-size:12px; color:#999; margin-top:8px; display:block; }

    /* Tarjeta "+ Nuevo" */
    .add-notebook { border:2px dashed #ccc; box-shadow:none; background:transparent; display:flex; align-items:center; justify-content:center; min-height:280px; }
    .add-notebook:hover { border-color:#1565c0; background:rgba(21,101,192,.03); transform:translateY(-2px); }
    .add-content { display:flex; flex-direction:column; align-items:center; gap:8px; color:#999; }
    .add-content mat-icon { font-size:48px; width:48px; height:48px; }
    .add-notebook:hover .add-content { color:#1565c0; }

    .empty { text-align:center; padding:64px; border-radius:16px; color:#999; }
    .empty mat-icon { font-size:64px; width:64px; height:64px; margin-bottom:16px; }
    .empty h3 { color:#555; }

    @media (max-width:900px) { .notebook { width:calc(50% - 12px); } }
    @media (max-width:600px) { .notebook { width:100%; } }
  `]
})
export class DashboardComponent implements OnInit {
  auth = inject(AuthService);
  private modulosService = inject(ModulosService);
  private gruposService = inject(GruposService);
  private ciclosService = inject(CiclosService);
  private activeModule = inject(ActiveModuleService);
  private tareasService = inject(TareasService);
  private examenesService = inject(ExamenesService);
  private eventosService = inject(EventosProgramacionService);
  private confirm = inject(ConfirmService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);
  private t = inject(TranslateService);
  private router = inject(Router);

  todosModulos: ModuloProfesional[] = [];
  todosGrupos: Grupo[] = [];
  ciclos: CicloFormativo[] = [];
  cursosDisponibles: string[] = [];
  cursoSeleccionado = '';
  notebooks: { modulo: ModuloProfesional; grupo: Grupo | null }[] = [];
  colors = COLORS;
  copiando = false;
  copiandoModuloId = '';
  // moduloId → cursos académicos en los que el módulo estuvo REALMENTE presente
  private moduloPresencia = new Map<string, Set<string>>();

  async ngOnInit() {
    const user = this.auth.currentUser;
    if (!user) return;

    this.todosModulos = (await this.modulosService.queryByField('profesorId', user.uid))
      .filter(m => m.profesorId === user.uid);

    try {
      const all = await this.gruposService.queryByField('centroId', user.centroId);
      this.todosGrupos = all.filter(g => g.activo !== false);
    } catch { this.todosGrupos = []; }

    // Detecta en qué cursos estuvo cada módulo (corrige modulosIds desincronizado)
    await this.construirPresenciaModulos(user.uid);

    try {
      this.ciclosService.getByCentro$(user.centroId).subscribe(c => this.ciclos = c);
    } catch {}

    const cursosSet = new Set<string>(this.todosGrupos.map(g => g.cursoAcademico).filter(Boolean));
    const now = new Date();
    const yearBase = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    cursosSet.add(`${yearBase}-${yearBase + 1}`);
    cursosSet.add(`${yearBase + 1}-${yearBase + 2}`);
    this.cursosDisponibles = Array.from(cursosSet).sort();
    this.cursoSeleccionado = this.activeModule.cursoActual;
    if (!cursosSet.has(this.cursoSeleccionado)) this.cursoSeleccionado = `${yearBase}-${yearBase + 1}`;

    this.filtrarNotebooks();
  }

  onCursoChange(curso: string) {
    this.cursoSeleccionado = curso;
    this.activeModule.setCursoAcademico(curso);
    this.activeModule.clear();
    this.filtrarNotebooks();
  }

  contarNotebooks(curso: string): number {
    const gc = this.todosGrupos.filter(g => g.cursoAcademico === curso);
    return this.todosModulos.filter(m =>
      !this.cuadernoArchivado(m, curso)
      && (gc.some(g => g.cicloId === m.cicloId && Number(g.curso) === Number(m.curso))
          || gc.some(g => g.cicloId === m.cicloId))
    ).length;
  }

  /** ¿Está el cuaderno (módulo) archivado para ese curso académico concreto? */
  private cuadernoArchivado(m: ModuloProfesional, curso: string): boolean {
    return ((m as any).cursosArchivados || []).includes(curso);
  }

  private filtrarNotebooks() {
    const gc = this.todosGrupos.filter(g => g.cursoAcademico === this.cursoSeleccionado);
    // Se ocultan los cuadernos archivados SOLO para el curso seleccionado,
    // de modo que el mismo módulo sigue visible en los demás cursos académicos.
    this.notebooks = this.todosModulos
      .filter(m => !this.cuadernoArchivado(m, this.cursoSeleccionado))
      .map(m => ({
        modulo: m,
        // Empareja por ciclo + curso (1º/2º); si no hay grupo de ese curso, cae a solo-ciclo
        grupo: gc.find(g => g.cicloId === m.cicloId && Number(g.curso) === Number(m.curso))
            || gc.find(g => g.cicloId === m.cicloId)
            || null
      }));
    this.aplicarOrden();
  }

  selectNotebook(item: { modulo: ModuloProfesional; grupo: Grupo | null }) {
    this.activeModule.setModule(item.modulo, item.grupo || undefined, this.cursoSeleccionado);
    this.router.navigate(['/tareas']);
  }

  // ================================================================
  //  DRAG & DROP
  // ================================================================
  onDrop(event: CdkDragDrop<any[]>) {
    moveItemInArray(this.notebooks, event.previousIndex, event.currentIndex);
    this.guardarOrden();
  }

  private guardarOrden() {
    const ids = this.notebooks.map(n => n.modulo.id).filter(Boolean);
    localStorage.setItem(`nbOrder_${this.cursoSeleccionado}`, JSON.stringify(ids));
  }

  private aplicarOrden() {
    const raw = localStorage.getItem(`nbOrder_${this.cursoSeleccionado}`);
    if (!raw) return;
    try {
      const orden: string[] = JSON.parse(raw);
      this.notebooks.sort((a, b) => {
        const ia = orden.indexOf(a.modulo.id!);
        const ib = orden.indexOf(b.modulo.id!);
        if (ia === -1 && ib === -1) return 0;
        if (ia === -1) return 1;
        if (ib === -1) return -1;
        return ia - ib;
      });
    } catch {}
  }

  // ================================================================
  //  ELIMINAR CUADERNO
  // ================================================================
  async eliminarCuaderno(item: { modulo: ModuloProfesional; grupo: Grupo | null }, event: Event) {
    event.stopPropagation();
    const mod = item.modulo;
    const curso = this.cursoSeleccionado;

    const ok = await this.confirm.ask({
      title: this.t.instant('dashboard.del_title', { abbr: mod.abreviatura, year: curso }),
      message: item.grupo
        ? this.t.instant('dashboard.del_msg_group', { abbr: mod.abreviatura, name: mod.nombre, year: curso, group: item.grupo.nombre })
        : this.t.instant('dashboard.del_msg_nogroup', { abbr: mod.abreviatura, name: mod.nombre, year: curso }),
      confirmText: this.t.instant('common.delete'),
      variant: 'danger'
    });
    if (!ok || !mod.id) return;

    try {
      // Se marca el curso como archivado SOLO para este módulo (no se toca profesorId,
      // que es global y compartido por todos los cursos). Así el cuaderno desaparece
      // únicamente del curso seleccionado y sigue apareciendo en los demás.
      const cursosArchivados = Array.from(
        new Set([...(((mod as any).cursosArchivados as string[]) || []), curso])
      );
      await this.modulosService.update(mod.id, { cursosArchivados } as any);
      // Reflejar el cambio en memoria para que el filtro lo oculte al instante
      const ref = this.todosModulos.find(m => m.id === mod.id);
      if (ref) (ref as any).cursosArchivados = cursosArchivados;
      this.filtrarNotebooks();
      this.snackBar.open(this.t.instant('dashboard.sb_deleted', { abbr: mod.abreviatura, year: curso }), 'OK', { duration: 4000 });
    } catch (e: any) {
      this.snackBar.open(this.t.instant('dashboard.sb_error', { msg: e.message }), this.t.instant('common.close'), { duration: 5000 });
    }
  }

  // ================================================================
  //  CREAR CUADERNO
  // ================================================================
  crearCuaderno() {
    const user = this.auth.currentUser;
    if (!user) return;

    // Se ofrecen para clonar SOLO los módulos que NO aparecen como tarjeta en el
    // curso actual (es decir, archivados para este curso) y que existen en un curso
    // anterior. Los que ya son tarjeta del curso actual (p. ej. DWEC) se importan/
    // reimportan desde el menú "Importar/Reimportar desde" de su propia tarjeta.
    //
    // Se filtra por cuadernoArchivado (la misma señal que usa la rejilla de tarjetas)
    // en lugar de por el mapa de presencia: ese mapa puede marcar un módulo como
    // "presente" en el curso actual por un modulosIds heredado en otro grupo del
    // mismo ciclo, lo que ocultaba erróneamente cuadernos como APIN.
    const modulosClonables = this.todosModulos
      .filter(m => this.cuadernoArchivado(m, this.cursoSeleccionado))
      .map(m => {
        const cursoOrigen = this.getSourceYear(m);
        if (!cursoOrigen) return null;
        const g = this.grupoFuente(m, cursoOrigen);
        return {
          id: m.id, abreviatura: m.abreviatura, nombre: m.nombre, cicloId: m.cicloId,
          curso: (m as any).curso ?? 2, horasSemanales: m.horasSemanales,
          cursoOrigen, grupoOrigenNombre: g?.nombre || ''
        };
      })
      .filter(Boolean)
      .sort((a: any, b: any) => a.abreviatura.localeCompare(b.abreviatura));

    // Nombre de grupo por defecto: abreviatura del primer ciclo + "1" o "2"
    const ref = this.dialog.open(NuevoCuadernoDialog, {
      width: '520px',
      data: {
        abreviatura: '', nombre: '', cicloId: this.ciclos[0]?.id || '',
        curso: 2, horasSemanales: 6, grupoNombre: '',
        cursoAcademico: this.cursoSeleccionado, ciclos: this.ciclos,
        modulosClonables, clonarModuloId: '', cursoOrigen: ''
      }
    });

    ref.afterClosed().subscribe(async (result) => {
      if (!result) return;
      try {
        // ── Caso CLONAR desde un curso anterior ──────────────────────────
        if (result.clonarModuloId && result.cursoOrigen) {
          const src = this.todosModulos.find(m => m.id === result.clonarModuloId);
          if (!src) throw new Error('Módulo origen no encontrado');
          this.copiando = true; this.copiandoModuloId = src.id || '';
          const stats = await this.ejecutarCopia(src, result.cursoOrigen, this.cursoSeleccionado);
          // Solo se renombra el grupo destino si se ha CREADO uno nuevo. Si se ha
          // reutilizado un grupo ya existente del ciclo (p. ej. 1SM2), no se toca su
          // nombre para no afectar a los otros cuadernos que comparten ese grupo.
          if (result.grupoNombre && stats.grupoId && stats.grupoCreado) {
            try { await this.gruposService.update(stats.grupoId, { nombre: result.grupoNombre } as any); } catch {}
          }
          await this.ngOnInit();
          this.snackBar.open(
            this.t.instant('dashboard.sb_cloned', { abbr: src.abreviatura, year: result.cursoOrigen, tareas: stats.tareas, examenes: stats.examenes }),
            'OK', { duration: 5000 });
          this.copiando = false; this.copiandoModuloId = '';
          return;
        }

        // ── Caso CREAR desde cero ────────────────────────────────────────
        // 1. Crear módulo
        const moduloId = await this.modulosService.create({
          nombre: result.nombre,
          abreviatura: result.abreviatura.toUpperCase(),
          cicloId: result.cicloId,
          curso: result.curso,
          horasSemanales: result.horasSemanales,
          horasTotales: result.horasSemanales * 32,
          profesorId: user.uid,
          resultadosAprendizaje: [],
          ponderacionRA: {},
          criteriosCalificacion: {
            porcentajeExamenes: 60, porcentajeTareas: 20,
            porcentajeActitud: 10, porcentajeAsistencia: 10,
            notaMinimaAprobado: 5, porcentajeMinimoAsistencia: 85,
            requiereAprobadoExamen: false, recuperacionDisponible: true
          },
          activo: true, esFCT: false, esProyecto: false
        } as any);

        // 2. Crear grupo para este curso
        const ciclo = this.ciclos.find(c => c.id === result.cicloId);
        await this.gruposService.create({
          nombre: result.grupoNombre,
          curso: result.curso, letra: 'A',
          cicloId: result.cicloId,
          cicloNombre: ciclo?.nombre || '',
          centroId: user.centroId,
          tutorId: user.uid,
          cursoAcademico: this.cursoSeleccionado,
          alumnosIds: [], modulosIds: [moduloId],
          activo: true
        } as any);

        // 3. Recargar
        await this.ngOnInit();
        this.snackBar.open(this.t.instant('dashboard.sb_created', { abbr: result.abreviatura }), 'OK', { duration: 4000 });
      } catch (e: any) {
        this.copiando = false; this.copiandoModuloId = '';
        this.snackBar.open(this.t.instant('dashboard.sb_error', { msg: e.message }), this.t.instant('common.close'), { duration: 5000 });
      }
    });
  }

  // ================================================================
  //  COPIAR CUADERNO
  // ================================================================

  /**
   * Precalcula, por módulo, los cursos en los que estuvo REALMENTE presente.
   * Señales combinadas:
   *   1) Algún grupo de ese curso lo enlaza en modulosIds.
   *   2) Tiene tareas o exámenes vinculados a un grupo de ese curso.
   * La (2) corrige el modulosIds desincronizado que hacía que getSourceYear no
   * detectara cuadernos como APIN en su curso de origen.
   */
  private async construirPresenciaModulos(uid: string) {
    const presencia = new Map<string, Set<string>>();
    const grupoCurso = new Map<string, string>();
    for (const g of this.todosGrupos) if (g.id) grupoCurso.set(g.id, g.cursoAcademico);

    const add = (moduloId?: string, grupoId?: string) => {
      if (!moduloId || !grupoId) return;
      const curso = grupoCurso.get(grupoId);
      if (!curso) return;
      if (!presencia.has(moduloId)) presencia.set(moduloId, new Set());
      presencia.get(moduloId)!.add(curso);
    };

    // 1) Enlaces declarados en los grupos
    for (const g of this.todosGrupos) {
      for (const mid of (((g as any).modulosIds as string[]) || [])) add(mid, g.id);
    }

    // 2) Contenido real (tareas + exámenes)
    try {
      const tareas = await firstValueFrom(this.tareasService.getByProfesor$(uid));
      for (const t of (tareas || [])) add((t as any).moduloId, (t as any).grupoId);
    } catch {}
    try {
      const examenes = await firstValueFrom(this.examenesService.getByProfesor$(uid));
      for (const e of (examenes || [])) add((e as any).moduloId, (e as any).grupoId);
    } catch {}

    this.moduloPresencia = presencia;
  }

  getSourceYear(modulo: ModuloProfesional): string | null {
    // Años ANTERIORES al seleccionado donde EXISTE este módulo (no solo su ciclo).
    const years = this.cursosDisponibles
      .filter(c => c < this.cursoSeleccionado && this.moduloExisteEn(modulo, c));
    return years.length ? years[years.length - 1] : null; // el más reciente de los anteriores
  }

  /**
   * ¿Estuvo ESTE módulo realmente presente en ese curso académico?
   * Se apoya en el mapa precalculado, así detecta cuadernos antiguos aunque su
   * grupo tenga el modulosIds desincronizado, y no da falsos positivos por ciclo.
   */
  private moduloExisteEn(modulo: ModuloProfesional, curso: string): boolean {
    return !!modulo.id && (this.moduloPresencia.get(modulo.id)?.has(curso) ?? false);
  }

  /**
   * Grupo de ORIGEN de un módulo en un curso académico concreto.
   * Prefiere el enlace real (grupo.modulosIds incluye el módulo); si no, cae al
   * mismo ciclo. Así la copia lee del cuaderno correcto aunque haya grupos
   * duplicados del mismo ciclo o el modulosIds esté desincronizado.
   */
  private grupoFuente(modulo: ModuloProfesional, curso: string): Grupo | undefined {
    const id = modulo.id;
    const candidatos = this.todosGrupos.filter(g => g.cursoAcademico === curso);
    return candidatos.find(g => !!id && Array.isArray((g as any).modulosIds) && (g as any).modulosIds.includes(id))
        || candidatos.find(g => g.cicloId === modulo.cicloId);
  }

  /**
   * Grupo de DESTINO con el que la rejilla emparejará la tarjeta del módulo en ese
   * curso. Usa EXACTAMENTE la misma regla que filtrarNotebooks (mismo ciclo + curso,
   * y si no, mismo ciclo). Es clave que el contenido importado se guarde en este
   * mismo grupo, para que al pulsar la tarjeta se vea lo importado.
   */
  private grupoDestino(modulo: ModuloProfesional, curso: string): Grupo | undefined {
    const gc = this.todosGrupos.filter(g => g.cursoAcademico === curso);
    return gc.find(g => g.cicloId === modulo.cicloId && Number(g.curso) === Number((modulo as any).curso))
        || gc.find(g => g.cicloId === modulo.cicloId)
        || undefined;
  }

  async copiarCuaderno(modulo: ModuloProfesional, event: Event) {
    event.stopPropagation();
    const cursoOrigen = this.getSourceYear(modulo);
    if (!cursoOrigen) return;

    const hayGrupoDestino = !!this.grupoDestino(modulo, this.cursoSeleccionado);
    const ok = await this.confirm.ask({
      title: this.t.instant('dashboard.imp_title', { abbr: modulo.abreviatura }),
      message:
        this.t.instant('dashboard.imp_msg_head', { from: cursoOrigen, to: this.cursoSeleccionado }) + '\n\n' +
        (hayGrupoDestino ? this.t.instant('dashboard.imp_with_group') : this.t.instant('dashboard.imp_without_group')) + '\n' +
        this.t.instant('dashboard.imp_no_copy') + '\n\n' +
        (hayGrupoDestino ? this.t.instant('dashboard.imp_warn_group', { to: this.cursoSeleccionado }) + '\n\n' : '') +
        this.t.instant('dashboard.imp_dates'),
      confirmText: this.t.instant('dashboard.imp_confirm'), variant: 'primary', icon: 'content_copy'
    });
    if (!ok) return;

    this.copiando = true;
    this.copiandoModuloId = modulo.id || '';
    try {
      const stats = await this.ejecutarCopia(modulo, cursoOrigen, this.cursoSeleccionado);
      await this.ngOnInit();
      this.snackBar.open(
        this.t.instant('dashboard.sb_copied', { abbr: modulo.abreviatura, eventos: stats.eventos, tareas: stats.tareas, examenes: stats.examenes }),
        'OK', { duration: 5000 });
    } catch (e: any) {
      this.snackBar.open(this.t.instant('dashboard.sb_error', { msg: (e.message || e) }), this.t.instant('common.close'), { duration: 6000 });
    } finally { this.copiando = false; this.copiandoModuloId = ''; }
  }

  private async ejecutarCopia(modulo: ModuloProfesional, cursoOrigen: string, cursoDestino: string) {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Sin usuario');
    const grupoOrigen = this.grupoFuente(modulo, cursoOrigen);
    if (!grupoOrigen?.id) throw new Error('Grupo origen no encontrado');

    const [y1] = cursoOrigen.split('-').map(Number);
    const [y2] = cursoDestino.split('-').map(Number);
    const diff = y2 - y1;

    // ── Desarchivar el módulo para el curso destino ───────────────────────────
    // Si el módulo estaba archivado para este curso (no aparecía como tarjeta), al
    // importarlo debe volver a mostrarse. Sin esto, la copia se hace pero la tarjeta
    // sigue oculta y "no se ve nada importado".
    const archivadosPrev = (((modulo as any).cursosArchivados as string[]) || []);
    if (archivadosPrev.includes(cursoDestino)) {
      const archivados = archivadosPrev.filter(c => c !== cursoDestino);
      try { await this.modulosService.update(modulo.id!, { cursosArchivados: archivados } as any); } catch {}
      (modulo as any).cursosArchivados = archivados;
      const refMod = this.todosModulos.find(m => m.id === modulo.id);
      if (refMod) (refMod as any).cursosArchivados = archivados;
    }

    // ── Grupo destino ─────────────────────────────────────────────────────────
    // Se REUTILIZA el grupo del curso destino con el que la rejilla emparejará la
    // tarjeta (mismo ciclo + curso). Así el contenido importado queda en el MISMO
    // grupo que mostrará el cuaderno y es accesible al pulsarlo. Solo se crea un
    // grupo nuevo si no existe ninguno de ese ciclo en el curso destino.
    const grupoDestinoExistente = this.grupoDestino(modulo, cursoDestino);
    let nuevoGrupoId: string;
    let grupoCreado = false;
    if (grupoDestinoExistente?.id) {
      nuevoGrupoId = grupoDestinoExistente.id;
      // Asegura que el módulo quede enlazado en el grupo destino.
      const mods = Array.from(new Set([...((grupoDestinoExistente as any).modulosIds || []), modulo.id!]));
      try { await this.gruposService.update(nuevoGrupoId, { modulosIds: mods } as any); } catch {}
    } else {
      grupoCreado = true;
      nuevoGrupoId = await this.gruposService.create({
        nombre: grupoOrigen.nombre, curso: grupoOrigen.curso, letra: grupoOrigen.letra,
        cicloId: grupoOrigen.cicloId, cicloNombre: grupoOrigen.cicloNombre,
        centroId: grupoOrigen.centroId, tutorId: user.uid,
        cursoAcademico: cursoDestino, turno: grupoOrigen.turno, aula: grupoOrigen.aula,
        alumnosIds: [], modulosIds: [modulo.id!],
        horario: grupoOrigen.horario, activo: true
      } as any);
    }

    const evMap = new Map<string, string>();
    let eventos = 0;
    for (const ev of await this.eventosService.getByModuloGrupo(modulo.id!, grupoOrigen.id).catch(() => [])) {
      const p: any = { moduloId: modulo.id!, grupoId: nuevoGrupoId, cursoAcademico: cursoDestino,
        evaluacion: ev.evaluacion, tipo: ev.tipo, titulo: ev.titulo, descripcion: ev.descripcion || '',
        color: ev.color, fechaInicio: this.shiftTs(ev.fechaInicio, diff), resultadosAprendizajeIds: ev.resultadosAprendizajeIds || [] };
      if (ev.fechaFin) p.fechaFin = this.shiftTs(ev.fechaFin, diff);
      const nid = await this.eventosService.create(p);
      if (ev.id) evMap.set(ev.id, nid);
      eventos++;
    }

    let tareas = 0;
    for (const t of (await this.tareasService.queryByField('moduloId', modulo.id!)).filter(x => x.grupoId === grupoOrigen.id && !x.archivada)) {
      const p: any = { titulo: t.titulo, descripcion: t.descripcion, moduloId: modulo.id!, grupoId: nuevoGrupoId,
        profesorId: user.uid, evaluacion: t.evaluacion, puntuacionMaxima: t.puntuacionMaxima,
        porcentajeNotaFinal: t.porcentajeNotaFinal, penalizacionRetraso: t.penalizacionRetraso,
        permiteEntregaTardia: t.permiteEntregaTardia, esGrupal: t.esGrupal, requiereArchivo: t.requiereArchivo,
        publicada: false, archivada: false, entregas: [], adjuntos: [],
        resultadosAprendizajeIds: t.resultadosAprendizajeIds || [], criteriosEvaluacionIds: t.criteriosEvaluacionIds || [],
        fechaPublicacion: this.shiftTs(t.fechaPublicacion, diff), fechaEntrega: this.shiftTs(t.fechaEntrega, diff) };
      if (t.unidadId && evMap.has(t.unidadId)) p.unidadId = evMap.get(t.unidadId);
      if (t.fechaLimiteRetraso) p.fechaLimiteRetraso = this.shiftTs(t.fechaLimiteRetraso, diff);
      if ((t as any).orden != null) p.orden = (t as any).orden;
      await this.tareasService.create(p);
      tareas++;
    }

    let examenes = 0;
    for (const ex of (await this.examenesService.queryByField('moduloId', modulo.id!)).filter(x => x.grupoId === grupoOrigen.id)) {
      const p: any = { titulo: ex.titulo, descripcion: ex.descripcion || '', moduloId: modulo.id!, grupoId: nuevoGrupoId,
        profesorId: user.uid, tipo: ex.tipo, evaluacion: ex.evaluacion,
        puntuacionMaxima: ex.puntuacionMaxima, porcentajeNotaFinal: ex.porcentajeNotaFinal,
        notaMinimaAprobado: ex.notaMinimaAprobado, tienePonderacion: ex.tienePonderacion,
        horaInicio: ex.horaInicio, horaFin: ex.horaFin, aula: ex.aula, duracionMinutos: ex.duracionMinutos,
        fecha: this.shiftTs(ex.fecha, diff), publicado: false, resultadosPublicados: false,
        permiteRecuperacion: ex.permiteRecuperacion, calificaciones: [], secciones: ex.secciones || [],
        resultadosAprendizajeIds: ex.resultadosAprendizajeIds || [], criteriosEvaluacionIds: ex.criteriosEvaluacionIds || [] };
      if (ex.unidadId && evMap.has(ex.unidadId)) p.unidadId = evMap.get(ex.unidadId);
      await this.examenesService.create(p);
      examenes++;
    }

    return { eventos, tareas, examenes, grupoId: nuevoGrupoId, grupoCreado };
  }

  private shiftTs(ts: any, years: number): Timestamp {
    if (!ts) return Timestamp.now();
    const d = ts.toDate ? ts.toDate() : new Date((ts.seconds || 0) * 1000);
    d.setFullYear(d.getFullYear() + years);
    return Timestamp.fromDate(d);
  }
}