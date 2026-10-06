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
import { MatSelectHarness } from '@angular/material/select/testing';
import { MatSlideToggleHarness } from '@angular/material/slide-toggle/testing';
import {
  LAST_ADMIN_MESSAGE,
  type UpdateAccountResponse,
  type UserAccount,
} from '@helpdesk/contract';
import type { TeamChoice } from './create-account.dialog';
import { EditAccountDialog } from './edit-account.dialog';
import { NEVER } from 'rxjs';
import { LiveUpdates } from '../live/live-updates';
import { TEAM_ACCOUNTS_API, TeamAccountsStore } from './team-accounts.store';

const TEAMS: TeamChoice[] = [
  { id: 'atlas', name: 'Team Atlas', leadName: 'Chris Taylor' },
  { id: 'echo', name: 'Team Echo', leadName: null },
];

const atlas = { id: 'atlas', name: 'Team Atlas' };

/** An agent on Atlas. */
const sam: UserAccount = {
  id: 'sam.rivera',
  name: 'Sam Rivera',
  role: 'agent',
  team: atlas,
  leadsTeam: false,
  active: true,
};

/** Atlas's lead. */
const chris: UserAccount = {
  id: 'chris.taylor',
  name: 'Chris Taylor',
  role: 'supervisor',
  team: atlas,
  leadsTeam: true,
  active: true,
};

/** Another admin: on no team. */
const priya: UserAccount = {
  id: 'priya.shah',
  name: 'Priya Shah',
  role: 'admin',
  team: null,
  leadsTeam: false,
  active: true,
};

