import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Directive, input } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MatDialogRef } from '@angular/material/dialog';
import { By } from '@angular/platform-browser';
import type {
  AgentReport,
  CurrentUser,
  ReportChoices,
  ReportsResponse,
  TeamReport,
} from '@helpdesk/contract';
import { provideMockStore } from '@ngrx/store/testing';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective } from 'ngx-echarts';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { initialSessionState } from '../session/session.feature';
import { ReportsDialog } from './reports.dialog';
import {
  INITIAL_REPORT_PICK,
  type ReportPick,
  REPORTS_API,
} from './reports.store';

const chris: CurrentUser = {
  id: 'chris.taylor',
  name: 'Chris Taylor',
  role: 'supervisor',
  teamId: 'atlas',
};

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
  requests: {
    received: 0,
    turnedIntoTickets: 0,
    dismissed: { spam: 0, duplicate: 0, 'not-support': 0 },
    waiting: 0,
    medianHoursToDecision: null,
  },
};

const alex: CurrentUser = {
  id: 'alex.morgan',
  name: 'Alex Morgan',
  role: 'admin',
  teamId: null,
};

/** What an admin may pick: Atlas (led by Chris), Comet (no lead). */
const ADMIN_CHOICES: ReportChoices = {
  teams: [
    { teamId: 'atlas', name: 'Team Atlas', leadName: 'Chris Taylor' },
    { teamId: 'comet', name: 'Team Comet', leadName: null },
  ],
  agents: [
    { agentId: 'ben.ward', name: 'Ben Ward', teamId: 'atlas' },
    { agentId: 'sam.rivera', name: 'Sam Rivera', teamId: 'atlas' },
    { agentId: 'cy.cole', name: 'Cy Cole', teamId: 'comet' },
  ],
};

/** What Chris may pick: his own team and its agents. */
const CHRIS_CHOICES: ReportChoices = {
  teams: [ADMIN_CHOICES.teams[0]],
  agents: ADMIN_CHOICES.agents.slice(0, 2),
};

/** An agent's row with these figures; everything else zero. */
const agentRow = (
  agentId: string,
  name: string,
  figures: Partial<AgentReport> = {}
): AgentReport => ({
  ...row('atlas', name),
  agentId,
  teamId: 'atlas',
  ...figures,
});

/** Atlas, with its two agents, as Chris gets it. */
const ATLAS_REPORT: ReportsResponse = {
  ...REPORT,
  agents: [
    agentRow('ben.ward', 'Ben Ward', {
      openByPriority: { low: 0, normal: 0, high: 1, urgent: 0 },
    }),
    agentRow('sam.rivera', 'Sam Rivera', {
      openByPriority: { low: 1, normal: 0, high: 0, urgent: 1 },
      overdue: 1,
      finished: 3,
      finishedWithDueTime: 2,
      finishedOnTime: 1,
      medianHoursToResolve: 8,
    }),
  ],
  choices: CHRIS_CHOICES,
};

/** Sam's own report. */
const SAM_REPORT: ReportsResponse = {
  ...REPORT,
  scope: { agentId: 'sam.rivera' },
  openByStatus: { new: 1, open: 1, pending: 0 },
  teams: [],
  agents: [
    agentRow('sam.rivera', 'Sam Rivera', {
      openByPriority: { low: 1, normal: 0, high: 0, urgent: 1 },
      overdue: 1,
      finished: 3,
      finishedWithDueTime: 3,
      finishedOnTime: 2,
      medianHoursToResolve: 8,
      medianHoursToFirstReply: 2.5,
    }),
  ],
  choices: CHRIS_CHOICES,
};

