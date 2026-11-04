import { parseName } from './parse-name';

describe('parseName', () => {
  it('extracts the final name and normalizes the path', () => {
    expect(parseName('/src/app', 'foo.component')).toEqual({
      name: 'foo.component',
      path: '/src/app',
    });
  });

  it('keeps the directory portion with a nested name', () => {
    expect(parseName('/src/app', 'nested/foo.component')).toEqual({
      name: 'foo.component',
      path: '/src/app/nested',
    });
  });

  it('normalizes a trailing slash in the base path', () => {
    expect(parseName('/src/app/', 'foo.component')).toEqual({
      name: 'foo.component',
      path: '/src/app',
    });
  });

  it('handles a name without a leading path', () => {
    expect(parseName('', 'bar.service')).toEqual({
      name: 'bar.service',
      path: '/',
    });
  });
});
