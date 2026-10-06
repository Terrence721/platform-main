import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { type JsonReport, renderSummary, summarize } from './test-summary';

// Writes test-results/summary.html from Vitest's JSON report (`yarn
// test:summary`, after `yarn test:report`; the pages workflow deploys it).
// What the page shows, and how, is in test-summary.ts.

const reportPath = resolve(__dirname, '../test-results/results.json');
const report: JsonReport = JSON.parse(readFileSync(reportPath, 'utf-8'));

const outPath = resolve(__dirname, '../test-results/summary.html');
writeFileSync(outPath, renderSummary(summarize(report)));
console.log(`Summary written to ${outPath}`);
