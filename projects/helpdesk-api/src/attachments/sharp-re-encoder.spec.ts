import type { ImageMediaType } from '@helpdesk/contract';
import sharp from 'sharp';
import { MAX_INPUT_PIXELS, SharpReEncoder } from './sharp-re-encoder';

/** A 20 x 10 picture, as each type. */
const picture = () =>
  sharp({
    create: { width: 20, height: 10, channels: 3, background: '#0b57d0' },
  });

/** What sharp reads back from bytes the re-encoder gave. */
const read = (bytes: Uint8Array) => sharp(bytes).metadata();

const encoded = {
  'image/png': () => picture().png().toBuffer(),
  'image/jpeg': () => picture().jpeg().toBuffer(),
  'image/webp': () => picture().webp().toBuffer(),
} satisfies Record<ImageMediaType, () => Promise<Buffer>>;

// The API's re-encoder (#1026): an image drawn anew by sharp, so only the
// picture is kept.
describe('SharpReEncoder', { timeout: 30_000 }, () => {
  const reEncoder = new SharpReEncoder();

  it.each([
    ['image/png', 'png'],
    ['image/jpeg', 'jpeg'],
    ['image/webp', 'webp'],
  ] as const)('gives a %s back as the same type', async (type, format) => {
    const out = await reEncoder.reEncode(await encoded[type](), type);

    expect(out).toBeInstanceOf(Uint8Array);
    expect(await read(out)).toMatchObject({ format, width: 20, height: 10 });
  });

  // sharp's own name for writing a photo's hidden data:
  // cspell:ignore Exif
  it("drops a photo's hidden data: its camera, owner and place", async () => {
    const photo = await picture()
      .jpeg()
      .withExif({
        IFD0: { Make: 'PhoneMaker', Artist: 'Dana Whitfield' },
        IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '51/1 30/1 0/1' },
      })
      .toBuffer();
    const holds = (bytes: Uint8Array, text: string) =>
      Buffer.from(bytes).includes(text);
    expect(holds(photo, 'Dana Whitfield')).toBe(true);
    expect(holds(photo, 'PhoneMaker')).toBe(true);

    const out = await reEncoder.reEncode(photo, 'image/jpeg');

    expect(holds(out, 'Dana Whitfield')).toBe(false);
    expect(holds(out, 'PhoneMaker')).toBe(false);
  });

  it('drops anything hidden after the image data', async () => {
    const png = await encoded['image/png']();
    const smuggled = Buffer.concat([
      png,
      Buffer.from('<script>steal()</script>'),
    ]);

    const out = await reEncoder.reEncode(smuggled, 'image/png');

    expect(Buffer.from(out).includes('steal()')).toBe(false);
  });

  it('turns a photo upright, as the phone that took it meant', async () => {
    // Stored 20 x 10, marked "turn a quarter clockwise to show".
    const sideways = await picture()
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer();

    const out = await reEncoder.reEncode(sideways, 'image/jpeg');

    expect(await read(out)).toMatchObject({ width: 10, height: 20 });
    expect((await read(out)).orientation).toBeUndefined();
  });

  it('keeps only the first frame of an animation', async () => {
    const frames = await Promise.all(
      ['#ff0000', '#00ff00'].map((background) =>
        sharp({
          create: { width: 8, height: 8, channels: 3, background },
        })
          .png()
          .toBuffer()
      )
    );
    const animated = await sharp(frames, { join: { animated: true } })
      .webp()
      .toBuffer();
    expect((await read(animated)).pages).toBe(2);

    const out = await reEncoder.reEncode(animated, 'image/webp');

    expect((await read(out)).pages ?? 1).toBe(1);
  });

  it('refuses an image too large to draw safely, before drawing it', async () => {
    // Over the limit by one row, yet small: one color compresses well.
    const width = 8_000;
    const height = Math.floor(MAX_INPUT_PIXELS / width) + 1;
    const huge = await sharp({
      create: { width, height, channels: 3, background: '#ffffff' },
    })
      .png()
      .toBuffer();

    await expect(reEncoder.reEncode(huge, 'image/png')).rejects.toThrow();
  });

  it('refuses bytes that only start like an image', async () => {
    const fake = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4,
    ]);

    await expect(reEncoder.reEncode(fake, 'image/png')).rejects.toThrow();
  });
});
