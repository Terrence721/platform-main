// The test summary page (summary.html, deployed beside the full Vitest
// report): what the suite is made of and how it ran. The command that reads
// the report and writes the page is generate-test-summary.ts.

/** Tests slower than this count as slow. Must match vitest.config.mts. */
export const SLOW_TEST_THRESHOLD_MS = 2000;

/** The parts of Vitest's JSON report the summary reads. */
export interface JsonReport {
  numTotalTests: number;
  numPassedTests: number;
  numFailedTests: number;
  testResults: {
    name: string;
    startTime: number;
    endTime: number;
    assertionResults: { status: string; duration?: number }[];
  }[];
}

/** One project's share of the suite: a module, an app, or `other`. */
export interface ProjectCount {
  name: string;
  files: number;
  tests: number;
}

export interface Summary {
  total: number;
  passed: number;
  failed: number;
  files: number;
  slow: number;
  wallClockSeconds: string;
  /** Most tests first; ties by name. */
  projects: ProjectCount[];
}

/** The project a test file belongs to: its folder under modules/ or projects/. */
export function projectOf(fileName: string): string {
  const match = fileName.match(/[\\/](?:modules|projects)[\\/]([^\\/]+)[\\/]/);
  return match ? match[1] : 'other';
}

/** Counts the report: totals, slow tests, wall time, and tests per project. */
export function summarize(report: JsonReport): Summary {
  const byProject = new Map<string, ProjectCount>();
  let slow = 0;
  for (const file of report.testResults) {
    slow += file.assertionResults.filter(
      ({ duration }) =>
        typeof duration === 'number' && duration > SLOW_TEST_THRESHOLD_MS
    ).length;
    const name = projectOf(file.name);
    const project = byProject.get(name) ?? { name, files: 0, tests: 0 };
    project.files++;
    project.tests += file.assertionResults.length;
    byProject.set(name, project);
  }

  const starts = report.testResults.map((file) => file.startTime);
  const ends = report.testResults.map((file) => file.endTime);
  const wallClockMs =
    report.testResults.length > 0 ? Math.max(...ends) - Math.min(...starts) : 0;

  return {
    total: report.numTotalTests,
    passed: report.numPassedTests,
    failed: report.numFailedTests,
    files: report.testResults.length,
    slow,
    wallClockSeconds: (wallClockMs / 1000).toFixed(1),
    projects: [...byProject.values()].sort(
      (a, b) => b.tests - a.tests || a.name.localeCompare(b.name)
    ),
  };
}

/** `part` of `whole` as a whole percentage; under 1% but not 0 says so. */
export function share(part: number, whole: number): string {
  if (whole === 0 || part === 0) {
    return '0%';
  }
  const percent = (part / whole) * 100;
  return percent < 1 ? '<1%' : `${Math.round(percent)}%`;
}

const escapeHtml = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (char) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        char
      ] ?? char
  );

/**
 * The page: a bar per project, sorted, in one color, then the run's stats.
 * Bars, not a donut (#860): telling 15 projects apart by color can't work,
 * so each bar is named by its label and color only says "tests". The blue
 * is the palette's first categorical slot, validated for each mode.
 */
