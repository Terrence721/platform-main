/**
 * The roles a signed-in user can have, least access first. Customers raise
 * tickets but never sign in, so they are not a role.
 */
export const ROLES = ['agent', 'supervisor', 'admin'] as const;

export type Role = (typeof ROLES)[number];

/** Everything a role can be allowed to do, named `area:action`. */
export const PERMISSIONS = [
  'tickets:read',
  'tickets:reply',
  'tickets:update',
  'tickets:assign-self',
  'tickets:assign-others',
  'admin:queues',
  'admin:customers',
  'admin:canned-replies',
  'admin:users',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

const TICKET_WORK: readonly Permission[] = [
  'tickets:read',
  'tickets:reply',
  'tickets:update',
  'tickets:assign-self',
];

/**
 * What each role may do. Agents work tickets and take them; supervisors can
 * also assign them to the agents on their team; admins manage the help desk
 * and its users, and leave assigning to the supervisors (#936).
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  agent: TICKET_WORK,
  supervisor: [...TICKET_WORK, 'tickets:assign-others'],
  admin: [
    ...TICKET_WORK,
    'admin:queues',
    'admin:customers',
    'admin:canned-replies',
    'admin:users',
  ],
};

/** Whether a value, such as a token claim, is a role. */
export function isRole(value: unknown): value is Role {
  return (ROLES as readonly unknown[]).includes(value);
}

/** Whether a role may do something. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
