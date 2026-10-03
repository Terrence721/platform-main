import {
  hasPermission,
  isRole,
  Permission,
  PERMISSIONS,
  Role,
  ROLE_PERMISSIONS,
  ROLES,
} from './roles';

describe('roles and permissions', () => {
  it('lists the roles least access first', () => {
    expect(ROLES).toEqual(['agent', 'supervisor', 'admin']);
  });

  it('lists every permission', () => {
    expect(PERMISSIONS).toEqual([
      'tickets:read',
      'tickets:reply',
      'tickets:update',
      'tickets:assign-self',
      'tickets:assign-others',
      'admin:queues',
      'admin:customers',
      'admin:canned-replies',
      'admin:users',
    ]);
  });

  it('derives the types from the lists', () => {
    expectTypeOf<Role>().toEqualTypeOf<'agent' | 'supervisor' | 'admin'>();
    expectTypeOf<Permission>().toEqualTypeOf<
      | 'tickets:read'
      | 'tickets:reply'
      | 'tickets:update'
      | 'tickets:assign-self'
      | 'tickets:assign-others'
      | 'admin:queues'
      | 'admin:customers'
      | 'admin:canned-replies'
      | 'admin:users'
    >();
  });
});

describe('isRole', () => {
  it.each(ROLES)('accepts %s', (role) => {
    expect(isRole(role)).toBe(true);
  });

  it.each([['customer'], ['Admin'], [''], [null], [undefined], [1], [{}]])(
    'rejects %j',
    (value) => {
      expect(isRole(value)).toBe(false);
    }
  );

  it('narrows the type', () => {
    const value: unknown = 'admin';
    if (isRole(value)) {
      expectTypeOf(value).toEqualTypeOf<Role>();
    }
  });
});

describe('role permissions', () => {
  // The agreed table (#866, admins' assigning removed in #936), written out
  // independently of the implementation.
  const granted: Record<Role, readonly Permission[]> = {
    agent: [
      'tickets:read',
      'tickets:reply',
      'tickets:update',
      'tickets:assign-self',
    ],
    supervisor: [
      'tickets:read',
      'tickets:reply',
      'tickets:update',
      'tickets:assign-self',
      'tickets:assign-others',
    ],
    admin: PERMISSIONS.filter(
      (permission) => permission !== 'tickets:assign-others'
    ),
  };

  it.each(
    ROLES.flatMap((role) =>
      PERMISSIONS.map((permission) => [role, permission] as const)
    )
  )('%s / %s follows the agreed table', (role, permission) => {
    expect(hasPermission(role, permission)).toBe(
      granted[role].includes(permission)
    );
  });

  it("gives supervisors and admins all of an agent's ticket work", () => {
    for (const role of ['supervisor', 'admin'] as const) {
      expect(ROLE_PERMISSIONS[role]).toEqual(
        expect.arrayContaining([...ROLE_PERMISSIONS.agent])
      );
    }
  });

  it('lets only supervisors assign tickets to others', () => {
    expect(
      ROLES.filter((role) => hasPermission(role, 'tickets:assign-others'))
    ).toEqual(['supervisor']);
  });

  it.each(ROLES)('lists no permission twice for %s', (role) => {
    const permissions = ROLE_PERMISSIONS[role];
    expect(new Set(permissions).size).toBe(permissions.length);
  });

  it.each(ROLES)('lists only known permissions for %s', (role) => {
    for (const permission of ROLE_PERMISSIONS[role]) {
      expect(PERMISSIONS).toContain(permission);
    }
  });
});
