import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';

/**
 * The public product page: what Helpdesk does, for someone who has not
 * signed in. Its sections are separate components, added one at a time.
 */
@Component({
  selector: 'hd-landing-page',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  template: `
    <section class="hero" aria-labelledby="landing-title">
      <p class="eyebrow">Customer support, organized</p>
      <h1 id="landing-title">
        Every request answered, on time, by the right person
      </h1>
      <p class="lede">
        Helpdesk turns customer emails into tickets your team can sort into
        queues, assign, and resolve before their deadline, with every change
        showing up for everyone at once.
      </p>
      <div class="actions">
        <a matButton="filled" routerLink="/sign-in">
          <mat-icon>login</mat-icon>
          Sign in
        </a>
      </div>
    </section>
  `,
  styles: `
    .hero {
      max-width: 40rem;
      padding-block: 3rem;
    }

    .eyebrow {
      margin: 0;
      font: var(--mat-sys-label-large);
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--mat-sys-primary);
    }

    h1 {
      margin: 0.75rem 0 0;
      font: var(--mat-sys-display-medium);
      text-wrap: balance;
    }

    .lede {
      margin: 1rem 0 0;
      font: var(--mat-sys-body-large);
      color: var(--mat-sys-on-surface-variant);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-top: 1.75rem;
    }

    @media (max-width: 600px) {
      .hero {
        padding-block: 1.5rem;
      }

      h1 {
        font: var(--mat-sys-display-small);
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LandingPage {}