describe('EditAccountDialog', () => {
  const dialogRef = { close: vi.fn() };

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function render(account: UserAccount) {
    dialogRef.close.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // The page's store, which the popup saves through.
        TeamAccountsStore,
        { provide: MAT_DIALOG_DATA, useValue: { account, teams: TEAMS } },
        { provide: MatDialogRef, useValue: dialogRef },
        // Live updates are the store's spec's concern: none here.
        { provide: LiveUpdates, useValue: { updates: NEVER } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(TeamAccountsStore);
    // The page has its accounts already.
    http.expectOne({ method: 'GET', url: TEAM_ACCOUNTS_API }).flush([]);

    const fixture = TestBed.createComponent(EditAccountDialog);
    fixture.detectChanges();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const dialog = fixture.nativeElement as HTMLElement;
    const field = (label: string) =>
      loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
    const tidy = (element: Element | null) =>
      element?.textContent?.replace(/\s+/g, ' ').trim();
    const saveButton = () =>
      loader.getHarness(MatButtonHarness.with({ text: 'Save' }));
    return {
      dialog,
      http,
      fixture,
      text: (selector: string) => tidy(dialog.querySelector(selector)),
      /** Every warning shown, in order. */
      warnings: () =>
        [...dialog.querySelectorAll('.warning')].map((element) =>
          tidy(element)
        ),
      errors: async (label: string) => (await field(label)).getTextErrors(),
      hasField: async (label: string) =>
        (
          await loader.getAllHarnesses(
            MatFormFieldHarness.with({ floatingLabelText: label })
          )
        ).length > 0,
      /**
       * Opens the list in the field with this label and clicks an option.
       * Options sit in an overlay; Material's option harness builds a
       * selector jsdom rejects, so they are clicked from the document.
       */
      choose: async (label: string, option: string) => {
        await (await (await field(label)).getControl(MatSelectHarness))?.open();
        const element = [
          ...document.querySelectorAll<HTMLElement>('mat-option'),
        ].find((candidate) => candidate.textContent?.trim() === option);
        if (!element) {
          throw new Error(`No "${option}" in the ${label} list`);
        }
        element.click();
        fixture.detectChanges();
      },
      activeSwitch: () => loader.getHarness(MatSlideToggleHarness),
      saveButton,
      save: async () => (await saveButton()).click(),
    };
  }

  const put = (http: HttpTestingController, userId: string) =>
    http.expectOne({ method: 'PUT', url: `${TEAM_ACCOUNTS_API}/${userId}` });

  /** Answers the save, then the quiet reload that follows it. */
  function saved(
    http: HttpTestingController,
    userId: string,
    response: UpdateAccountResponse
  ) {
    put(http, userId).flush(response);
    http.expectOne({ method: 'GET', url: TEAM_ACCOUNTS_API }).flush([]);
  }

  it('shows the account as it is, with Save off until something changes', async () => {
    const form = await render(sam);

    expect(form.text('h2')).toBe('Edit Sam Rivera');
    expect(form.text('.user-id')).toBe('sam.rivera');
    expect(await (await form.activeSwitch()).isChecked()).toBe(true);
    expect(form.warnings()).toEqual([]);
    expect(await (await form.saveButton()).isDisabled()).toBe(true);

    await form.choose('Team', 'Team Echo');
    expect(await (await form.saveButton()).isDisabled()).toBe(false);

    await form.choose('Team', 'Team Atlas');
    expect(await (await form.saveButton()).isDisabled()).toBe(true);
  });

  it('deactivates an agent, warning that their open tickets go back', async () => {
    const form = await render(sam);

    await (await form.activeSwitch()).toggle();

    expect(form.warnings()).toEqual([
      'Any open tickets Sam Rivera holds will go back to Unassigned.',
    ]);
    await form.save();
    const call = put(form.http, 'sam.rivera');
    expect(call.request.body).toEqual({
      role: 'agent',
      teamId: 'atlas',
      active: false,
    });
  });

  it('warns that an agent made a supervisor on Atlas would replace its lead, and hand back their tickets', async () => {
    const form = await render(sam);

    await form.choose('Role', 'supervisor');

    // Supervisors don't work tickets, so Sam's go back to Unassigned (#1009).
    expect(form.warnings()).toEqual([
      "Chris Taylor leads Team Atlas now. They'll stay on the team, but Sam Rivera will lead it.",
      'Any open tickets Sam Rivera holds will go back to Unassigned.',
    ]);
  });

  it('gives no lead warning for a team without a lead', async () => {
    const form = await render(sam);

    await form.choose('Role', 'supervisor');
    await form.choose('Team', 'Team Echo');

    expect(form.warnings()).toEqual([
      'Any open tickets Sam Rivera holds will go back to Unassigned.',
    ]);
  });

  it('warns that a lead made an agent leaves the team with no lead', async () => {
    const form = await render(chris);

    expect(form.warnings()).toEqual([]);
    await form.choose('Role', 'agent');

    expect(form.warnings()).toEqual([
      'Team Atlas will have no lead until another supervisor joins it.',
    ]);
  });

  it('asks an admin for no team, and sends none', async () => {
    const form = await render(sam);

    await form.choose('Role', 'admin');

    expect(await form.hasField('Team')).toBe(false);
    expect(form.text('.note')).toBe('Admins belong to no team.');
    await form.save();
    expect(put(form.http, 'sam.rivera').request.body).toEqual({
      role: 'admin',
      teamId: null,
      active: true,
    });
  });

  it('asks for a team when an admin becomes an agent, sending nothing', async () => {
    const form = await render(priya);

    await form.choose('Role', 'agent');
    await form.save();

    expect(await form.errors('Team')).toEqual(['Choose a team.']);
  });

  it("shows the API's refusal, and saves once at a time", async () => {
    const form = await render(priya);
    await (await form.activeSwitch()).toggle();

    await form.save();
    expect(await (await form.saveButton()).isDisabled()).toBe(true);

    put(form.http, 'priya.shah').flush(
      { message: LAST_ADMIN_MESSAGE },
      { status: 409, statusText: 'Conflict' }
    );
    form.fixture.detectChanges();
    expect(form.dialog.querySelector('.error')?.getAttribute('role')).toBe(
      'alert'
    );
    expect(form.text('.error')).toBe(LAST_ADMIN_MESSAGE);
    expect(await (await form.saveButton()).isDisabled()).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes with true once saved', async () => {
    const form = await render(sam);
    await (await form.activeSwitch()).toggle();

    await form.save();
    saved(form.http, 'sam.rivera', {
      account: { ...sam, active: false },
      releasedTickets: 3,
    });
    form.fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith(true);
  });
});
