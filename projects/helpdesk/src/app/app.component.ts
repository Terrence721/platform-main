import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatToolbarModule } from '@angular/material/toolbar';
import { RouterLink, RouterOutlet } from '@angular/router';
import { LetDirective } from '@ngrx/component';
import { Store } from '@ngrx/store';
import { PAGE_SECTIONS, selectCurrentSection } from './router.selectors';
import { ToolbarActions } from './session/session.actions';
import { sessionFeature } from './session/session.feature';
import { SignInLauncher } from './sign-in/sign-in-launcher';
import { Sounds } from './sound/sounds';

/**
 * The app shell: the toolbar and the routed page below it. Pages lay out
 * their own content, so the shell adds no padding around them. Signed out,
 * the toolbar offers the landing page's sections and Sign in; signed in, it
 * shows who is signed in, a speaker that mutes the help desk's sounds (or
 * turns them back on), and Sign out. Until the start-up session check
 * answers, it shows neither, so a reload does not flash Sign in.
 */
@Component({
  selector: 'hd-root',
  imports: [
    LetDirective,
    MatButtonModule,
    MatIconModule,
    MatToolbarModule,
    RouterLink,
    RouterOutlet,
  ],
  template: `
    <mat-toolbar>
      <div class="bar">
        <a
          class="brand"
          [routerLink]="homePage() ?? '/'"
          aria-label="Helpdesk home"
        >
          <svg viewBox="0 0 32 32" aria-hidden="true">
            <path class="band" d="M4.5 17a11.5 11.5 0 0 1 23 0" />
            <rect x="2.5" y="14" width="7" height="11" rx="2.5" />
            <rect x="22.5" y="14" width="7" height="11" rx="2.5" />
            <path class="boom" d="M26 24.5c-1 3.5-4.5 5-9 5" />
            <rect class="mic" x="13" y="28" width="6" height="3" rx="1.5" />
          </svg>
          Helpdesk
        </a>
        @if (session().checked) {
          @if (session().user; as user) {
            <div class="account">
              <span class="who">
                {{ user.name }} · <span class="role">{{ user.role }}</span>
              </span>
              <button
                matIconButton
                type="button"
                class="sound-toggle"
                [attr.aria-label]="
                  sounds.muted() ? 'Turn sounds on' : 'Mute sounds'
                "
                [attr.aria-pressed]="sounds.muted()"
                (click)="sounds.setMuted(!sounds.muted())"
              >
                <mat-icon>{{
                  sounds.muted() ? 'volume_off' : 'volume_up'
                }}</mat-icon>
              </button>
              <button matButton="outlined" type="button" (click)="signOut()">
                <mat-icon>logout</mat-icon>
                Sign out
              </button>
            </div>
          } @else {
            <nav aria-label="Page" *ngrxLet="currentSection$ as current">
              @for (section of sections; track section.fragment) {
                <a
                  class="section-link"
                  matButton
                  routerLink="/"
                  [fragment]="section.fragment"
                  [class.current]="section.fragment === current"
                  [attr.aria-current]="
                    section.fragment === current ? 'location' : null
                  "
                >
                  {{ section.label }}
                </a>
              }
              <button matButton="filled" type="button" (click)="signIn.open()">
                <mat-icon>login</mat-icon>
                Sign in
              </button>
            </nav>
          }
        }
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

    nav {
      display: flex;
      align-items: center;
      gap: 0.25rem;
    }

    .account {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }

    .who {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .role {
      text-transform: capitalize;
    }

    .current {
      background: var(--mat-sys-secondary-container);
      --mat-button-text-label-text-color: var(--mat-sys-on-secondary-container);
    }

    /* Narrow screens keep only the logo and Sign in, as in the mockup. */
    @media (max-width: 860px) {
      .section-link {
        display: none;
      }
    }

    /* A phone keeps the logo, the sound toggle and Sign out in reach; who
       is signed in is left to their own page, which says so. */
    @media (max-width: 600px) {
      .who {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly store = inject(Store);
  protected readonly signIn = inject(SignInLauncher);
  /** The help desk's sounds, which the toolbar's speaker mutes (#941). */
  protected readonly sounds = inject(Sounds);
  protected readonly sections = PAGE_SECTIONS;
  /** The landing section the URL points at, from the router state. */
  protected readonly currentSection$ = this.store.select(selectCurrentSection);
  /** Who is signed in, and whether the start-up check has answered. */
  protected readonly session = this.store.selectSignal(
    sessionFeature.selectSessionState
  );
  /** The signed-in user's own page, where the logo leads. */
  protected readonly homePage = this.store.selectSignal(
    sessionFeature.selectHomePage
  );

  protected signOut(): void {
    this.store.dispatch(ToolbarActions.signOutClicked());
  }
}
