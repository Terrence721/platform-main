import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { AssignTicketData, AssignTicketDialog } from './assign-ticket.dialog';

const NOBODY = 'No other agent on your team can take it.';

const DATA: AssignTicketData = {
  ticketNumber: 1312,
  subject: 'Charged after cancelling',
  currentAssigneeId: 'sam.rivera',
  members: [
    { id: 'benny.lind', name: 'Benny Lind', openTickets: 5, overdueTickets: 3 },
    { id: 'ida.idle', name: 'Ida Idle', openTickets: 0, overdueTickets: 0 },
    { id: 'sam.rivera', name: 'Sam Rivera', openTickets: 8, overdueTickets: 1 },
  ],
};

describe('AssignTicketDialog', () => {
  const dialogRef = { close: vi.fn() };

  function render(data: AssignTicketData = DATA) {
    dialogRef.close.mockClear();
    TestBed.configureTestingModule({
      providers: [
        { provide: MAT_DIALOG_DATA, useValue: data },
        { provide: MatDialogRef, useValue: dialogRef },
      ],
    });
    const fixture = TestBed.createComponent(AssignTicketDialog);
    fixture.detectChanges();
    const dialog = fixture.nativeElement as HTMLElement;
    const loader = TestbedHarnessEnvironment.loader(fixture);
    return {
      dialog,
      text: (selector: string) =>
        dialog.querySelector(selector)?.textContent?.trim(),
      /** Each agent choice: its text, and whether it can be chosen. */
      choices: () =>
        [...dialog.querySelectorAll('mat-radio-button')].map((choice) => [
          choice.textContent?.replace(/\s+/g, ' ').trim(),
          !choice.querySelector('input')?.disabled,
        ]),
      /** Picks the agent with this name. */
      pick: (name: string) => {
        const input = [...dialog.querySelectorAll('mat-radio-button')]
          .find((choice) => choice.textContent?.includes(name))
          ?.querySelector('input');
        input?.click();
        fixture.detectChanges();
      },
      assignButton: () =>
        loader.getHarness(MatButtonHarness.with({ text: 'Assign' })),
    };
  }

  it('names the ticket and its subject', () => {
    const { text } = render();

    expect(text('h2')).toBe('Assign #1312');
    expect(text('.subject')).toBe('Charged after cancelling');
  });

  it('offers each agent with their load, the current holder not selectable', () => {
    expect(render().choices()).toEqual([
      ['Benny Lind · 5 open · 3 overdue', true],
      ['Ida Idle · 0 open · 0 overdue', true],
      ['Sam Rivera · 8 open · 1 overdue (has it now)', false],
    ]);
  });

  it('lets every agent be chosen for an unassigned ticket', () => {
    const choices = render({ ...DATA, currentAssigneeId: null }).choices();

    expect(choices.every(([, selectable]) => selectable)).toBe(true);
  });

  it('says so when no other agent on the team can take it', () => {
    const onlyTheHolder = render({
      ...DATA,
      members: DATA.members.filter(({ id }) => id === 'sam.rivera'),
    });

    expect(onlyTheHolder.text('.nobody')).toBe(NOBODY);
  });

  it('says so when the team has no agents at all', () => {
    const { text } = render({ ...DATA, currentAssigneeId: null, members: [] });

    expect(text('.nobody')).toBe(NOBODY);
  });

  it('says nothing of the kind while an agent can be chosen', () => {
    expect(render().dialog.querySelector('.nobody')).toBeNull();
  });

  it('waits for a choice before Assign can be pressed', async () => {
    const { assignButton } = render();

    expect(await (await assignButton()).isDisabled()).toBe(true);
  });

  it('closes with the chosen agent', async () => {
    const { pick, assignButton } = render();

    pick('Ida Idle');
    await (await assignButton()).click();

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith('ida.idle');
  });
});
