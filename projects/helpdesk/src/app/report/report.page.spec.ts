import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { TestBed } from '@angular/core/testing';
import { MatButtonHarness } from '@angular/material/button/testing';
import { MatCheckboxHarness } from '@angular/material/checkbox/testing';
import { MatFormFieldHarness } from '@angular/material/form-field/testing';
import { MatInputHarness } from '@angular/material/input/testing';
import { MatRadioGroupHarness } from '@angular/material/radio/testing';
import { MatSelectHarness } from '@angular/material/select/testing';
import { provideRouter } from '@angular/router';
import { TICKET_DESCRIPTION_MAX_LENGTH } from '@helpdesk/contract';
import ReportPage from './report.page';
import { REPORT_API } from './report.store';

// The public Report an issue page (#1026): anyone, with no account, tells
// the help desk about a problem and gets a reference back.
describe('ReportPage', () => {
  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.restoreAllMocks();
  });

  async function render() {
    // The page's own timer: the form opens at 1,000 ms.
    let now = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
      ],
    });
    const fixture = TestBed.createComponent(ReportPage);
    fixture.detectChanges();
    const loader = TestbedHarnessEnvironment.loader(fixture);
    const page = fixture.nativeElement as HTMLElement;
    const field = (label: string) =>
      loader.getHarness(MatFormFieldHarness.with({ floatingLabelText: label }));
    const input = async (label: string) => {
      const control = await (await field(label)).getControl(MatInputHarness);
      if (!control) {
        throw new Error(`No input in the "${label}" field`);
      }
      return control;
    };
    const send = async () =>
      (
        await loader.getHarness(MatButtonHarness.with({ text: 'Send request' }))
      ).click();
    return {
      page,
      fixture,
      http: TestBed.inject(HttpTestingController),
      /** Moves the page's timer on, as time passes while filling it in. */
      wait: (ms: number) => (now += ms),
      text: (selector: string) =>
        page.querySelector(selector)?.textContent?.replace(/\s+/g, ' ').trim(),
      fill: async (label: string, value: string) =>
        (await input(label)).setValue(value),
      errors: async (label: string) => (await field(label)).getTextErrors(),
      /** Options sit in an overlay: clicked from the document, as elsewhere. */
      choose: async (label: string, option: string) => {
        await (await (await field(label)).getControl(MatSelectHarness))?.open();
        [...document.querySelectorAll<HTMLElement>('mat-option')]
          .find((candidate) => candidate.textContent?.trim() === option)
          ?.click();
        fixture.detectChanges();
      },
      impact: () =>
        loader.getHarness(
          MatRadioGroupHarness.with({
            selector: '[aria-labelledby="impact-label"]',
          })
        ),
      consent: () => loader.getHarness(MatCheckboxHarness),
      send,
      /** Fills every required field in, as a person would. */
      fillAll: async () => {
        await input('Your name').then((i) => i.setValue('Dana Whitfield'));
        await input('Email').then((i) => i.setValue('dana@example.com'));
        await (
          await field('What is it about?')
        )
          .getControl(MatSelectHarness)
          .then((select) => select?.open());
        [...document.querySelectorAll<HTMLElement>('mat-option')]
          .find((option) => option.textContent?.trim() === 'Billing')
          ?.click();
        await (
          await loader.getHarness(MatRadioGroupHarness)
        ).checkRadioButton({ label: "I'm blocked" });
        await input('Subject').then((i) => i.setValue('Charged twice'));
        await input('Describe the problem').then((i) =>
          i.setValue('My card was charged twice this month.')
        );
        await (await loader.getHarness(MatCheckboxHarness)).check();
      },
    };
  }

  it('is headed Report an issue, straight into the form', async () => {
    const { page, text } = await render();

    expect(text('h1')).toBe('Report an issue');
    // No line of introduction between the heading and the form.
    expect(page.querySelector('h1')?.nextElementSibling?.tagName).toBe('FORM');
  });

  it('asks for every field, labelled, with help where it helps', async () => {
    const { page, impact, consent } = await render();

    for (const label of [
      'Your name',
      'Email',
      'What is it about?',
      'Subject',
      'Describe the problem',
      'Where it happened',
    ]) {
      expect(page.textContent).toContain(label);
    }
    expect(page.textContent).toContain("We'll only use it to answer you.");
    expect(page.textContent).toContain(
      'Optional: a page, an order or account number.'
    );
    expect(page.querySelector('#impact-label')?.textContent?.trim()).toBe(
      'How much is this affecting you?'
    );
    expect(
      await Promise.all(
        (await (await impact()).getRadioButtons()).map((radio) =>
          radio.getLabelText()
        )
      )
    ).toEqual(["I'm blocked", "It's slowing me down", 'I have a question']);
    expect(await (await consent()).getLabelText()).toBe(
      "I agree that Helpdesk keeps my name, email and what I write, to answer this request. It's never shared or used for anything else."
    );
  });

  // So a too-long field never happens, and never needs its own message.
  it("stops each text at the contract's limit", async () => {
    const { page } = await render();
    const limit = (name: string) =>
      page
        .querySelector(`[formControlName="${name}"]`)
        ?.getAttribute('maxlength');

    expect(['name', 'subject', 'description', 'where'].map(limit)).toEqual([
      '100',
      '200',
      `${TICKET_DESCRIPTION_MAX_LENGTH}`,
      '200',
    ]);
  });

  it('counts the characters of the problem against the limit', async () => {
    const { fill, text } = await render();

    await fill('Describe the problem', 'Charged twice');

    expect(text('.count')).toBe(`13 / ${TICKET_DESCRIPTION_MAX_LENGTH}`);
  });

  // People never see it, so they leave it empty; programs fill it in.
  it('hides the honeypot field from people, keyboards and screen readers', async () => {
    const { page } = await render();
    const honeypot = page.querySelector<HTMLInputElement>(
      'input[name="website"]'
    );

    expect(honeypot).not.toBeNull();
    expect(honeypot?.tabIndex).toBe(-1);
    expect(honeypot?.autocomplete).toBe('off');
    expect(honeypot?.closest('[aria-hidden="true"]')).not.toBeNull();
  });

  describe('sending', () => {
    it('sends the form with how long it was open, keeping where empty as none', async () => {
      const { fillAll, wait, send, http } = await render();
      await fillAll();
      wait(45_000);

      await send();

      expect(
        http.expectOne({ method: 'POST', url: REPORT_API }).request.body
      ).toEqual({
        name: 'Dana Whitfield',
        email: 'dana@example.com',
        category: 'billing',
        impact: 'blocked',
        subject: 'Charged twice',
        description: 'My card was charged twice this month.',
        where: null,
        consent: true,
        website: '',
        fillMilliseconds: 45_000,
      });
    });

    it('lists what is missing at the top, focused, each line leading to its field; sends nothing', async () => {
      const { page, send, fixture } = await render();

      await send();
      fixture.detectChanges();

      const summary = page.querySelector<HTMLElement>('.error-summary');
      expect(summary?.querySelector('h2')?.textContent?.trim()).toBe(
        'There are 7 problems'
      );
      expect(document.activeElement).toBe(summary);
      const links = [...(summary?.querySelectorAll('a') ?? [])];
      expect(links.map((link) => link.textContent?.trim())).toEqual([
        'Enter your name.',
        'Enter your email address, such as dana@example.com.',
        'Choose what it is about.',
        'Say how much this is affecting you.',
        'Enter a subject.',
        'Describe the problem.',
        'Agree to how your request is kept, to send it.',
      ]);
      expect(links[1].getAttribute('href')).toBe('#email');
    });

    it('marks a field wrong where it is, in the same words', async () => {
      const { fill, errors, send } = await render();
      await fill('Email', 'dana');

      await send();

      expect(await errors('Email')).toEqual([
        'Enter your email address, such as dana@example.com.',
      ]);
    });

    it('shows the reference, announced, once sent, with where to go next', async () => {
      const { fillAll, wait, send, http, fixture, page, text } = await render();
      await fillAll();
      wait(45_000);
      await send();

      http
        .expectOne(REPORT_API)
        .flush({ reference: 'R-1042' }, { status: 201, statusText: 'Created' });
      fixture.detectChanges();

      const done = page.querySelector('.sent');
      expect(done?.getAttribute('role')).toBe('status');
      expect(text('.sent h2')).toBe("We've got it. Your reference is R-1042.");
      expect(text('.sent p')).toBe(
        "Keep it: with your email, it's how you check on your request."
      );
      expect(page.querySelector('form')).toBeNull();
      expect(
        [...page.querySelectorAll('.sent a, .sent button')].map((element) =>
          element.textContent?.trim()
        )
      ).toEqual(['Check my request', 'Report another issue']);
      // To Check my request, with the reference filled in.
      expect(page.querySelector('.sent a')?.getAttribute('href')).toBe(
        '/report/status?reference=R-1042'
      );
    });

    it('starts again with an empty form for another issue', async () => {
      const { fillAll, wait, send, http, fixture, page } = await render();
      await fillAll();
      wait(45_000);
      await send();
      http
        .expectOne(REPORT_API)
        .flush({ reference: 'R-1042' }, { status: 201, statusText: 'Created' });
      fixture.detectChanges();

      page.querySelector<HTMLButtonElement>('.sent button')?.click();
      fixture.detectChanges();

      expect(page.querySelector('form')).not.toBeNull();
      expect(
        page.querySelector<HTMLInputElement>('input[formControlName="name"]')
          ?.value
      ).toBe('');
    });

    it('says why sending failed, as an alert, keeping what was written', async () => {
      const { fillAll, wait, send, http, fixture, page, text } = await render();
      await fillAll();
      wait(45_000);
      await send();

      http.expectOne(REPORT_API).flush(
        { message: 'Too many requests from here. Please try again later.' },
        {
          status: 429,
          statusText: 'Too Many Requests',
          headers: { 'Retry-After': '3600' },
        }
      );
      fixture.detectChanges();

      expect(page.querySelector('.send-error')?.getAttribute('role')).toBe(
        'alert'
      );
      expect(text('.send-error')).toBe(
        'Too many requests from here. Please try again in about an hour.'
      );
      expect(
        page.querySelector<HTMLInputElement>('input[formControlName="subject"]')
          ?.value
      ).toBe('Charged twice');
    });
  });
});