describe('ReportsDialog', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  /**
   * The popup, opened by `user` (Chris, a supervisor, unless given), on
   * `initial` when given.
   */
  function render(user: CurrentUser = chris, initial?: ReportPick) {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideMockStore({
          initialState: {
            session: { ...initialSessionState, user, checked: true },
          },
        }),
        { provide: MatDialogRef, useValue: { close: vi.fn() } },
        ...(initial
          ? [{ provide: INITIAL_REPORT_PICK, useValue: initial }]
          : []),
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
      /**
       * Opens "Report for" and reads it: each group's label and its
       * options; options outside a group come under ''. They sit in an
       * overlay, read from the document.
       */
      openMenu: async () => {
        await (
          await TestbedHarnessEnvironment.loader(fixture).getHarness(
            MatSelectHarness
          )
        ).open();
        const loose = [...document.querySelectorAll('mat-option')]
          .filter((option) => !option.closest('mat-optgroup'))
          .map(tidy);
        const groups = [...document.querySelectorAll('mat-optgroup')].map(
          (group) => [
            tidy(group.querySelector('.mat-mdc-optgroup-label')),
            [...group.querySelectorAll('mat-option')].map(tidy),
          ]
        );
        return [['', loose], ...groups];
      },
      /** Clicks the open menu's option with this text. */
      chooseOption: (text: string) => {
        const option = [
          ...document.querySelectorAll<HTMLElement>('mat-option'),
        ].find((element) => tidy(element) === text);
        if (!option) {
          throw new Error(`No "${text}" in Report for`);
        }
        option.click();
        fixture.detectChanges();
      },
      /**
       * Each of the tiles across the top: its lines (value, label, hint),
       * joined by " | ". Not the customer requests card's (#1026).
       */
      tiles: () =>
        [...dialog.querySelectorAll('.tile')]
          .filter((tile) => !tile.closest('.requests'))
          .map((tile) => [...tile.children].map(tidy).join(' | ')),
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

  it('says when a refresh failed, keeping the figures from before', () => {
    const { dialog, http, answer, refreshButton, detectChanges } = render();
    answer(REPORT);
    expect(dialog.querySelector('.refresh-failed')).toBeNull();

    refreshButton().click();
    http
      .expectOne(REPORTS_API)
      .flush(null, { status: 500, statusText: 'Server Error' });
    detectChanges();

    const note = dialog.querySelector('.refresh-failed');
    expect(note?.getAttribute('role')).toBe('status');
    expect(note?.textContent?.trim()).toBe(
      "Couldn't refresh. These are the figures from before."
    );
    expect(dialog.querySelector('.tiles')).not.toBeNull();

    // The next refresh clears it.
    refreshButton().click();
    detectChanges();
    expect(dialog.querySelector('.refresh-failed')).toBeNull();
    http.expectOne(REPORTS_API).flush(REPORT);
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

    it('labels only the statuses with open work; empty ones stay in the legend', () => {
      const { charts, answer } = render();
      answer({ ...REPORT, openByStatus: { new: 0, open: 2, pending: 0 } });

      const [{ options }] = charts();
      expect(
        (
          options.series[0]['data'] as {
            name: string;
            label: { show: boolean };
            labelLine: { show: boolean };
          }[]
        ).map(({ name, label, labelLine }) => [
          name,
          label.show,
          labelLine.show,
        ])
      ).toEqual([
        ['new', false, false],
        ['open', true, true],
        ['pending', false, false],
      ]);
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

  describe('Report for', () => {
    it('offers a supervisor their own team, then its agents', async () => {
      const { answer, openMenu } = render();
      answer(ATLAS_REPORT);

      expect(await openMenu()).toEqual([
        ['', ['My team · Team Atlas']],
        ['Agents · Team Atlas', ['Ben Ward', 'Sam Rivera']],
      ]);
    });

    it('offers an admin every team, each supervisor and team, then the agents by team', async () => {
      const { answer, openMenu } = render(alex);
      answer({ ...REPORT, scope: 'all', choices: ADMIN_CHOICES });

      expect(await openMenu()).toEqual([
        ['', ['All teams']],
        [
          'Supervisors and their teams',
          ['Chris Taylor · Team Atlas', 'No lead · Team Comet'],
        ],
        ['Agents · Team Atlas', ['Ben Ward', 'Sam Rivera']],
        ['Agents · Team Comet', ['Cy Cole']],
      ]);
    });

    it('reports on the agent chosen, keeping the menu while it loads', async () => {
      const { answer, openMenu, chooseOption, http, dialog } = render();
      answer(ATLAS_REPORT);
      await openMenu();

      chooseOption('Sam Rivera');

      expect(dialog.querySelector('mat-spinner')).not.toBeNull();
      expect(dialog.querySelector('mat-select')).not.toBeNull();
      const call = http.expectOne(
        ({ url, params }) =>
          url === REPORTS_API && params.get('agent') === 'sam.rivera'
      );
      call.flush(SAM_REPORT);
    });

    it('starts the new report at its top, wherever the last was scrolled', async () => {
      const { answer, openMenu, chooseOption, http, dialog } = render();
      answer(ATLAS_REPORT);
      const content = dialog.querySelector('mat-dialog-content') as HTMLElement;
      content.scrollTop = 400;
      expect(content.scrollTop).toBe(400);

      await openMenu();
      chooseOption('Sam Rivera');

      expect(content.scrollTop).toBe(0);
      http.expectOne(() => true).flush(SAM_REPORT);
    });

    it('reports on the team chosen (an admin picking a supervisor)', async () => {
      const { answer, openMenu, chooseOption, http } = render(alex);
      answer({ ...REPORT, scope: 'all', choices: ADMIN_CHOICES });
      await openMenu();

      chooseOption('Chris Taylor · Team Atlas');

      http
        .expectOne(
          ({ url, params }) =>
            url === REPORTS_API && params.get('team') === 'atlas'
        )
        .flush({ ...ATLAS_REPORT, choices: ADMIN_CHOICES });
    });
  });

  describe("a team's report", () => {
    it("adds two charts comparing the team's agents", () => {
      const { charts, answer } = render();
      answer(ATLAS_REPORT);

      expect(charts().map(({ title }) => title)).toEqual([
        'Open work by status',
        'Open work by team and priority',
        'SLA met, last 30 days',
        'Median hours, last 30 days',
        'Agents: open work by priority',
        'Agents: SLA met and median hours to resolve, last 30 days',
      ]);
    });

    it('stacks each agent’s open work by priority, with their overdue beside it', () => {
      const { charts, answer } = render();
      answer(ATLAS_REPORT);

      const { options } = charts()[4];
      expect(options['yAxis']).toMatchObject({
        data: ['Ben Ward', 'Sam Rivera'],
      });
      expect(options.series.map(({ name, data }) => [name, data])).toEqual([
        ['low', [0, 1]],
        ['normal', [0, 0]],
        ['high', [1, 0]],
        ['urgent', [0, 1]],
        ['overdue', [0, 1]],
      ]);
    });

    it("gives each agent's SLA met and median resolve time, a gap where none", () => {
      const { charts, answer } = render();
      answer(ATLAS_REPORT);

      const { options } = charts()[5];
      expect(options.series.map(({ name, data }) => [name, data])).toEqual([
        ['SLA met %', ['-', 50]],
        ['Median hours to resolve', ['-', 8]],
      ]);
    });
  });

  // Customer requests (#1026), as designed: one card after the charts, the
  // same whoever the report is about.
  describe('customer requests', () => {
    const busy: ReportsResponse['requests'] = {
      received: 12,
      turnedIntoTickets: 7,
      dismissed: { spam: 2, duplicate: 1, 'not-support': 0 },
      waiting: 2,
      medianHoursToDecision: 5.5,
    };
    /** The card's tiles, as the popup's own tiles are read. */
    const requestTiles = (dialog: HTMLElement) =>
      [...dialog.querySelectorAll('.requests .tile')].map((tile) =>
        [...tile.children].map((part) => part.textContent?.trim())
      );

    it('says, under its heading, that it covers every request, whoever the report is for', () => {
      const { dialog, text, answer } = render();
      answer({ ...REPORT, requests: busy });

      const card = dialog.querySelector('section.requests');
      expect(card?.getAttribute('aria-labelledby')).toBe('requests-title');
      expect(text('#requests-title')).toBe('Customer requests');
      expect(text('.requests-scope')).toBe(
        'All customer requests · last 30 days'
      );
      expect(card?.querySelector('ul')?.getAttribute('aria-label')).toBe(
        'Customer requests'
      );
    });

    it('shows what arrived, became tickets, waits, and how long a decision took', () => {
      const { dialog, answer } = render();
      answer({ ...REPORT, requests: busy });

      expect(requestTiles(dialog)).toEqual([
        ['12', 'Received', 'sent through Report an issue'],
        ['7', 'Turned into tickets', 'decided in the window'],
        ['2', 'Waiting now', 'in New requests'],
        [
          '5.5 h',
          'Median to a decision',
          'from arrival to a ticket or dismissal',
        ],
      ]);
    });

    it('counts what was dismissed, by every reason', () => {
      const { text, answer } = render();
      answer({ ...REPORT, requests: busy });

      expect(text('.dismissed')).toBe(
        'Dismissed: 3 · Spam 2 · Already reported 1 · Not a support request 0'
      );
    });

    it('shows a dash for the median when nothing was decided', () => {
      const { dialog, answer } = render();
      answer(REPORT);

      expect(requestTiles(dialog)[3][0]).toBe('–');
    });

    it("is there on an agent's report too", () => {
      const { dialog, http, detectChanges } = render(chris, {
        kind: 'agent',
        agentId: 'sam.rivera',
      });

      http
        .expectOne(({ params }) => params.get('agent') === 'sam.rivera')
        .flush({ ...SAM_REPORT, requests: busy });
      detectChanges();

      expect(requestTiles(dialog)[0]).toEqual([
        '12',
        'Received',
        'sent through Report an issue',
      ]);
    });
  });

  describe("an agent's report", () => {
    it('opens on the agent it is given, named in the title line', () => {
      const { text, http, detectChanges } = render(chris, {
        kind: 'agent',
        agentId: 'sam.rivera',
      });

      http
        .expectOne(({ params }) => params.get('agent') === 'sam.rivera')
        .flush(SAM_REPORT);
      detectChanges();

      expect(text('.scope')).toMatch(/^Sam Rivera ·/);
    });

    it('shows their own figures in three charts: status, priority, times', () => {
      const { charts, tiles, http, detectChanges } = render(chris, {
        kind: 'agent',
        agentId: 'sam.rivera',
      });
      http.expectOne(() => true).flush(SAM_REPORT);
      detectChanges();

      expect(tiles()[0]).toBe('2 | Open | new, open or pending');
      expect(tiles()[2]).toBe('66% | SLA met | finished by the due time');
      expect(charts().map(({ title }) => title)).toEqual([
        'Open work by status',
        'Open work by priority',
        'Median hours, last 30 days',
      ]);
      expect(charts()[1].options.series[0]['data']).toEqual([
        { value: 1, itemStyle: { color: '#90a4ae' } },
        { value: 0, itemStyle: { color: '#42a5f5' } },
        { value: 0, itemStyle: { color: '#ffa726' } },
        { value: 1, itemStyle: { color: '#ef5350' } },
      ]);
      expect(
        (charts()[2].options.series[0]['data'] as { value: unknown }[]).map(
          ({ value }) => value
        )
      ).toEqual([8, 2.5]);
    });
  });
});
