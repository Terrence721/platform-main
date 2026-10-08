import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { LetDirective } from '@ngrx/component';
import { CapabilitiesService } from './capabilities.service';

/**
 * The landing page's features section: what Helpdesk does, as a grid of
 * outlined cards. The capabilities live in @ngrx/data's entity cache; the
 * section asks for them when it is created and shows whatever is cached.
 * The page puts it in its `#features` band and content column.
 */
@Component({
  selector: 'hd-capabilities',
  imports: [LetDirective, MatCardModule, MatIconModule],
  template: `
    <header>
      <h2 id="capabilities-title">
        Everything a support team works with, in one place
      </h2>
      <p>
        Built for the people answering requests all day: clear deadlines, the
        most urgent work first, and the tickets nobody holds yet in plain view.
      </p>
    </header>
    <ul *ngrxLet="capabilities.entities$ as capabilities">
      @for (capability of capabilities; track capability.id) {
        <li>
          <mat-card appearance="outlined">
            <span class="icon">
              <mat-icon aria-hidden="true">{{ capability.icon }}</mat-icon>
            </span>
            <h3>{{ capability.title }}</h3>
            <p>{{ capability.summary }}</p>
          </mat-card>
        </li>
      }
    </ul>
  `,
  styles: `
    header {
      max-width: 40em;
      margin-bottom: 1.75rem;
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
      font-size: clamp(1.625rem, 3.4vw, 2.125rem);
      line-height: 1.2;
    }
    header p {
      margin: 0.625rem 0 0;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }
    ul {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 1rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    mat-card {
      height: 100%;
      gap: 0.625rem;
      padding: 1.5rem;
    }
    .icon {
      display: grid;
      place-items: center;
      width: 2.75rem;
      height: 2.75rem;
      border-radius: 0.75rem;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    h3 {
      margin: 0;
      font: var(--mat-sys-title-large);
      font-size: 1.125rem;
    }
    mat-card p {
      margin: 0;
      font: var(--mat-sys-body-large);
      font-size: 0.9375rem;
      color: var(--mat-sys-on-surface-variant);
    }
    @media (max-width: 860px) {
      ul {
        grid-template-columns: minmax(0, 1fr);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CapabilitiesSection {
  protected readonly capabilities = inject(CapabilitiesService);

  constructor() {
    this.capabilities.load();
  }
}
