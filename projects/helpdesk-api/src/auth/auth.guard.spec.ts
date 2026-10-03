import type { CurrentUser } from '@helpdesk/contract';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { SESSION_COOKIE } from './auth-config';
import { AuthGuard, SessionRequest, signedInUserFrom } from './auth.guard';
import type { AuthService } from './auth.service';

const sam: CurrentUser = {
  id: 'sam.rivera',
  name: 'Sam Rivera',
  role: 'agent',
  teamId: 'atlas',
};

/** An ExecutionContext for an HTTP request, as Nest hands guards one. */
function contextFor(request: SessionRequest): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
  } as unknown as ExecutionContext;
}

describe('AuthGuard', () => {
  /** A service that recognizes only the session token "valid-token". */
  const auth = {
    currentUser: vi.fn(async (token: string | undefined) =>
      token === 'valid-token' ? sam : null
    ),
  };
  const guard = new AuthGuard(auth as unknown as AuthService);

  beforeEach(() => auth.currentUser.mockClear());

  it('lets a valid session through, with its user attached', async () => {
    const request: SessionRequest = {
      cookies: { [SESSION_COOKIE]: 'valid-token' },
    };

    expect(await guard.canActivate(contextFor(request))).toBe(true);
    expect(request.user).toEqual(sam);
  });

  it('asks about exactly the session cookie', async () => {
    await guard.canActivate(
      contextFor({
        cookies: { other: 'something', [SESSION_COOKIE]: 'valid-token' },
      })
    );

    expect(auth.currentUser).toHaveBeenCalledExactlyOnceWith('valid-token');
  });

  it.each([
    ['no cookies at all', {}],
    ['other cookies but no session', { cookies: { other: 'something' } }],
    [
      'a session the service does not recognize',
      { cookies: { [SESSION_COOKIE]: 'expired-or-forged' } },
    ],
  ])('turns away %s with 401, attaching nobody', async (_, request) => {
    const attempt: SessionRequest = { ...request };

    await expect(guard.canActivate(contextFor(attempt))).rejects.toBeInstanceOf(
      UnauthorizedException
    );
    expect(attempt.user).toBeUndefined();
  });
});

describe('signedInUserFrom (behind @SignedInUser)', () => {
  it('gives the user the guard attached', () => {
    expect(signedInUserFrom(contextFor({ user: sam }))).toEqual(sam);
  });

  it('answers 401, not undefined, if an endpoint forgot the guard', () => {
    expect(() => signedInUserFrom(contextFor({}))).toThrow(
      UnauthorizedException
    );
  });
});
