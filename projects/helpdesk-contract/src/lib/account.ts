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
  /** Whether they can sign in; deactivated accounts cannot. */
  active: boolean;
}
