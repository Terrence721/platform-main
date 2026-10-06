import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Directive, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import type { ReportsResponse, TeamReport } from '@helpdesk/contract';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { ReportsDialog } from './reports.dialog';
import { REPORTS_API } from './reports.store';

/**
 * Stands in for ngx-echarts, which needs a real canvas to draw: keeps the
 * options each chart is given, which is what these tests check.
 */
// eslint-disable-next-line @angular-eslint/directive-selector -- ngx-echarts' own selector, which this stands in for
@Directive({ selector: '[echarts]' })
class FakeChart {
  readonly options = input<EChartsCoreOption>();
}

/** A row with these figures; everything else zero. */
const row = (
  teamId: string | null,
  name: string,
  figures: Partial<TeamReport> = {}
): TeamReport => ({
  teamId,
  name,
  openByPriority: { low: 0, normal: 0, high: 0, urgent: 0 },
  overdue: 0,
  finished: 0,
  finishedWithDueTime: 0,
  finishedOnTime: 0,
  medianHoursToResolve: null,
  medianHoursToFirstReply: null,
  ...figures,
});

/** Atlas and Unassigned, as the API answers Chris, Atlas's supervisor. */
const REPORT: ReportsResponse = {
  asOf: '2026-10-05T12:00:00.000Z',
  // Midday UTC, so it is 5 September in every time zone the test may run in.
  since: '2026-09-05T12:00:00.000Z',
  scope: { teamId: 'atlas' },
  openByStatus: { new: 3, open: 2, pending: 1 },
  teams: [
    row('atlas', 'Team Atlas', {
      openByPriority: { low: 1, normal: 0, high: 1, urgent: 1 },
      overdue: 1,
      finished: 3,
      finishedWithDueTime: 2,
      finishedOnTime: 1,
      medianHoursToResolve: 8,
      medianHoursToFirstReply: 2.5,
    }),
    row(null, 'Unassigned', {
      openByPriority: { low: 0, normal: 2, high: 0, urgent: 1 },
      overdue: 1,
    }),
  ],
  agents: [],
  choices: { teams: [], agents: [] },
};

