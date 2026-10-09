import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatRadioGroupHarness } from '@angular/material/radio/testing';
import type { PendingRequest, TicketDto } from '@helpdesk/contract';
import { NEVER } from 'rxjs';
import { LiveUpdates } from '../live/live-updates';
import { Sounds } from '../sound/sounds';
import {
  type DismissRequestData,
  DismissRequestDialog,
} from './dismiss-request.dialog';
import {
  NEW_REQUESTS_API,
  NewRequestsStore,
  QUEUES_API,
} from './new-requests.store';

/** Grace again, about the double charge her open ticket #1002 is about. */
const grace = {
  id: 'request-2',
  reference: 'R-1002',
  subject: 'Charged twice again?',
  possibleDuplicates: {
    openTickets: [
      { ticketNumber: 1002, subject: 'Refund for a double charge' },
    ] as TicketDto[],
    earlierRequests: [],
  },
} as unknown as PendingRequest;

// Dismiss (#1026): why a request will not become a ticket; for a
// duplicate, the ticket it repeats.
describe('DismissRequestDialog', () => {
  const dialogRef = { close: vi.fn() };

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function render(request: PendingRequest = grace) {
    dialogRef.close.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        NewRequestsStore,
        {
          provide: MAT_DIALOG_DATA,
          useValue: { request } satisfies DismissRequestData,
        },
        { provide: MatDialogRef, useValue: dialogRef },
        { provide: LiveUpdates, useValue: { updates: NEVER } },
        { provide: Sounds, useValue: { play: vi.fn() } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(NewRequestsStore);
    http.expectOne({ method: 'GET', url: NEW_REQUESTS_API }).flush([request]);
    http.expectOne({ method: 'GET', url: QUEUES_API }).flush([]);

    const fixture = TestBed.createComponent(DismissRequestDialog);
    fixture.detectChanges();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const dialog = fixture.nativeElement as HTMLElement;
    return {
      dialog,
      fixture,
      http,
      text: (selector: string) =>
        dialog
          .querySelector(selector)
          ?.textContent?.replace(/\s+/g, ' ')
          .trim(),
      reasons: () => loader.getHarness(MatRadioGroupHarness),
      choose: async (label: string) => {
        await (
          await loader.getHarness(MatRadioGroupHarness)
        ).checkRadioButton({
          label,
        });
        fixture.detectChanges();
      },
      // By its field's label, as the other specs find inputs: jsdom rejects
      // the selector the input harness builds when given one of its own.
      ticketField: async () => {
        const field = await loader.getHarnessOrNull(
          MatFormFieldHarness.with({ floatingLabelText: 'Ticket it repeats' })
        );
        return field === null ? null : field.getControl(MatInputHarness);
      },
      dismiss: async () =>
        (
          await loader.getHarness(
            MatButtonHarness.with({ text: 'Dismiss request' })
          )
        ).click(),
      post: () =>
        http.expectOne({
          method: 'POST',
          url: `${NEW_REQUESTS_API}/request-2/dismiss`,
        }),
    };
  }

  it('names the request, and offers the three reasons', async () => {
    const { text, reasons } = await render();

    expect(text('h2')).toBe('Dismiss R-1002');
    expect(
      await Promise.all(
        (await (await reasons()).getRadioButtons()).map((radio) =>
          radio.getLabelText()
        )
      )
    ).toEqual(['Spam', 'Already reported', 'Not a support request']);
  });

  it('asks which ticket only for a duplicate', async () => {
    const { ticketField, choose } = await render();

    expect(await ticketField()).toBeNull();
    await choose('Already reported');
    expect(await ticketField()).not.toBeNull();
  });

  it('offers the possible duplicates, each filling the ticket in', async () => {
    const { dialog, choose, ticketField, fixture } = await render();
    await choose('Already reported');

    const use = dialog.querySelector<HTMLButtonElement>('.duplicates button');
    expect(use?.textContent?.replace(/\s+/g, ' ').trim()).toBe(
      'Use #1002 Refund for a double charge'
    );
    use?.click();
    fixture.detectChanges();

    expect(await (await ticketField())?.getValue()).toBe('1002');
  });

  it('dismisses as spam, with no ticket, and closes', async () => {
    const { choose, dismiss, post, fixture } = await render();
    await choose('Spam');

    await dismiss();
    const call = post();
    expect(call.request.body).toEqual({
      reason: 'spam',
      duplicateOfTicketNumber: null,
    });
    call.flush(null, { status: 204, statusText: 'No Content' });
    fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith(true);
  });

  it('dismisses a duplicate of a typed ticket, with or without its #', async () => {
    const { choose, ticketField, dismiss, post } = await render();
    await choose('Already reported');
    await (await ticketField())?.setValue('#1002');

    await dismiss();

    expect(post().request.body).toEqual({
      reason: 'duplicate',
      duplicateOfTicketNumber: 1002,
    });
  });

  it('asks for a reason, and for a duplicate its ticket, sending nothing', async () => {
    const { dismiss, text, choose } = await render();

    await dismiss();
    expect(text('.reason-error')).toBe('Choose why it is dismissed.');

    await choose('Already reported');
    await dismiss();
    expect(text('mat-error')).toBe(
      'Enter the number of the ticket it repeats.'
    );
  });

  it("shows the API's refusal as an alert, staying open", async () => {
    const { choose, dismiss, post, http, fixture, dialog } = await render();
    await choose('Spam');

    await dismiss();
    post().flush(
      { message: 'Someone has decided this request already.' },
      { status: 409, statusText: 'Conflict' }
    );
    http.expectOne(NEW_REQUESTS_API).flush([]);
    http.expectOne(QUEUES_API).flush([]);
    fixture.detectChanges();

    expect(dialog.querySelector('.error')?.getAttribute('role')).toBe('alert');
    expect(dialogRef.close).not.toHaveBeenCalled();
  });
});
