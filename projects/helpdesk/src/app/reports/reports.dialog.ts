import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import {
  OPEN_WORK_STATUSES,
  type ReportAgentChoice,
  TICKET_PRIORITIES,
  type TicketPriority,
} from '@helpdesk/contract';
import { Store } from '@ngrx/store';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { sessionFeature } from '../session/session.feature';
import { type ReportPick, ReportsStore, slaMetPercent } from './reports.store';

/**
 * ECharts with only what these charts use (pie and bar charts, their
 * axes, tooltip, legend and screen-reader descriptions), loaded when the
 * popup first draws a chart, not with the page.
 */
async function loadEcharts() {
  const [core, charts, components, renderers] = await Promise.all([
    import('echarts/core'),
    import('echarts/charts'),
    import('echarts/components'),
    import('echarts/renderers'),
  ]);
  core.use([
    charts.PieChart,
    charts.BarChart,
    components.GridComponent,
    components.TooltipComponent,
    components.LegendComponent,
    components.AriaComponent,
    renderers.CanvasRenderer,
  ]);
  return core;
}

/** Each priority's color, calm to alarming; readable in both themes. */
const PRIORITY_COLORS: Record<TicketPriority, string> = {
  low: '#90a4ae',
  normal: '#42a5f5',
  high: '#ffa726',
  urgent: '#ef5350',
};

/** Open statuses' colors: new, open, pending. */
const STATUS_COLORS = ['#7e57c2', '#26a69a', '#ffca28'];

/** The tiles across the top: label, value and how to show it. */
interface Tile {
  label: string;
  value: string;
  hint: string;
}

/** One team's agents, as the "Report for" list groups them. */
interface AgentGroup {
  teamId: string;
  teamName: string;
  agents: ReportAgentChoice[];
}

/** A pick as the "Report for" list's value: "default", "team:…", "agent:…". */
export function pickValue(pick: ReportPick): string {
  switch (pick.kind) {
    case 'team':
      return `team:${pick.teamId}`;
    case 'agent':
      return `agent:${pick.agentId}`;
    default:
      return 'default';
  }
}

/** The pick a "Report for" value stands for. */
export function pickFrom(value: string): ReportPick {
  const [kind, id] = value.split(/:(.*)/);
  if (kind === 'team' && id) {
    return { kind: 'team', teamId: id };
  }
  if (kind === 'agent' && id) {
    return { kind: 'agent', agentId: id };
  }
  return { kind: 'default' };
}

/**
 * The Reports popup (#967, #969): open work, overdue, SLA and reply times.
 * "Report for" picks who: an admin's every team, a supervisor and their
 * team, or an agent; a supervisor's own team or one of its agents. A
 * team's report has four charts and the Unassigned work, then two
 * comparing its agents; an agent's report has their own three. The
 * figures come from the popup's own ReportsStore (GET /api/reports);
 * Refresh loads the latest while the charts stay up. Chart text and lines
 * take the page's theme colors, so the charts suit both themes.
 */
