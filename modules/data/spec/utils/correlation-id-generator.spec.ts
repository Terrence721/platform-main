import { CorrelationIdGenerator } from '../..';

describe('CorrelationIdGenerator', () => {
  it('generates CRID1, CRID2, ... in sequence', () => {
    const generator = new CorrelationIdGenerator();
    expect([generator.next(), generator.next(), generator.next()]).toEqual([
      'CRID1',
      'CRID2',
      'CRID3',
    ]);
  });

  it('counts per instance', () => {
    const first = new CorrelationIdGenerator();
    first.next();
    expect(new CorrelationIdGenerator().next()).toBe('CRID1');
  });
});