describe('ReportsDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  function render() {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
      ],
    });
    TestBed.overrideComponent(ReportsDialog, {
      remove: { imports: [NgxEchartsDirective] },
      add: { imports: [FakeChart] },
    });
    const fixture = TestBed.createComponent(ReportsDialog);
    fixture.detectChanges();
    const http = TestBed.inject(HttpTestingController);
    const dialog = fixture.nativeElement as HTMLElement;
    const tidy = (element: Element | null) =>
      element?.textContent?.replace(/\s+/g, ' ').trim();
    return {
      dialog,
      http,
      /** Answers the popup's request for the figures, then renders. */
      answer: (body: ReportsResponse | null, status = 200) => {
        http
          .expectOne({ method: 'GET', url: REPORTS_API })
          .flush(body, { status, statusText: status === 200 ? 'OK' : 'Error' });
        fixture.detectChanges();
      },
      text: (selector: string) => tidy(dialog.querySelector(selector)),
      /** Each tile as "value label hint". */
      /** Each tile's lines (value, label, hint), joined by " | ". */
      tiles: () =>
        [...dialog.querySelectorAll('.tile')].map((tile) =>
          [...tile.children].map(tidy).join(' | ')
        ),
      /** Each chart's heading and the options it was given, in order. */
      charts: () =>
        fixture.debugElement.queryAll(By.css('.chart-card')).map((card) => ({
          title: tidy(card.nativeElement.querySelector('h3')),
          options: card
            .query(By.directive(FakeChart))
            .injector.get(FakeChart)
            .options() as Record<string, unknown> & {
            series: Record<string, unknown>[];
          },
        })),
      refreshButton: () =>
        dialog.querySelector<HTMLButtonElement>(
          'button[aria-label="Refresh the reports"]'
        ) as HTMLButtonElement,
      detectChanges: () => fixture.detectChanges(),
    };
  }

  it('shows a spinner while the figures load', () => {
    const { dialog, answer } = render();

    expect(
      dialog.querySelector('mat-spinner')?.getAttribute('aria-label')
    ).toBe('Loading the reports');
    expect(dialog.querySelector('.tiles')).toBeNull();

    answer(REPORT);
    expect(dialog.querySelector('mat-spinner')).toBeNull();
  });

  it('says when the figures could not be loaded, and tries again', () => {
    const { dialog, answer, http, detectChanges } = render();

    answer(null, 500);

    const message = dialog.querySelector('.message');
    expect(message?.getAttribute('role')).toBe('alert');
    expect(message?.textContent).toContain("Couldn't load the reports.");
    message?.querySelector('button')?.click();
    detectChanges();
    expect(dialog.querySelector('mat-spinner')).not.toBeNull();
    http.expectOne(REPORTS_API).flush(REPORT);
  });

  it("names the team and the window: the supervisor's team, since when", () => {
    const { text, answer } = render();
    answer(REPORT);

    expect(text('h2')).toBe('Reports');
    expect(text('.scope')).toBe(
      'Team Atlas · open work now · finished work since 5 Sep'
    );
  });

  it('says All teams for an admin', () => {
    const { text, answer } = render();

    answer({ ...REPORT, scope: 'all' });

    expect(text('.scope')).toMatch(/^All teams ·/);
  });

  it('sums the figures across every row in the tiles', () => {
    const { tiles, answer } = render();

    answer(REPORT);

    expect(tiles()).toEqual([
      '6 | Open | new, open or pending',
      '2 | Overdue | open and past due',
      '50% | SLA met | finished by the due time',
      '3 | Finished | in the last 30 days',
    ]);
  });

  it('shows a dash for SLA met when nothing with a due time was finished', () => {
    const { tiles, answer } = render();

    answer({
      ...REPORT,
      teams: REPORT.teams.map((team) => ({
        ...team,
        finishedWithDueTime: 0,
        finishedOnTime: 0,
      })),
    });

    expect(tiles()[2]).toBe('– | SLA met | finished by the due time');
  });

  it('refreshes with the figures still shown, the icon spinning meanwhile', () => {
    const { dialog, http, answer, refreshButton, detectChanges } = render();
    answer(REPORT);

    refreshButton().click();
    detectChanges();

    expect(dialog.querySelector('.tiles')).not.toBeNull();
    expect(refreshButton().disabled).toBe(true);
    expect(dialog.querySelector('mat-icon.spinning')).not.toBeNull();
    http.expectOne(REPORTS_API).flush(REPORT);
    detectChanges();
    expect(refreshButton().disabled).toBe(false);
    expect(dialog.querySelector('mat-icon.spinning')).toBeNull();
  });

  describe('charts', () => {
    it('has four, each with a heading', () => {
      const { charts, answer } = render();
      answer(REPORT);

      expect(charts().map(({ title }) => title)).toEqual([
        'Open work by status',
        'Open work by team and priority',
        'SLA met, last 30 days',
        'Median hours, last 30 days',
      ]);
    });

    it('draws open work by status as a donut', () => {
      const { charts, answer } = render();
      answer(REPORT);

      const [{ options }] = charts();
      expect(options.series[0]).toMatchObject({
        type: 'pie',
        data: [
          { name: 'new', value: 3 },
          { name: 'open', value: 2 },
          { name: 'pending', value: 1 },
        ],
      });
    });

    it('stacks open work by priority, one bar a team', () => {
      const { charts, answer } = render();
      answer(REPORT);

      const { options } = charts()[1];
      expect(options['yAxis']).toMatchObject({
        type: 'category',
        data: ['Team Atlas', 'Unassigned'],
      });
      expect(
        options.series.map(({ name, stack, data }) => [name, stack, data])
      ).toEqual([
        ['low', 'open', [1, 0]],
        ['normal', 'open', [0, 2]],
        ['high', 'open', [1, 0]],
        ['urgent', 'open', [1, 1]],
      ]);
    });

    it('gives SLA met per team out of 100, and no bar where nothing was due', () => {
      const { charts, answer } = render();
      answer(REPORT);

      const { options } = charts()[2];
      expect(options['yAxis']).toMatchObject({ max: 100 });
      expect(options.series[0]['data']).toEqual([50, '-']);
    });

    it('pairs median hours to resolve and to first reply, a gap where none', () => {
      const { charts, answer } = render();
      answer(REPORT);

      const { options } = charts()[3];
      expect(options.series.map(({ name, data }) => [name, data])).toEqual([
        ['To resolve', [8, '-']],
        ['To first reply', [2.5, '-']],
      ]);
    });

    it('describes every chart to screen readers', () => {
      const { charts, answer } = render();
      answer(REPORT);

      expect(
        charts().every(
          ({ options }) => (options['aria'] as { enabled: boolean }).enabled
        )
      ).toBe(true);
    });
  });
});
