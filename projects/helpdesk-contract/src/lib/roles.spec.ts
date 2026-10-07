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
  // What the API's routes allow each role (their `@OnlyFor` guards, #1023),
  // written out independently of the implementation: agents work and take
  // tickets; supervisors work them and assign them to their team's agents,
  // but take none; admins manage accounts and work no tickets.
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
      'tickets:assign-others',
    ],
    admin: ['admin:users'],
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

  it('lets only agents take tickets, and only supervisors assign them', () => {
    expect(
      ROLES.filter((role) => hasPermission(role, 'tickets:assign-self'))
    ).toEqual(['agent']);
    expect(
      ROLES.filter((role) => hasPermission(role, 'tickets:assign-others'))
    ).toEqual(['supervisor']);
  });

  it('gives admins no ticket work, and only admins the accounts', () => {
    expect(
      ROLE_PERMISSIONS.admin.filter((permission) =>
        permission.startsWith('tickets:')
      )
    ).toEqual([]);
    expect(ROLES.filter((role) => hasPermission(role, 'admin:users'))).toEqual([
      'admin',
    ]);
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
