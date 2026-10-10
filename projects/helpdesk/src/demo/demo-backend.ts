import {
  FetchBackend,
  HttpBackend,
  HttpErrorResponse,
  type HttpEvent,
  HttpHeaders,
  type HttpRequest,
  HttpResponse,
} from '@angular/common/http';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { defer, from, map, type Observable } from 'rxjs';
import type { DemoApi } from './demo-api';

/**
 * The demo's API, once its database is ready. A promise, so requests made
 * while the demo is still starting simply wait for it.
 */
export const DEMO_API = new InjectionToken<Promise<DemoApi>>('DEMO_API');

/** Whether a request is for the Helpdesk API. */
function isApi(url: string): boolean {
  return url === '/api' || url.startsWith('/api/');
}

/**
 * How the in-browser demo (#942) sends the app's requests: those for the
 * Helpdesk API to the demo's API in the page, everything else over the
 * network as usual. It takes HttpClient's backend (the part that does the
 * sending), as Angular's own testing backend does, so the app, its
 * interceptors and its error handling stay exactly as they are. Answers
 * travel as JSON, as over the network: a refusal arrives as an
 * HttpErrorResponse with the API's own body and status. A file arrives
 * as its bytes (a Blob) with its headers, as a download does.
 */
@Injectable()
export class DemoBackend implements HttpBackend {
  private readonly api = inject(DEMO_API);
  private readonly network = inject(FetchBackend);

  handle(request: HttpRequest<unknown>): Observable<HttpEvent<unknown>> {
    if (!isApi(request.url)) {
      return this.network.handle(request);
    }
    return defer(() =>
      from(
        this.api.then((api) =>
          api.handle({
            method: request.method,
            url: request.urlWithParams,
            body: request.body,
          })
        )
      )
    ).pipe(
      map(({ status, body, headers }) => {
        // A customer's file (#1026): its bytes as they are, with its type
        // and download name, as the API sends a download.
        if (body instanceof Blob) {
          return new HttpResponse({
            status,
            body,
            headers: new HttpHeaders(headers),
            url: request.url,
          });
        }
        // Through JSON and back, as over the network (Dates become text,
        // undefined fields disappear).
        const json: unknown =
          body === null ? null : JSON.parse(JSON.stringify(body));
        if (status >= 400) {
          throw new HttpErrorResponse({
            status,
            error: json,
            url: request.url,
          });
        }
        return new HttpResponse({ status, body: json, url: request.url });
      })
    );
  }
}
