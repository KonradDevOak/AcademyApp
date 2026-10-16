import { HttpErrorResponse } from '@angular/common/http';
import {
  inviteErrorKey,
  isConsentRequired,
  isEmailMismatch,
  isInvitationAlreadyAccepted
} from './invite-errors';

function errorWithCode(code: string): HttpErrorResponse {
  return new HttpErrorResponse({ error: { errors: [{ code }] } });
}

describe('invite-errors', () => {
  it('treats parent_invitation_not_pending as an already-accepted signal, not a message', () => {
    expect(isInvitationAlreadyAccepted(errorWithCode('parent_invitation_not_pending'))).toBeTrue();
    expect(isInvitationAlreadyAccepted(errorWithCode('parent_invitation_not_found'))).toBeFalse();
  });

  it('detects an email mismatch', () => {
    expect(isEmailMismatch(errorWithCode('invitation_email_mismatch'))).toBeTrue();
    expect(isEmailMismatch(errorWithCode('parent_invitation_expired'))).toBeFalse();
  });

  it('detects a consent-required backstop from join()', () => {
    expect(isConsentRequired(errorWithCode('member_consent_required'))).toBeTrue();
    expect(isConsentRequired(errorWithCode('membership_required'))).toBeFalse();
  });

  it('maps known codes to i18n keys', () => {
    expect(inviteErrorKey(errorWithCode('parent_invitation_not_found'))).toBe(
      'academy.invite.errors.parentInvitationNotFound'
    );
    expect(inviteErrorKey(errorWithCode('parent_invitation_expired'))).toBe(
      'academy.invite.errors.parentInvitationExpired'
    );
    expect(inviteErrorKey(errorWithCode('invitation_email_mismatch'))).toBe(
      'academy.invite.errors.emailMismatch'
    );
    expect(inviteErrorKey(errorWithCode('membership_required'))).toBe(
      'academy.invite.errors.membershipRequired'
    );
    expect(inviteErrorKey(errorWithCode('member_consent_required'))).toBe(
      'academy.invite.errors.memberConsentRequired'
    );
  });

  it('falls back to a generic key for unknown codes', () => {
    expect(inviteErrorKey(errorWithCode('something_unmapped'))).toBe('academy.invite.errors.generic');
  });

  it('falls back to a generic key when the error has no code at all', () => {
    const error = new HttpErrorResponse({ error: {} });
    expect(inviteErrorKey(error)).toBe('academy.invite.errors.generic');
  });
});
