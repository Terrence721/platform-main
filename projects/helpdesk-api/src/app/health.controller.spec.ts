import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AddressInfo } from 'net';
import { AppModule } from './app.module';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports that the API is up', async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    expect(moduleRef.get(HealthController).check()).toEqual({ status: 'ok' });
  });
});

describe('GET /api/health', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    // The same prefix main.ts sets.
    app.setGlobalPrefix('api');
    // Port 0: the system picks a free one, so this never clashes with a
    // running API.
    await app.listen(0);
  });

  afterEach(async () => {
    await app.close();
  });

  it('answers 200 with { status: "ok" } over HTTP', async () => {
    const { port } = app.getHttpServer().address() as AddressInfo;

    const response = await fetch(`http://localhost:${port}/api/health`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
  });

  it('only answers under the /api prefix', async () => {
    const { port } = app.getHttpServer().address() as AddressInfo;

    expect((await fetch(`http://localhost:${port}/health`)).status).toBe(404);
  });
});
