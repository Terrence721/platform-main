import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

/** Every route sits under /api, e.g. GET /api/health. */
const GLOBAL_PREFIX = 'api';
const DEFAULT_PORT = 3000;

/** Starts the Helpdesk API on PORT (default 3000). */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix(GLOBAL_PREFIX);

  const port = Number(process.env['PORT'] ?? DEFAULT_PORT);
  await app.listen(port);
  Logger.log(
    `Helpdesk API listening on http://localhost:${port}/${GLOBAL_PREFIX}`
  );
}

void bootstrap();
