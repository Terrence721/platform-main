import type { ImageMediaType } from '@helpdesk/contract';

// How images are re-encoded, apart from what does it: the API provides
// sharp, which the in-browser demo cannot load, and the demo a canvas
// (#1026). The services only need this interface and its token.

/**
 * Draws an image anew, as the same type: what comes out holds only the
 * picture, so hidden data (a photo's location, its camera) and anything
 * smuggled in after the image data are gone. Rejects an image it cannot
 * read, or one too large to draw safely.
 */
export interface ImageReEncoder {
  reEncode(image: Uint8Array, type: ImageMediaType): Promise<Uint8Array>;
}

/** The `ImageReEncoder` the attachments service injects. */
export const IMAGE_RE_ENCODER = Symbol('IMAGE_RE_ENCODER');
