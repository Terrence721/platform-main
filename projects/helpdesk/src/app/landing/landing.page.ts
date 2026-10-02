import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Store } from '@ngrx/store';
import { LandingPageActions } from './landing.actions';

/**
 * The public product page: what Helpdesk does, for someone who has not
 * signed in. Its sections are separate components, added one at a time.
 * Signing in is offered in the toolbar, which stays visible as the page
 * scrolls.
 */
@Component({
  selector: 'hd-landing-page',
  template: `
    <section class="hero" aria-labelledby="landing-title">
      <div class="column">
        <div class="intro">
          <p class="eyebrow">Customer support, organized</p>
          <h1 id="landing-title">
            Every request answered, on time, by the right person
          </h1>
          <p class="lede">
            Helpdesk turns customer emails into tickets your team can sort into
            queues, assign, and resolve before their deadline, with every change
            showing up for everyone at once.
          </p>
        </div>
      </div>
    </section>
  `,
  styles: `
    .hero {
      padding-block: 3.5rem 3rem;
    }

    /* The page's content column, shared with the toolbar: centered, at most
       70rem wide, with a 1rem gutter on narrow screens. */
    .column {
      max-width: 70rem;
      margin-inline: auto;
      padding-inline: 1rem;
    }

    .intro {
      max-width: 33rem;
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
      font-size: clamp(2.125rem, 5vw, 3.25rem);
      line-height: 1.12;
      text-wrap: balance;
    }

    .lede {
      margin: 1rem 0 0;
      font: var(--mat-sys-body-large);
      font-size: 1.125rem;
      color: var(--mat-sys-on-surface-variant);
    }

    @media (max-width: 600px) {
      .hero {
        padding-block: 2rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class LandingPage {
  constructor() {
    inject(Store).dispatch(LandingPageActions.opened());
  }
}
