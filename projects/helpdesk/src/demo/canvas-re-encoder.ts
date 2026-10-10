import type { ImageMediaType } from '@helpdesk/contract';
import type { ImageReEncoder } from '@helpdesk/server';

/**
 * The most pixels an image may have, as the API's re-encoder allows: 40
 * million, more than a phone's photo.
 */
export const MAX_INPUT_PIXELS = 40_000_000;

/** How closely a redrawn JPEG or WebP keeps to the picture sent. */
const QUALITY = 0.85;

/** A picture the browser decoded: its size, and letting go of it. */
export interface DecodedImage {
  readonly width: number;
  readonly height: number;
  close(): void;
}

/** The browser's part: decoding an image, and drawing one anew. */
export interface BrowserDrawing {
  decode(image: Blob): Promise<DecodedImage>;
  encode(picture: DecodedImage, type: string, quality: number): Promise<Blob>;
}

/**
 * The browser's own tools: `createImageBitmap` decodes, turned upright as
 * the photo's orientation tag says and at its first frame; an
 * OffscreenCanvas draws it, and writes it as the type asked for, if the
 * browser can.
 */
const IN_THE_BROWSER: BrowserDrawing = {
  decode: (image) =>
    createImageBitmap(image, { imageOrientation: 'from-image' }),
  async encode(picture, type, quality) {
    const canvas = new OffscreenCanvas(picture.width, picture.height);
    const context = canvas.getContext('2d');
    if (context === null) {
      throw new Error('This browser has no canvas to draw on.');
    }
    // What `decode` above gives: an ImageBitmap.
    context.drawImage(picture as ImageBitmap, 0, 0);
    return canvas.convertToBlob({ type, quality });
  },
};

/**
 * The in-browser demo's `ImageReEncoder` (#1026), as sharp is the API's:
 * the browser decodes the image and a canvas draws it anew as the same
 * type. A canvas holds only pixels, so a photo's hidden data and anything
 * after the image data are gone. Rejects an image the browser cannot
 * decode, one over `MAX_INPUT_PIXELS`, and a type it cannot write (Safari
 * writes no WebP), rather than keep a different type than was detected.
 */
export class CanvasReEncoder implements ImageReEncoder {
  constructor(private readonly drawing: BrowserDrawing = IN_THE_BROWSER) {}

  async reEncode(image: Uint8Array, type: ImageMediaType): Promise<Uint8Array> {
    // A copy: a Blob takes bytes in an ArrayBuffer, never a shared one.
    const picture = await this.drawing.decode(
      new Blob([new Uint8Array(image)], { type })
    );
    try {
      if (picture.width * picture.height > MAX_INPUT_PIXELS) {
        throw new Error('The image is too large to draw.');
      }
      const redrawn = await this.drawing.encode(picture, type, QUALITY);
      if (redrawn.type !== type) {
        throw new Error(`This browser cannot write ${type}.`);
      }
      return new Uint8Array(await redrawn.arrayBuffer());
    } finally {
      picture.close();
    }
  }
}
