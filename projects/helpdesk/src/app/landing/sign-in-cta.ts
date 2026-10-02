import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SignInLauncher } from '../sign-in/sign-in-launcher';

/**
 * The landing page's closing call to action: for the support team member
 * who has read this far, the way in. The page puts it in its `#signin`
 * band.
 */
@Component({
  selector: 'hd-sign-in-cta',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <div class="panel">
      <div>
        <h2 id="signin-title">Ready to pick up the next ticket?</h2>
        <p>Sign in with the account your admin set up for you.</p>
      </div>
      <button matButton="filled" type="button" (click)="signIn.open()">
        <mat-icon>login</mat-icon>
        Sign in
      </button>
    </div>
  `,
  styles: `
    .panel {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 1.25rem;
      padding: 2rem;
      border-radius: 1.75rem;
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }
    h2 {
      margin: 0;
      font: var(--mat-sys-headline-small);
      font-size: 1.625rem;
    }
    p {
      margin: 0.375rem 0 0;
      font: var(--mat-sys-body-large);
    }
    @media (max-width: 520px) {
      .panel {
        padding: 1.5rem;
        border-radius: 1.25rem;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignInCta {
  protected readonly signIn = inject(SignInLauncher);
}
