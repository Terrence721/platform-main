import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type AbstractControl,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  type ValidationErrors,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import {
  isEmailAddress,
  REQUEST_CATEGORIES,
  REQUEST_CATEGORY_LABELS,
  REQUEST_IMPACT_LABELS,
  REQUEST_IMPACTS,
  REQUEST_NAME_MAX_LENGTH,
  REQUEST_WHERE_MAX_LENGTH,
  type RequestCategory,
  type RequestImpact,
  TICKET_DESCRIPTION_MAX_LENGTH,
  TICKET_SUBJECT_MAX_LENGTH,
} from '@helpdesk/contract';
import { ReportStore } from './report.store';

/** A field that must hold more than spaces. */
function filled(control: AbstractControl<string>): ValidationErrors | null {
  return control.value.trim() === '' ? { required: true } : null;
}

/** A field that must look like an email address, once trimmed. */
function emailAddress(
  control: AbstractControl<string>
): ValidationErrors | null {
  return isEmailAddress(control.value.trim().toLowerCase())
    ? null
    : { email: true };
}

/**
 * Each field's message when it is wrong: the same words the API uses, so
 * a person reads one message whichever caught it, in the summary and at
 * the field alike.
 */
const MESSAGES = {
  name: 'Enter your name.',
  email: 'Enter your email address, such as dana@example.com.',
  category: 'Choose what it is about.',
  impact: 'Say how much this is affecting you.',
  subject: 'Enter a subject.',
  description: 'Describe the problem.',
  where: `Keep where it happened to ${REQUEST_WHERE_MAX_LENGTH} characters or fewer.`,
  consent: 'Agree to how your request is kept, to send it.',
} as const;

type Field = keyof typeof MESSAGES;

/**
 * The public Report an issue page (#1026): anyone, with no account, tells
 * the help desk about a problem, and gets a reference back to check on it
 * with their email. A failed send lists what is wrong at the top, focused,
 * each line leading to its field; the reference is announced once sent.
 * Two fields catch spam with no paid service: one hidden from people, and
 * how long the form was open, from the page's own timer (a duration, so a
 * visitor's clock set wrong cannot make their request look like spam).
 */
