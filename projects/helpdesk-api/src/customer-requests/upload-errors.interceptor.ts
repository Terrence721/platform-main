import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENTS_MAX_COUNT,
  REQUEST_FIELDS_PART,
  REQUEST_FILES_PART,
} from '@helpdesk/contract';
import {
  BadRequestException,
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
  PayloadTooLargeException,
} from '@nestjs/common';
import { catchError, type Observable, throwError } from 'rxjs';

/** Too many files: more `files` parts, or parts, than one request may have. */
export const TOO_MANY_FILES = `Attach at most ${ATTACHMENTS_MAX_COUNT} files.`;
export const FILE_TOO_LARGE = `Each file must be ${ATTACHMENT_MAX_BYTES / 1024 / 1024} MB or less.`;
export const FILE_PART = `Send each file in a "${REQUEST_FILES_PART}" part.`;
export const FIELDS_PART = `Send the request's fields as JSON, in a "${REQUEST_FIELDS_PART}" part.`;

/**
 * What a visitor is told for each of multer's limits (#1026), as Nest
 * words them: their messages are multer's own ("Unexpected file field -
 * files"), and a file over the size is a 413. All are the sender's to
 * fix, so each is a 400 that says how. Any other error passes as it is.
 */
function wordedForVisitors(error: unknown): unknown {
  if (error instanceof PayloadTooLargeException) {
    return new BadRequestException(FILE_TOO_LARGE);
  }
  if (!(error instanceof BadRequestException)) {
    return error;
  }
  const { message } = error;
  // Multer says "Unexpected field" or, since 2.x, "Unexpected file field".
  const unexpected = /^Unexpected (file )?field - (.*)$/.exec(message);
  if (
    unexpected?.[2] === REQUEST_FILES_PART ||
    message.startsWith('Too many files') ||
    message.startsWith('Too many parts')
  ) {
    return new BadRequestException(TOO_MANY_FILES);
  }
  if (unexpected !== null) {
    return new BadRequestException(FILE_PART);
  }
  if (message.startsWith('Too many fields') || message.startsWith('Field')) {
    return new BadRequestException(FIELDS_PART);
  }
  return error;
}

/**
 * Put before the files interceptor on a route, so its refusals reach the
 * visitor in plain words.
 */
@Injectable()
export class UploadErrorsInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next
      .handle()
      .pipe(
        catchError((error: unknown) =>
          throwError(() => wordedForVisitors(error))
        )
      );
  }
}
