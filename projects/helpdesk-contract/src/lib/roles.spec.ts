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
  // The agreed table (#866), written out independently of the implementation.
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
    admin: [...PERMISSIONS],
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

  it('gives each role everything the role below it has', () => {
    for (let i = 1; i < ROLES.length; i++) {
      const below = ROLE_PERMISSIONS[ROLES[i - 1]];
      expect(ROLE_PERMISSIONS[ROLES[i]]).toEqual(
        expect.arrayContaining([...below])
      );
    }
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
