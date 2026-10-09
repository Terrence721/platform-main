import { HttpBackend } from '@angular/common/http';
import {
  type ApplicationRef,
  createComponent,
  mergeApplicationConfig,
} from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';
import { OPEN_EVENT_SOURCE } from './app/live/live-updates';
import type { DemoApi } from './demo/demo-api';
import { DEMO_API, DemoBackend } from './demo/demo-backend';
import { DemoBanner } from './demo/demo-banner';
import { restoreRoute } from './demo/restore-route';

// The in-browser demo's entry point (#942), used instead of main.ts by the
// `demo` build configuration. It starts the same app, and beside it the
// demo's database and API in the page; the app's requests to /api are
// answered by them instead of a server (DemoBackend).

/** Reads a file of the migrations the demo build copies into migrations/. */
async function readMigration(path: string): Promise<string> {
  const response = await fetch(new URL(`migrations/${path}`, document.baseURI));
  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status}).`);
  }
  return response.text();
}

/**
 * The demo's API, once its database is migrated and seeded. Loaded on its
 * own (dynamic import()), so PGlite, the seed and the server library's
 * services are not part of the app's first download; requests wait for it.
 */
const demoApi: Promise<DemoApi> = Promise.all([
  import('./demo/demo-database'),
  import('./demo/demo-api'),
]).then(async ([{ startDemoDatabase }, { DemoApi }]) => {
  const { database, summary } = await startDemoDatabase(readMigration);
  console.info(
    `Demo database ready: ${summary.users} users, ${summary.tickets} ` +
      `tickets, ${summary.messages} messages.`
  );
  return new DemoApi(database);
});
demoApi.catch((error: unknown) =>
  console.error('The demo could not start.', error)
);

/**
 * Adds the demo's banner along the bottom of the page, outside the app,
 * and keeps the page's end clear of it as its height changes (it wraps on
 * narrow screens).
 */
function addBanner(app: ApplicationRef): void {
  const host = document.createElement('hd-demo-banner');
  document.body.append(host);
  const banner = createComponent(DemoBanner, {
    environmentInjector: app.injector,
    hostElement: host,
  });
  app.attachView(banner.hostView);
  banner.changeDetectorRef.detectChanges();
  const bar = host.firstElementChild;
  if (bar) {
    new ResizeObserver(() => {
      document.body.style.paddingBottom = `${bar.clientHeight}px`;
    }).observe(bar);
  }
}

// After a reload on GitHub Pages, put the page back before the router
// reads the address (see restore-route.ts and 404.html).
restoreRoute();

bootstrapApplication(
  AppComponent,
  mergeApplicationConfig(appConfig, {
    // After the app's own providers, so the demo's backend is the one used.
    providers: [
      { provide: HttpBackend, useClass: DemoBackend },
      { provide: DEMO_API, useValue: demoApi },
      // No live updates (#950): no server to stream them, and in one tab
      // the pages already show their own changes.
      { provide: OPEN_EVENT_SOURCE, useValue: () => null },
    ],
  })
)
  .then(addBanner)
  .catch((error: unknown) => console.error(error));
