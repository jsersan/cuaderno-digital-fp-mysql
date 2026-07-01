import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { TranslateModule, TranslateService } from '@ngx-translate/core';
import jsPDF from 'jspdf';
import { GruposService, AlumnosService, CiclosService, AuthService, ActiveModuleService, OrlasService, OrlaRegistro } from '@core/services';
import { Grupo, Alumno, CicloFormativo } from '@core/models';

// Cada alumno con su foto guardada como dataURL (Base64) en alumno.fotoUrl
interface FotoAlumno {
  alumno: Alumno;
  fotoDataUrl: string | null;   // dataURL: previsualizar, PDF y guardar en Firestore
  nombreArchivo: string | null;
  subiendo: boolean;
}

@Component({
  selector: 'app-orla',
  standalone: true,
  imports: [
    CommonModule, FormsModule,
    MatCardModule, MatFormFieldModule, MatSelectModule,
    MatButtonModule, MatIconModule, MatProgressSpinnerModule, MatProgressBarModule,
    MatSnackBarModule, TranslateModule
  ],
  template: `
    <div class="page-header">
      <div>
        <h2>{{ 'orla.title' | translate }}</h2>
        <p class="subtitle">{{ 'orla.subtitle' | translate }}</p>
      </div>
      <button mat-raised-button color="primary"
              (click)="generarPDF()"
              [disabled]="generando || !grupoSel || alumnosConFoto() === 0">
        <mat-icon>picture_as_pdf</mat-icon> {{ 'orla.generate' | translate }}
      </button>
    </div>

    @if (grupoSel && orlaGuardada) {
      <mat-card class="orla-guardada">
        <div class="og-info">
          <mat-icon>verified</mat-icon>
          <div>
            <strong>{{ 'orla.saved_title' | translate }}</strong>
            <span class="og-meta">
              {{ orlaGuardada.conFoto }} / {{ orlaGuardada.totalAlumnos }} {{ 'orlas.with_photo' | translate }}
              · {{ 'orla.saved_on' | translate }} {{ formatFecha(orlaGuardada.generadaEn) }}
            </span>
          </div>
        </div>
        <button mat-raised-button color="primary"
                (click)="generarPDF()" [disabled]="generando || alumnosConFoto() === 0">
          @if (generando) {
            <mat-spinner diameter="18"></mat-spinner>
          } @else {
            <ng-container><mat-icon>download</mat-icon> {{ 'orla.download_saved' | translate }}</ng-container>
          }
        </button>
      </mat-card>
    }

    <mat-card class="filters-card">
      <div class="filters-row">
        <mat-form-field appearance="outline">
          <mat-label>{{ 'common.group' | translate }}</mat-label>
          <mat-select [(ngModel)]="grupoSel" (ngModelChange)="onGrupoChange()">
            @for (g of grupos; track g.id) {
              <mat-option [value]="g.id">{{ g.nombre }}</mat-option>
            }
          </mat-select>
        </mat-form-field>

        @if (grupoSel) {
          <button mat-stroked-button (click)="bulkInput.click()" [disabled]="subiendoAlguna()">
            <mat-icon>add_photo_alternate</mat-icon> {{ 'orla.upload_multiple' | translate }}
          </button>
          <input #bulkInput type="file" hidden multiple accept="image/*"
                 (change)="onBulkUpload($event)">

          <span class="counter">
            {{ 'orla.assigned' | translate:{ done: alumnosConFoto(), total: fotos.length } }}
          </span>

          @if (subiendoAlguna()) {
            <span class="saving"><mat-icon>cloud_upload</mat-icon> {{ 'orla.saving' | translate }}</span>
          }
        }
      </div>
      @if (grupoSel && sinFoto() > 0) {
        <p class="alta-aviso">
          <mat-icon>warning_amber</mat-icon>
          {{ 'orla.missing_photos' | translate:{ count: sinFoto() } }}
        </p>
      }
      @if (grupoSel) {
        <p class="hint">
          <mat-icon>info</mat-icon>
          {{ 'orla.bulk_hint' | translate }}
        </p>
      }
    </mat-card>

    @if (grupoSel && fotos.length > 0) {
      <div class="orla-grid">
        @for (f of fotos; track f.alumno.id; let i = $index) {
          <mat-card class="alumno-card">
            <div class="foto-box" (click)="!f.subiendo && fileInputs[i].click()"
                 [class.has-foto]="f.fotoDataUrl">
              @if (f.subiendo) {
                <mat-spinner diameter="32"></mat-spinner>
              } @else if (f.fotoDataUrl) {
                <img [src]="f.fotoDataUrl" [alt]="f.alumno.nombre">
                <button mat-icon-button class="remove-btn"
                        (click)="quitarFoto(i, $event)">
                  <mat-icon>close</mat-icon>
                </button>
              } @else {
                <mat-icon class="placeholder-icon">add_a_photo</mat-icon>
                <span class="placeholder-text">{{ 'orla.add_photo' | translate }}</span>
              }
            </div>
            <input #fileInput type="file" hidden accept="image/*"
                   (change)="onSingleUpload($event, i)">
            <div class="alumno-nombre">
              <strong>{{ f.alumno.apellidos }}</strong>
              <span>{{ f.alumno.nombre }}</span>
            </div>
          </mat-card>
        }
      </div>
    }

    @if (grupoSel && fotos.length === 0) {
      <mat-card class="empty-card">
        <mat-icon>groups</mat-icon>
        <p>{{ 'orla.no_students' | translate }}</p>
      </mat-card>
    }

    @if (!grupoSel) {
      <mat-card class="empty-card">
        <mat-icon>photo_library</mat-icon>
        <p>{{ 'orla.select_group' | translate }}</p>
      </mat-card>
    }
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px; flex-wrap: wrap; gap: 12px; }
    .page-header h2 { margin: 0; font-size: 24px; font-weight: 700; }
    .subtitle { color: #666; margin: 4px 0 0; }
    .orla-guardada { display: flex; justify-content: space-between; align-items: center; gap: 16px; padding: 16px 20px; margin-bottom: 16px; border-radius: 12px; background: linear-gradient(135deg, #e8f5e9, #f1f8e9); border-left: 4px solid #2e7d32; flex-wrap: wrap; }
    .og-info { display: flex; align-items: center; gap: 12px; }
    .og-info mat-icon { color: #2e7d32; font-size: 32px; width: 32px; height: 32px; }
    .og-info strong { display: block; font-size: 15px; color: #1b5e20; }
    .og-meta { font-size: 13px; color: #555; }
    .filters-card { margin-bottom: 16px; padding: 16px; border-radius: 12px; }
    .filters-row { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
    .filters-row mat-form-field { min-width: 220px; }
    .counter { font-size: 13px; color: #666; font-weight: 500; }
    .saving { display: flex; align-items: center; gap: 4px; font-size: 13px; color: #1565c0; }
    .saving mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .hint { display: flex; align-items: center; gap: 8px; font-size: 12px; color: #888; margin: 12px 0 0; }
    .hint mat-icon { font-size: 16px; width: 16px; height: 16px; }
    .alta-aviso { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #e65100; margin: 12px 0 0; font-weight: 500; }
    .alta-aviso mat-icon { font-size: 18px; width: 18px; height: 18px; }

    .orla-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 16px; }
    .alumno-card { padding: 12px; border-radius: 12px; text-align: center; }
    .foto-box { position: relative; width: 100%; aspect-ratio: 3 / 4; border-radius: 8px; border: 2px dashed #ccc; display: flex; flex-direction: column; align-items: center; justify-content: center; cursor: pointer; overflow: hidden; background: #fafafa; transition: border-color 0.2s; }
    .foto-box:hover { border-color: #1565c0; }
    .foto-box.has-foto { border-style: solid; border-color: #1565c0; }
    .foto-box img { width: 100%; height: 100%; object-fit: cover; }
    .placeholder-icon { font-size: 32px; width: 32px; height: 32px; color: #bbb; }
    .placeholder-text { font-size: 11px; color: #999; margin-top: 4px; }
    .remove-btn { position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.55); color: white; width: 28px; height: 28px; line-height: 28px; }
    .remove-btn mat-icon { font-size: 18px; width: 18px; height: 18px; }
    .alumno-nombre { margin-top: 8px; display: flex; flex-direction: column; }
    .alumno-nombre strong { font-size: 13px; }
    .alumno-nombre span { font-size: 12px; color: #666; }

    .empty-card { text-align: center; padding: 48px; color: #999; border-radius: 12px; }
    .empty-card mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 12px; }
    @media (max-width: 600px) { .orla-grid { grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); } }
  `]
})
export class OrlaComponent implements OnInit {
  private gruposService = inject(GruposService);
  private alumnosService = inject(AlumnosService);
  private ciclosService = inject(CiclosService);
  private auth = inject(AuthService);
  private activeModule = inject(ActiveModuleService);
  private orlasService = inject(OrlasService);
  private snackBar = inject(MatSnackBar);
  private t = inject(TranslateService);

