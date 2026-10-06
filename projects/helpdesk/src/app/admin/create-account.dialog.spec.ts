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
import { MatSelectHarness } from '@angular/material/select/testing';
import type { UserAccount } from '@helpdesk/contract';
import {
  CreateAccountData,
  CreateAccountDialog,
} from './create-account.dialog';
import { NEVER } from 'rxjs';
import { LiveUpdates } from '../live/live-updates';
import { TEAM_ACCOUNTS_API, TeamAccountsStore } from './team-accounts.store';

const DATA: CreateAccountData = {
  teams: [
    { id: 'atlas', name: 'Team Atlas', leadName: 'Chris Taylor' },
    { id: 'echo', name: 'Team Echo', leadName: null },
  ],
};

const nia: UserAccount = {
  id: 'nia.new',
  name: 'Nia New',
  role: 'agent',
  team: { id: 'atlas', name: 'Team Atlas' },
  leadsTeam: false,
  active: true,
};

describe('CreateAccountDialog', () => {
  const dialogRef = { close: vi.fn() };

  afterEach(() => TestBed.inject(HttpTestingController).verify());

  async function render() {
    dialogRef.close.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        // The page's store, which the popup creates through.
        TeamAccountsStore,
        { provide: MAT_DIALOG_DATA, useValue: DATA },
        { provide: MatDialogRef, useValue: dialogRef },
        // Live updates are the store's spec's concern: none here.
        { provide: LiveUpdates, useValue: { updates: NEVER } },
      ],
    });
    const http = TestBed.inject(HttpTestingController);
    TestBed.inject(TeamAccountsStore);
    // The page has its accounts already.
    http.expectOne({ method: 'GET', url: TEAM_ACCOUNTS_API }).flush([]);

    const fixture = TestBed.createComponent(CreateAccountDialog);
    fixture.detectChanges();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const dialog = fixture.nativeElement as HTMLElement;
    const field = (label: string) =>
      loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
    const input = async (label: string) => {
      const control = await (await field(label)).getControl(MatInputHarness);
      if (!control) {
        throw new Error(`No input in the "${label}" field`);
      }
      return control;
    };
    return {
      dialog,
      http,
      fixture,
      text: (selector: string) =>
        dialog
          .querySelector(selector)
          ?.textContent?.replace(/\s+/g, ' ')
          .trim(),
      fill: async (label: string, value: string) =>
        (await input(label)).setValue(value),
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
      create: async () =>
        (
          await loader.getHarness(MatButtonHarness.with({ text: 'Create' }))
        ).click(),
      createButton: () =>
        loader.getHarness(MatButtonHarness.with({ text: 'Create' })),
    };
  }

  /** Fills in a good agent on Team Atlas. */
  async function fillAgent(form: Awaited<ReturnType<typeof render>>) {
    await form.fill('User ID', 'nia.new');
    await form.fill('Name', '  Nia New  ');
    await form.choose('Team', 'Team Atlas');
    await form.fill('Starting password', 'a-starting-password');
  }

  const post = (http: HttpTestingController) =>
    http.expectOne({ method: 'POST', url: TEAM_ACCOUNTS_API });

  it('says what is missing and sends nothing when the form is empty', async () => {
    const { create, errors } = await render();

    await create();

    expect(await errors('User ID')).toEqual(['Enter a user ID.']);
    expect(await errors('Name')).toEqual(['Enter a name.']);
    expect(await errors('Team')).toEqual(['Choose a team.']);
    expect(await errors('Starting password')).toEqual([
      'Use 12 to 128 characters.',
    ]);
  });

  it('explains a bad user ID and a short password', async () => {
    const form = await render();
    await fillAgent(form);
    await form.fill('User ID', 'Nia New');
    await form.fill('Starting password', 'short');

    await form.create();

    expect(await form.errors('User ID')).toEqual([
      'Use 3 to 32 lowercase letters, digits, dots and hyphens, starting with a letter.',
    ]);
    expect(await form.errors('Starting password')).toEqual([
      'Use 12 to 128 characters.',
    ]);
  });

  it('creates an agent with the trimmed name and the team', async () => {
    const form = await render();
    await fillAgent(form);

    await form.create();

    const call = post(form.http);
    expect(call.request.body).toEqual({
      userId: 'nia.new',
      name: 'Nia New',
      role: 'agent',
      teamId: 'atlas',
      password: 'a-starting-password',
    });
    call.flush(nia, { status: 201, statusText: 'Created' });
  });

  it('asks an admin for no team, and sends none', async () => {
    const form = await render();
    await form.choose('Role', 'admin');

    expect(await form.hasField('Team')).toBe(false);
    expect(form.text('.note')).toBe('Admins belong to no team.');

    await form.fill('User ID', 'nia.new');
    await form.fill('Name', 'Nia New');
    await form.fill('Starting password', 'a-starting-password');
    await form.create();

    const call = post(form.http);
    expect(call.request.body).toEqual(
      expect.objectContaining({ role: 'admin', teamId: null })
    );
    call.flush(
      { ...nia, role: 'admin', team: null },
      { status: 201, statusText: 'Created' }
    );
  });

  it("warns that a new supervisor replaces the team's lead", async () => {
    const form = await render();

    await form.choose('Role', 'supervisor');
    await form.choose('Team', 'Team Atlas');

    expect(form.dialog.querySelector('.warning')?.getAttribute('role')).toBe(
      'status'
    );
    expect(form.text('.warning')).toBe(
      "Chris Taylor leads Team Atlas now. They'll stay on the team, but the new supervisor will lead it."
    );
  });

  it('gives no warning for a team without a lead, or for an agent', async () => {
    const form = await render();

    await form.choose('Role', 'supervisor');
    await form.choose('Team', 'Team Echo');
    expect(form.dialog.querySelector('.warning')).toBeNull();

    await form.choose('Role', 'agent');
    await form.choose('Team', 'Team Atlas');
    expect(form.dialog.querySelector('.warning')).toBeNull();
  });

  it("shows the API's refusal, and saves once at a time", async () => {
    const form = await render();
    await fillAgent(form);

    await form.create();
    expect(await (await form.createButton()).isDisabled()).toBe(true);

    post(form.http).flush(
      { message: 'That user ID is taken.' },
      { status: 409, statusText: 'Conflict' }
    );
    form.fixture.detectChanges();
    expect(form.dialog.querySelector('.error')?.getAttribute('role')).toBe(
      'alert'
    );
    expect(form.text('.error')).toBe('That user ID is taken.');
    expect(await (await form.createButton()).isDisabled()).toBe(false);
    expect(dialogRef.close).not.toHaveBeenCalled();
  });

  it('closes with the new user ID once created', async () => {
    const form = await render();
    await fillAgent(form);

    await form.create();
    post(form.http).flush(nia, { status: 201, statusText: 'Created' });
    form.fixture.detectChanges();

    expect(dialogRef.close).toHaveBeenCalledExactlyOnceWith('nia.new');
  });
});
