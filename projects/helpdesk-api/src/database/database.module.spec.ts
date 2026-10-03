import { Test } from '@nestjs/testing';
import { Pool } from 'pg';
import { databaseUrl } from './database-url';
import {
  CONNECTION_TIMEOUT_MS,
  DATABASE,
  DatabaseModule,
  PG_POOL,
} from './database.module';

describe('DatabaseModule', () => {
  it('provides a Drizzle client on top of the pool', async () => {
    const pool = { end: vi.fn(async () => undefined) };
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .compile();

    const database = moduleRef.get(DATABASE);

    expect(database).toBeDefined();
    expect(typeof database.select).toBe('function');
    await moduleRef.close();
  });

  it('closes the pool once when the API stops, so no connections stay open', async () => {
    const pool = { end: vi.fn(async () => undefined) };
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
    })
      .overrideProvider(PG_POOL)
      .useValue(pool)
      .compile();

    expect(pool.end).not.toHaveBeenCalled();
    await moduleRef.close();

    expect(pool.end).toHaveBeenCalledOnce();
  });

  it('points the real pool at databaseUrl() without connecting yet', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [DatabaseModule],
    }).compile();

    const pool = moduleRef.get<Pool>(PG_POOL);

    expect(pool).toBeInstanceOf(Pool);
    expect(pool.options.connectionString).toBe(databaseUrl());
    expect(pool.options.connectionTimeoutMillis).toBe(CONNECTION_TIMEOUT_MS);
    expect(pool.totalCount).toBe(0);
    await moduleRef.close();
  });
});
