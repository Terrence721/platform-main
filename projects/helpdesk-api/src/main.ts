import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { existsSync } from 'fs';
import { AppModule } from './app/app.module';

// .env (copied from .env.example) sets DATABASE_URL and the like. Read from
// the repo root, where `nx serve` and `yarn start:helpdesk` run the API;
// values already in the environment win.
if (existsSync('.env')) {
  process.loadEnvFile('.env');
}

/** Every route sits under /api, e.g. GET /api/health. */
const GLOBAL_PREFIX = 'api';
const DEFAULT_PORT = 3000;

/** Starts the Helpdesk API on PORT (default 3000). */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(GLOBAL_PREFIX);
  // Reads the session cookie into request.cookies for AuthGuard.
  app.use(cookieParser());

  const port = Number(process.env['PORT'] ?? DEFAULT_PORT);
  await app.listen(port);
  Logger.log(
    `Helpdesk API listening on http://localhost:${port}/${GLOBAL_PREFIX}`
  );
}

void bootstrap();
