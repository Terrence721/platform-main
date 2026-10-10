import { Blob as NodeBlob } from 'node:buffer';
import {
  type BrowserDrawing,
  CanvasReEncoder,
  type DecodedImage,
  MAX_INPUT_PIXELS,
} from './canvas-re-encoder';

const SENT = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3, 0xde, 0xad]);
const REDRAWN = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

/** Bytes a Blob holds. */
const bytesOf = async (blob: Blob) => new Uint8Array(await blob.arrayBuffer());

// The demo's re-encoder (#1026): the browser decodes the image and a
// canvas draws it anew. The drawing itself is the browser's, so here it
// is stood in for; the demo's browser check draws for real.
describe('CanvasReEncoder', () => {
  // jsdom's Blob doesn't know Node's typed arrays (another realm's), and
  // keeps "[object Uint8Array]" as text; Node's own Blob takes the bytes,
  // as a browser's does.
  const jsdomBlob = globalThis.Blob;
  beforeAll(() => {
    globalThis.Blob = NodeBlob as unknown as typeof Blob;
  });
  afterAll(() => {
    globalThis.Blob = jsdomBlob;
  });

  /** A decoded picture of this size, which records being closed. */
  const picture = (width = 20, height = 10): DecodedImage => ({
    width,
    height,
    close: vi.fn(),
  });

  /** A browser that decodes to `decoded` and writes `written`. */
  function browser(decoded: DecodedImage, written?: Blob) {
    return {
      decode: vi.fn<BrowserDrawing['decode']>(async () => decoded),
      encode: vi.fn<BrowserDrawing['encode']>(
        async (_, type) => written ?? new Blob([REDRAWN], { type })
      ),
    };
  }

  it('decodes the image as its type, draws it as the same type, and gives the new bytes', async () => {
    const decoded = picture();
    const drawing = browser(decoded);

    const out = await new CanvasReEncoder(drawing).reEncode(SENT, 'image/png');

    const [sent] = drawing.decode.mock.calls[0];
    expect(sent.type).toBe('image/png');
    expect(await bytesOf(sent)).toEqual(SENT);
    expect(drawing.encode).toHaveBeenCalledExactlyOnceWith(
      decoded,
      'image/png',
      0.85
    );
    expect(out).toEqual(REDRAWN);
    expect(decoded.close).toHaveBeenCalledOnce();
  });

  it('refuses an image the browser cannot decode', async () => {
    const drawing = browser(picture());
    drawing.decode.mockRejectedValue(
      new DOMException('Broken', 'InvalidStateError')
    );

    await expect(
      new CanvasReEncoder(drawing).reEncode(SENT, 'image/jpeg')
    ).rejects.toThrow();
    expect(drawing.encode).not.toHaveBeenCalled();
  });

  it(`refuses an image over ${MAX_INPUT_PIXELS / 1_000_000} megapixels, drawing nothing`, async () => {
    const huge = picture(8_000, MAX_INPUT_PIXELS / 8_000 + 1);
    const drawing = browser(huge);

    await expect(
      new CanvasReEncoder(drawing).reEncode(SENT, 'image/png')
    ).rejects.toThrow();
    expect(drawing.encode).not.toHaveBeenCalled();
    expect(huge.close).toHaveBeenCalledOnce();
  });

  // Safari writes no WebP: asked for one, a canvas gives a PNG.
  it('refuses a type the browser cannot write, rather than keep another', async () => {
    const decoded = picture();
    const drawing = browser(
      decoded,
      new Blob([REDRAWN], { type: 'image/png' })
    );

    await expect(
      new CanvasReEncoder(drawing).reEncode(SENT, 'image/webp')
    ).rejects.toThrow();
    expect(decoded.close).toHaveBeenCalledOnce();
  });

  it('lets go of the picture even when drawing fails', async () => {
    const decoded = picture();
    const drawing = browser(decoded);
    drawing.encode.mockRejectedValue(new Error('Out of memory'));

    await expect(
      new CanvasReEncoder(drawing).reEncode(SENT, 'image/png')
    ).rejects.toThrow();
    expect(decoded.close).toHaveBeenCalledOnce();
  });

  it("draws with the browser's own tools when given none", () => {
    expect(() => new CanvasReEncoder()).not.toThrow();
  });
});
