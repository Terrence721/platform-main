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

/**
 * Changes an account (`PUT /api/users/:userId`, admins only): its role,
 * its team, and whether it can sign in. The same team rules as Create
 * Account apply. Someone who stops working a team's tickets (deactivated,
 * moved to another team, or made an admin) hands their open tickets back
 * to that team's Unassigned; a lead who stops leading leaves the team with
 * no lead; someone made a supervisor of a team becomes its lead.
 */
export interface UpdateAccountRequest {
  role: Role;
  /** The team's id; `null` for an admin. */
  teamId: string | null;
  active: boolean;
}

/** The account after a change, and how many open tickets it handed back. */
export interface UpdateAccountResponse {
  account: UserAccount;
  /** Open tickets that went back to the team's Unassigned list. */
  releasedTickets: number;
}

/** The answer when an admin tries to change their own account. */
export const OWN_ACCOUNT_MESSAGE = "You can't change your own account.";

/** The answer when a change would leave no active admin. */
export const LAST_ADMIN_MESSAGE = 'There must always be an active admin.';
