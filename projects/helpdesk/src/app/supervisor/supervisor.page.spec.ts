import { TestBed } from '@angular/core/testing';
import { CurrentUser } from '@helpdesk/contract';
import { provideMockStore } from '@ngrx/store/testing';
import { initialSessionState } from '../session/session.feature';
import SupervisorPage from './supervisor.page';

const jordan: CurrentUser = {
  id: 'jordan.lee',
  name: 'Jordan Lee',
  role: 'supervisor',
  teamId: 'atlas',
};

describe('SupervisorPage', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          initialState: {
            session: { ...initialSessionState, user: jordan, checked: true },
          },
        }),
      ],
    });
    const fixture = TestBed.createComponent(SupervisorPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    return {
      text: (selector: string) =>
        page.querySelector(selector)?.textContent?.trim(),
    };
  }

  it('is headed My team, as the supervisor page', () => {
    const { text } = render();

    expect(text('.eyebrow')).toBe('Supervisor');
    expect(text('h1')).toBe('My team');
  });

  it('greets the signed-in supervisor by name', () => {
    const { text } = render();

    expect(text('.greeting')).toBe('Signed in as Jordan Lee');
  });

  it("says where the team's workload will show", () => {
    const { text } = render();

    expect(text('.placeholder')?.replace(/\s+/g, ' ')).toBe(
      "Your team's agents and their open tickets, plus unassigned and overdue work, show here."
    );
  });
});
