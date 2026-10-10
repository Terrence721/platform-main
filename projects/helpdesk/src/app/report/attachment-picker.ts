import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  model,
  signal,
  viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MEDIA_TYPES,
  ATTACHMENTS_MAX_COUNT,
} from '@helpdesk/contract';

const KB = 1024;
const MB = 1024 * KB;

/** A file's size in words: `900 bytes`, `12 KB`, `2.3 MB`. */
export function formatFileSize(bytes: number): string {
  if (bytes < KB) {
    return `${bytes} ${bytes === 1 ? 'byte' : 'bytes'}`;
  }
  if (bytes < MB) {
    return `${Math.round(bytes / KB)} KB`;
  }
  return `${Number((bytes / MB).toFixed(1))} MB`;
}

/** Names the browser gives a type to; the API checks the contents again. */
const ALLOWED_NAME = /\.(png|jpe?g|webp|pdf|txt|csv|log)$/i;

/**
 * Whether a file looks like one the API takes: by the browser's word for
 * its type, or failing that its name. Any text is taken, as the API keeps
 * text of every kind, so a CSV or a log may go. Only a first check, so a
 * customer is told at once: the API decides from the contents.
 */
function looksAllowed({ name, type }: File): boolean {
  return (
    (ATTACHMENT_MEDIA_TYPES as readonly string[]).includes(type) ||
    type.startsWith('text/') ||
    ALLOWED_NAME.test(name)
  );
}

/** Whether a file is shown as a picture in the list. */
const isPicture = ({ name, type }: File) =>
  type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(name);

/** What the picker offers to choose: the allowed types, and text by name. */
const ACCEPT = [...ATTACHMENT_MEDIA_TYPES, '.txt', '.csv', '.log'].join(',');

/**
 * Attachments on the Report an issue page (#1026): a drop zone that is
 * also the button to choose files (Enter or Space open the picker; on a
 * phone, the camera too), the chosen files listed with a Remove button
 * each, and a file that won't do refused at once, in the API's words and
 * announced. Up to ATTACHMENTS_MAX_COUNT files, then it asks for one to
 * be removed. The files are two-way bound (`[(files)]`), for the page to
 * send.
 */
