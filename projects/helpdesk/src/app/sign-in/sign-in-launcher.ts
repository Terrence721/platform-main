import { Injectable, Injector, inject } from '@angular/core';

/**
 * Opens the sign-in popup. The popup and Material's dialog code are loaded
 * on the first click (dynamic `import()`), not with the page, so visitors
 * who never sign in never download them.
 */
@Injectable({ providedIn: 'root' })
export class SignInLauncher {
  private readonly injector = inject(Injector);
  private opening = false;

  /** Opens the popup, unless it is already open or on its way. */
  async open(): Promise<void> {
    if (this.opening) {
      return;
    }
    this.opening = true;
    try {
      const [{ MatDialog }, { SignInDialog }] = await Promise.all([
        import('@angular/material/dialog'),
        import('./sign-in-dialog'),
      ]);
      const dialog = this.injector.get(MatDialog);
      if (
        dialog.openDialogs.some(
          (ref) => ref.componentInstance instanceof SignInDialog
        )
      ) {
        return;
      }
      dialog.open(SignInDialog, {
        width: '26rem',
        maxWidth: 'calc(100vw - 2rem)',
      });
    } finally {
      this.opening = false;
    }
  }
}
