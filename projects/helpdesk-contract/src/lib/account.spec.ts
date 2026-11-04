import {
  ACCOUNT_NAME_MAX_LENGTH,
  LAST_ADMIN_MESSAGE,
  OWN_ACCOUNT_MESSAGE,
  USER_ID_TAKEN_MESSAGE,
} from './account';

describe('account constants', () => {
  it('limits account names to 100 characters', () => {
    expect(ACCOUNT_NAME_MAX_LENGTH).toBe(100);
  });

  it('keeps the account message wording', () => {
    expect(USER_ID_TAKEN_MESSAGE).toBe('That user ID is taken.');
    expect(OWN_ACCOUNT_MESSAGE).toBe("You can't change your own account.");
    expect(LAST_ADMIN_MESSAGE).toBe('There must always be an active admin.');
  });
});
