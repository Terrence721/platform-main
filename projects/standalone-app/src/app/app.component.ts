import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'ngrx-root',
  imports: [MatToolbarModule, RouterOutlet],
  template: `
    <mat-toolbar>
      <h1>Bookshelf</h1>
    </mat-toolbar>

    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    h1 {
      margin: 0;
      font: inherit;
    }

    main {
      padding: 16px;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
