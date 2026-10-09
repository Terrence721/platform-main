import { IMAGE_RE_ENCODER, type ImageReEncoder } from './image-re-encoder';

// The API provides sharp under this token, and the demo a canvas (#1026).
describe('IMAGE_RE_ENCODER', () => {
  it('is its own token, named for what it provides', () => {
    expect(typeof IMAGE_RE_ENCODER).toBe('symbol');
    expect(IMAGE_RE_ENCODER.description).toBe('IMAGE_RE_ENCODER');
    expect(IMAGE_RE_ENCODER).not.toBe(Symbol.for('IMAGE_RE_ENCODER'));
  });

  it('is met by anything that turns an image into a new one', async () => {
    const reEncoder: ImageReEncoder = {
      reEncode: async (image, type) => new Uint8Array([...image, type.length]),
    };

    await expect(
      reEncoder.reEncode(new Uint8Array([1]), 'image/png')
    ).resolves.toEqual(new Uint8Array([1, 9]));
  });
});
