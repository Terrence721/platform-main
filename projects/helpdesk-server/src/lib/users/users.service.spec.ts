import { PGlite } from '@electric-sql/pglite';
import {
  type CreateAccountRequest,
  type Role,
  USER_ID_TAKEN_MESSAGE,
} from '@helpdesk/contract';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/pglite';
import { migrate } from 'drizzle-orm/pglite/migrator';
import { fileURLToPath } from 'url';
import { verifyPassword } from '../auth/password';
import { teams, users } from '../database/schema';
import { UsersService } from './users.service';

/** The real migrations, so the tests run against the real schema. */
const MIGRATIONS = fileURLToPath(new URL('../../../drizzle', import.meta.url));

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

/**
 * A database with the real schema, teams Atlas (led by Chris) and Beacon
 * (no lead), and PEOPLE; and the service over it.
 */
async function seededService() {
  const client = new PGlite();
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

  const service = new UsersService(database);
  return { client, database, service };
}

describe('UsersService', () => {
  let client: PGlite;
  let service: UsersService;

  beforeAll(async () => {
    ({ client, service } = await seededService());
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
      leadsTeam: false,
      active: true,
    });
    expect(JSON.stringify(await service.list())).not.toContain('secret-hash');
  });

  it("says who leads their team: Atlas's lead only", async () => {
    const leads = (await service.list())
      .filter(({ leadsTeam }) => leadsTeam)
      .map(({ id }) => id);

    // Beacon has no lead; the admin has no team.
    expect(leads).toEqual(['chris.taylor']);
  });
});

// Each test hashes a password, which is slow on purpose (scrypt), and gets
// a fresh database: 2-5 seconds here, so more room than the 5-second
// default, for slower CI machines.
describe('UsersService.create', { timeout: 30_000 }, () => {
  const PASSWORD = 'a-starting-password';
  let client: PGlite;
  let database: Awaited<ReturnType<typeof seededService>>['database'];
  let service: UsersService;

  // A fresh database for each test, as each one adds accounts.
  beforeEach(async () => {
    ({ client, database, service } = await seededService());
  }, 60_000);

  afterEach(() => client.close());

  const request = (
    changes: Partial<CreateAccountRequest> = {}
  ): CreateAccountRequest => ({
    userId: 'nia.new',
    name: 'Nia New',
    role: 'agent',
    teamId: 'beacon',
    password: PASSWORD,
    ...changes,
  });

  /** The stored row for a user ID, straight from the table. */
  const row = async (id: string) =>
    (await database.select().from(users).where(eq(users.id, id)))[0];

  /** Who leads a team, straight from the table. */
  const leadOf = async (id: string) =>
    (await database.select().from(teams).where(eq(teams.id, id)))[0]
      .supervisorId;

  it('creates an agent on a team, active, and answers with the account', async () => {
    expect(await service.create(request())).toEqual({
      id: 'nia.new',
      name: 'Nia New',
      role: 'agent',
      team: { id: 'beacon', name: 'Beacon' },
      leadsTeam: false,
      active: true,
    });
    expect((await service.list()).map(({ id }) => id)).toContain('nia.new');
  });

  it('stores only a hash of the password, one that checks out', async () => {
    await service.create(request());

    const { passwordHash } = await row('nia.new');
    expect(passwordHash).not.toContain(PASSWORD);
    expect(await verifyPassword(PASSWORD, passwordHash)).toBe(true);
  });

  it('makes a new supervisor the lead of a team that had none', async () => {
    await service.create(request({ role: 'supervisor', teamId: 'beacon' }));

    expect(await leadOf('beacon')).toBe('nia.new');
  });

  it('makes a new supervisor the lead, the old lead staying on the team', async () => {
    await service.create(request({ role: 'supervisor', teamId: 'atlas' }));

    expect(await leadOf('atlas')).toBe('nia.new');
    const chris = await row('chris.taylor');
    expect([chris.role, chris.teamId]).toEqual(['supervisor', 'atlas']);
  });

  it('lists the new supervisor as the lead, and the old one no longer', async () => {
    const created = await service.create(
      request({ role: 'supervisor', teamId: 'atlas' })
    );

    expect(created.leadsTeam).toBe(true);
    const leadsTeam = (id: string) =>
      service
        .list()
        .then((accounts) => accounts.find((account) => account.id === id))
        .then((account) => account?.leadsTeam);
    expect(await leadsTeam('nia.new')).toBe(true);
    expect(await leadsTeam('chris.taylor')).toBe(false);
  });

  it('creates an admin, with no team', async () => {
    const admin = await service.create(
      request({ role: 'admin', teamId: null })
    );

    expect(admin.team).toBeNull();
    expect((await row('nia.new')).role).toBe('admin');
  });

  it('refuses a user ID someone has, changing nothing', async () => {
    await expect(
      service.create(request({ userId: 'sam.rivera', name: 'Someone Else' }))
    ).rejects.toThrow(USER_ID_TAKEN_MESSAGE);

    expect((await row('sam.rivera')).name).toBe('Sam Rivera');
  });

  it.each([
    [
      'an admin with a team',
      { role: 'admin', teamId: 'atlas' },
      'An admin belongs to no team.',
    ],
    [
      'an agent with no team',
      { role: 'agent', teamId: null },
      'Choose a team.',
    ],
    [
      'a supervisor with no team',
      { role: 'supervisor', teamId: null },
      'Choose a team.',
    ],
    [
      'a team that does not exist',
      { teamId: 'nowhere' },
      'That team does not exist.',
    ],
  ] as const)('refuses %s, saving nothing', async (_, changes, message) => {
    await expect(service.create(request(changes))).rejects.toThrow(message);

    expect(await row('nia.new')).toBeUndefined();
  });

  it('answers a taken user ID with 409, and a bad team with 400', async () => {
    await expect(
      service.create(request({ userId: 'sam.rivera' }))
    ).rejects.toMatchObject({ status: 409 });
    await expect(
      service.create(request({ teamId: 'nowhere' }))
    ).rejects.toMatchObject({ status: 400 });
  });
});
