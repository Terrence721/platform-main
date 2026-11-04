import '@angular/compiler';
import { CorrelationIdGenerator } from '../..';

describe('CorrelationIdGenerator', () => {
  it('starts producing CRID1 on the first call', () => {
    const generator = new CorrelationIdGenerator();

    expect(generator.next()).toBe('CRID1');
  });

  it('monotonically increments successive ids', () => {
    const generator = new CorrelationIdGenerator();

    const first = generator.next();
    const second = generator.next();
    const third = generator.next();

    expect(first).toBe('CRID1');
    expect(second).toBe('CRID2');
    expect(third).toBe('CRID3');
  });

  it('uses the CRID prefix for every id', () => {
    const generator = new CorrelationIdGenerator();

    expect(generator.next()).toMatch(/^CRID\d+$/);
    expect(generator.next()).toMatch(/^CRID\d+$/);
  });
});
