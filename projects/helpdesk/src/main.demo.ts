import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { appConfig } from './app/app.config';

// The in-browser demo's entry point (#942), used instead of main.ts by the
// `demo` build configuration. It starts the same app, and starts the demo's
// database in the page beside it. For now the database only reports that it
// is ready; answering the app's /api calls from it comes next.

/** Reads a file of the migrations the demo build copies into migrations/. */
async function readMigration(path: string): Promise<string> {
  const response = await fetch(new URL(`migrations/${path}`, document.baseURI));
  if (!response.ok) {
    throw new Error(`Could not load ${path} (${response.status}).`);
  }
  return response.text();
}

// Loaded on its own (dynamic import()), so PGlite and the seed are not part
// of the app's first download.
void import('./demo/demo-database')
  .then(({ startDemoDatabase }) => startDemoDatabase(readMigration))
  .then(({ summary }) =>
    console.info(
      `Demo database ready: ${summary.users} users, ${summary.tickets} ` +
        `tickets, ${summary.messages} messages.`
    )
  )
  .catch((error: unknown) =>
    console.error('The demo database could not start.', error)
  );

bootstrapApplication(AppComponent, appConfig).catch((error: unknown) =>
  console.error(error)
);
