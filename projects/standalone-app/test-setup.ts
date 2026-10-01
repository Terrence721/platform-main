import '@angular/compiler';
import { setupTestBed } from '@analogjs/vitest-angular/setup-testbed';

// The app is zoneless (no zone.js), and so are its tests.
setupTestBed({ zoneless: true });
