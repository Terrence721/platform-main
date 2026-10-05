import { HttpClient } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { Role, SignInResponse } from '@helpdesk/contract';
import { Store } from '@ngrx/store';
import { SessionApiActions } from '../app/session/session.actions';
import { DEMO_API } from './demo-backend';

/** The public password every seeded demo account signs in with. */
export const DEMO_PASSWORD = 'helpdesk-dev-only';

/** The account each "Try it as" button signs in with. */
export const DEMO_ACCOUNTS: readonly {
  role: Role;
  label: string;
  userId: string;
}[] = [
  { role: 'agent', label: 'Agent', userId: 'sam.rivera' },
  { role: 'supervisor', label: 'Supervisor', userId: 'chris.taylor' },
  { role: 'admin', label: 'Admin', userId: 'alex.morgan' },
];

/** Where the demo is up to: starting its database, ready, or failed. */
export type DemoState = 'preparing' | 'ready' | 'failed';

/**
 * The in-browser demo's banner (#942), along the bottom of the page: what
 * the demo is, "Preparing the demo…" while its database starts, then one
 * button per role that signs in as that role's demo account. It signs in
 * through the API (answered in the page) and reports it with the app's own
 * Signed In action, so the app then opens that role's page as after any
 * sign-in. Added by main.demo.ts; the app itself does not know about it.
 */
@Component({
  selector: 'hd-demo-banner',
  imports: [MatButtonModule, MatProgressSpinnerModule],
  template: `
    <aside class="banner" aria-label="About this demo">
      <p class="about">
        <strong>Live demo</strong>: it runs entirely in your browser, and any
        changes reset when you reload.
      </p>
      @switch (state()) {
        @case ('preparing') {
          <p class="status" role="status">
            <mat-spinner diameter="18" aria-hidden="true" />
            Preparing the demo…
          </p>
        }
        @case ('failed') {
          <p class="status" role="alert">
            The demo could not start in this browser. Try reloading the page.
          </p>
        }
        @default {
          <div class="try" role="group" aria-label="Try the demo as">
            <span>Try it as</span>
            @for (account of accounts; track account.role) {
              <button
                matButton="filled"
                type="button"
                [disabled]="signingIn()"
                (click)="tryAs(account.userId)"
              >
                {{ account.label }}
              </button>
            }
          </div>
          <p class="password">
            Or sign in with any user ID and the password
            <code>{{ password }}</code
            >.
          </p>
          @if (error(); as error) {
            <p class="error" role="alert">{{ error }}</p>
          }
        }
      }
    </aside>
  `,
  styles: `
    .banner {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 1000;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 0.25rem 1rem;
      padding: 0.5rem 1rem;
      background: var(--mat-sys-inverse-surface);
      color: var(--mat-sys-inverse-on-surface);
      font: var(--mat-sys-body-medium);
    }
    p {
      margin: 0;
    }
    .status,
    .try {
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .password,
    .error {
      flex-basis: 100%;
      text-align: center;
      font: var(--mat-sys-body-small);
    }
    .error {
      color: var(--mat-sys-inverse-primary);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DemoBanner {
  private readonly http = inject(HttpClient);
  private readonly store = inject(Store);

  protected readonly accounts = DEMO_ACCOUNTS;
  protected readonly password = DEMO_PASSWORD;
  /** Whether the demo has started; it starts when the page opens. */
  readonly state = signal<DemoState>('preparing');
  protected readonly signingIn = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    inject(DEMO_API).then(
      () => this.state.set('ready'),
      () => this.state.set('failed')
    );
  }

  /** Signs in as one of the demo accounts, then opens its role's page. */
  protected tryAs(userId: string): void {
    this.signingIn.set(true);
    this.error.set(null);
    this.http
      .post<SignInResponse>('/api/auth/sign-in', {
        userId,
        password: DEMO_PASSWORD,
      })
      .subscribe({
        next: ({ user }) => {
          this.signingIn.set(false);
          this.store.dispatch(SessionApiActions.signedIn({ user }));
        },
        error: () => {
          this.signingIn.set(false);
          this.error.set('That did not work. Try reloading the page.');
        },
      });
  }
}
