import { TestBed } from '@angular/core/testing';
import { CurrentUser } from '@helpdesk/contract';
import { provideMockStore } from '@ngrx/store/testing';
import { initialSessionState } from '../session/session.feature';
import AdminPage from './admin.page';

const alex: CurrentUser = {
  id: 'alex.morgan',
  name: 'Alex Morgan',
  role: 'admin',
  teamId: null,
};

describe('AdminPage', () => {
  function render() {
    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          initialState: {
            session: { ...initialSessionState, user: alex, checked: true },
          },
        }),
      ],
    });
    const fixture = TestBed.createComponent(AdminPage);
    fixture.detectChanges();
    const page = fixture.nativeElement as HTMLElement;
    return {
      text: (selector: string) =>
        page.querySelector(selector)?.textContent?.trim(),
    };
  }

  it('is headed Team accounts, as the admin page', () => {
    const { text } = render();

    expect(text('.eyebrow')).toBe('Admin');
    expect(text('h1')).toBe('Team accounts');
  });

  it('greets the signed-in admin by name', () => {
    const { text } = render();

    expect(text('.greeting')).toBe('Signed in as Alex Morgan');
  });

  it('says where the accounts will show', () => {
    const { text } = render();

    expect(text('.placeholder')).toBe(
      "Everyone's Helpdesk accounts, with their roles and teams, show here."
    );
  });
});