  // Tamaño/calidad de las fotos guardadas como Base64 (foto carnet 3:4)
  private readonly FOTO_W = 400;
  private readonly FOTO_H = 533;
  private readonly FOTO_CALIDAD = 0.75;

  grupos: Grupo[] = [];
  ciclos: CicloFormativo[] = [];
  grupoSel = '';
  fotos: FotoAlumno[] = [];
  fileInputs: HTMLInputElement[] = [];
  generando = false;
  orlaGuardada: OrlaRegistro | null = null;

  async ngOnInit() {
    const user = this.auth.currentUser;
    if (!user) return;

    await this.activeModule.restore();
    this.ciclosService.getByCentro$(user.centroId).subscribe(c => this.ciclos = c);
    this.gruposService.getByCentro$(user.centroId, '2025-2026').subscribe(g => {
      this.grupos = g;
      if (this.activeModule.grupoId && !this.grupoSel) {
        this.grupoSel = this.activeModule.grupoId;
        this.onGrupoChange();
      }
    });
  }

  async onGrupoChange() {
    if (!this.grupoSel) { this.fotos = []; this.orlaGuardada = null; return; }
    const alumnos = await this.alumnosService.getByGrupo(this.grupoSel);
    alumnos.sort((a, b) => a.apellidos.localeCompare(b.apellidos) || a.nombre.localeCompare(b.nombre));

    // La foto persistida (alumno.fotoUrl) ya es un dataURL Base64: se usa directamente.
    this.fotos = alumnos.map(a => ({
      alumno: a,
      fotoDataUrl: (a as any).fotoUrl || null,
      nombreArchivo: null,
      subiendo: false
    }));
    setTimeout(() => this.collectInputs(), 0);

    // ¿Tiene este grupo una orla ya generada?
    try {
      this.orlaGuardada = await this.orlasService.getByGrupo(this.grupoSel);
    } catch { this.orlaGuardada = null; }
  }

