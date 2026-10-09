import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import RequestStatusPage from './request-status.page';
import { REQUEST_STATUS_API } from './request-status.store';

// Check my request (#1026): a customer gives their reference and email and
// reads where their request is up to.
describe('RequestStatusPage', () => {
  afterEach(() => TestBed.inject(HttpTestingController).verify());

  /** The page, with `reference` as the address gives it, if at all. */
  async function render(reference?: string) {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    const fixture = TestBed.createComponent(RequestStatusPage);
    if (reference !== undefined) {
      fixture.componentRef.setInput('reference', reference);
    }
    fixture.detectChanges();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const page = fixture.nativeElement as HTMLElement;
    const field = (label: string) =>
      loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
    const input = async (label: string) =>
      (await (
        await field(label)
      ).getControl(MatInputHarness)) as MatInputHarness;
    return {
      page,
      fixture,
      http: TestBed.inject(HttpTestingController),
      text: (selector: string) =>
        page.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim(),
      fill: async (label: string, value: string) =>
        (await input(label)).setValue(value),
      value: async (label: string) => (await input(label)).getValue(),
      errors: async (label: string) => (await field(label)).getTextErrors(),
      check: async () =>
        (
          await loader.getHarness(MatButtonHarness.with({ text: 'Check' }))
        ).click(),
    };
  }

  const asked = (http: HttpTestingController) =>
    http.expectOne(
      ({ method, url }) => method === 'GET' && url === REQUEST_STATUS_API
    );

  it('is headed Check my request, asking for the reference and the email', async () => {
    const { page, text } = await render();

    expect(text('h1')).toBe('Check my request');
    expect(page.textContent).toContain('On your confirmation, such as R-1042.');
    expect(page.textContent).toContain('The one you sent it with.');
  });

  // From the confirmation's "Check my request" link.
  it('fills the reference in from the address', async () => {
    const { value } = await render('R-1042');

    expect(await value('Reference')).toBe('R-1042');
  });

  it('asks for both before checking, sending nothing', async () => {
    const { check, errors } = await render();

    await check();

    expect(await errors('Reference')).toEqual([
      'Enter the reference from your confirmation.',
    ]);
    expect(await errors('Email')).toEqual([
      'Enter the email you sent it with.',
    ]);
  });

  it('says where the request is up to, announced', async () => {
    const { fill, check, http, fixture, page, text } = await render('R-1042');
    await fill('Email', 'dana@example.com');

    await check();
    const call = asked(http);
    expect(call.request.params.get('reference')).toBe('R-1042');
    expect(call.request.params.get('email')).toBe('dana@example.com');
    call.flush({
      reference: 'R-1042',
      status: 'ticket',
      ticketNumber: 1061,
      ticketStatus: 'new',
    });
    fixture.detectChanges();

    expect(page.querySelector('.answer')?.getAttribute('role')).toBe('status');
    expect(text('.answer')).toBe('R-1042 is now ticket #1061, which is New.');
  });

  it('says so when no request matches, in the same place', async () => {
    const { fill, check, http, fixture, text } = await render('R-1042');
    await fill('Email', 'someone@example.com');

    await check();
    asked(http).flush(
      { message: 'No request matches that reference and email.' },
      { status: 404, statusText: 'Not Found' }
    );
    fixture.detectChanges();

    expect(text('.answer')).toBe(
      'No request matches that reference and email.'
    );
  });

  it('shows a failure to check as an alert', async () => {
    const { fill, check, http, fixture, page } = await render('R-1042');
    await fill('Email', 'dana@example.com');

    await check();
    asked(http).error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(page.querySelector('.check-error')?.getAttribute('role')).toBe(
      'alert'
    );
  });
});
