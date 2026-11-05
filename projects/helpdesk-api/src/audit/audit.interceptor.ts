import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/**
 * Baseline audit trail for mutating requests: who did what, and whether it
 * succeeded. It deliberately records no request bodies, since they may
 * contain credentials or customer data. Records go to stdout as JSON so
 * they can be shipped to a SIEM alongside the API access log.
 */
@Injectable()
export class AuditInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: { id?: string } }>();
    const method = request.method;
    const mutating = !['GET', 'HEAD', 'OPTIONS'].includes(method);
    return next.handle().pipe(
      tap({
        next: () => {
          if (!mutating) return;
          console.log(
            JSON.stringify({
              audit: true,
              method,
              path: request.originalUrl || request.url,
              user: request.user?.id ?? null,
              outcome: 'success',
              at: new Date().toISOString(),
            })
          );
        },
        error: (error: unknown) => {
          if (!mutating) return;
          console.log(
            JSON.stringify({
              audit: true,
              method,
              path: request.originalUrl || request.url,
              user: request.user?.id ?? null,
              outcome: 'failure',
              error: error instanceof Error ? error.message : String(error),
              at: new Date().toISOString(),
            })
          );
        },
      })
    );
  }
}
