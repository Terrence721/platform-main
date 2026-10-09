// Attachments (#1026): files a customer adds to a request, such as a
// screenshot. Kept in the database with the request; a ticket made from
// the request reaches them through it. Staff open them only as downloads.

/**
 * The file types allowed, as media types. The server decides a file's
 * type from its contents, never from its name or what the browser says.
 */
export const ATTACHMENT_MEDIA_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'application/pdf',
  'text/plain',
] as const;

export type AttachmentMediaType = (typeof ATTACHMENT_MEDIA_TYPES)[number];

/**
 * The allowed types that are images: re-encoded on arrival, which drops
 * hidden data such as a photo's location, and shown as thumbnails.
 */
export const IMAGE_MEDIA_TYPES = [
  'image/png',
  'image/jpeg',
  'image/webp',
] as const satisfies readonly AttachmentMediaType[];

export type ImageMediaType = (typeof IMAGE_MEDIA_TYPES)[number];

/** The most files one request may carry. */
export const ATTACHMENTS_MAX_COUNT = 3;

/** The largest file allowed, in bytes: 5 MB. */
export const ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;

/** The longest file name kept; a longer one is shortened. */
export const ATTACHMENT_FILE_NAME_MAX_LENGTH = 200;

/**
 * A request sent with files is `multipart/form-data`: its fields, as the
 * JSON of a `CreateRequestRequest`, in the part named this.
 */
export const REQUEST_FIELDS_PART = 'request';

/** ...and each file in a part named this. */
export const REQUEST_FILES_PART = 'files';

/** An attachment as lists show it: what it is, never its contents. */
export interface AttachmentSummary {
  id: string;
  fileName: string;
  mediaType: AttachmentMediaType;
  /** Its size in bytes, after any re-encoding. */
  size: number;
}

/** Whether a value, such as a file's detected type, is an allowed type. */
export function isAttachmentMediaType(
  value: unknown
): value is AttachmentMediaType {
  return (ATTACHMENT_MEDIA_TYPES as readonly unknown[]).includes(value);
}

/** Whether a value is one of the allowed image types. */
export function isImageMediaType(value: unknown): value is ImageMediaType {
  return (IMAGE_MEDIA_TYPES as readonly unknown[]).includes(value);
}
