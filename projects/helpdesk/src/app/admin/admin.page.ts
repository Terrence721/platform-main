import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { sessionFeature } from '../session/session.feature';

/**
 * An admin's own page: everyone's Helpdesk accounts. Only admins get here
 * (the route's `canMatchRole('admin')`). The accounts come with the API's
 * users endpoint; until then the page says where they will be.
 */
@Component({
  selector: 'hd-admin-page',
  template: `
    <section class="column" aria-labelledby="admin-title">
      <p class="eyebrow">Admin</p>
      <h1 id="admin-title">Team accounts</h1>
      @if (user(); as user) {
        <p class="greeting">Signed in as {{ user.name }}</p>
      }
      <p class="placeholder">
        Everyone's Helpdesk accounts, with their roles and teams, show here.
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
export default class AdminPage {
  protected readonly user = inject(Store).selectSignal(
    sessionFeature.selectUser
  );
}