  formatFecha(fecha: any): string {
    if (!fecha) return '—';
    const d = fecha?.toDate ? fecha.toDate() : new Date(fecha.seconds ? fecha.seconds * 1000 : fecha);
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  private collectInputs() {
    const nodes = Array.from(document.querySelectorAll('.alumno-card input[type=file]')) as HTMLInputElement[];
    this.fileInputs = nodes;
  }

  alumnosConFoto(): number {
    return this.fotos.filter(f => f.fotoDataUrl).length;
  }

  sinFoto(): number {
    return this.fotos.filter(f => !f.fotoDataUrl).length;
  }

  subiendoAlguna(): boolean {
    return this.fotos.some(f => f.subiendo);
  }

  async onSingleUpload(event: Event, index: number) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = '';
    await this.procesarYGuardar(index, file);
  }

  async onBulkUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    input.value = '';

    let emparejados = 0;
    let porOrden = 0;
    let libreIdx = 0;

    for (const file of files) {
      const match = this.buscarAlumnoPorNombreArchivo(file.name);
      let idx = -1;

      if (match >= 0 && !this.fotos[match].fotoDataUrl) {
        idx = match;
        emparejados++;
      } else {
        while (libreIdx < this.fotos.length && this.fotos[libreIdx].fotoDataUrl) libreIdx++;
        if (libreIdx < this.fotos.length) { idx = libreIdx; libreIdx++; porOrden++; }
      }

      if (idx >= 0) {
        await this.procesarYGuardar(idx, file);
      }
    }

