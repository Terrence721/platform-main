import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { sessionFeature } from '../session/session.feature';

/**
 * An agent's own page: the tickets assigned to them. Only agents get here
 * (the route's `canMatchRole('agent')`). The ticket list comes with the
 * API's tickets endpoint; until then the page says where it will be.
 */
@Component({
  selector: 'hd-agent-page',
  template: `
    <section class="column" aria-labelledby="agent-title">
      <p class="eyebrow">Agent</p>
      <h1 id="agent-title">My tickets</h1>
      @if (user(); as user) {
        <p class="greeting">Signed in as {{ user.name }}</p>
      }
      <p class="placeholder">
        The tickets assigned to you, the most urgent first, show here.
      </p>
    </section>
  `,
  styles: `
    /* The same content column as the landing page and the toolbar. */
    .column {
      max-width: 70rem;
      margin-inline: auto;
      padding: 2.5rem 1rem;
    }

    .eyebrow {
      margin: 0;
      font: var(--mat-sys-label-large);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--mat-sys-primary);
    }

    h1 {
      margin: 0.5rem 0 0;
      font: var(--mat-sys-headline-large);
    }

    .greeting {
      margin: 0.5rem 0 0;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }

    .placeholder {
      margin: 2rem 0 0;
      padding: 1.5rem;
      border: 1px dashed var(--mat-sys-outline-variant);
      border-radius: 0.75rem;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AgentPage {
  protected readonly user = inject(Store).selectSignal(
    sessionFeature.selectUser
  );
}
