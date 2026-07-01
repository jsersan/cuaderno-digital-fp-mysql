import { Pipe, PipeTransform, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

/**
 * Traduce los valores del enum TipoEvaluacion (que se guardan en español en la
 * base de datos: "1ª Evaluación", "2ª Evaluación", "1ª Evaluación Final",
 * "2ª Evaluación Final") a su versión en el idioma activo, sin tocar los datos.
 *
 * Uso en plantilla:  {{ examen.evaluacion | evalLabel }}
 */
@Pipe({ name: 'evalLabel', standalone: true, pure: false })
export class EvalLabelPipe implements PipeTransform {
  private t = inject(TranslateService);

  private static readonly MAP: { [valor: string]: string } = {
    '1ª Evaluación': 'evaluations.eval1',
    '2ª Evaluación': 'evaluations.eval2',
    '1ª Evaluación Final': 'evaluations.eval1final',
    '2ª Evaluación Final': 'evaluations.eval2final'
  };

  transform(valor: string | null | undefined): string {
    if (!valor) return '';
    const clave = EvalLabelPipe.MAP[valor];
    if (!clave) return valor;                 // valor desconocido: se muestra tal cual
    const traducido = this.t.instant(clave);
    return traducido === clave ? valor : traducido; // si falta la clave, fallback al original
  }
}
