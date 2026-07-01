import { Component, inject, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LanguageService } from '@core/services';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet></router-outlet>`
})
export class AppComponent implements OnInit {
  private language = inject(LanguageService);
  title = 'Cuaderno Digital FP - Euskadi';

  ngOnInit() {
    this.language.init();
  }
}
