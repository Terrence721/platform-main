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
  'admin:users',
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Reading a ticket, replying and adding notes, changing its status. */
const TICKET_WORK: readonly Permission[] = [
  'tickets:read',
  'tickets:reply',
  'tickets:update',
];

/**
 * What each role may do, as the API's routes allow it (their `@OnlyFor`
 * guards; this table enforces nothing itself). Agents work tickets and take
 * them; supervisors work their team's tickets and assign them to its agents,
 * but take none; admins manage the accounts and work no tickets (#936,
 * #1023).
 */
export const ROLE_PERMISSIONS: Readonly<Record<Role, readonly Permission[]>> = {
  agent: [...TICKET_WORK, 'tickets:assign-self'],
  supervisor: [...TICKET_WORK, 'tickets:assign-others'],
  admin: ['admin:users'],
};

/** Whether a value, such as a token claim, is a role. */
export function isRole(value: unknown): value is Role {
  return (ROLES as readonly unknown[]).includes(value);
}

/** Whether a role may do something. */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role].includes(permission);
}
