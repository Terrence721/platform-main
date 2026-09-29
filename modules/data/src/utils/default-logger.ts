import { Injectable } from '@angular/core';
import { Logger } from './interfaces';

/**
 * The default Logger: writes to the console. Nothing is written when there
 * is no message (null or undefined); any other message and extra value are
 * written as given, including falsy ones such as 0, '' and false.
 */
@Injectable()
export class DefaultLogger implements Logger {
  error(message?: any, extra?: any) {
    write('error', message, extra);
  }

  log(message?: any, extra?: any) {
    write('log', message, extra);
  }

  warn(message?: any, extra?: any) {
    write('warn', message, extra);
  }
}

function write(method: 'error' | 'log' | 'warn', message: any, extra: any) {
  if (message == null) {
    return;
  }
  if (extra === undefined) {
    console[method](message);
  } else {
    console[method](message, extra);
  }
}
