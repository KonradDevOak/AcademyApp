// Mirror of the Members module's JSON contract (Sandbox src/Modules/Members) as consumed by a
// browser client — see src/Modules/Members/CLAUDE.md and the native app's core/models/member.model.ts.
// Plain data shapes only, no @angular imports.

export interface StorefrontImageDto {
  id: string;
  url: string;
  fileName: string;
}

export interface MembershipDto {
  storefrontId: string;
  joinedAt: string;
  storefrontName: string | null;
  // StorefrontBusinessType enum member name ("Academy"). May be null when the backend's Storefronts lookup
  // fails (fail-open on the server side).
  businessType: string | null;
  // The academy's enabled service ids — decide which sections (groups, classes & passes) it offers.
  // Empty when the backend's Storefronts lookup fails.
  services: string[];
  // Owner-uploaded per-club background images, null until uploaded or when the backend lookup fails.
  clubBackgroundDarkImage: StorefrontImageDto | null;
  clubBackgroundLightImage: StorefrontImageDto | null;
}

// Returned by GET /api/members/me. The backend responds 200 with a `null` body (not 404) when no
// Member row exists yet — i.e. this identity has never called POST complete-profile — so callers must
// treat `null` the same as "profile not completed", not as a fetch failure.
export interface MemberDto {
  id: string;
  email: string;
  displayName: string | null;
  // Self-service contact profile — global across every storefront the member belongs to, replacing
  // the old per-storefront Academy Guardian entity. Null until the member fills in the "Profil" form.
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  profileCompletedAt: string | null;
}

// GET /api/members/{storefrontId}/consents/pending — one entry per document the owner has published
// that this member hasn't accepted the current version of yet. Empty array = nothing to accept.
export interface PendingMemberConsentDto {
  documentType: string;
  documentVersionId: string;
  versionLabel: string;
  contentUrl: string;
}

// GET /api/members/{storefrontId}/health-questionnaire — the latest own submission. AnswersJson is an opaque
// JSON string whose shape the client owns (see HealthQuestionnaireAnswers in the health-questionnaire screen).
export interface HealthQuestionnaireSubmissionDto {
  id: string;
  memberId: string;
  storefrontId: string;
  answersJson: string;
  submittedAt: string;
}
