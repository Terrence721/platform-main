import {
  ATTACHMENT_MAX_BYTES,
  ATTACHMENT_MEDIA_TYPES,
  ATTACHMENTS_MAX_COUNT,
  IMAGE_MEDIA_TYPES,
  isAttachmentMediaType,
  isImageMediaType,
  REQUEST_FILES_PART,
  REQUEST_FIELDS_PART,
} from './attachment';

describe('attachments', () => {
  it('allows PNG, JPEG, WebP, PDF and plain text only', () => {
    expect(ATTACHMENT_MEDIA_TYPES).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
      'application/pdf',
      'text/plain',
    ]);
    for (const type of ATTACHMENT_MEDIA_TYPES) {
      expect(isAttachmentMediaType(type)).toBe(true);
    }
    for (const type of ['image/svg+xml', 'image/gif', 'text/html', '', 42]) {
      expect(isAttachmentMediaType(type)).toBe(false);
    }
  });

  it('knows which allowed types are images', () => {
    expect(IMAGE_MEDIA_TYPES).toEqual([
      'image/png',
      'image/jpeg',
      'image/webp',
    ]);
    for (const type of IMAGE_MEDIA_TYPES) {
      expect(ATTACHMENT_MEDIA_TYPES).toContain(type);
      expect(isImageMediaType(type)).toBe(true);
    }
    expect(isImageMediaType('application/pdf')).toBe(false);
    expect(isImageMediaType('text/plain')).toBe(false);
  });

  it('takes up to 3 files of 5 MB each', () => {
    expect(ATTACHMENTS_MAX_COUNT).toBe(3);
    expect(ATTACHMENT_MAX_BYTES).toBe(5 * 1024 * 1024);
  });

  it('names the multipart send its fields and its files', () => {
    expect(REQUEST_FIELDS_PART).toBe('request');
    expect(REQUEST_FILES_PART).toBe('files');
  });
});
