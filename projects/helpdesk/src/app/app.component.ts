import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';

/**
 * The app shell: the toolbar and the routed page below it. Pages lay out
 * their own content, so the shell adds no padding around them.
 */
@Component({
  selector: 'hd-root',
  imports: [
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    RouterLink,
    RouterOutlet,
  ],
  template: `
    <mat-toolbar>
      <div class="bar">
        <a class="brand" routerLink="/" aria-label="Helpdesk home">
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path class="band" d="M4.5 17a11.5 11.5 0 0 1 23 0" />
            <rect x="2.5" y="14" width="7" height="11" rx="2.5" />
            <rect x="22.5" y="14" width="7" height="11" rx="2.5" />
            <path class="boom" d="M26 24.5c-1 3.5-4.5 5-9 5" />
            <rect class="mic" x="13" y="28" width="6" height="3" rx="1.5" />
          </svg>
          Helpdesk
        </a>
        <a matButton="filled" routerLink="/sign-in">
          <mat-icon>login</mat-icon>
          Sign in
        </a>
      </div>
    </mat-toolbar>

    <main>
      <router-outlet />
    </main>
  `,
  styles: `
    mat-toolbar {
      position: sticky;
      top: 0;
      z-index: 2;
      --mat-toolbar-container-background-color: var(
        --mat-sys-surface-container
      );
      border-bottom: 1px solid var(--mat-sys-outline-variant);
    }

    .bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 0.75rem;
      width: 100%;
      max-width: 70rem;
      margin-inline: auto;
    }

    .brand {
      display: flex;
      align-items: center;
      gap: 0.625rem;
      font: var(--mat-sys-title-large);
      color: var(--mat-sys-on-surface);
      text-decoration: none;
    }

    svg {
      width: 2rem;
      height: 2rem;
      fill: var(--mat-sys-primary);
    }

    .band,
    .boom {
      fill: none;
      stroke: var(--mat-sys-primary);
      stroke-linecap: round;
    }

    .band {
      stroke-width: 3;
    }

    .boom {
      stroke-width: 2;
    }

    .mic {
      fill: #42a5f5;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {}
