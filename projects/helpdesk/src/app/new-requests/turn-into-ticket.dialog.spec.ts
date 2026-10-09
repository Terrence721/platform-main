import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatSelectHarness } from '@angular/material/select/testing';
import type {
  PendingRequest,
  QueueSummary,
  TicketDto,
} from '@helpdesk/contract';
import { NEVER } from 'rxjs';
import { LiveUpdates } from '../live/live-updates';
import { Sounds } from '../sound/sounds';
import {
  NEW_REQUESTS_API,
  NewRequestsStore,
  QUEUES_API,
} from './new-requests.store';
import {
  type TurnIntoTicketData,
  TurnIntoTicketDialog,
} from './turn-into-ticket.dialog';

const QUEUES: QueueSummary[] = [
  { id: 'billing', name: 'Billing' },
  { id: 'technical', name: 'Technical support' },
];

const grace = {
  id: 'request-2',
  reference: 'R-1002',
  subject: 'Charged twice again?',
  category: 'billing',
  impact: 'slowed',
  suggestedQueueId: 'billing',
} as PendingRequest;

const ticket = { id: 'ticket-1', ticketNumber: 1061 } as TicketDto;

// Turn into ticket (#1026): a supervisor confirms the queue and priority,
// each starting on what the request suggests.
describe('TurnIntoTicketDialog', () => {
  const dialogRef = { close: vi.fn() };

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function render(request: PendingRequest = grace) {
    dialogRef.close.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // The page's store, which the popup decides through.
        NewRequestsStore,
        {
          provide: MAT_DIALOG_DATA,
          useValue: { request, queues: QUEUES } satisfies TurnIntoTicketData,
        },
        { provide: MatDialogRef, useValue: dialogRef },
        // Live updates and sounds are the store's spec's concern.
        { provide: LiveUpdates, useValue: { updates: NEVER } },
        { provide: Sounds, useValue: { play: vi.fn() } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(NewRequestsStore);
    // The page has its requests already.
    http.expectOne({ method: 'GET', url: NEW_REQUESTS_API }).flush([request]);
    http.expectOne({ method: 'GET', url: QUEUES_API }).flush(QUEUES);

    const fixture = TestBed.createComponent(TurnIntoTicketDialog);
    fixture.detectChanges();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const dialog = fixture.nativeElement as HTMLElement;
    const select = (label: string) =>
      loader.getHarness(
        MatSelectHarness.with({ selector: `[aria-label="${label}"]` })
      );
    return {
      dialog,
      fixture,
      http,
      text: (selector: string) =>
        dialog
          .querySelector(selector)
          ?.textContent?.replace(/\s+/g, ' ')
          .trim(),
      queue: () => select('Queue'),
      priority: () => select('Priority'),
      create: async () =>
        (
          await loader.getHarness(
            MatButtonHarness.with({ text: 'Create ticket' })
          )
        ).click(),
    };
  }

  it('names the request it turns into a ticket', async () => {
    const { text } = await render();

    expect(text('h2')).toBe('Turn R-1002 into a ticket');
    expect(text('.subject')).toBe('Charged twice again?');
  });

  it('starts on the queue the category suggests, and the priority the impact suggests', async () => {
    const { queue, priority } = await render();

    expect(await (await queue()).getValueText()).toBe('Billing');
    expect(await (await priority()).getValueText()).toBe('Normal');
  });

  it('offers every queue, and every priority', async () => {
    const { queue, priority } = await render();
    // Options sit in an overlay; Material's option harness builds a
    // selector jsdom rejects, so they are read from the document.
    // A closed list's panel may stay in the document, so only the last
    // one, the list just opened, is read.
    const optionsOf = async (harness: MatSelectHarness) => {
      await harness.open();
      const panel = [
        ...document.querySelectorAll('.mat-mdc-select-panel'),
      ].pop();
      return [...(panel?.querySelectorAll('mat-option') ?? [])].map((option) =>
        option.textContent?.trim()
      );
    };

    expect(await optionsOf(await queue())).toEqual([
      'Billing',
      'Technical support',
    ]);
    await (await queue()).close();
    expect(await optionsOf(await priority())).toEqual([
      'Low',
      'Normal',
      'High',
      'Urgent',
    ]);
  });

  it('asks for a queue when none is suggested, sending nothing', async () => {
    const { create, text } = await render({ ...grace, suggestedQueueId: null });

    await create();

    expect(text('mat-error')).toBe('Choose a queue.');
  });

  it('creates the ticket and closes with it', async () => {
    const { create, http, fixture } = await render();

    await create();
    const call = http.expectOne({
      method: 'POST',
      url: `${NEW_REQUESTS_API}/request-2/ticket`,
    });
    expect(call.request.body).toEqual({
      queueId: 'billing',
      priority: 'normal',
    });
    call.flush(ticket, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith(ticket);
  });

  it("shows the API's refusal as an alert, staying open", async () => {
    const { create, http, fixture, dialog } = await render();

    await create();
    http
      .expectOne(`${NEW_REQUESTS_API}/request-2/ticket`)
      .flush(
        { message: 'Someone has decided this request already.' },
        { status: 409, statusText: 'Conflict' }
      );
    // The list loads again, in case someone decided it first.
    http.expectOne(NEW_REQUESTS_API).flush([]);
    http.expectOne(QUEUES_API).flush(QUEUES);
    fixture.detectChanges();

    const alert = dialog.querySelector('.error');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent?.trim()).toBe(
      'Someone has decided this request already.'
    );
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
