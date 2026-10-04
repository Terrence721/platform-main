import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from './nest-shim';

describe('the demo stand-in for @nestjs/common', () => {
  it.each([
    [BadRequestException, 400, 'Bad Request'],
    [UnauthorizedException, 401, 'Unauthorized'],
    [ForbiddenException, 403, 'Forbidden'],
    [NotFoundException, 404, 'Not Found'],
    [ConflictException, 409, 'Conflict'],
  ] as const)(
    '%o answers with its status and message, as Nest does',
    (Exception, status, message) => {
      const custom = new Exception('No such ticket among yours.');

      expect(custom).toBeInstanceOf(HttpException);
      expect(custom).toBeInstanceOf(Error);
      expect(custom.getStatus()).toBe(status);
      expect(custom.message).toBe('No such ticket among yours.');
      expect(new Exception().message).toBe(message);
    }
  );

  it('names each exception after its class', () => {
    expect(new ConflictException().name).toBe('ConflictException');
  });

  // Called directly, as TypeScript calls them on a decorated service.
  it('leaves a decorated service as it is', () => {
    class Service {}

    expect(Injectable()(Service)).toBeUndefined();
    expect(Inject(Symbol('TOKEN'))(Service, undefined, 0)).toBeUndefined();
    expect(new Service()).toBeInstanceOf(Service);
  });
});
