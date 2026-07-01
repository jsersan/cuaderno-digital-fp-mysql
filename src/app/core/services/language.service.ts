import { Injectable, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type Idioma = 'es' | 'eu';

@Injectable({ providedIn: 'root' })
export class LanguageService {
  private translate = inject(TranslateService);
  private readonly STORAGE_KEY = 'appLang';

  idiomas: { code: Idioma; label: string; nombre: string }[] = [
    { code: 'es', label: 'ES', nombre: 'Castellano' },
    { code: 'eu', label: 'EU', nombre: 'Euskara' }
  ];

  current = signal<Idioma>('es');

  init() {
    this.translate.addLangs(['es', 'eu']);
    this.translate.setDefaultLang('es');
    const guardado = (localStorage.getItem(this.STORAGE_KEY) as Idioma) || 'es';
    this.use(guardado);
  }

  use(lang: Idioma) {
    this.translate.use(lang);
    this.current.set(lang);
    localStorage.setItem(this.STORAGE_KEY, lang);
    document.documentElement.lang = lang;
  }

  toggle() {
    this.use(this.current() === 'es' ? 'eu' : 'es');
  }
}
