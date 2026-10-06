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
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  OPEN_REPORT_STATUSES,
  TICKET_PRIORITIES,
  type TicketPriority,
} from '@helpdesk/contract';
import type { EChartsCoreOption } from 'echarts/core';
import { NgxEchartsDirective, provideEchartsCore } from 'ngx-echarts';
import { ReportsStore, slaMetPercent } from './reports.store';

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

/**
 * The Reports popup (#967): open work, overdue, SLA and reply times, for
 * a supervisor's team or (for an admin) every team, with the Unassigned
 * work. Four figures across the top, then four charts. The figures come
 * from the popup's own ReportsStore (GET /api/reports); Refresh loads the
 * latest while the charts stay up. Chart text and lines take the page's
 * theme colors, so the charts suit the light and the dark theme.
 */
@Component({
  selector: 'hd-reports-dialog',
  imports: [
    DatePipe,
    MatButtonModule,
    MatDialogModule,
    MatIconModule,
    MatProgressSpinnerModule,
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
          data: OPEN_REPORT_STATUSES.map((status) => ({
            name: status,
            value: report?.openByStatus[status] ?? 0,
          })),
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