@Component({
  selector: 'hd-attachment-picker',
  imports: [MatButtonModule, MatIconModule],
  template: `
    <p class="label" id="attach-label">Attachments <span>(optional)</span></p>
    <div
      #drop
      class="drop"
      [class.over]="over()"
      role="button"
      tabindex="0"
      aria-labelledby="attach-label attach-hint"
      [attr.aria-disabled]="full() ? 'true' : null"
      [attr.aria-describedby]="error() ? 'attach-error' : null"
      (click)="open()"
      (keydown)="pressed($event)"
      (dragover)="dragOver($event)"
      (dragleave)="over.set(false)"
      (drop)="dropped($event)"
    >
      <mat-icon aria-hidden="true">upload_file</mat-icon>
      @if (full()) {
        <strong>Remove a file to attach another.</strong>
      } @else {
        <strong>Drop files here or <u>choose files</u></strong>
      }
      <small id="attach-hint"
        >PNG, JPEG, WebP, PDF or text · up to {{ maxCount }} files,
        {{ maxSize }} each</small
      >
    </div>
    <input
      #input
      type="file"
      multiple
      hidden
      aria-hidden="true"
      tabindex="-1"
      [accept]="accept"
      (change)="picked(input)"
    />
    @if (files().length > 0) {
      <ul aria-label="Attached files">
        @for (file of files(); track $index) {
          <li>
            <mat-icon aria-hidden="true">{{
              isPicture(file) ? 'image' : 'description'
            }}</mat-icon>
            <span class="name">{{ file.name }}</span>
            <span class="size">{{ size(file.size) }}</span>
            <button
              matButton
              type="button"
              [attr.aria-label]="'Remove ' + file.name"
              (click)="remove(file)"
            >
              Remove
            </button>
          </li>
        }
      </ul>
    }
    @if (error(); as message) {
      <p id="attach-error" class="field-error" role="alert">{{ message }}</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0.25rem 0 0.75rem;
    }
    .label {
      margin: 0;
      font: var(--mat-sys-body-large);
    }
    .label span,
    .size,
    small {
      color: var(--mat-sys-on-surface-variant);
    }
    .drop {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.25rem;
      padding: 1.25rem 1rem;
      border: 2px dashed var(--mat-sys-outline);
      border-radius: 0.75rem;
      text-align: center;
      cursor: pointer;
      background: var(--mat-sys-surface-container-lowest);
    }
    .drop:focus-visible {
      outline: 3px solid var(--mat-sys-primary);
      outline-offset: 2px;
    }
    .drop.over {
      border-color: var(--mat-sys-primary);
      background: var(--mat-sys-primary-container);
    }
    .drop[aria-disabled='true'] {
      cursor: default;
    }
    .drop mat-icon {
      width: 2rem;
      height: 2rem;
      font-size: 2rem;
      color: var(--mat-sys-primary);
    }
    strong {
      font: var(--mat-sys-title-small);
    }
    u {
      color: var(--mat-sys-primary);
    }
    small {
      font: var(--mat-sys-body-small);
    }
    ul {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.25rem 0.25rem 0.25rem 0.75rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 0.75rem;
    }
    li mat-icon {
      flex: none;
      color: var(--mat-sys-on-surface-variant);
    }
    .name {
      flex: 1;
      min-width: 0;
      overflow-wrap: anywhere;
    }
    .size {
      font: var(--mat-sys-body-small);
      white-space: nowrap;
    }
    .field-error {
      margin: 0;
      color: var(--mat-sys-error);
      font: var(--mat-sys-body-small);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AttachmentPicker {
  /** The files chosen, for the page to send. */
  readonly files = model<readonly File[]>([]);

  protected readonly maxCount = ATTACHMENTS_MAX_COUNT;
  protected readonly maxSize = formatFileSize(ATTACHMENT_MAX_BYTES);
  protected readonly accept = ACCEPT;
  protected readonly size = formatFileSize;
  protected readonly isPicture = isPicture;

  /** Why the last file chosen was refused; `null` otherwise. */
  protected readonly error = signal<string | null>(null);
  /** Whether files are being dragged over the drop zone. */
  protected readonly over = signal(false);
  protected readonly full = computed(
    () => this.files().length >= ATTACHMENTS_MAX_COUNT
  );

  private readonly input =
    viewChild.required<ElementRef<HTMLInputElement>>('input');
  private readonly drop = viewChild.required<ElementRef<HTMLElement>>('drop');

  /** Opens the browser's file picker, unless no more files fit. */
  protected open(): void {
    if (!this.full()) {
      this.input().nativeElement.click();
    }
  }

  /** Enter or Space open the picker, as on any button. */
  protected pressed(event: KeyboardEvent): void {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.open();
    }
  }

  protected dragOver(event: DragEvent): void {
    // Lets the files be dropped here, not opened by the browser.
    event.preventDefault();
    this.over.set(true);
  }

  protected dropped(event: DragEvent): void {
    event.preventDefault();
    this.over.set(false);
    this.add([...(event.dataTransfer?.files ?? [])]);
  }

  protected picked(input: HTMLInputElement): void {
    this.add([...(input.files ?? [])]);
    // So the same file can be chosen again, after it was removed.
    input.value = '';
  }

  /**
   * Adds the files that will do, after those already chosen; the first
   * that won't is named in the error, in the API's words.
   */
  private add(chosen: readonly File[]): void {
    const files = [...this.files()];
    let problem: string | null = null;
    for (const file of chosen) {
      const refusal =
        files.length >= ATTACHMENTS_MAX_COUNT
          ? `Attach at most ${ATTACHMENTS_MAX_COUNT} files.`
          : file.size > ATTACHMENT_MAX_BYTES
            ? `"${file.name}" is larger than ${this.maxSize}.`
            : looksAllowed(file)
              ? null
              : `"${file.name}" isn't a PNG, JPEG, WebP, PDF or text file.`;
      if (refusal === null) {
        files.push(file);
      } else {
        problem ??= refusal;
      }
    }
    this.files.set(files);
    this.error.set(problem);
  }

  /** Takes a file off the list; focus goes back to the drop zone. */
  protected remove(file: File): void {
    this.files.update((files) => files.filter((kept) => kept !== file));
    this.error.set(null);
    this.drop().nativeElement.focus();
  }
}
