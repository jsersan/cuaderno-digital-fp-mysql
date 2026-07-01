import { Component, inject, OnInit, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatDialog, MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { DragDropModule, CdkDragDrop } from '@angular/cdk/drag-drop';
import { GruposService, ModulosService, AuthService, ActiveModuleService } from '@core/services';
import { TranslateModule } from '@ngx-translate/core';
import { Grupo, ModuloProfesional, Horario, FranjaHoraria } from '@core/models';

const DIAS: { key: string; labelKey: string }[] = [
  { key: 'lunes', labelKey: 'schedule.monday' },
  { key: 'martes', labelKey: 'schedule.tuesday' },
  { key: 'miercoles', labelKey: 'schedule.wednesday' },
  { key: 'jueves', labelKey: 'schedule.thursday' },
  { key: 'viernes', labelKey: 'schedule.friday' }
];

@Component({
  selector: 'app-horario',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, MatCardModule, MatButtonModule, MatIconModule, MatSlideToggleModule, MatSnackBarModule, TranslateModule, DragDropModule],
  template: `
    <div class="page-header">
      <div>
        <h2>{{ 'schedule.title' | translate }}</h2>
        <p class="sub">{{ activeModule.grupoNombre || ('dashboard.group' | translate) }} · curso 2025-2026</p>
      </div>
      <div class="actions">
        <button mat-button routerLink="/asistencia"><mat-icon>arrow_back</mat-icon> {{ 'common.back' | translate }}</button>
        <button mat-raised-button color="primary" (click)="guardar()" [disabled]="saving"><mat-icon>save</mat-icon> {{ 'schedule.save' | translate }}</button>
      </div>
    </div>

    @if (!activeModule.grupoId) {
      <mat-card class="no-module"><mat-icon>menu_book</mat-icon><p>{{ 'common.select_notebook' | translate }} <a routerLink="/dashboard">{{ 'common.dashboard' | translate }}</a></p></mat-card>
    } @else {
      <div class="toolbar">
        <mat-slide-toggle [(ngModel)]="soloMiModulo">{{ 'schedule.only_my_module' | translate }} ({{ activeModule.current?.abreviatura }})</mat-slide-toggle>
        <span class="flex-spacer"></span>
        <button mat-stroked-button (click)="cargarPropuesta()"><mat-icon>auto_fix_high</mat-icon> Cargar propuesta {{ cursoPropuesta }}º {{ familiaPropuesta }}</button>
        <span class="leyenda">{{ 'schedule.click_cell' | translate }}</span>
      </div>

      <mat-card class="grid-card">
        <table class="horario-table">
          <thead>
            <tr>
              <th class="hora-col">{{ 'schedule.slot' | translate }}</th>
              @for (d of dias; track d.key) { <th>{{ d.labelKey | translate }}</th> }
            </tr>
          </thead>
          <tbody cdkDropListGroup>
            @for (franja of franjasFijas; track franja; let fi = $index) {
              <tr>
                <td class="hora-col">{{ franja.replace('-', ' - ') }}</td>
                @for (d of dias; track d.key) {
                  <td class="celda" cdkDropList [cdkDropListData]="{ dia: d.key, franja: franja }"
                      (cdkDropListDropped)="onDropCelda($event)"
                      (click)="editarCelda(d.key, franja)"
                      [class.mio]="esMiModulo(getFranja(d.key, franja))"
                      [class.atenuada]="soloMiModulo && getFranja(d.key, franja) && !esMiModulo(getFranja(d.key, franja))">
                    @if (getFranja(d.key, franja); as fr) {
                      @if (!soloMiModulo || esMiModulo(fr)) {
                        <div class="mod-chip" cdkDrag [cdkDragData]="{ dia: d.key, franja: franja }"
                             title="Arrastra para mover o intercambiar">
                          <span class="mod-abrev">{{ getModAbrev(fr.moduloId) }}</span>
                          @if (fr.aula) { <span class="aula">{{ fr.aula }}</span> }
                        </div>
                      }
                    } @else {
                      <span class="vacia">+</span>
                    }
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
      </mat-card>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-header h2 { margin: 0; } .sub { color: #666; margin: 4px 0 0; }
    .actions { display: flex; gap: 8px; }
    .no-module { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .no-module mat-icon { font-size: 48px; width: 48px; height: 48px; }
    .toolbar { display: flex; align-items: center; gap: 24px; margin-bottom: 12px; flex-wrap: wrap; }
    .flex-spacer { flex: 1; }
    .leyenda { font-size: 13px; color: #999; }
    .grid-card { padding: 0; border-radius: 12px; overflow: hidden; }
    .horario-table { width: 100%; border-collapse: collapse; }
    .horario-table th { background: #fafafa; padding: 12px 8px; font-size: 13px; font-weight: 600; color: #555; border-bottom: 2px solid #e0e0e0; }
    .horario-table td { border: 1px solid #eee; text-align: center; height: 56px; }
    .hora-col { background: #fafafa; font-size: 12px; font-weight: 600; color: #666; white-space: nowrap; padding: 0 12px; min-width: 110px; }
    .celda { cursor: pointer; transition: background 0.12s; vertical-align: middle; }
    .celda:hover { background: #e3f2fd; }
    .celda.mio { background: #e8f5e9; }
    .celda.atenuada { opacity: 0.25; }
    .mod-abrev { display: block; font-weight: 700; color: #1565c0; font-size: 14px; }
    .celda.mio .mod-abrev { color: #2e7d32; }
    .aula { display: block; font-size: 11px; color: #888; }
    .vacia { color: #ccc; font-size: 20px; }
    /* Drag & drop de módulos entre celdas */
    .mod-chip { display: inline-flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 10px; border-radius: 8px; cursor: grab; user-select: none; }
    .mod-chip:active { cursor: grabbing; }
    .mod-chip.cdk-drag-preview { background: #fff; box-shadow: 0 8px 20px rgba(0,0,0,.28); padding: 6px 12px; }
    .mod-chip.cdk-drag-placeholder { opacity: .3; }
    .cdk-drag-animating { transition: transform .2s cubic-bezier(0,0,.2,1); }
    .celda.cdk-drop-list-receiving, .celda.cdk-drop-list-dragging { outline: 2px dashed #1565c0; outline-offset: -2px; background: #e3f2fd; }
  `]
})
export class HorarioComponent implements OnInit {
  private gruposService = inject(GruposService);
  private modulosService = inject(ModulosService);
  private auth = inject(AuthService);
  activeModule = inject(ActiveModuleService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  dias = DIAS;
  franjasFijas = ['08:30-09:25','09:25-10:20','10:20-11:15','11:45-12:40','12:40-13:35','13:35-14:30'];
  horario: Horario = { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [] };
  modulos: ModuloProfesional[] = [];
  soloMiModulo = false;
  saving = false;

  async ngOnInit() {
    await this.activeModule.restore();
    const user = this.auth.currentUser;
    const grupo = this.activeModule.currentGrupo;

    // Cargar TODOS los módulos del ciclo del grupo (no solo los del profesor)
    try {
      if (grupo?.cicloId) {
        this.modulos = await this.modulosService.queryByField('cicloId', grupo.cicloId);
      }
      // Respaldo: si no hay ciclo o no devuelve nada, usar los del profesor
      if (this.modulos.length === 0 && user) {
        this.modulos = await this.modulosService.queryByField('profesorId', user.uid);
      }
    } catch {
      if (user) {
        try { this.modulos = await this.modulosService.queryByField('profesorId', user.uid); } catch {}
      }
    }
    // Ordenar por abreviatura para que el desplegable sea cómodo
    this.modulos.sort((a, b) => (a.abreviatura || '').localeCompare(b.abreviatura || ''));

    if (grupo?.horario) {
      this.horario = {
        lunes: grupo.horario.lunes || [], martes: grupo.horario.martes || [],
        miercoles: grupo.horario.miercoles || [], jueves: grupo.horario.jueves || [],
        viernes: grupo.horario.viernes || []
      };
    }
  }

  getFranja(dia: string, franja: string): FranjaHoraria | null {
    const [hi, hf] = franja.split('-');
    return (this.horario[dia] || []).find(f => f.horaInicio === hi && f.horaFin === hf) || null;
  }

  // ── Drag & Drop: mover / intercambiar módulos entre celdas ──────────────────
  onDropCelda(event: CdkDragDrop<{ dia: string; franja: string }>) {
    const origen = event.item.data as { dia: string; franja: string };
    const destino = event.container.data as { dia: string; franja: string };
    if (!origen || !destino) return;
    if (origen.dia === destino.dia && origen.franja === destino.franja) return; // misma celda
    this.intercambiarCeldas(origen, destino);
  }

  // Intercambia el contenido (el módulo) de dos celdas, conservando la hora propia
  // de cada franja. Si la celda destino está vacía, equivale a mover.
  private intercambiarCeldas(a: { dia: string; franja: string }, b: { dia: string; franja: string }) {
    const payload = (fr: FranjaHoraria | null) => fr
      ? { moduloId: fr.moduloId, moduloAbreviatura: fr.moduloAbreviatura, profesorId: fr.profesorId, aula: fr.aula }
      : null;
    const pa = payload(this.getFranja(a.dia, a.franja));
    const pb = payload(this.getFranja(b.dia, b.franja));
    this.setCeldaPayload(a.dia, a.franja, pb);
    this.setCeldaPayload(b.dia, b.franja, pa);
  }

  // Asigna (o vacía, si payload es null) el módulo de una celda manteniendo su horario.
  private setCeldaPayload(dia: string, franja: string, payload: { moduloId: string; moduloAbreviatura?: string; profesorId?: string; aula?: string } | null) {
    const [hi, hf] = franja.split('-');
    const lista = this.horario[dia] || (this.horario[dia] = []);
    const idx = lista.findIndex(f => f.horaInicio === hi && f.horaFin === hf);
    if (!payload) {
      if (idx >= 0) lista.splice(idx, 1);
      return;
    }
    const nueva: FranjaHoraria = {
      horaInicio: hi, horaFin: hf,
      moduloId: payload.moduloId,
      moduloAbreviatura: payload.moduloAbreviatura || this.getModAbrev(payload.moduloId),
      profesorId: payload.profesorId || '',
      aula: payload.aula || ''
    };
    if (idx >= 0) lista[idx] = nueva; else lista.push(nueva);
  }

  esMiModulo(fr: FranjaHoraria | null): boolean {
    return !!fr && fr.moduloId === this.activeModule.moduloId;
  }

  getModAbrev(moduloId: string): string {
    return this.modulos.find(m => m.id === moduloId)?.abreviatura || '¿?';
  }

  editarCelda(dia: string, franja: string) {
    const [hi, hf] = franja.split('-');
    const existente = this.getFranja(dia, franja);
    const ref = this.dialog.open(CeldaHorarioDialog, {
      width: '420px',
      data: {
        dia, horaInicio: hi, horaFin: hf,
        moduloId: existente?.moduloId || this.activeModule.moduloId,
        aula: existente?.aula || this.activeModule.currentGrupo?.aula || '',
        modulos: this.modulos,
        tieneExistente: !!existente
      }
    });
    ref.afterClosed().subscribe((result) => {
      if (!result) return;
      const lista = this.horario[dia];
      const idx = lista.findIndex(f => f.horaInicio === hi && f.horaFin === hf);
      if (result.borrar) {
        if (idx >= 0) lista.splice(idx, 1);
        return;
      }
      const franjaNueva: FranjaHoraria = {
        horaInicio: hi, horaFin: hf, moduloId: result.moduloId,
        moduloAbreviatura: this.getModAbrev(result.moduloId),
        profesorId: this.auth.currentUser?.uid || '', aula: result.aula || ''
      };
      if (idx >= 0) lista[idx] = franjaNueva; else lista.push(franjaNueva);
    });
  }

  // Propuesta orientativa de 2º DAW: [dia, franjaInicio, abreviaturaModulo]
  private readonly PROPUESTA_2DAW: { dia: string; ini: string; abrev: string; nombre?: string }[] = [
    { dia: 'lunes', ini: '08:30', abrev: 'DWES' }, { dia: 'martes', ini: '08:30', abrev: 'DWEC' }, { dia: 'miercoles', ini: '08:30', abrev: 'DWES' }, { dia: 'jueves', ini: '08:30', abrev: 'DIW' }, { dia: 'viernes', ini: '08:30', abrev: 'DWEC' },
    { dia: 'lunes', ini: '09:25', abrev: 'DWES' }, { dia: 'martes', ini: '09:25', abrev: 'DWEC' }, { dia: 'miercoles', ini: '09:25', abrev: 'DWES' }, { dia: 'jueves', ini: '09:25', abrev: 'DIW' }, { dia: 'viernes', ini: '09:25', abrev: 'DWEC' },
    { dia: 'lunes', ini: '10:20', abrev: 'DWEC' }, { dia: 'martes', ini: '10:20', abrev: 'DIW' }, { dia: 'miercoles', ini: '10:20', abrev: 'IPE2' }, { dia: 'jueves', ini: '10:20', abrev: 'DWES' }, { dia: 'viernes', ini: '10:20', abrev: 'DESP' },
    { dia: 'lunes', ini: '11:45', abrev: 'DIW' }, { dia: 'martes', ini: '11:45', abrev: 'DWES' }, { dia: 'miercoles', ini: '11:45', abrev: 'DWEC' }, { dia: 'jueves', ini: '11:45', abrev: 'ING' }, { dia: 'viernes', ini: '11:45', abrev: 'DWES' },
    { dia: 'lunes', ini: '12:40', abrev: 'DIW' }, { dia: 'martes', ini: '12:40', abrev: 'DWES' }, { dia: 'miercoles', ini: '12:40', abrev: 'PROY' }, { dia: 'jueves', ini: '12:40', abrev: 'ING' }, { dia: 'viernes', ini: '12:40', abrev: 'DESP' },
    { dia: 'lunes', ini: '13:35', abrev: 'DWEC' }, { dia: 'martes', ini: '13:35', abrev: 'IPE2' }, { dia: 'miercoles', ini: '13:35', abrev: 'PROY' }, { dia: 'jueves', ini: '13:35', abrev: 'IPE2' }, { dia: 'viernes', ini: '13:35', abrev: 'DIW' }
  ];

  // Propuesta orientativa de 1º SMR (DCB): [dia, franjaInicio, abreviaturaModulo, palabraClaveNombre]
  // Módulos de 1º (no de 2º): Montaje y mantenimiento (MME), SO monopuesto (SOM),
  //   Aplicaciones ofimáticas (APIN), Redes locales (RL), Seguridad informática (SI),
  //   Inglés técnico (ING). 'nombre' es respaldo por si la abreviatura real difiere.
  //   Reparto semanal aprox.: MME 7 · APIN 7 · RL 7 · SOM 5 · SI 3 · ING 1.
  private readonly PROPUESTA_1SMR: { dia: string; ini: string; abrev: string; nombre?: string }[] = [
    { dia: 'lunes', ini: '08:30', abrev: 'MOME', nombre: 'montaje' }, { dia: 'martes', ini: '08:30', abrev: 'APIN', nombre: 'ofim' }, { dia: 'miercoles', ini: '08:30', abrev: 'RELO', nombre: 'redes local' }, { dia: 'jueves', ini: '08:30', abrev: 'SOMO', nombre: 'monopuesto' }, { dia: 'viernes', ini: '08:30', abrev: 'SEG', nombre: 'seguridad' },
    { dia: 'lunes', ini: '09:25', abrev: 'MOME', nombre: 'montaje' }, { dia: 'martes', ini: '09:25', abrev: 'APIN', nombre: 'ofim' }, { dia: 'miercoles', ini: '09:25', abrev: 'RELO', nombre: 'redes local' }, { dia: 'jueves', ini: '09:25', abrev: 'SOMO', nombre: 'monopuesto' }, { dia: 'viernes', ini: '09:25', abrev: 'APIN', nombre: 'ofim' },
    { dia: 'lunes', ini: '10:20', abrev: 'RELO', nombre: 'redes local' }, { dia: 'martes', ini: '10:20', abrev: 'MOME', nombre: 'montaje' }, { dia: 'miercoles', ini: '10:20', abrev: 'SOMO', nombre: 'monopuesto' }, { dia: 'jueves', ini: '10:20', abrev: 'APIN', nombre: 'ofim' }, { dia: 'viernes', ini: '10:20', abrev: 'MOME', nombre: 'montaje' },
    { dia: 'lunes', ini: '11:45', abrev: 'APIN', nombre: 'ofim' }, { dia: 'martes', ini: '11:45', abrev: 'RELO', nombre: 'redes local' }, { dia: 'miercoles', ini: '11:45', abrev: 'MOME', nombre: 'montaje' }, { dia: 'jueves', ini: '11:45', abrev: 'SOMO', nombre: 'monopuesto' }, { dia: 'viernes', ini: '11:45', abrev: 'RELO', nombre: 'redes local' },
    { dia: 'lunes', ini: '12:40', abrev: 'SOMO', nombre: 'monopuesto' }, { dia: 'martes', ini: '12:40', abrev: 'SEG', nombre: 'seguridad' }, { dia: 'miercoles', ini: '12:40', abrev: 'APIN', nombre: 'ofim' }, { dia: 'jueves', ini: '12:40', abrev: 'MOME', nombre: 'montaje' }, { dia: 'viernes', ini: '12:40', abrev: 'SEG', nombre: 'seguridad' },
    { dia: 'lunes', ini: '13:35', abrev: 'ING', nombre: 'ingl' }, { dia: 'martes', ini: '13:35', abrev: 'MOME', nombre: 'montaje' }, { dia: 'miercoles', ini: '13:35', abrev: 'RELO', nombre: 'redes local' }, { dia: 'jueves', ini: '13:35', abrev: 'APIN', nombre: 'ofim' }, { dia: 'viernes', ini: '13:35', abrev: 'RELO', nombre: 'redes local' }
  ];

  // Propuesta oficial de 2º SMR (DCB): [dia, franjaInicio, abreviaturaModulo]
  // Reparto (30 = 21 sem): SVR 9 · SOR 8 · AW 5 · FOL 5 · EIE 3
  //   SVR=Servicios en red · SOR=Sistemas operativos en red · AW=Aplicaciones web
  private readonly PROPUESTA_2SMR: { dia: string; ini: string; abrev: string; nombre?: string }[] = [
    { dia: 'lunes', ini: '08:30', abrev: 'SVR' }, { dia: 'martes', ini: '08:30', abrev: 'SOR' }, { dia: 'miercoles', ini: '08:30', abrev: 'AW' }, { dia: 'jueves', ini: '08:30', abrev: 'FOL' }, { dia: 'viernes', ini: '08:30', abrev: 'EIE' },
    { dia: 'lunes', ini: '09:25', abrev: 'SVR' }, { dia: 'martes', ini: '09:25', abrev: 'SOR' }, { dia: 'miercoles', ini: '09:25', abrev: 'AW' }, { dia: 'jueves', ini: '09:25', abrev: 'FOL' }, { dia: 'viernes', ini: '09:25', abrev: 'SVR' },
    { dia: 'lunes', ini: '10:20', abrev: 'SOR' }, { dia: 'martes', ini: '10:20', abrev: 'SVR' }, { dia: 'miercoles', ini: '10:20', abrev: 'SOR' }, { dia: 'jueves', ini: '10:20', abrev: 'AW' }, { dia: 'viernes', ini: '10:20', abrev: 'SVR' },
    { dia: 'lunes', ini: '11:45', abrev: 'SVR' }, { dia: 'martes', ini: '11:45', abrev: 'SOR' }, { dia: 'miercoles', ini: '11:45', abrev: 'SVR' }, { dia: 'jueves', ini: '11:45', abrev: 'FOL' }, { dia: 'viernes', ini: '11:45', abrev: 'SOR' },
    { dia: 'lunes', ini: '12:40', abrev: 'SOR' }, { dia: 'martes', ini: '12:40', abrev: 'AW' }, { dia: 'miercoles', ini: '12:40', abrev: 'SVR' }, { dia: 'jueves', ini: '12:40', abrev: 'FOL' }, { dia: 'viernes', ini: '12:40', abrev: 'EIE' },
    { dia: 'lunes', ini: '13:35', abrev: 'FOL' }, { dia: 'martes', ini: '13:35', abrev: 'SVR' }, { dia: 'miercoles', ini: '13:35', abrev: 'SOR' }, { dia: 'jueves', ini: '13:35', abrev: 'AW' }, { dia: 'viernes', ini: '13:35', abrev: 'EIE' }
  ];

  // Detecta la familia del cuaderno activo por las abreviaturas del ciclo:
  // si hay módulos típicos de DAW → 'DAW'; si no → 'SMR'.
  get familiaPropuesta(): 'DAW' | 'SMR' {
    const norm = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const abrevs = this.modulos.map(m => norm(m.abreviatura || ''));
    const esDaw = abrevs.some(a => ['DWEC', 'DWES', 'DIW', 'DAW2', 'IPE2', 'DESP'].includes(a));
    return esDaw ? 'DAW' : 'SMR';
  }

  // Curso del grupo activo (1º o 2º). Se usa el campo 'curso'; como respaldo, el
  // dígito inicial del nombre del grupo (p.ej. "1SM2" → 1, "2SM2" → 2). Por defecto 2.
  get cursoPropuesta(): 1 | 2 {
    const g: any = this.activeModule.currentGrupo;
    const c = Number(g?.curso);
    if (c === 1 || c === 2) return c;
    const m = (this.activeModule.grupoNombre || g?.nombre || '').match(/^\s*([12])/);
    return m && m[1] === '1' ? 1 : 2;
  }

  // Devuelve la propuesta para el curso + familia del grupo activo (null si no hay).
  private getPropuesta(curso: 1 | 2, familia: 'DAW' | 'SMR'): { dia: string; ini: string; abrev: string; nombre?: string }[] | null {
    if (familia === 'SMR') return curso === 1 ? this.PROPUESTA_1SMR : this.PROPUESTA_2SMR;
    if (familia === 'DAW') return curso === 2 ? this.PROPUESTA_2DAW : null; // de momento no hay 1º DAW
    return null;
  }

  // Busca un módulo del ciclo por abreviatura (flexible: ignora may/min y signos) y,
  // como respaldo, por una palabra clave del nombre. Así la propuesta encaja aunque
  // las abreviaturas reales no coincidan exactamente con las del DCB.
  private buscarModulo(abrev: string, nombreKey?: string): ModuloProfesional | null {
    const norm = (s: string) => (s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    const target = norm(abrev);
    const porAbrev = this.modulos.find(m => norm(m.abreviatura || '') === target);
    if (porAbrev) return porAbrev;
    if (nombreKey) {
      const key = nombreKey.toLowerCase();
      const porNombre = this.modulos.find(m => (m.nombre || '').toLowerCase().includes(key));
      if (porNombre) return porNombre;
    }
    return null;
  }

  cargarPropuesta() {
    const familia = this.familiaPropuesta;
    const curso = this.cursoPropuesta;
    const propuesta = this.getPropuesta(curso, familia);
    if (!propuesta) {
      this.snackBar.open(`Todavía no hay una propuesta predefinida para ${curso}º ${familia}.`, 'OK', { duration: 6000 });
      return;
    }
    if (!confirm(`Esto reemplazará el horario actual con la propuesta de ${curso}º ${familia}. ¿Continuar?`)) return;

    const nuevo: Horario = { lunes: [], martes: [], miercoles: [], jueves: [], viernes: [] };
    const noEncontrados = new Set<string>();
    let colocados = 0;

    for (const item of propuesta) {
      const mod = this.buscarModulo(item.abrev, item.nombre);
      if (!mod) { noEncontrados.add(item.abrev); continue; }
      const fin = this.finDeFranja(item.ini);
      nuevo[item.dia].push({
        horaInicio: item.ini, horaFin: fin, moduloId: mod.id || '',
        moduloAbreviatura: mod.abreviatura, profesorId: mod.profesorId || '',
        aula: this.activeModule.currentGrupo?.aula || ''
      });
      colocados++;
    }

    // Rellena huecos con el módulo del cuaderno activo (p.ej. DASP) SOLO hasta sus
    // horas semanales, no todas las celdas vacías. Antes rellenaba TODOS los huecos,
    // lo que saturaba el horario con el módulo activo cuando faltaban módulos del
    // ciclo (síntoma: "DASP en casi todas las horas"). Los huecos que sobren quedan
    // vacíos ("+"), marcando dónde faltan módulos por crear.
    const activo = this.modulos.find(m => m.id === this.activeModule.moduloId);
    const maxActivo = Math.max(0, Number((activo as any)?.horasSemanales) || 0);
    let rellenadas = 0;
    if (activo && maxActivo > 0) {
      for (const franja of this.franjasFijas) {
        if (rellenadas >= maxActivo) break;
        const [hi, hf] = franja.split('-');
        for (const d of this.dias) {
          if (rellenadas >= maxActivo) break;
          const lista = nuevo[d.key];
          if (!lista.some(f => f.horaInicio === hi && f.horaFin === hf)) {
            lista.push({
              horaInicio: hi, horaFin: hf, moduloId: activo.id || '',
              moduloAbreviatura: activo.abreviatura, profesorId: activo.profesorId || '',
              aula: this.activeModule.currentGrupo?.aula || ''
            });
            colocados++; rellenadas++;
          }
        }
      }
    }

    this.horario = nuevo;

    if (noEncontrados.size > 0) {
      this.snackBar.open(
        `Propuesta cargada (${colocados} sesiones). Faltan por crear en el ciclo, sus huecos quedan vacíos: ${[...noEncontrados].join(', ')}.`,
        'OK', { duration: 9000 }
      );
    } else {
      this.snackBar.open(`✓ Propuesta cargada (${colocados} sesiones). Revisa y pulsa "Guardar horario".`, 'OK', { duration: 5000 });
    }
  }

  private finDeFranja(ini: string): string {
    const fr = this.franjasFijas.find(f => f.startsWith(ini));
    return fr ? fr.split('-')[1] : ini;
  }

  async guardar() {
    const grupo = this.activeModule.currentGrupo;
    if (!grupo?.id) return;
    this.saving = true;
    try {
      await this.gruposService.update(grupo.id, { horario: this.horario } as any);
      // refrescar el grupo activo en memoria
      this.activeModule.setGrupo({ ...grupo, horario: this.horario });
      this.snackBar.open('✓ Horario guardado', 'OK', { duration: 3000 });
    } catch (e: any) {
      this.snackBar.open('Error: ' + e.message, 'Cerrar', { duration: 5000 });
    }
    this.saving = false;
  }
}

@Component({
  selector: 'app-celda-horario-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatButtonModule, MatIconModule, MatFormFieldModule, MatInputModule, MatSelectModule, TranslateModule],
  template: `
    <h2 mat-dialog-title>{{ data.horaInicio }} - {{ data.horaFin }}</h2>
    <mat-dialog-content>
      <div class="form">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'schedule.module' | translate }}</mat-label>
          <mat-select [(ngModel)]="data.moduloId">
            @for (m of data.modulos; track m.id) { <mat-option [value]="m.id">{{ m.abreviatura }} - {{ m.nombre }}</mat-option> }
          </mat-select>
        </mat-form-field>
        <mat-form-field appearance="outline">
          <mat-label>{{ 'schedule.classroom' | translate }}</mat-label>
          <input matInput [(ngModel)]="data.aula" placeholder="Ej: Aula 2">
        </mat-form-field>
      </div>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      @if (data.tieneExistente) {
        <button mat-button color="warn" (click)="borrar()"><mat-icon>delete</mat-icon> {{ 'schedule.remove' | translate }}</button>
      }
      <button mat-button (click)="cerrar()">{{ 'common.cancel' | translate }}</button>
      <button mat-raised-button color="primary" [disabled]="!data.moduloId" (click)="guardar()">{{ 'common.save' | translate }}</button>
    </mat-dialog-actions>
  `,
  styles: [`.form { display: flex; flex-direction: column; gap: 8px; padding-top: 8px; min-width: 340px; } .form mat-form-field { width: 100%; }`]
})
export class CeldaHorarioDialog {
  constructor(public ref: MatDialogRef<CeldaHorarioDialog>, @Inject(MAT_DIALOG_DATA) public data: any) {}
  cerrar() { this.ref.close(); }
  guardar() { this.ref.close({ moduloId: this.data.moduloId, aula: this.data.aula }); }
  borrar() { this.ref.close({ borrar: true }); }
}