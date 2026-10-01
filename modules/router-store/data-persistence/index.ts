// The published entry point is src/public_api.ts (ng-packagr's default), which
// also exports the option and stream types; re-export it whole so the
// workspace path exposes the same API.
export * from './src/public_api';
