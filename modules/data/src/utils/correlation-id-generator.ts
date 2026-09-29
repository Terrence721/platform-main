import { Injectable } from '@angular/core';

/**
 * Generates a string id beginning 'CRID',
 * followed by a monotonically increasing integer for use as a correlation id.
 * As they are produced locally by a counter, these ids are unique only
 * among those from the same instance: one per app, provided with the
 * other @ngrx/data services, for the life of that app.
 * Ngrx entity dispatcher query and save methods call this service to generate default correlation ids.
 * Do NOT use for entity keys.
 */
@Injectable()
export class CorrelationIdGenerator {
  /** Seed for the ids */
  protected seed = 0;
  /** Prefix of the id, 'CRID' */
  protected prefix = 'CRID';
  /** Return the next correlation id */
  next() {
    this.seed += 1;
    return this.prefix + this.seed;
  }
}
