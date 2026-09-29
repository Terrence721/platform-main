import { Injectable } from '@angular/core';
import { Logger } from './interfaces';

/**
 * The default Logger: writes to the console. Nothing is written when there
 * is no message (null or undefined); any other message and every further
 * value are written as given, including falsy ones such as 0, '' and false.
 */
@Injectable()
export class DefaultLogger implements Logger {
  error(message?: any, ...optionalParams: any[]) {
    write('error', message, optionalParams);
  }

  log(message?: any, ...optionalParams: any[]) {
    write('log', message, optionalParams);
  }

  warn(message?: any, ...optionalParams: any[]) {
    write('warn', message, optionalParams);
  }
}

function write(
  method: 'error' | 'log' | 'warn',
  message: any,
  optionalParams: any[]
) {
  if (message == null) {
    return;
  }
  console[method](message, ...optionalParams);
}
