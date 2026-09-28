import { EntityAction } from '../actions/entity-action';
import { RequestData } from './interfaces';

/**
 * Error from a DataService
 * The source error either comes from a failed HTTP response or was thrown within the service.
 * @param error the HttpErrorResponse or the error thrown by the service
 * @param requestData the HTTP request information such as the method and the url.
 */
export class DataServiceError extends Error {
  constructor(
    public error: any,
    public requestData: RequestData | null
  ) {
    super(
      typeof error === 'string' ? error : (extractMessage(error) ?? undefined)
    );
    this.name = this.constructor.name;
  }
}

// Many ways the error can be shaped. These are the ways we recognize.
// The first one that holds a message wins, so an HttpErrorResponse whose
// `error` is an object without one (a network failure's ProgressEvent, a
// problem-details body) still gets its own `message`.
function extractMessage(sourceError: any): string | null {
  if (sourceError == null) {
    return null;
  }
  const { error, body, message } = sourceError;
  const errMessage = [
    // prefer HttpErrorResponse.error to its message property
    typeof error === 'string' ? error : error?.message,
    message,
    // try the body if no error or message property
    typeof body === 'string' ? body : body?.error,
  ].find((candidate) => !!candidate);

  return typeof errMessage === 'string'
    ? errMessage
    : errMessage
      ? JSON.stringify(errMessage)
      : null;
}

/** Payload for an EntityAction data service error such as QUERY_ALL_ERROR */
export interface EntityActionDataServiceError {
  error: DataServiceError;
  originalAction: EntityAction;
}
