import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { type AttachmentSummary, isImageMediaType } from '@helpdesk/contract';
import { formatFileSize } from '../report/attachment-picker';
import { AttachmentFiles } from './attachment-files';

/**
 * "Files from the customer" (#1026), for staff: on a New requests card and
 * in a ticket's popup. Each file is a row: a thumbnail for a picture (an
 * icon for the rest), its name and size, and a Download button named for
 * it. Pictures are read once each, through the signed-in download route,
 * and shown from memory; the thumbnails are let go of when the list goes.
 * A file that can't be read says so in its row, quietly, and the rest
 * works. No files, nothing shown.
 */
@Component({
  selector: 'hd-customer-files',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (files().length > 0) {
      <p class="files-label">Files from the customer</p>
      <ul aria-label="Files from the customer">
        @for (file of files(); track file.id) {
          <li>
            @if (thumbnails().get(file.id); as thumbnail) {
              <img class="thumb" [src]="thumbnail" [alt]="file.fileName" />
            } @else {
              <span class="icon">
                <mat-icon aria-hidden="true">{{
                  isPicture(file) ? 'image' : 'description'
                }}</mat-icon>
              </span>
            }
            <span class="what">
              <span class="name">{{ file.fileName }}</span>
              @if (failed().has(file.id)) {
                <span class="failed">Couldn't load this file.</span>
              } @else {
                <span class="size">{{ size(file.size) }}</span>
              }
            </span>
            <button
              matButton
              type="button"
              [attr.aria-label]="'Download ' + file.fileName"
              (click)="download(file)"
            >
              <mat-icon aria-hidden="true">download</mat-icon>
              <span class="label">Download</span>
            </button>
          </li>
        }
      </ul>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .files-label {
      margin: 0.5rem 0 0;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }
    ul {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
      margin: 0.25rem 0 0;
      padding: 0;
      list-style: none;
    }
    li {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.375rem 0.25rem 0.375rem 0.375rem;
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: 0.75rem;
      background: var(--mat-sys-surface);
    }
    .thumb,
    .icon {
      flex: none;
      width: 72px;
      height: 48px;
      border-radius: 0.5rem;
      background: var(--mat-sys-surface-container);
    }
    .thumb {
      object-fit: cover;
      border: 1px solid var(--mat-sys-outline-variant);
      box-sizing: border-box;
    }
    .icon {
      display: grid;
      place-items: center;
      color: var(--mat-sys-on-surface-variant);
    }
    .what {
      display: flex;
      flex: 1;
      flex-direction: column;
      min-width: 0;
    }
    .name {
      overflow-wrap: anywhere;
      color: var(--mat-sys-on-surface);
    }
    .size,
    .failed {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    /* On a phone, the button is its icon, so long names have room; its
       name for screen readers stays "Download <file>". */
    @media (max-width: 480px) {
      .label {
        display: none;
      }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerFiles {
  /** The files to list: a request's, or those of a ticket's request. */
  readonly files = input.required<readonly AttachmentSummary[]>();

  private readonly attachmentFiles = inject(AttachmentFiles);
  private readonly destroyRef = inject(DestroyRef);

  /** Each picture's thumbnail, as an object URL, by file id. */
  protected readonly thumbnails = signal<ReadonlyMap<string, string>>(
    new Map()
  );
  /** The files that couldn't be read. */
  protected readonly failed = signal<ReadonlySet<string>>(new Set());
  /** The pictures already asked for, so each is read once. */
  private readonly asked = new Set<string>();

  protected readonly size = formatFileSize;
  protected readonly isPicture = ({ mediaType }: AttachmentSummary) =>
    isImageMediaType(mediaType);

  constructor() {
    effect(() => {
      for (const file of this.files()) {
        if (this.isPicture(file) && !this.asked.has(file.id)) {
          this.asked.add(file.id);
          untracked(() => this.readThumbnail(file.id));
        }
      }
    });
    this.destroyRef.onDestroy(() => {
      for (const url of this.thumbnails().values()) {
        URL.revokeObjectURL(url);
      }
    });
  }

  /** Saves a file under its name. */
  protected download(file: AttachmentSummary): void {
    this.attachmentFiles
      .save(file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.markFailed(file.id) });
  }

  private readThumbnail(id: string): void {
    this.attachmentFiles
      .bytes(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (blob) =>
          this.thumbnails.update((thumbnails) =>
            new Map(thumbnails).set(id, URL.createObjectURL(blob))
          ),
        error: () => this.markFailed(id),
      });
  }

  private markFailed(id: string): void {
    this.failed.update((failed) => new Set(failed).add(id));
  }
}
