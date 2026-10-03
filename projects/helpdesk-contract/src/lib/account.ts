import { Role } from './roles';

/** A team, as an account shows it. */
export interface TeamSummary {
  id: string;
  name: string;
}

/**
 * Someone's Helpdesk account, as an admin sees it on Team accounts. Never
 * carries a password or its hash.
 */
export interface UserAccount {
  /** The user ID they sign in with, such as `sam.rivera`. */
  id: string;
  name: string;
  role: Role;
  /** The agent's or supervisor's team; `null` for admins. */
  team: TeamSummary | null;
  /**
   * Whether they lead their team. Only one supervisor does; one who was
   * replaced stays on the team as a supervisor, no longer leading it.
   */
  leadsTeam: boolean;
  /** Whether they can sign in; deactivated accounts cannot. */
  active: boolean;
}

/** The longest name an account can have; the form and the API both check. */
export const ACCOUNT_NAME_MAX_LENGTH = 100;

/** The answer when a new account's user ID already belongs to someone. */
export const USER_ID_TAKEN_MESSAGE = 'That user ID is taken.';

/**
 * Creates an account, as an admin fills in the Create Account form. The
 * server checks every field: the user ID against `USER_ID_PATTERN` and
 * unused, the name 1 to `ACCOUNT_NAME_MAX_LENGTH` characters, the password
 * `PASSWORD_MIN_LENGTH` to `PASSWORD_MAX_LENGTH`, and the team (required
 * for agents and supervisors, `null` for admins). A new supervisor becomes
 * their team's lead, replacing any lead it had.
 */
export interface CreateAccountRequest {
  userId: string;
  name: string;
  role: Role;
  /** The team's id; `null` for an admin. */
  teamId: string | null;
  /** The starting password; the server stores only its hash. */
  password: string;
}
