import {
  ApplicationRef,
  inject,
  Injectable,
  NgZone,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { isNgZone } from './zone-helpers';

@Injectable({
  providedIn: 'root',
  useFactory: () => {
    const zone = inject(NgZone);
    return isNgZone(zone)
      ? new NoopTickScheduler()
      : inject(ZonelessTickScheduler);
  },
})
export abstract class TickScheduler {
  abstract schedule(): void;
}

@Injectable({
  providedIn: 'root',
})
export class ZonelessTickScheduler extends TickScheduler {
  private readonly appRef = inject(ApplicationRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly isServer = isPlatformServer(this.platformId);
  private readonly scheduleFn = (callback: () => void): void => {
    if (this.isServer) {
      setTimeout(callback);
    } else {
      requestAnimationFrame(callback);
    }
  };
  private isScheduled = false;

  schedule(): void {
    if (!this.isScheduled) {
      this.isScheduled = true;
      this.scheduleFn(() => {
        // The app can be destroyed before the frame fires (a test tearing down
        // its TestBed, for one); ticking it then only logs NG0406.
        if (!this.appRef.destroyed) {
          this.appRef.tick();
        }
        this.isScheduled = false;
      });
    }
  }
}

export class NoopTickScheduler extends TickScheduler {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  schedule(): void {}
}
