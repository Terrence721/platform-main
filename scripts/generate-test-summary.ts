import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Must match vitest.config.mts's root-level slowTestThreshold - see the
// comment there for why the html reporter's own dashboard reads a
// different (previously-mismatched) value than each project's config.
const SLOW_TEST_THRESHOLD_MS = 2000;

// Fixed order, not sorted by count - matches the port order in todo.md
// (store phase 13, entity 26, effects 27, operators 28-29) and keeps each
// module's color stable across runs even as counts shift. Colors are the
// project's categorical slots 1-4 in their validated order (see dataviz
// skill: color-formula.md) - `node scripts/validate_palette.js
// "#2a78d6,#eb6834,#1baf7a,#eda100" --mode light` (and the dark set)
// both pass every adjacent-pair CVD/contrast gate.
const MODULE_ORDER = [
  { key: 'store', label: 'store', light: '#2a78d6', dark: '#3987e5' },
  { key: 'entity', label: 'entity', light: '#eb6834', dark: '#d95926' },
  { key: 'effects', label: 'effects', light: '#1baf7a', dark: '#199e70' },
  { key: 'operators', label: 'operators', light: '#eda100', dark: '#c98500' },
];

interface AssertionResult {
  status: string;
  duration?: number;
}

interface TestResult {
  name: string;
  startTime: number;
  endTime: number;
  assertionResults: AssertionResult[];
}

interface JsonReport {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: TestResult[];
}

const reportPath = resolve(__dirname, '../test-results/results.json');
const report: JsonReport = JSON.parse(readFileSync(reportPath, 'utf-8'));

const files = report.testResults.length;
let slow = 0;
const moduleCounts = new Map<string, { files: number; tests: number }>();
for (const file of report.testResults) {
  for (const assertion of file.assertionResults) {
    if (
      typeof assertion.duration === 'number' &&
      assertion.duration > SLOW_TEST_THRESHOLD_MS
    ) {
      slow++;
    }
  }

  const match = file.name.match(/[\\/](?:modules|projects)[\\/]([^\\/]+)[\\/]/);
  const key = match ? match[1] : 'other';
  const entry = moduleCounts.get(key) ?? { files: 0, tests: 0 };
  entry.files++;
  entry.tests += file.assertionResults.length;
  moduleCounts.set(key, entry);
}

const starts = report.testResults.map((f) => f.startTime);
const ends = report.testResults.map((f) => f.endTime);
const wallClockMs = Math.max(...ends) - Math.min(...starts);

const stats = {
  total: report.numTotalTests,
  pass: report.numPassedTests,
  fail: report.numFailedTests,
  files,
  slow,
  wallClockSeconds: (wallClockMs / 1000).toFixed(1),
};

// Known modules first (fixed order/color), then anything else found in the
// data (e.g. a newly-ported module not yet added to MODULE_ORDER above)
// folded in afterward rather than silently dropped.
const knownKeys = new Set(MODULE_ORDER.map((m) => m.key));
const modules = [
  ...MODULE_ORDER.filter((m) => moduleCounts.has(m.key)).map((m) => ({
    ...m,
    ...moduleCounts.get(m.key)!,
  })),
  ...[...moduleCounts.entries()]
    .filter(([key]) => !knownKeys.has(key))
    .map(([key, counts]) => ({
      key,
      label: key,
      light: '#898781',
      dark: '#898781',
      ...counts,
    })),
];

// --- SVG donut geometry -----------------------------------------------
// One slice per module (categorical composition of the suite) rather than
// pass/fail - with 0 failures the common case, a pass/fail ring tells the
// reader nothing but "100%". Module breakdown is the dimension that
// actually varies and carries information. Pass/fail/slow move to the
// stat row below instead: each is a status flag on tests already counted
// in some module's slice, not a disjoint category of its own, so forcing
// them into the ring would double-count (see dataviz skill:
// choosing-a-form.md - part-to-whole across genuine categories only).

const R = 70;
const CX = 90;
const CY = 90;
const GAP_DEG = modules.length > 1 ? 2.5 : 0;

function polarToCartesian(angleDeg: number) {
  const angleRad = ((angleDeg - 90) * Math.PI) / 180;
  return {
    x: CX + R * Math.cos(angleRad),
    y: CY + R * Math.sin(angleRad),
  };
}

