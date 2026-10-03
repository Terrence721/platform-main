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
    active: true,
  },
  {
    id: 'chris.taylor',
    name: 'Chris Taylor',
    role: 'supervisor',
    team: atlas,
    active: true,
  },
  {
    id: 'dee.parted',
    name: 'Dee Parted',
    role: 'agent',
    team: atlas,
    active: false,
  },
  {
    id: 'sam.rivera',
    name: 'Sam Rivera',
    role: 'agent',
    team: atlas,
    active: true,
  },
];

describe('AccountsTable', () => {
  function render(accounts: UserAccount[] = ACCOUNTS) {
    const fixture = TestBed.createComponent(AccountsTable);
    fixture.componentRef.setInput('accounts', accounts);
    fixture.detectChanges();
    const table = fixture.nativeElement as HTMLElement;
    return {
      table,
      rows: () =>
        [...table.querySelectorAll('tr.mat-mdc-row')].map((row) =>
          [...row.querySelectorAll('td')].map((cell) =>
            cell.textContent?.trim()
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

  it('has a column for user ID, name, role and status', () => {
    expect(
      [...render().table.querySelectorAll('th')].map((cell) =>
        cell.textContent?.trim()
      )
    ).toEqual(['User ID', 'Name', 'Role', 'Status']);
  });

  it('shows the accounts in the order given', () => {
    expect(render().rows()).toEqual([
      ['benny.lind', 'Benny Lind', 'agent', 'Active'],
      ['chris.taylor', 'Chris Taylor', 'supervisor', 'Active'],
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

  it('marks inactive accounts', () => {
    expect(
      [...render().table.querySelectorAll('td.mat-column-status')].map((cell) =>
        cell.classList.contains('inactive')
      )
    ).toEqual([false, false, true, false]);
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
