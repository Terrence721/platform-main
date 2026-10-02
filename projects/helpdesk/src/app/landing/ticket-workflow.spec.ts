import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatChipListboxHarness } from '@angular/material/chips/testing';
import { TicketWorkflowSection } from './ticket-workflow';

describe('TicketWorkflowSection', () => {
  async function render() {
    const fixture = TestBed.createComponent(TicketWorkflowSection);
    fixture.detectChanges();
    const listbox = await TestbedHarnessEnvironment.loader(fixture).getHarness(
      MatChipListboxHarness
    );
    return { section: fixture.nativeElement as HTMLElement, listbox };
  }

  const chips = async (listbox: MatChipListboxHarness) =>
    Promise.all(
      (await listbox.getChips()).map(async (chip) => ({
        label: await chip.getText(),
        picked: await chip.isSelected(),
        reachable: await (await chip.host()).hasClass('reachable'),
      }))
    );

  const highlighted = async (listbox: MatChipListboxHarness) =>
    (await chips(listbox))
      .filter((chip) => chip.reachable)
      .map(({ label }) => label);

  it('shows the statuses in order, with New picked to begin with', async () => {
    const { listbox } = await render();

    expect((await chips(listbox)).map(({ label }) => label)).toEqual([
      'New',
      'Open',
      'Pending',
      'Resolved',
      'Closed',
    ]);
    expect(
      (await chips(listbox))
        .filter((chip) => chip.picked)
        .map(({ label }) => label)
    ).toEqual(['New']);
  });

  it('highlights where a new ticket can go, and says so', async () => {
    const { section, listbox } = await render();

    expect(await highlighted(listbox)).toEqual(['Open', 'Closed']);
    expect(section.querySelector('mat-card h3')?.textContent).toBe('New');
    expect(section.querySelector('.next')?.textContent?.trim()).toBe(
      'Can move to: Open, Closed'
    );
  });

  it('follows the status the visitor picks', async () => {
    const { section, listbox } = await render();

    await listbox.selectChips({ text: 'Resolved' });

    expect(await highlighted(listbox)).toEqual(['Open', 'Closed']);
    expect(section.querySelector('mat-card h3')?.textContent).toBe('Resolved');
    expect(section.querySelector('mat-card p')?.textContent).toBe(
      "Answered. If the customer says it isn't fixed, reopen it."
    );
  });

  it('calls Closed final, with nothing highlighted', async () => {
    const { section, listbox } = await render();

    await listbox.selectChips({ text: 'Closed' });

    expect(await highlighted(listbox)).toEqual([]);
    expect(section.querySelector('.next')?.textContent?.trim()).toBe(
      'Final: a closed ticket stays closed.'
    );
  });

  it('keeps a status picked when it is clicked again', async () => {
    const { listbox } = await render();
    const [first] = await listbox.getChips({ text: 'New' });

    await (await first.host()).click();

    expect(await first.isSelected()).toBe(true);
  });

  it('is a labelled list of options, with the arrows hidden', async () => {
    const { section } = await render();
    const arrows = [...section.querySelectorAll('.arrow')];

    expect(
      section.querySelector('mat-chip-listbox')?.getAttribute('aria-label')
    ).toBe('Ticket statuses, in order');
    expect(arrows).toHaveLength(4);
    expect(arrows.every((arrow) => arrow.getAttribute('aria-hidden'))).toBe(
      true
    );
  });

  it('announces the explanation when it changes', async () => {
    const { section } = await render();

    expect(section.querySelector('mat-card')?.getAttribute('aria-live')).toBe(
      'polite'
    );
  });
});
