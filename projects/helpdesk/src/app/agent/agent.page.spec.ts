import { TestBed } from '@angular/core/testing';
import { CurrentUser } from '@helpdesk/contract';
import { provideMockStore } from '@ngrx/store/testing';
import { initialSessionState } from '../session/session.feature';
import AgentPage from './agent.page';

const sam: CurrentUser = {
  id: 'sam.rivera',
  name: 'Sam Rivera',
  role: 'agent',
  teamId: 'atlas',
};

describe('AgentPage', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          initialState: {
            session: { ...initialSessionState, user: sam, checked: true },
          },
        }),
      ],
    });
    const fixture = TestBed.createComponent(AgentPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    return {
      text: (selector: string) =>
        page.querySelector(selector)?.textContent?.trim(),
    };
  }

  it('is headed My tickets, as the agent page', () => {
    const { text } = render();

    expect(text('.eyebrow')).toBe('Agent');
    expect(text('h1')).toBe('My tickets');
  });

  it('greets the signed-in agent by name', () => {
    const { text } = render();

    expect(text('.greeting')).toBe('Signed in as Sam Rivera');
  });

  it('says where the assigned tickets will show', () => {
    const { text } = render();

    expect(text('.placeholder')).toBe(
      'The tickets assigned to you, the most urgent first, show here.'
    );
  });
});
