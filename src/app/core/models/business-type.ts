// StorefrontBusinessType enum member name on the backend for the single business type this app serves.
// Which sections an academy offers (groups, classes & passes) follows from its services, not its type —
// see sectionsOf in core/services/active-sections.ts.
export const ACADEMY_BUSINESS_TYPE = 'Academy';

// The backend lists and accepts memberships only in academies (GET /members/me/memberships,
// POST /members/{id}/join); the client re-checks so an unexpected type never shows up in the app.
export function isClubBusinessType(businessType: string | null | undefined): boolean {
  return businessType === ACADEMY_BUSINESS_TYPE;
}
