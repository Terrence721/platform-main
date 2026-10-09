import type { ImageMediaType } from '@helpdesk/contract';
import type { ImageReEncoder } from '@helpdesk/server';
import { Injectable } from '@nestjs/common';
import sharp from 'sharp';

/**
 * The most pixels an image may have: 40 million, more than a phone's
 * photo. sharp refuses a larger one from its header, before decoding it,
 * so a small file claiming a vast picture can't use up the memory.
 */
export const MAX_INPUT_PIXELS = 40_000_000;

/** How closely a redrawn JPEG or WebP keeps to the picture sent. */
const QUALITY = 85;

/**
 * The API's `ImageReEncoder` (#1026): sharp draws the image anew as the same
 * type. sharp keeps no metadata unless asked, so a photo's camera, owner
 * and place are dropped, and only the image data is read, so anything
 * after it is too. The picture is first turned as its orientation tag
 * says, so a phone photo shows upright without the tag. An animation keeps
 * its first frame. sharp rejects an image it cannot decode in full, or one
 * over `MAX_INPUT_PIXELS`.
 */
@Injectable()
export class SharpReEncoder implements ImageReEncoder {
  async reEncode(image: Uint8Array, type: ImageMediaType): Promise<Uint8Array> {
    const picture = sharp(image, {
      limitInputPixels: MAX_INPUT_PIXELS,
      // Refuse a damaged image rather than keep what could be read of it.
      failOn: 'error',
      animated: false,
    }).rotate();
    const redrawn =
      type === 'image/png'
        ? picture.png()
        : type === 'image/jpeg'
          ? picture.jpeg({ quality: QUALITY })
          : picture.webp({ quality: QUALITY });
    return new Uint8Array(await redrawn.toBuffer());
  }
}
