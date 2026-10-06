import { describe, expect, it } from 'vitest';
import {
  type JsonReport,
  projectOf,
  renderSummary,
  share,
  summarize,
} from './test-summary';

/** A test file in the report: `durations` gives one test per entry. */
const file = (
  name: string,
  durations: number[],
  startTime = 1_000,
  endTime = 2_000
) => ({
  name,
  startTime,
  endTime,
  assertionResults: durations.map((duration) => ({
    status: 'passed',
    duration,
  })),
});

const report = (
  testResults: JsonReport['testResults'],
  failed = 0
): JsonReport => {
  const total = testResults.reduce(
    (sum, { assertionResults }) => sum + assertionResults.length,
    0
  );
  return {
    numTotalTests: total,
    numPassedTests: total - failed,
    numFailedTests: failed,
    testResults,
  };
};

describe('projectOf', () => {
  it.each([
    ['/repo/modules/store/spec/store.spec.ts', 'store'],
    ['/repo/projects/helpdesk/src/app/app.spec.ts', 'helpdesk'],
    ['C:\\repo\\modules\\signals\\spec\\state.spec.ts', 'signals'],
    ['/repo/scripts/app-launcher.spec.ts', 'other'],
  ])('puts %s under %s', (fileName, project) => {
    expect(projectOf(fileName)).toBe(project);
  });
});

describe('summarize', () => {
  it('counts files and tests per project, most tests first', () => {
    const summary = summarize(
      report([
        file('/r/modules/entity/a.spec.ts', [1]),
        file('/r/modules/store/a.spec.ts', [1, 1]),
        file('/r/modules/store/b.spec.ts', [1]),
        file('/r/scripts/x.spec.ts', [1, 1]),
      ])
    );

    expect(summary.projects).toEqual([
      { name: 'store', files: 2, tests: 3 },
      { name: 'other', files: 1, tests: 2 },
      { name: 'entity', files: 1, tests: 1 },
    ]);
    expect(summary.files).toBe(4);
    expect(summary.total).toBe(6);
  });

  it('orders projects with as many tests by name', () => {
    const summary = summarize(
      report([
        file('/r/modules/store/a.spec.ts', [1]),
        file('/r/modules/effects/a.spec.ts', [1]),
      ])
    );

    expect(summary.projects.map(({ name }) => name)).toEqual([
      'effects',
      'store',
    ]);
  });

  it('counts tests slower than 2 s as slow, and the run from first start to last end', () => {
    const summary = summarize(
      report([
        file('/r/modules/store/a.spec.ts', [2000, 2001], 1_000, 4_000),
        file('/r/modules/store/b.spec.ts', [5000], 3_000, 6_500),
      ])
    );

    expect(summary.slow).toBe(2);
    expect(summary.wallClockSeconds).toBe('5.5');
  });

  it('passes on the passed and failed counts', () => {
    const summary = summarize(
      report([file('/r/modules/store/a.spec.ts', [1, 1, 1])], 1)
    );

    expect(summary).toMatchObject({ total: 3, passed: 2, failed: 1 });
  });

  it('copes with a report with no files', () => {
    expect(summarize(report([]))).toMatchObject({
      files: 0,
      slow: 0,
      wallClockSeconds: '0.0',
      projects: [],
    });
  });
});

describe('share', () => {
  it.each([
    [0, 100, '0%'],
    [5, 0, '0%'],
    [1, 1000, '<1%'],
    [15, 1000, '2%'],
    [1570, 9167, '17%'],
    [100, 100, '100%'],
  ])('%i of %i is %s', (part, whole, expected) => {
    expect(share(part, whole)).toBe(expected);
  });
});

describe('renderSummary', () => {
  const page = renderSummary(
    summarize(
      report([
        file('/r/modules/store/a.spec.ts', [1, 1, 1, 1]),
        file('/r/modules/entity/a.spec.ts', [1]),
        file('/r/modules/entity/b.spec.ts', [1]),
      ])
    )
  );
  const rows = [...page.matchAll(/<li class="bar-row"[\s\S]*?<\/li>/g)].map(
    ([row]) => row
  );

  it('has a row per project, most tests first, each bar against the largest', () => {
    expect(rows).toHaveLength(2);
    expect(rows[0]).toContain('<span class="bar-label">store</span>');
    expect(rows[0]).toContain('width: 100.00%');
    expect(rows[1]).toContain('<span class="bar-label">entity</span>');
    expect(rows[1]).toContain('width: 50.00%');
  });

  it('gives each row its count and share, and the details on hover', () => {
    expect(rows[1]).toContain('2 <span class="bar-pct">33%</span>');
    expect(rows[1]).toContain('title="entity: 2 tests (33%) in 2 files"');
    expect(rows[0]).toContain('in 1 file"');
  });

  it('says how many tests and projects in the heading', () => {
    expect(page).toContain('<h2>6 tests across 2 projects, most first</h2>');
    expect(
      renderSummary(
        summarize(report([file('/r/modules/store/a.spec.ts', [1])]))
      )
    ).toContain('across 1 project, most first');
  });

  it('draws every bar in the one blue, with no per-project colors (#860)', () => {
    expect(page).toMatch(/--bar:\s*#2a78d6;/);
    expect(page).toMatch(/--bar:\s*#3987e5;/);
    expect(page).toContain('background: var(--bar)');
    // The donut's per-project colors, which fell back to one grey.
    expect(page).not.toMatch(/--mod-/);
    expect(rows.every((row) => !row.includes('style="background'))).toBe(true);
  });

  it('escapes a project name', () => {
    const escaped = renderSummary(
      summarize(report([file('/r/projects/<b>&co/a.spec.ts', [1])]))
    );

    expect(escaped).toContain('&lt;b&gt;&amp;co');
    expect(escaped).not.toContain('<b>&co');
  });

  it('colors Failing and Slow only when there are some', () => {
    expect(page).toContain(
      '.stat-fail .stat-value { color: var(--text-primary); }'
    );
    const failing = renderSummary(
      summarize(report([file('/r/modules/store/a.spec.ts', [3000])], 1))
    );
    expect(failing).toContain(
      '.stat-fail .stat-value { color: var(--status-critical); }'
    );
    expect(failing).toContain(
      '.stat-slow .stat-value { color: var(--status-warning); }'
    );
  });
});
