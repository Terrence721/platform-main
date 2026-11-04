import { LOADING_EXTENSION_TYPE } from '../src/consts';

describe('resource extension type constants', () => {
  it('exposes the loading extension type as a symbol', () => {
    expect(typeof LOADING_EXTENSION_TYPE).toBe('symbol');
  });
});