@Component({
  selector: 'hd-report-page',
  imports: [
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    MatSelectModule,
    ReactiveFormsModule,
    RouterLink,
  ],
  providers: [ReportStore],
  template: `
    <section class="column" aria-labelledby="report-title">
      <h1 id="report-title">Report an issue</h1>
      @if (store.sendState() === 'sent') {
        <div class="sent" role="status">
          <h2>We've got it. Your reference is {{ store.reference() }}.</h2>
          <p>Keep it: with your email, it's how you check on your request.</p>
          <div class="actions">
            <a
              matButton="filled"
              routerLink="/report/status"
              [queryParams]="{ reference: store.reference() }"
              >Check my request</a
            >
            <button matButton="outlined" type="button" (click)="another()">
              Report another issue
            </button>
          </div>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
          @if (problems().length > 0) {
            <div
              #summary
              class="error-summary"
              role="alert"
              tabindex="-1"
              aria-labelledby="summary-title"
            >
              <h2 id="summary-title">
                There
                {{
                  problems().length === 1
                    ? 'is 1 problem'
                    : 'are ' + problems().length + ' problems'
                }}
              </h2>
              <ul>
                @for (problem of problems(); track problem.field) {
                  <li>
                    <a
                      [href]="'#' + problem.field"
                      (click)="focus($event, problem.field)"
                      >{{ problem.message }}</a
                    >
                  </li>
                }
              </ul>
            </div>
          }
          <mat-form-field appearance="outline">
            <mat-label>Your name</mat-label>
            <input
              matInput
              id="name"
              formControlName="name"
              autocomplete="name"
              [maxlength]="nameMaxLength"
            />
            <mat-error>{{ messages.name }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Email</mat-label>
            <input
              matInput
              id="email"
              type="email"
              formControlName="email"
              autocomplete="email"
            />
            <mat-hint>We'll only use it to answer you.</mat-hint>
            <mat-error>{{ messages.email }}</mat-error>
          </mat-form-field>
          <!-- No asterisk: every field is required but the one marked
               optional, as the others show. -->
          <mat-form-field appearance="outline" hideRequiredMarker>
            <mat-label>What is it about?</mat-label>
            <mat-select id="category" formControlName="category">
              @for (category of categories; track category) {
                <mat-option [value]="category">{{
                  categoryLabels[category]
                }}</mat-option>
              }
            </mat-select>
            <mat-error>{{ messages.category }}</mat-error>
          </mat-form-field>
          <div class="impact">
            <p id="impact-label">How much is this affecting you?</p>
            <mat-radio-group
              id="impact"
              formControlName="impact"
              aria-labelledby="impact-label"
              [attr.aria-describedby]="
                showError('impact') ? 'impact-error' : null
              "
            >
              @for (impact of impacts; track impact) {
                <mat-radio-button [value]="impact">{{
                  impactLabels[impact]
                }}</mat-radio-button>
              }
            </mat-radio-group>
            @if (showError('impact')) {
              <p id="impact-error" class="field-error">{{ messages.impact }}</p>
            }
          </div>
          <mat-form-field appearance="outline">
            <mat-label>Subject</mat-label>
            <input
              matInput
              id="subject"
              formControlName="subject"
              autocomplete="off"
              [maxlength]="subjectMaxLength"
            />
            <mat-error>{{ messages.subject }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Describe the problem</mat-label>
            <textarea
              matInput
              id="description"
              formControlName="description"
              rows="6"
              [maxlength]="descriptionMaxLength"
            ></textarea>
            <mat-hint align="end" class="count"
              >{{ descriptionLength() }} / {{ descriptionMaxLength }}</mat-hint
            >
            <mat-error>{{ messages.description }}</mat-error>
          </mat-form-field>
          <mat-form-field appearance="outline">
            <mat-label>Where it happened</mat-label>
            <input
              matInput
              id="where"
              formControlName="where"
              autocomplete="off"
              [maxlength]="whereMaxLength"
            />
            <mat-hint>Optional: a page, an order or account number.</mat-hint>
            <mat-error>{{ messages.where }}</mat-error>
          </mat-form-field>
          <!-- People never see this field, so they leave it empty; programs
               that fill in every field give themselves away (#1026). -->
          <div class="honeypot" aria-hidden="true">
            <label for="website">Leave this empty</label>
            <input
              id="website"
              name="website"
              formControlName="website"
              tabindex="-1"
              autocomplete="off"
            />
          </div>
          <div class="consent">
            <mat-checkbox id="consent" formControlName="consent">
              I agree that Helpdesk keeps my name, email and what I write, to
              answer this request. It's never shared or used for anything else.
            </mat-checkbox>
            @if (showError('consent')) {
              <p class="field-error">{{ messages.consent }}</p>
            }
          </div>
          @if (store.error(); as error) {
            <p class="send-error" role="alert">{{ error }}</p>
          }
          <button
            matButton="filled"
            type="submit"
            [disabled]="store.sendState() === 'sending'"
          >
            Send request
          </button>
        </form>
      }
    </section>
  `,
  styles: `
    .column {
      max-width: 42rem;
      margin-inline: auto;
      padding: 2.5rem 1rem;
    }
    h1 {
      margin: 0 0 1.5rem;
      font: var(--mat-sys-headline-large);
    }
    form {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .error-summary {
      padding: 1rem 1.25rem;
      border: 2px solid var(--mat-sys-error);
      border-radius: 0.75rem;
      outline: none;
    }
    .error-summary:focus-visible {
      outline: 3px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    .error-summary h2 {
      margin: 0 0 0.5rem;
      font: var(--mat-sys-title-medium);
    }
    .error-summary ul {
      margin: 0;
      padding-inline-start: 1.25rem;
    }
    .error-summary a {
      color: var(--mat-sys-error);
    }
    .impact p,
    .consent {
      margin: 0;
    }
    #impact-label {
      font: var(--mat-sys-body-large);
      margin-bottom: 0.25rem;
    }
    mat-radio-group {
      display: flex;
      flex-wrap: wrap;
      gap: 0 1rem;
    }
    .field-error,
    .send-error {
      margin: 0.25rem 0 0;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
    }
    .send-error {
      font: var(--mat-sys-body-medium);
    }
    /* Off-screen, not display: none, which some programs skip. */
    .honeypot {
      position: absolute;
      left: -10000px;
      width: 1px;
      height: 1px;
      overflow: hidden;
    }
    button[type='submit'] {
      align-self: flex-start;
    }
    .sent h2 {
      margin: 0 0 0.5rem;
      font: var(--mat-sys-title-large);
    }
    .sent p {
      margin: 0 0 1.25rem;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
    }
    /* On a phone the impact choices stack. */
    @media (max-width: 600px) {
      mat-radio-group {
        flex-direction: column;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class ReportPage {
  protected readonly store = inject(ReportStore);
  protected readonly messages = MESSAGES;
  protected readonly categories = REQUEST_CATEGORIES;
  protected readonly categoryLabels = REQUEST_CATEGORY_LABELS;
  protected readonly impacts = REQUEST_IMPACTS;
  protected readonly impactLabels = REQUEST_IMPACT_LABELS;
  // The inputs stop at these, so a too-long field never needs a message.
  protected readonly nameMaxLength = REQUEST_NAME_MAX_LENGTH;
  protected readonly subjectMaxLength = TICKET_SUBJECT_MAX_LENGTH;
  protected readonly descriptionMaxLength = TICKET_DESCRIPTION_MAX_LENGTH;
  protected readonly whereMaxLength = REQUEST_WHERE_MAX_LENGTH;

  protected readonly form = inject(NonNullableFormBuilder).group({
    name: ['', [filled, Validators.maxLength(REQUEST_NAME_MAX_LENGTH)]],
    email: ['', [emailAddress]],
    category: [null as RequestCategory | null, Validators.required],
    impact: [null as RequestImpact | null, Validators.required],
    subject: ['', [filled, Validators.maxLength(TICKET_SUBJECT_MAX_LENGTH)]],
    description: [
      '',
      [filled, Validators.maxLength(TICKET_DESCRIPTION_MAX_LENGTH)],
    ],
    where: ['', Validators.maxLength(REQUEST_WHERE_MAX_LENGTH)],
    website: [''],
    consent: [false, Validators.requiredTrue],
  });

  private readonly description = toSignal(
    this.form.controls.description.valueChanges,
    { initialValue: '' }
  );
  protected readonly descriptionLength = computed(
    () => this.description().length
  );

  /** When the form opened, on the page's own timer. */
  private openedAt = performance.now();
  /** Whether a send was tried, so the summary shows what is wrong. */
  private readonly tried = signal(false);
  /** Bumped on each try, so the summary is worked out again. */
  private readonly attempt = signal(0);
  private readonly summary = viewChild<ElementRef<HTMLElement>>('summary');

  /** What is wrong, in the form's order, once a send was tried. */
  protected readonly problems = computed(() => {
    this.attempt();
    if (!this.tried()) {
      return [];
    }
    return (Object.keys(MESSAGES) as Field[])
      .filter((field) => this.form.controls[field].invalid)
      .map((field) => ({ field, message: MESSAGES[field] }));
  });

  constructor() {
    // A summary that has just appeared takes focus, so it is read at once.
    effect(() => {
      if (this.problems().length > 0) {
        this.summary()?.nativeElement.focus();
      }
    });
  }

  /** Whether a field outside mat-form-field should show its error now. */
  protected showError(field: 'impact' | 'consent'): boolean {
    const control = this.form.controls[field];
    return control.invalid && (control.touched || this.tried());
  }

  /** Sends the form, or lists what is wrong at the top. */
  protected submit(): void {
    this.tried.set(true);
    this.attempt.update((count) => count + 1);
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    const where = value.where.trim();
    this.store.send({
      name: value.name.trim(),
      email: value.email.trim().toLowerCase(),
      // Checked just above: required, so chosen.
      category: value.category as RequestCategory,
      impact: value.impact as RequestImpact,
      subject: value.subject.trim(),
      description: value.description.trim(),
      where: where === '' ? null : where,
      consent: true,
      website: value.website,
      fillMilliseconds: Math.round(performance.now() - this.openedAt),
    });
  }

  /** Moves to the field a summary line names, as its link says. */
  protected focus(event: Event, field: Field): void {
    event.preventDefault();
    document.getElementById(field)?.focus();
  }

  /** Back to an empty form, for another issue. */
  protected another(): void {
    this.form.reset();
    this.tried.set(false);
    this.openedAt = performance.now();
    this.store.reset();
  }
}
