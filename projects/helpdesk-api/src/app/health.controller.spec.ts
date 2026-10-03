import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { DATABASE, PG_POOL } from '../database/database.module';
import { AppModule } from './app.module';
import { HealthController } from './health.controller';

/** A stand-in for the Drizzle client: its query succeeds or fails. */
function fakeDatabase(answers: boolean) {
  return {
    execute: vi.fn(async () => {
      if (!answers) {
        throw new Error('connect ECONNREFUSED 127.0.0.1:5435');
      }
      return { rows: [{ '?column?': 1 }] };
    }),
  };
}

describe('HealthController', () => {
  async function controllerWith(database: ReturnType<typeof fakeDatabase>) {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: DATABASE, useValue: database }],
    }).compile();
    return moduleRef.get(HealthController);
  }

  it('reports that the API and the database are up', async () => {
    const database = fakeDatabase(true);

    expect(await (await controllerWith(database)).check()).toEqual({
      status: 'ok',
      database: 'up',
    });
    expect(database.execute).toHaveBeenCalledOnce();
  });

  it('reports the database as down, rather than failing, when it does not answer', async () => {
    expect(await (await controllerWith(fakeDatabase(false))).check()).toEqual({
      status: 'ok',
      database: 'down',
    });
  });
});

describe('GET /api/health', () => {
  let app: INestApplication;

  async function start(databaseAnswers: boolean): Promise<number> {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(DATABASE)
      .useValue(fakeDatabase(databaseAnswers))
      .overrideProvider(PG_POOL)
      .useValue({ end: vi.fn(async () => undefined) })
      .compile();
    app = moduleRef.createNestApplication({ logger: false });
    // The same prefix main.ts sets.
    app.setGlobalPrefix('api');
    // Port 0: the system picks a free one, so this never clashes with a
    // running API.
    await app.listen(0);
    return (app.getHttpServer().address() as AddressInfo).port;
  }

  afterEach(async () => {
    await app.close();
  });

  it('answers 200 with the API and the database up', async () => {
    const port = await start(true);

    const response = await fetch(`http://localhost:${port}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', database: 'up' });
  });

  it('still answers 200 when the database is down, and says so', async () => {
    const port = await start(false);

    const response = await fetch(`http://localhost:${port}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok', database: 'down' });
  });

  it('only answers under the /api prefix', async () => {
    const port = await start(true);

    expect((await fetch(`http://localhost:${port}/health`)).status).toBe(404);
  });
});