@Component({
  selector: 'hd-reports-dialog',
  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    NgxEchartsDirective,
  ],
  providers: [ReportsStore, provideEchartsCore({ echarts: loadEcharts })],
  template: `
    <div class="title-row">
      <div>
        <h2 mat-dialog-title>Reports</h2>
        @if (store.report(); as report) {
          <p class="scope">
            {{ scopeName() }} · open work now · finished work since
            {{ report.since | date: 'd MMM' }}
          </p>
        }
        @if (store.choices(); as choices) {
          <mat-form-field appearance="outline" class="report-for">
            <mat-label>Report for</mat-label>
            <mat-select
              [value]="selected()"
              (selectionChange)="choose($event.value)"
            >
              <mat-option value="default">{{ defaultLabel() }}</mat-option>
              @if (isAdmin()) {
                <mat-optgroup label="Supervisors and their teams">
                  @for (team of choices.teams; track team.teamId) {
                    <mat-option [value]="'team:' + team.teamId">
                      {{ team.leadName ?? 'No lead' }} · {{ team.name }}
                    </mat-option>
                  }
                </mat-optgroup>
              }
              @for (group of agentGroups(); track group.teamId) {
                <mat-optgroup [label]="'Agents · ' + group.teamName">
                  @for (agent of group.agents; track agent.agentId) {
                    <mat-option [value]="'agent:' + agent.agentId">{{
                      agent.name
                    }}</mat-option>
                  }
                </mat-optgroup>
              }
            </mat-select>
          </mat-form-field>
        }
      </div>
      <button
        matIconButton
        type="button"
        aria-label="Refresh the reports"
        [disabled]="store.loadState() === 'loading' || store.refreshing()"
        (click)="store.load()"
      >
        <mat-icon [class.spinning]="store.refreshing()">refresh</mat-icon>
      </button>
    </div>
    <mat-dialog-content>
      @switch (store.loadState()) {
        @case ('loading') {
          <mat-spinner diameter="40" aria-label="Loading the reports" />
        }
        @case ('failed') {
          <p class="message" role="alert">
            Couldn't load the reports.
            <button matButton type="button" (click)="store.load()">
              Try again
            </button>
          </p>
        }
        @default {
          <ul class="tiles">
            @for (tile of tiles(); track tile.label) {
              <li class="tile">
                <span class="value">{{ tile.value }}</span>
                <span class="label">{{ tile.label }}</span>
                <span class="hint">{{ tile.hint }}</span>
              </li>
            }
          </ul>
          <div class="charts">
            <section class="chart-card" aria-labelledby="by-status">
              <h3 id="by-status">Open work by status</h3>
              <div echarts class="chart" [options]="byStatus()"></div>
            </section>
            @if (isAgentReport()) {
              <section class="chart-card" aria-labelledby="by-priority">
                <h3 id="by-priority">Open work by priority</h3>
                <div echarts class="chart" [options]="byPriority()"></div>
              </section>
              <section class="chart-card" aria-labelledby="agent-times">
                <h3 id="agent-times">Median hours, last 30 days</h3>
                <div echarts class="chart" [options]="agentTimes()"></div>
              </section>
            } @else {
              <section class="chart-card" aria-labelledby="by-team">
                <h3 id="by-team">Open work by team and priority</h3>
                <div echarts class="chart" [options]="byTeam()"></div>
              </section>
              <section class="chart-card" aria-labelledby="sla">
                <h3 id="sla">SLA met, last 30 days</h3>
                <div echarts class="chart" [options]="sla()"></div>
              </section>
              <section class="chart-card" aria-labelledby="times">
                <h3 id="times">Median hours, last 30 days</h3>
                <div echarts class="chart" [options]="times()"></div>
              </section>
              @if (store.report()?.agents?.length) {
                <section class="chart-card wide" aria-labelledby="by-agent">
                  <h3 id="by-agent">Agents: open work by priority</h3>
                  <div echarts class="chart tall" [options]="byAgent()"></div>
                </section>
                <section class="chart-card wide" aria-labelledby="agent-sla">
                  <h3 id="agent-sla">
                    Agents: SLA met and median hours to resolve, last 30 days
                  </h3>
                  <div echarts class="chart tall" [options]="agentSla()"></div>
                </section>
              }
            }
          </div>
        }
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" mat-dialog-close>Close</button>
    </mat-dialog-actions>
  `,
  styles: `
    .title-row {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      padding-inline-end: 1rem;
    }
    .scope {
      margin: -0.75rem 1.5rem 0;
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }
    .report-for {
      width: min(24rem, calc(100vw - 6rem));
      margin: 0.75rem 1.5rem 0;
    }
    .tiles {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 0.75rem;
      margin: 0.5rem 0 1rem;
      padding: 0;
      list-style: none;
    }
    .tile {
      display: flex;
      flex-direction: column;
      padding: 0.75rem 1rem;
      border-radius: 0.75rem;
      background: var(--mat-sys-surface-container);
    }
    .value {
      font: var(--mat-sys-headline-medium);
      color: var(--mat-sys-on-surface);
    }
    .label {
      font: var(--mat-sys-label-large);
    }
    .hint {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .charts {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 1rem;
    }
    .chart-card {
      padding: 0.75rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 0.75rem;
    }
    h3 {
      margin: 0 0 0.25rem;
      font: var(--mat-sys-title-small);
    }
    .chart {
      height: 16rem;
    }
    /* The agents' charts: the whole width, and room for ten names. */
    .wide {
      grid-column: 1 / -1;
    }
    .tall {
      height: 22rem;
    }
    .message {
      color: var(--mat-sys-on-surface-variant);
    }
    .spinning {
      animation: spin 1s linear infinite;
    }
    @keyframes spin {
      to {
        transform: rotate(360deg);
      }
    }
    /* A phone: two tiles a row, one chart a row. */
    @media (max-width: 40rem) {
      .tiles {
        grid-template-columns: repeat(2, 1fr);
      }
      .charts {
        grid-template-columns: 1fr;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportsDialog {
  protected readonly store = inject(ReportsStore);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly user = inject(Store).selectSignal(sessionFeature.selectUser);

  protected readonly isAdmin = computed(() => this.user()?.role === 'admin');

  /** Whether the report is about one agent, not a team or every team. */
  protected readonly isAgentReport = computed(
    () => this.store.pick().kind === 'agent'
  );

  /** The "Report for" list's current value. */
  protected readonly selected = computed(() => pickValue(this.store.pick()));

  /** The first choice: an admin's every team, a supervisor's own. */
  protected readonly defaultLabel = computed(() =>
    this.isAdmin()
      ? 'All teams'
      : `My team · ${this.store.choices()?.teams[0]?.name ?? ''}`
  );

  /** The agents to pick, grouped by team, the teams by name. */
  protected readonly agentGroups = computed((): AgentGroup[] => {
    const choices = this.store.choices();
    if (choices === null) {
      return [];
    }
    return choices.teams
      .map(({ teamId, name }) => ({
        teamId,
        teamName: name,
        agents: choices.agents.filter((agent) => agent.teamId === teamId),
      }))
      .filter(({ agents }) => agents.length > 0);
  });

  /** Reports on what was picked in "Report for". */
  protected choose(value: string): void {
    this.store.select(pickFrom(value));
    // A new report starts at its top, wherever the last one was scrolled.
    const content = this.host.nativeElement.querySelector('mat-dialog-content');
    if (content) {
      content.scrollTop = 0;
    }
  }

  /** "All teams", or the team or agent by name. */
  protected readonly scopeName = computed(() => {
    const report = this.store.report();
    if (report === null || report.scope === 'all') {
      return 'All teams';
    }
    const { scope } = report;
    return 'agentId' in scope
      ? (report.agents.find(({ agentId }) => agentId === scope.agentId)?.name ??
          '')
      : (report.teams.find(({ teamId }) => teamId === scope.teamId)?.name ??
          '');
  });

  protected readonly tiles = computed((): Tile[] => {
    const { open, overdue, finished, slaMetPercent } = this.store.summary();
    return [
      { label: 'Open', value: `${open}`, hint: 'new, open or pending' },
      { label: 'Overdue', value: `${overdue}`, hint: 'open and past due' },
      {
        label: 'SLA met',
        value: slaMetPercent === null ? '–' : `${slaMetPercent}%`,
        hint: 'finished by the due time',
      },
      { label: 'Finished', value: `${finished}`, hint: 'in the last 30 days' },
    ];
  });

  /** Open work by status: a donut. */
  protected readonly byStatus = computed((): EChartsCoreOption => {
    const report = this.store.report();
    return {
      ...this.base(),
      color: STATUS_COLORS,
      tooltip: { trigger: 'item' },
      legend: { bottom: 0, textStyle: { color: this.text() } },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'],
          label: { color: this.text(), formatter: '{b}: {c}' },
          data: OPEN_WORK_STATUSES.map((status) => {
            const value = report?.openByStatus[status] ?? 0;
            // No label for an empty slice: it stays in the legend only.
            return {
              name: status,
              value,
              label: { show: value > 0 },
              labelLine: { show: value > 0 },
            };
          }),
        },
      ],
    };
  });

  /** Open work by team, stacked by priority: horizontal bars. */
  protected readonly byTeam = computed((): EChartsCoreOption => {
    const teams = this.store.report()?.teams ?? [];
    return {
      ...this.base(),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, textStyle: { color: this.text() } },
      grid: { left: 8, right: 16, top: 8, bottom: 32, containLabel: true },
      xAxis: { type: 'value', ...this.axis() },
      yAxis: {
        type: 'category',
        inverse: true,
        data: teams.map(({ name }) => name),
        ...this.axis(),
      },
      series: TICKET_PRIORITIES.map((priority) => ({
        type: 'bar',
        name: priority,
        stack: 'open',
        color: PRIORITY_COLORS[priority],
        data: teams.map(({ openByPriority }) => openByPriority[priority]),
      })),
    };
  });

  /** SLA met % per team: bars out of 100; none where nothing was due. */
  protected readonly sla = computed((): EChartsCoreOption => {
    const teams = this.store.report()?.teams ?? [];
    return {
      ...this.base(),
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: unknown) => `${value}%`,
      },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: teams.map(({ name }) => name),
        ...this.axis(),
      },
      yAxis: { type: 'value', max: 100, ...this.axis() },
      series: [
        {
          type: 'bar',
          name: 'SLA met',
          color: '#66bb6a',
          label: {
            show: true,
            position: 'top',
            color: this.text(),
            formatter: '{c}%',
          },
          // '-' is ECharts' "no value": no bar for a team with nothing due.
          data: teams.map(
            (team) =>
              slaMetPercent(team.finishedOnTime, team.finishedWithDueTime) ??
              '-'
          ),
        },
      ],
    };
  });

  /** Median hours to resolve and to first reply, per team: paired bars. */
  protected readonly times = computed((): EChartsCoreOption => {
    const teams = this.store.report()?.teams ?? [];
    return {
      ...this.base(),
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: unknown) => `${value} h`,
      },
      legend: { bottom: 0, textStyle: { color: this.text() } },
      grid: { left: 8, right: 16, top: 8, bottom: 32, containLabel: true },
      xAxis: {
        type: 'category',
        data: teams.map(({ name }) => name),
        ...this.axis(),
      },
      yAxis: { type: 'value', name: 'hours', ...this.axis() },
      series: [
        {
          type: 'bar',
          name: 'To resolve',
          color: '#5c6bc0',
          data: teams.map((team) => team.medianHoursToResolve ?? '-'),
        },
        {
          type: 'bar',
          name: 'To first reply',
          color: '#29b6f6',
          data: teams.map((team) => team.medianHoursToFirstReply ?? '-'),
        },
      ],
    };
  });

  /** An agent's open work by priority: one bar each. */
  protected readonly byPriority = computed((): EChartsCoreOption => {
    const agent = this.store.report()?.agents[0];
    return {
      ...this.base(),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: { type: 'category', data: [...TICKET_PRIORITIES], ...this.axis() },
      yAxis: { type: 'value', minInterval: 1, ...this.axis() },
      series: [
        {
          type: 'bar',
          name: 'Open',
          label: { show: true, position: 'top', color: this.text() },
          data: TICKET_PRIORITIES.map((priority) => ({
            value: agent?.openByPriority[priority] ?? 0,
            itemStyle: { color: PRIORITY_COLORS[priority] },
          })),
        },
      ],
    };
  });

  /** An agent's median hours to resolve and to first reply: two bars. */
  protected readonly agentTimes = computed((): EChartsCoreOption => {
    const agent = this.store.report()?.agents[0];
    return {
      ...this.base(),
      tooltip: {
        trigger: 'axis',
        valueFormatter: (value: unknown) => `${value} h`,
      },
      grid: { left: 8, right: 16, top: 24, bottom: 8, containLabel: true },
      xAxis: {
        type: 'category',
        data: ['To resolve', 'To first reply'],
        ...this.axis(),
      },
      yAxis: { type: 'value', name: 'hours', ...this.axis() },
      series: [
        {
          type: 'bar',
          name: 'Median hours',
          label: { show: true, position: 'top', color: this.text() },
          data: [
            {
              value: agent?.medianHoursToResolve ?? '-',
              itemStyle: { color: '#5c6bc0' },
            },
            {
              value: agent?.medianHoursToFirstReply ?? '-',
              itemStyle: { color: '#29b6f6' },
            },
          ],
        },
      ],
    };
  });

  /** A team's agents' open work, stacked by priority: horizontal bars. */
  protected readonly byAgent = computed((): EChartsCoreOption => {
    const agents = this.store.report()?.agents ?? [];
    return {
      ...this.base(),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, textStyle: { color: this.text() } },
      grid: { left: 8, right: 16, top: 8, bottom: 32, containLabel: true },
      xAxis: { type: 'value', minInterval: 1, ...this.axis() },
      yAxis: {
        type: 'category',
        inverse: true,
        data: agents.map(({ name }) => name),
        ...this.axis(),
      },
      series: [
        ...TICKET_PRIORITIES.map((priority) => ({
          type: 'bar',
          name: priority,
          stack: 'open',
          color: PRIORITY_COLORS[priority],
          data: agents.map(({ openByPriority }) => openByPriority[priority]),
        })),
        {
          // How much of it is overdue, beside each bar.
          type: 'bar',
          name: 'overdue',
          color: '#b71c1c',
          barGap: '10%',
          data: agents.map(({ overdue }) => overdue),
        },
      ],
    };
  });

  /**
   * A team's agents' SLA met % (bars, left axis) and median hours to
   * resolve (bars, right axis); a gap where an agent finished nothing.
   */
  protected readonly agentSla = computed((): EChartsCoreOption => {
    const agents = this.store.report()?.agents ?? [];
    return {
      ...this.base(),
      tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
      legend: { bottom: 0, textStyle: { color: this.text() } },
      grid: { left: 8, right: 8, top: 32, bottom: 32, containLabel: true },
      xAxis: {
        type: 'category',
        data: agents.map(({ name }) => name),
        ...this.axis(),
        axisLabel: { color: this.text(), interval: 0, rotate: 30 },
      },
      yAxis: [
        { type: 'value', name: 'SLA met %', max: 100, ...this.axis() },
        {
          type: 'value',
          name: 'hours',
          ...this.axis(),
          splitLine: { show: false },
        },
      ],
      series: [
        {
          type: 'bar',
          name: 'SLA met %',
          color: '#66bb6a',
          data: agents.map(
            (agent) =>
              slaMetPercent(agent.finishedOnTime, agent.finishedWithDueTime) ??
              '-'
          ),
        },
        {
          type: 'bar',
          name: 'Median hours to resolve',
          yAxisIndex: 1,
          color: '#5c6bc0',
          data: agents.map((agent) => agent.medianHoursToResolve ?? '-'),
        },
      ],
    };
  });

  /** What every chart shares: a see-through background, a description. */
  private base(): EChartsCoreOption {
    return {
      backgroundColor: 'transparent',
      aria: { enabled: true },
      textStyle: { color: this.text() },
    };
  }

  /** Axis text and lines in the theme's colors. */
  private axis() {
    return {
      axisLabel: { color: this.text() },
      axisLine: { lineStyle: { color: this.line() } },
      splitLine: { lineStyle: { color: this.line() } },
    };
  }

  private text(): string {
    return this.themeColor('--mat-sys-on-surface-variant', '#49454f');
  }

  private line(): string {
    return this.themeColor('--mat-sys-outline-variant', '#cac4d0');
  }

  /** A theme color as the page has it now; `fallback` outside a theme. */
  private themeColor(name: string, fallback: string): string {
    const value = getComputedStyle(this.host.nativeElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  }
}
