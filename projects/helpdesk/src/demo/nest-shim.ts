// The demo build's stand-in for @nestjs/common (tsconfig.demo.json points
// the import here). The API's services run in the browser in the demo
// (#942), and all they take from Nest is the decorators below and the HTTP
// exceptions; Nest itself needs Node. The demo creates the services itself,
// so the decorators do nothing; the exceptions keep Nest's status and
// message, which the in-browser API sends back as the real API would.

/** Marks a class as a service; nothing to do outside Nest. */
export function Injectable(): ClassDecorator {
  return () => undefined;
}

/** Names what a constructor parameter receives; nothing to do outside Nest. */
export function Inject(_token: unknown): ParameterDecorator {
  return () => undefined;
}

/** An error with the HTTP status the API answers it with. */
export class HttpException extends Error {
  constructor(
    message: string,
    private readonly status: number
  ) {
    super(message);
    this.name = new.target.name;
  }

  getStatus(): number {
    return this.status;
  }
}

/** 400: the request itself is wrong, such as a missing field. */
export class BadRequestException extends HttpException {
  constructor(message = 'Bad Request') {
    super(message, 400);
  }
}

/** 401: nobody is signed in. */
export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

/** 403: signed in, but this is not for the user's role. */
export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

/** 404: no such thing, or none the user may reach. */
export class NotFoundException extends HttpException {
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}

/** 409: it exists, but its state does not allow the change. */
export class ConflictException extends HttpException {
  constructor(message = 'Conflict') {
    super(message, 409);
  }
}
