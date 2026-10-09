import {
  DISMISS_REASON_LABELS,
  DISMISS_REASONS,
  formatRequestReference,
  isDismissReason,
  isEmailAddress,
  isRequestCategory,
  isRequestImpact,
  parseRequestReference,
  REQUEST_CATEGORIES,
  REQUEST_CATEGORY_LABELS,
  REQUEST_IMPACT_LABELS,
  REQUEST_IMPACTS,
  REQUEST_STATUSES,
  SUGGESTED_PRIORITY,
} from './customer-request';
import { TICKET_PRIORITIES } from './ticket';

describe('customer requests', () => {
  it('labels every category and impact, and every dismissal reason', () => {
    expect(Object.keys(REQUEST_CATEGORY_LABELS)).toEqual([
      ...REQUEST_CATEGORIES,
    ]);
    expect(Object.keys(REQUEST_IMPACT_LABELS)).toEqual([...REQUEST_IMPACTS]);
    expect(Object.keys(DISMISS_REASON_LABELS)).toEqual([...DISMISS_REASONS]);
  });

  it('suggests a ticket priority for every impact, the most for blocked', () => {
    expect(SUGGESTED_PRIORITY).toEqual({
      blocked: 'high',
      slowed: 'normal',
      question: 'low',
    });
    for (const priority of Object.values(SUGGESTED_PRIORITY)) {
      expect(TICKET_PRIORITIES).toContain(priority);
    }
  });

  it('is pending, then a ticket or dismissed', () => {
    expect(REQUEST_STATUSES).toEqual(['pending', 'ticket', 'dismissed']);
  });

  it.each([
    [isRequestCategory, REQUEST_CATEGORIES],
    [isRequestImpact, REQUEST_IMPACTS],
    [isDismissReason, DISMISS_REASONS],
  ] as const)('%o knows its own values, and nothing else', (guard, values) => {
    for (const value of values) {
      expect(guard(value)).toBe(true);
    }
    for (const value of ['', 'BUG', 'other ', null, undefined, 1, {}]) {
      expect(guard(value)).toBe(false);
    }
  });

  describe('an email address', () => {
    it.each(['dana@example.com', 'dana.whitfield+billing@mail.example.co.uk'])(
      'takes %j',
      (email) => {
        expect(isEmailAddress(email)).toBe(true);
      }
    );

    it.each([
      '',
      'dana',
      'dana@',
      '@example.com',
      'dana@example',
      'dana @example.com',
      'dana@@example.com',
      'dana@example..com',
      `${'a'.repeat(250)}@example.com`,
      null,
      42,
    ])('refuses %j', (email) => {
      expect(isEmailAddress(email)).toBe(false);
    });
  });

  describe('the reference a customer gets', () => {
    it('reads R- and the number', () => {
      expect(formatRequestReference(1042)).toBe('R-1042');
    });

    it.each([
      ['R-1042', 1042],
      ['r-1042', 1042],
      ['  R-1042 ', 1042],
      ['R1042', 1042],
      ['1042', 1042],
    ])(
      'reads %j back as %i, as a customer may type it',
      (text, requestNumber) => {
        expect(parseRequestReference(text)).toBe(requestNumber);
      }
    );

    it.each([
      '',
      'R-',
      'R-12a',
      'R--1042',
      'R-0',
      'R-1.5',
      'T-1042',
      'R-99999999999',
    ])('refuses %j', (text) => {
      expect(parseRequestReference(text)).toBeNull();
    });
  });
});