export function renderSummary(summary: Summary): string {
  const most = Math.max(1, ...summary.projects.map(({ tests }) => tests));
  const rows = summary.projects
    .map(({ name, files, tests }) => {
      const label = escapeHtml(name);
      const width = ((tests / most) * 100).toFixed(2);
      const percent = share(tests, summary.total);
      const fileCount = `${files.toLocaleString('en-US')} ${files === 1 ? 'file' : 'files'}`;
      return `      <li class="bar-row" title="${label}: ${tests.toLocaleString('en-US')} tests (${percent}) in ${fileCount}">
        <span class="bar-label">${label}</span>
        <span class="bar-track"><span class="bar" style="width: ${width}%"></span></span>
        <span class="bar-value">${tests.toLocaleString('en-US')} <span class="bar-pct">${percent}</span></span>
      </li>`;
    })
    .join('\n');

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Test Summary</title>
<style>
  /* On the root, so the page around the card and all text get them too. */
  :root {
    color-scheme: light;
    --surface-1:      #fcfcfb;
    --page-plane:     #f9f9f7;
    --text-primary:   #0b0b0b;
    --text-secondary: #52514e;
    --text-muted:     #898781;
    --border:         rgba(11,11,11,0.10);
    --hover:          rgba(11,11,11,0.04);
    --bar:            #2a78d6;
    --status-warning: #fab219;
    --status-critical:#d03b3b;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      color-scheme: dark;
      --surface-1:      #1a1a19;
      --page-plane:     #0d0d0d;
      --text-primary:   #ffffff;
      --text-secondary: #c3c2b7;
      --text-muted:     #898781;
      --border:         rgba(255,255,255,0.10);
      --hover:          rgba(255,255,255,0.05);
      --bar:            #3987e5;
      --status-warning: #fab219;
      --status-critical:#e66767;
    }
  }
  :root[data-theme="dark"] {
    color-scheme: dark;
    --surface-1:      #1a1a19;
    --page-plane:     #0d0d0d;
    --text-primary:   #ffffff;
    --text-secondary: #c3c2b7;
    --text-muted:     #898781;
    --border:         rgba(255,255,255,0.10);
    --hover:          rgba(255,255,255,0.05);
    --bar:            #3987e5;
    --status-warning: #fab219;
    --status-critical:#e66767;
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
  @media (max-width: 680px) {
    .viz-root { margin: 16px; padding: 20px; }
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
    margin: 0 0 20px;
  }
  .bars { list-style: none; margin: 0; padding: 0; }
  .bar-row {
    display: grid;
    grid-template-columns: minmax(7rem, auto) 1fr auto;
    align-items: center;
    gap: 12px;
    padding: 5px 6px;
    border-radius: 6px;
    font-size: 14px;
  }
  .bar-row:hover { background: var(--hover); }
  .bar-label { color: var(--text-secondary); }
  .bar-track { display: block; height: 16px; }
  /* Grows from the left; the data end is rounded, the baseline square. */
  .bar {
    display: block;
    height: 100%;
    min-width: 2px;
    background: var(--bar);
    border-radius: 0 4px 4px 0;
  }
  .bar-value {
    color: var(--text-primary);
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    text-align: right;
    min-width: 6.5rem;
  }
  .bar-pct { color: var(--text-muted); font-weight: 400; }

  .stat-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    margin-top: 28px;
    padding-top: 24px;
    border-top: 1px solid var(--border);
  }
  .stat { text-align: center; }
  .stat-value { font-size: 20px; font-weight: 600; }
  .stat-label { font-size: 12px; color: var(--text-muted); margin-top: 2px; }
  .stat-fail .stat-value { color: ${summary.failed > 0 ? 'var(--status-critical)' : 'var(--text-primary)'}; }
  .stat-slow .stat-value { color: ${summary.slow > 0 ? 'var(--status-warning)' : 'var(--text-primary)'}; }

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
    <h2>${summary.total.toLocaleString('en-US')} tests across ${summary.projects.length} ${summary.projects.length === 1 ? 'project' : 'projects'}, most first</h2>
    <ol class="bars" aria-label="Tests per project">
${rows}
    </ol>
    <div class="stat-row">
      <div class="stat">
        <div class="stat-value">${summary.files.toLocaleString('en-US')}</div>
        <div class="stat-label">Files</div>
      </div>
      <div class="stat stat-fail">
        <div class="stat-value">${summary.failed.toLocaleString('en-US')}</div>
        <div class="stat-label">Failing</div>
      </div>
      <div class="stat stat-slow">
        <div class="stat-value">${summary.slow.toLocaleString('en-US')}</div>
        <div class="stat-label">Slow (&gt;${SLOW_TEST_THRESHOLD_MS / 1000}s)</div>
      </div>
      <div class="stat">
        <div class="stat-value">${summary.wallClockSeconds}s</div>
        <div class="stat-label">Wall time</div>
      </div>
    </div>
    <a class="back-link" href="./index.html">&larr; Full interactive report</a>
  </div>
</body>
</html>
`;
}
