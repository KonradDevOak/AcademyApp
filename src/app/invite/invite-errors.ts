import { HttpErrorResponse } from '@angular/common/http';
import { getErrorCode } from '../academy/register-athlete-errors';

// Codes from POST members/{storefrontId}/join and POST academy/invitations/accept. getErrorCode()
// is generic despite living in the academy/ folder (reused the same way academy-payment-errors.ts
// does) — the { errors: [{ code, message }] } shape is shared across every module. Returns an i18n
// key (see public/assets/i18n/pl.json academy.invite.errors.*), not translated text — call sites
// pipe it through TranslatePipe/TranslateService.
const INVITE_ERROR_KEYS: Record<string, string> = {
  parent_invitation_not_found: 'academy.invite.errors.parentInvitationNotFound',
  parent_invitation_expired: 'academy.invite.errors.parentInvitationExpired',
  membership_required: 'academy.invite.errors.membershipRequired',
  member_consent_required: 'academy.invite.errors.memberConsentRequired'
};

const GENERIC_KEY = 'academy.invite.errors.generic';

// A second click on the same invitation link (or a page reload mid-flow that re-submits accept)
// lands here — treat it as success, not an error, per the backend contract.
export function isInvitationAlreadyAccepted(error: HttpErrorResponse): boolean {
  return getErrorCode(error) === 'parent_invitation_not_pending';
}

export function isEmailMismatch(error: HttpErrorResponse): boolean {
  return getErrorCode(error) === 'invitation_email_mismatch';
}

export function isConsentRequired(error: HttpErrorResponse): boolean {
  return getErrorCode(error) === 'member_consent_required';
}

export function inviteErrorKey(error: HttpErrorResponse): string {
  const code = getErrorCode(error);
  if (code === 'invitation_email_mismatch') {
    return 'academy.invite.errors.emailMismatch';
  }
  return (code && INVITE_ERROR_KEYS[code]) || GENERIC_KEY;
}
