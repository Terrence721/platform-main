import { PGlite } from '@electric-sql/pglite';
import type { Role } from '@helpdesk/contract';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import type { Database } from '../database/database.module';
import { teams, users } from '../database/schema';
import { UsersService } from './users.service';

/** The real migrations, so the tests run against the real schema. */
const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

/** Everyone, in no particular order: the service sorts them. */
const PEOPLE: {
  id: string;
  name: string;
  role: Role;
  teamId: string | null;
  active?: boolean;
}[] = [
  { id: 'sam.rivera', name: 'Sam Rivera', role: 'agent', teamId: 'atlas' },
  { id: 'alex.morgan', name: 'Alex Morgan', role: 'admin', teamId: null },
  {
    id: 'chris.taylor',
    name: 'Chris Taylor',
    role: 'supervisor',
    teamId: 'atlas',
  },
  { id: 'omar.other', name: 'Omar Other', role: 'agent', teamId: 'beacon' },
  {
    id: 'dee.parted',
    name: 'Dee Parted',
    role: 'agent',
    teamId: 'atlas',
    active: false,
  },
  // Two people with the same name, told apart by user ID.
  { id: 'jo.smith2', name: 'Jo Smith', role: 'agent', teamId: 'beacon' },
  { id: 'jo.smith', name: 'Jo Smith', role: 'agent', teamId: 'atlas' },
];

describe('UsersService', () => {
  let client: PGlite;
  let service: UsersService;

  beforeAll(async () => {
    client = new PGlite();
    const database = drizzle(client);
    await migrate(database, { migrationsFolder: MIGRATIONS });

    await database.insert(teams).values([
      { id: 'atlas', name: 'Atlas' },
      { id: 'beacon', name: 'Beacon' },
    ]);
    await database
      .insert(users)
      .values(
        PEOPLE.map((person) => ({ ...person, passwordHash: 'secret-hash' }))
      );
    await database
      .update(teams)
      .set({ supervisorId: 'chris.taylor' })
      .where(eq(teams.id, 'atlas'));

    // The service is typed for the node-postgres driver; both are Drizzle's
    // Postgres databases with the same query builder.
    service = new UsersService(database as unknown as Database);
  }, 60_000);

  afterAll(() => client.close());

  it('lists every account by name, the same names by user ID', async () => {
    expect((await service.list()).map(({ id }) => id)).toEqual([
      'alex.morgan',
      'chris.taylor',
      'dee.parted',
      'jo.smith',
      'jo.smith2',
      'omar.other',
      'sam.rivera',
    ]);
  });

  it('gives each account its team, and none to the admin', async () => {
    const accounts = await service.list();
    const teamOf = (id: string) =>
      accounts.find((account) => account.id === id)?.team;

    expect(teamOf('sam.rivera')).toEqual({ id: 'atlas', name: 'Atlas' });
    expect(teamOf('omar.other')).toEqual({ id: 'beacon', name: 'Beacon' });
    expect(teamOf('alex.morgan')).toBeNull();
  });

  it('says which accounts are active', async () => {
    const accounts = await service.list();

    expect(
      accounts.filter(({ active }) => !active).map(({ id }) => id)
    ).toEqual(['dee.parted']);
  });

  it('sends exactly the contract fields: never a password hash', async () => {
    const [first] = await service.list();

    expect(first).toEqual({
      id: 'alex.morgan',
      name: 'Alex Morgan',
      role: 'admin',
      team: null,
      active: true,
    });
    expect(JSON.stringify(await service.list())).not.toContain('secret-hash');
  });
});
