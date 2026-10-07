import { TestBed } from '@angular/core/testing';
import { PERMISSIONS } from '@helpdesk/contract';
import { ABILITIES, RolesTable } from './roles-table';

describe('RolesTable', () => {
  function render(): HTMLElement {
    const fixture = TestBed.createComponent(RolesTable);
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  const text = (element: Element | null | undefined) =>
    element?.textContent?.trim();

  it('has a column for what people can do, then one per role', () => {
    const headers = [...render().querySelectorAll('th')].map(text);

    expect(headers).toEqual([
      'What they can do',
      'Agent',
      'Supervisor',
      'Admin',
    ]);
  });

  it("matches each role's permissions in the contract", () => {
    const rows = [...render().querySelectorAll('tbody tr')].map((row) => [
      text(row.querySelector('td')),
      ...[...row.querySelectorAll('td.role')].map((cell) =>
        text(cell.querySelector('.cdk-visually-hidden'))
      ),
    ]);

    // As the API allows it (#1023): admins work no tickets, and only
    // agents take them.
    expect(rows).toEqual([
      ['Work tickets: reply, add notes, change status', 'Yes', 'Yes', 'No'],
      ['Take a ticket', 'Yes', 'No', 'No'],
      ["Assign or reassign within one's team", 'No', 'Yes', 'No'],
      ["Manage the team's accounts", 'No', 'No', 'Yes'],
    ]);
  });

  it('shows every permission in the contract, each in exactly one row', () => {
    const shown = ABILITIES.flatMap(({ permissions }) => permissions);

    expect([...shown].sort()).toEqual([...PERMISSIONS].sort());
  });

  it('hides the check marks and dashes from screen readers, which hear Yes or No', () => {
    const cells = [...render().querySelectorAll('td.role')];

    expect(cells).toHaveLength(12);
    for (const cell of cells) {
      expect(
        cell.querySelector('mat-icon, .no')?.getAttribute('aria-hidden')
      ).toBe('true');
      expect(text(cell.querySelector('.cdk-visually-hidden'))).toMatch(
        /^(Yes|No)$/
      );
    }
  });

  it('heads the section with an h2 the page can label it by', () => {
    const heading = render().querySelector('h2');

    expect(heading?.id).toBe('roles-title');
    expect(text(heading)).toBe('Three roles, clear limits');
  });
});