    this.snackBar.open(
      this.t.instant('orla.bulk_result', { matched: emparejados, rest: porOrden }),
      'OK', { duration: 5000 }
    );
  }

  // Redimensiona/comprime a Base64 y guarda en alumno.fotoUrl (Firestore, sin Storage)
  private async procesarYGuardar(index: number, file: File) {
    const f = this.fotos[index];
    const alumnoId = f.alumno.id;
    if (!alumnoId) return;

    f.subiendo = true;
    try {
      const dataUrl = await this.redimensionarImagen(file, this.FOTO_W, this.FOTO_H, this.FOTO_CALIDAD);
      f.fotoDataUrl = dataUrl;
      f.nombreArchivo = file.name;
      await this.alumnosService.update(alumnoId, { fotoUrl: dataUrl } as Partial<Alumno>);
    } catch (e: any) {
      console.error('Error guardando foto:', e);
      this.snackBar.open(this.t.instant('orla.upload_error', { msg: e?.message || '' }), 'Cerrar', { duration: 5000 });
      f.fotoDataUrl = null;
      f.nombreArchivo = null;
    } finally {
      f.subiendo = false;
    }
  }

  private buscarAlumnoPorNombreArchivo(nombreArchivo: string): number {
    const limpio = nombreArchivo
      .toLowerCase()
      .replace(/\.[^.]+$/, '')
      .replace(/[_\-.]+/g, ' ')
      .trim();

    return this.fotos.findIndex(f => {
      const a = f.alumno;
      const nombre = (a.nombre || '').toLowerCase();
      const apellidos = (a.apellidos || '').toLowerCase();
      const dni = (a.dni || '').toLowerCase();
      const emailUser = (a.email || '').split('@')[0].toLowerCase();
      return (
        (dni && limpio.includes(dni)) ||
        (emailUser && limpio.includes(emailUser)) ||
        (apellidos && limpio.includes(apellidos)) ||
        (nombre && apellidos && limpio.includes(nombre) && limpio.includes(apellidos.split(' ')[0]))
      );
    });
  }

  async quitarFoto(index: number, event: Event) {
    event.stopPropagation();
    const f = this.fotos[index];
    const alumnoId = f.alumno.id;

    f.fotoDataUrl = null;
    f.nombreArchivo = null;

    if (alumnoId) {
      try {
        await this.alumnosService.update(alumnoId, { fotoUrl: '' } as Partial<Alumno>);
      } catch { /* ignorar */ }
    }
  }

  // Escala a anchoMax x altoMax (recorte centrado "cover") y devuelve dataURL JPEG comprimido
  private redimensionarImagen(file: File, anchoMax: number, altoMax: number, calidad: number): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('No se pudo leer el archivo'));
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error('Imagen no válida'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = anchoMax;
          canvas.height = altoMax;
          const ctx = canvas.getContext('2d');
          if (!ctx) { reject(new Error('No se pudo crear el lienzo')); return; }

          const escala = Math.max(anchoMax / img.width, altoMax / img.height);
          const wEscalado = img.width * escala;
          const hEscalado = img.height * escala;
          const dx = (anchoMax - wEscalado) / 2;
          const dy = (altoMax - hEscalado) / 2;
          ctx.drawImage(img, dx, dy, wEscalado, hEscalado);

          resolve(canvas.toDataURL('image/jpeg', calidad));
        };
        img.src = reader.result as string;
      };
      reader.readAsDataURL(file);
    });
  }

  async generarPDF() {
    if (!this.grupoSel) return;
    const conFoto = this.fotos.filter(f => f.fotoDataUrl);
    if (conFoto.length === 0) {
      this.snackBar.open(this.t.instant('orla.no_photos'), 'Cerrar', { duration: 3000 });
      return;
    }

    this.generando = true;
    try {
      const grupo = this.grupos.find(g => g.id === this.grupoSel);
      const ciclo = this.ciclos.find(c => c.id === grupo?.cicloId);

      const tituloCiclo = ciclo?.nombre || grupo?.cicloNombre || '';
      const cursoTexto = this.cursoOrdinal(grupo?.curso);
      const cursoAcademico = 'Curso 2026-2027';
      const subtitulo = `${grupo?.nombre || ''}${cursoTexto ? ' · ' + cursoTexto : ''} · ${cursoAcademico}`;

      const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const W = doc.internal.pageSize.getWidth();
      const H = doc.internal.pageSize.getHeight();
      const MX = 10;

      const ordenados = [...conFoto].sort((a, b) => a.alumno.apellidos.localeCompare(b.alumno.apellidos));
      const n = ordenados.length;

      let cols: number;
      if (n <= 4) cols = 2;
      else if (n <= 12) cols = 4;
      else cols = 5;

      const top = 40;
      const bottom = 12;
      const gapX = 4;
      const gapY = 5;
      const labelH = 8;

      const rows = Math.ceil(n / cols);
      const cellW = (W - MX * 2 - gapX * (cols - 1)) / cols;

      const availH = H - top - bottom;
      const fotoIdeal = cellW * 4 / 3;
      const fotoMax = (availH - rows * labelH - (rows - 1) * gapY) / rows;
      const fotoH = Math.max(20, Math.min(fotoIdeal, fotoMax));
      const cellH = fotoH + labelH;

      const pintarEncabezado = (compacto: boolean) => {
        if (compacto) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(12);
          doc.setTextColor(21, 101, 192);
          doc.text(`${tituloCiclo} · ${subtitulo}`, W / 2, 14, { align: 'center', maxWidth: W - MX * 2 });
          doc.setDrawColor(21, 101, 192);
          doc.setLineWidth(0.6);
          doc.line(MX, 18, W - MX, 18);
        } else {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(20);
          doc.setTextColor(21, 101, 192);
          doc.text(tituloCiclo, W / 2, 20, { align: 'center', maxWidth: W - MX * 2 });
          doc.setFontSize(14);
          doc.setTextColor(60, 60, 60);
          doc.text(subtitulo, W / 2, 30, { align: 'center' });
          doc.setDrawColor(21, 101, 192);
          doc.setLineWidth(0.8);
          doc.line(MX, 35, W - MX, 35);
        }
      };

      pintarEncabezado(false);

      let x = MX;
      let y = top;

      for (let i = 0; i < n; i++) {
        const f = ordenados[i];

        if (y + cellH > H - bottom + 0.5) {
          doc.addPage();
          pintarEncabezado(true);
          y = 26;
          x = MX;
        }

        doc.setDrawColor(200, 200, 200);
        doc.setLineWidth(0.3);
        doc.roundedRect(x, y, cellW, fotoH, 1.5, 1.5, 'S');

        try {
          const fmt = (f.fotoDataUrl || '').includes('image/png') ? 'PNG' : 'JPEG';
          doc.addImage(f.fotoDataUrl!, fmt, x + 1, y + 1, cellW - 2, fotoH - 2);
        } catch { /* imagen no válida */ }

        doc.setTextColor(40, 40, 40);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text(f.alumno.apellidos, x + cellW / 2, y + fotoH + 3.5, { align: 'center', maxWidth: cellW });
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text(f.alumno.nombre, x + cellW / 2, y + fotoH + 7, { align: 'center', maxWidth: cellW });

        x += cellW + gapX;
        if ((i + 1) % cols === 0) { x = MX; y += cellH + gapY; }
      }

      const total = (doc as any).internal.getNumberOfPages();
      for (let p = 1; p <= total; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text('Cuaderno Digital FP · Euskadi', MX, H - 7);
        doc.text(new Date().toLocaleDateString('es-ES'), W - MX, H - 7, { align: 'right' });
        doc.setTextColor(0);
      }

      const nombreArchivo = `Orla_${grupo?.nombre || 'grupo'}`.replace(/[,\s]+/g, '_');
      doc.save(`${nombreArchivo}.pdf`);

      // Registrar/actualizar la orla del grupo (para la pantalla "Orlas")
      const user = this.auth.currentUser;
      try {
        await this.orlasService.upsert({
          grupoId: this.grupoSel,
          grupoNombre: grupo?.nombre || '',
          cicloNombre: tituloCiclo,
          cursoTexto: cursoTexto,
          totalAlumnos: this.fotos.length,
          conFoto: this.alumnosConFoto(),
          centroId: user?.centroId || '',
          cursoAcademico: '2025-2026',
          generadaEn: new Date()
        });
        // Refrescar el panel de orla guardada en pantalla
        this.orlaGuardada = await this.orlasService.getByGrupo(this.grupoSel);
      } catch (e) { console.error('No se pudo registrar la orla:', e); }

      this.snackBar.open(this.t.instant('orla.generated'), 'OK', { duration: 3000 });
    } catch (e: any) {
      console.error('Error generando orla:', e);
      this.snackBar.open(this.t.instant('orla.error', { msg: e.message }), 'Cerrar', { duration: 5000 });
    } finally {
      this.generando = false;
    }
  }

  private cursoOrdinal(curso?: number): string {
    if (curso === 1) return 'Primer Curso';
    if (curso === 2) return 'Segundo Curso';
    return curso ? `${curso}º Curso` : '';
  }
}