function describeArc(startDeg: number, endDeg: number) {
  const start = polarToCartesian(endDeg);
  const end = polarToCartesian(startDeg);
  const largeArcFlag = endDeg - startDeg <= 180 ? '0' : '1';
  return `M ${start.x} ${start.y} A ${R} ${R} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
}

let cursor = 0;
const arcs: string[] = [];
for (const mod of modules) {
  const sweep = (mod.tests / stats.total) * 360;
  if (sweep > 0) {
    const start = cursor + GAP_DEG / 2;
    const end = cursor + sweep - GAP_DEG / 2;
    if (end > start) {
      arcs.push(
        `<path d="${describeArc(start, end)}" style="stroke: var(--mod-${mod.key})" class="arc" />`
      );
    }
  }
  cursor += sweep;
}

const moduleColorVars = modules
  .map(
    (m) => `--mod-${m.key}-light: ${m.light}; --mod-${m.key}-dark: ${m.dark};`
  )
  .join(' ');

const legendRows = modules
  .map((m) => {
    const pct = Math.round((m.tests / stats.total) * 100);
    return `        <div class="legend-row">
          <span class="swatch" style="background: var(--mod-${m.key})"></span>
          <span class="legend-label">${m.label}</span>
          <span class="legend-value">${m.tests.toLocaleString()} <span class="legend-pct">(${pct}%)</span></span>
        </div>`;
  })
  .join('\n');

// --- Page ---------------------------------------------------------------

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Test Summary</title>
<style>
  .viz-root {
    color-scheme: light;
    --surface-1:      #fcfcfb;
    --page-plane:      #f9f9f7;
    --text-primary:   #0b0b0b;
    --text-secondary: #52514e;
    --text-muted:     #898781;
    --border:         rgba(11,11,11,0.10);
    --status-good:    #0ca30c;
    --status-warning: #fab219;
    --status-critical:#d03b3b;
    ${modules.map((m) => `--mod-${m.key}: var(--mod-${m.key}-light);`).join(' ')}
    ${moduleColorVars}
  }
  @media (prefers-color-scheme: dark) {
    :root:where(:not([data-theme="light"])) .viz-root {
      color-scheme: dark;
      --surface-1:      #1a1a19;
      --page-plane:      #0d0d0d;
      --text-primary:   #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted:     #898781;
      --border:         rgba(255,255,255,0.10);
      --status-good:    #0ca30c;
      --status-warning: #fab219;
      --status-critical:#e66767;
      ${modules.map((m) => `--mod-${m.key}: var(--mod-${m.key}-dark);`).join(' ')}
    }
  }
  :root[data-theme="dark"] .viz-root {
    color-scheme: dark;
    --surface-1:      #1a1a19;
    --page-plane:      #0d0d0d;
    --text-primary:   #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted:     #898781;
    --border:         rgba(255,255,255,0.10);
    --status-good:    #0ca30c;
    --status-warning: #fab219;
    --status-critical:#e66767;
    ${modules.map((m) => `--mod-${m.key}: var(--mod-${m.key}-dark);`).join(' ')}
  }

  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    background: var(--page-plane);
    color: var(--text-primary);
  }
  .viz-root {
    max-width: 640px;
    margin: 48px auto;
    padding: 32px;
    background: var(--surface-1);
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  h1 {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-secondary);
    margin: 0 0 4px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  h2 {
    font-size: 13px;
    font-weight: 400;
    color: var(--text-muted);
    margin: 0 0 24px;
  }
  .donut-row {
    display: flex;
    align-items: center;
    gap: 32px;
    flex-wrap: wrap;
  }
  svg { flex: none; }
  .arc {
    fill: none;
    stroke-width: 16;
    stroke-linecap: round;
  }
  .track {
    fill: none;
    stroke: var(--border);
    stroke-width: 16;
  }
  .donut-center {
    font-size: 26px;
    font-weight: 600;
  }
  .donut-sub {
    font-size: 12px;
    fill: var(--text-muted);
  }
  .legend { display: flex; flex-direction: column; gap: 10px; }
  .legend-row { display: flex; align-items: center; gap: 8px; font-size: 14px; }
  .swatch { width: 10px; height: 10px; border-radius: 2px; flex: none; }
  .legend-label { color: var(--text-secondary); }
  .legend-value { color: var(--text-primary); font-weight: 600; margin-left: auto; padding-left: 16px; }
  .legend-pct { color: var(--text-muted); font-weight: 400; }

  .stat-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 32px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
  }
  .stat { text-align: center; }
  .stat-value { font-size: 20px; font-weight: 600; }
  .stat-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .stat-fail .stat-value { color: ${stats.fail > 0 ? 'var(--status-critical)' : 'var(--text-primary)'}; }
  .stat-slow .stat-value { color: ${stats.slow > 0 ? 'var(--status-warning)' : 'var(--text-primary)'}; }

  .back-link {
    display: inline-block;
    margin-top: 28px;
    font-size: 13px;
    color: var(--text-secondary);
  }
</style>
</head>
<body>
  <div class="viz-root">
    <h1>Test Summary</h1>
    <h2>Suite composition by module</h2>
    <div class="donut-row">
      <svg width="180" height="180" viewBox="0 0 180 180" role="img" aria-label="${stats.total.toLocaleString()} tests across ${modules.length} modules">
        <circle class="track" cx="${CX}" cy="${CY}" r="${R}" />
        ${arcs.join('\n        ')}
        <text x="${CX}" y="${CY - 4}" text-anchor="middle" class="donut-center" fill="var(--text-primary)">${stats.total.toLocaleString()}</text>
        <text x="${CX}" y="${CY + 16}" text-anchor="middle" class="donut-sub">tests</text>
      </svg>
      <div class="legend">
${legendRows}
      </div>
    </div>
    <div class="stat-row">
      <div class="stat">
        <div class="stat-value">${stats.files.toLocaleString()}</div>
        <div class="stat-label">Files</div>
      </div>
      <div class="stat stat-fail">
        <div class="stat-value">${stats.fail.toLocaleString()}</div>
        <div class="stat-label">Failing</div>
      </div>
      <div class="stat stat-slow">
        <div class="stat-value">${stats.slow.toLocaleString()}</div>
        <div class="stat-label">Slow (&gt;${SLOW_TEST_THRESHOLD_MS / 1000}s)</div>
      </div>
      <div class="stat">
        <div class="stat-value">${stats.wallClockSeconds}s</div>
        <div class="stat-label">Wall time</div>
      </div>
    </div>
    <a class="back-link" href="./index.html">&larr; Full interactive report</a>
  </div>
</body>
</html>
`;

const outPath = resolve(__dirname, '../test-results/summary.html');
writeFileSync(outPath, html);
console.log(`Summary written to ${outPath}`);
