import { detectMediaType } from './file-type';
import { eicarTestFile, FILE_SCANNER, type FileScanner } from './file-scanner';

// The optional virus scan (#1293): what the API's ClamAV client provides
// under this token, and the harmless file every scanner flags.
// The test file's own name: cspell:ignore EICAR
describe('FILE_SCANNER', () => {
  it('is its own token, named for what it provides', () => {
    expect(typeof FILE_SCANNER).toBe('symbol');
    expect(FILE_SCANNER.description).toBe('FILE_SCANNER');
  });

  it('is met by anything that says a file is clean, or what it found', async () => {
    const scanner: FileScanner = {
      scan: async (file) =>
        file.length > 0 ? { clean: true } : { clean: false, threat: 'Empty' },
    };

    await expect(scanner.scan(new Uint8Array([1]))).resolves.toEqual({
      clean: true,
    });
    await expect(scanner.scan(new Uint8Array())).resolves.toEqual({
      clean: false,
      threat: 'Empty',
    });
  });
});

describe('eicarTestFile', () => {
  const text = new TextDecoder().decode(eicarTestFile());

  it('is the standard test file: 68 characters of plain text', () => {
    expect(text).toHaveLength(68);
    expect(text.startsWith('X5O!P%@AP[4')).toBe(true);
    expect(text).toContain('EICAR-STANDARD-ANTIVIRUS-TEST-FILE!');
    expect(text.endsWith('$H+H*')).toBe(true);
  });

  // So only a scan can stop it: the type check alone lets it through.
  it('passes the type check, as text', () => {
    expect(detectMediaType(eicarTestFile())).toBe('text/plain');
  });

  it('gives fresh bytes each time', () => {
    expect(eicarTestFile()).not.toBe(eicarTestFile());
  });
});
