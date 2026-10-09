import { TestBed } from '@angular/core/testing';
import {
  PartialMatchRouteSnapshot,
  provideRouter,
  Route,
  Router,
  UrlTree,
} from '@angular/router';
import { CurrentUser, Role } from '@helpdesk/contract';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { Observable } from 'rxjs';
import { SignInLauncher } from '../sign-in/sign-in-launcher';
import { canMatchRole } from './role-match.guard';
import { initialSessionState, SessionState } from './session.feature';

const userWith = (role: Role): CurrentUser => ({
  id: `${role}.user`,
  name: 'Someone',
  role,
  teamId: role === 'admin' ? null : 'atlas',
});

describe('canMatchRole', () => {
  const launcher = { open: vi.fn(async () => undefined) };
  let store: MockStore;

  beforeEach(() => {
    launcher.open.mockClear();
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideMockStore({ initialState: { session: initialSessionState } }),
        { provide: SignInLauncher, useValue: launcher },
      ],
    });
    store = TestBed.inject(MockStore);
  });

  const setSession = (session: Partial<SessionState>) =>
    store.setState({ session: { ...initialSessionState, ...session } });

  /** The guard's answers for a page meant for `role`, as they come. */
  function answersFor(role: Role): (boolean | string)[] {
    const answers: (boolean | string)[] = [];
    const answer$ = TestBed.runInInjectionContext(() =>
      canMatchRole(role)({} as Route, [], {} as PartialMatchRouteSnapshot)
    ) as Observable<boolean | UrlTree>;
    answer$.subscribe((answer) =>
      answers.push(
        answer instanceof UrlTree
          ? TestBed.inject(Router).serializeUrl(answer)
          : answer
      )
    );
    return answers;
  }

  it.each(['admin', 'supervisor', 'agent'] as const)(
    'lets a signed-in %s into their own page',
    (role) => {
      setSession({ user: userWith(role), checked: true });

      expect(answersFor(role)).toEqual([true]);
    }
  );

  it.each([
    ['an agent', 'agent', 'admin', '/agent'],
    ['a supervisor', 'supervisor', 'agent', '/supervisor'],
    ['an admin', 'admin', 'supervisor', '/admin'],
  ] as const)(
    "sends %s who opens another role's page to their own",
    (_, role, page, home) => {
      setSession({ user: userWith(role), checked: true });

      expect(answersFor(page)).toEqual([home]);
    }
  );

  it('sends a signed-out visitor to the landing page, with the sign-in popup open', () => {
    setSession({ user: null, checked: true });

    expect(answersFor('admin')).toEqual(['/']);
    expect(launcher.open).toHaveBeenCalledOnce();
  });

  it('waits for the start-up session check before answering', () => {
    setSession({ user: null, checked: false });

    const answers = answersFor('agent');
    expect(answers).toEqual([]);
    expect(launcher.open).not.toHaveBeenCalled();

    // The check answers: the session is restored.
    setSession({ user: userWith('agent'), checked: true });
    expect(answers).toEqual([true]);
  });
});
