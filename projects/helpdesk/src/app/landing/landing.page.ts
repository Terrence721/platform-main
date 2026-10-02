import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { Store } from '@ngrx/store';
import { CapabilitiesSection } from './features';
import { LandingPageActions } from './landing.actions';
import { TicketPreview } from './ticket-preview';

/**
 * The public product page: what Helpdesk does, for someone who has not
 * signed in. Its sections are separate components, added one at a time.
 * Signing in is offered in the toolbar, which stays visible as the page
 * scrolls.
 */
@Component({
  selector: 'hd-landing-page',
  imports: [CapabilitiesSection, MatButtonModule, RouterLink, TicketPreview],
  template: `
    <section class="hero" aria-labelledby="landing-title">
      <div class="column hero-grid">
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
          <a
            class="tour"
            matButton="outlined"
            routerLink="/"
            fragment="features"
          >
            See what it does
          </a>
        </div>
        <hd-ticket-preview />
      </div>
    </section>
    <section
      class="band alt"
      id="features"
      aria-labelledby="capabilities-title"
    >
      <div class="column">
        <hd-capabilities />
      </div>
    </section>
  `,
  styles: `
    .hero {
      padding-block: 3.5rem 3rem;
    }

    /* The sections below the hero, full width; every other one tinted. */
    .band {
      padding-block: 3.5rem;
    }

    .alt {
      background: var(--mat-sys-surface-container-low);
    }

    /* The page's content column, shared with the toolbar: centered, at most
       70rem wide, with a 1rem gutter on narrow screens. */
    .column {
      max-width: 70rem;
      margin-inline: auto;
      padding-inline: 1rem;
    }

    /* The hero's text on the left, the "My tickets" card on the right. */
    .hero-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.1fr);
      gap: 3rem;
      align-items: center;
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

    .tour {
      margin-top: 1.75rem;
    }

    @media (max-width: 860px) {
      .hero-grid {
        grid-template-columns: minmax(0, 1fr);
        gap: 2rem;
      }
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
