import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatSortHarness } from '@angular/material/sort/testing';
import type { UserAccount } from '@helpdesk/contract';
import { AccountsTable } from './accounts-table';

const atlas = { id: 'atlas', name: 'Atlas' };

/** Team Atlas, as the API sends it: by name. */
const ACCOUNTS: UserAccount[] = [
  {
    id: 'benny.lind',
    name: 'Benny Lind',
    role: 'agent',
    team: atlas,
    leadsTeam: false,
    active: true,
  },
  {
    id: 'chris.taylor',
    name: 'Chris Taylor',
    role: 'supervisor',
    team: atlas,
    leadsTeam: true,
    active: true,
  },
  {
    id: 'dee.parted',
    name: 'Dee Parted',
    role: 'agent',
    team: atlas,
    leadsTeam: false,
    active: false,
  },
  {
    id: 'sam.rivera',
    name: 'Sam Rivera',
    role: 'agent',
    team: atlas,
    leadsTeam: false,
    active: true,
  },
];

describe('AccountsTable', () => {
  function render(
    accounts: UserAccount[] = ACCOUNTS,
    signedInId: string | null = null
  ) {
    const fixture = TestBed.createComponent(AccountsTable);
    fixture.componentRef.setInput('accounts', accounts);
    fixture.componentRef.setInput('signedInId', signedInId);
    fixture.detectChanges();
    const table = fixture.nativeElement as HTMLElement;
    return {
      table,
      fixture,
      /** The Edit buttons' labels, top to bottom. */
      editLabels: () =>
        [...table.querySelectorAll('td.mat-column-edit button')].map((button) =>
          button.getAttribute('aria-label')
        ),
      /** Each row's cells but Edit, as text, with runs of spaces as one. */
      rows: () =>
        [...table.querySelectorAll('tr.mat-mdc-row')].map((row) =>
          [...row.querySelectorAll('td:not(.mat-column-edit)')].map((cell) =>
            cell.textContent?.replace(/\s+/g, ' ').trim()
          )
        ),
      /** The user IDs shown, top to bottom. */
      order: () =>
        [...table.querySelectorAll('td.mat-column-id')].map((cell) =>
          cell.textContent?.trim()
        ),
      /** Clicks the header of the column with this label. */
      clickHeader: async (label: string) => {
        const sort =
          await TestbedHarnessEnvironment.loader(fixture).getHarness(
            MatSortHarness
          );
        const [header] = await sort.getSortHeaders({ label });
        await header.click();
      },
    };
  }

  it('has a column for user ID, name, role, status and Edit', () => {
    // Edit's header is for screen readers only (cdk-visually-hidden).
    expect(
      [...render().table.querySelectorAll('th')].map((cell) =>
        cell.textContent?.trim()
      )
    ).toEqual(['User ID', 'Name', 'Role', 'Status', 'Edit']);
  });

  it('shows the accounts in the order given', () => {
    expect(render().rows()).toEqual([
      ['benny.lind', 'Benny Lind', 'agent', 'Active'],
      ['chris.taylor', 'Chris Taylor', 'supervisor · lead', 'Active'],
      ['dee.parted', 'Dee Parted', 'agent', 'Inactive'],
      ['sam.rivera', 'Sam Rivera', 'agent', 'Active'],
    ]);
  });

  it('shows each role as a pill: team leads green, members blue', () => {
    const pills = [...render().table.querySelectorAll('span.role')];

    // The colors themselves are in the styles: .supervisor green, .agent blue.
    expect(pills.map((pill) => pill.className)).toEqual([
      'role agent',
      'role supervisor',
      'role agent',
      'role agent',
    ]);
  });

  it('gives an admin their own pill (purple, in the styles)', () => {
    const admin: UserAccount = {
      id: 'alex.morgan',
      name: 'Alex Morgan',
      role: 'admin',
      team: null,
      leadsTeam: false,
      active: true,
    };

    expect(render([admin]).table.querySelector('span.role')?.className).toBe(
      'role admin'
    );
  });

  it("marks the team's lead, and not a supervisor who was replaced", () => {
    const replaced: UserAccount = {
      ...ACCOUNTS[1],
      id: 'old.lead',
      name: 'Old Lead',
      leadsTeam: false,
    };
    const pills = [
      ...render([ACCOUNTS[1], replaced]).table.querySelectorAll('span.role'),
    ].map((pill) => pill.textContent?.replace(/\s+/g, ' ').trim());

    // Shown capitalized by the styles: "Supervisor · Lead", "Supervisor".
    expect(pills).toEqual(['supervisor · lead', 'supervisor']);
  });

  it('marks inactive accounts', () => {
    expect(
      [...render().table.querySelectorAll('td.mat-column-status')].map((cell) =>
        cell.classList.contains('inactive')
      )
    ).toEqual([false, false, true, false]);
  });

  describe('Edit', () => {
    it('gives each row an Edit button named for its account', () => {
      expect(render().editLabels()).toEqual([
        'Edit Benny Lind',
        'Edit Chris Taylor',
        'Edit Dee Parted',
        'Edit Sam Rivera',
      ]);
    });

    it('says which account was clicked', () => {
      const { table, fixture } = render();
      const edited: UserAccount[] = [];
      fixture.componentInstance.edit.subscribe((account) =>
        edited.push(account)
      );

      table
        .querySelector<HTMLButtonElement>('[aria-label="Edit Sam Rivera"]')
        ?.click();

      expect(edited).toEqual([ACCOUNTS[3]]);
    });

    it("leaves out the signed-in admin's own row", () => {
      const admin: UserAccount = {
        id: 'alex.morgan',
        name: 'Alex Morgan',
        role: 'admin',
        team: null,
        leadsTeam: false,
        active: true,
      };

      expect(render([admin, ACCOUNTS[0]], 'alex.morgan').editLabels()).toEqual([
        'Edit Benny Lind',
      ]);
    });

    it('cannot be sorted by', async () => {
      const sort = await TestbedHarnessEnvironment.loader(
        render().fixture
      ).getHarness(MatSortHarness);

      expect(
        await Promise.all(
          (await sort.getSortHeaders()).map((header) => header.getLabel())
        )
      ).toEqual(['User ID', 'Name', 'Role', 'Status']);
    });
  });

  describe('sorting', () => {
    it('sorts roles in role order, then reversed: team lead first', async () => {
      const { order, clickHeader } = render();

      await clickHeader('Role');
      expect(order()).toEqual([
        'benny.lind',
        'dee.parted',
        'sam.rivera',
        'chris.taylor',
      ]);

      await clickHeader('Role');
      expect(order()[0]).toBe('chris.taylor');
    });

    it('sorts active accounts before inactive ones', async () => {
      const { order, clickHeader } = render();

      await clickHeader('Status');

      expect(order().at(-1)).toBe('dee.parted');
    });

    it('returns to the order given on the third click', async () => {
      const { order, clickHeader } = render();

      await clickHeader('Name');
      await clickHeader('Name');
      await clickHeader('Name');

      expect(order()).toEqual(ACCOUNTS.map(({ id }) => id));
    });
  });
});
