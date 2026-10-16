// Survives the CIAM login round trip in the system browser (localStorage, not signals — Android may kill
// the backgrounded app meanwhile, and sessionStorage would die with it). Namespaced like the other
// academy.* storage keys to avoid colliding with MSAL's own storage entries; a one-shot handoff for the
// current invitation attempt, cleared once it is accepted.
//
// Belt-and-braces alongside the primary mechanism: InviteComponent sends an unauthenticated visitor
// to /login?returnUrl=<full /invite URL incl. query>, and MSAL's navigateToLoginRequestUrl already
// restores that full URL (query string included) after CIAM redirects back to /login. This context
// is a fallback for the case where the query string doesn't survive that round trip intact.
const ACADEMY_INVITE_CONTEXT_STORAGE_KEY = 'academy.academy-invite-context';

export interface AcademyInviteContext {
  token: string;
  storefrontId: string;
}

export function saveInviteContext(context: AcademyInviteContext): void {
  try {
    localStorage.setItem(ACADEMY_INVITE_CONTEXT_STORAGE_KEY, JSON.stringify(context));
  } catch {
    // Private-browsing modes can throw on access — the invite page will just show its invalid-link
    // state if the query string is also missing after the login round trip.
  }
}

// Not removed here on read — a restart mid-flow (e.g. the parent closes and reopens the app while
// filling in the profile form) can re-read the same context and resume. Callers clear it
// explicitly once the invitation is accepted (see clearInviteContext()).
export function readInviteContext(): AcademyInviteContext | null {
  try {
    const raw = localStorage.getItem(ACADEMY_INVITE_CONTEXT_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as Partial<AcademyInviteContext>;
    return parsed.token && parsed.storefrontId
      ? { token: parsed.token, storefrontId: parsed.storefrontId }
      : null;
  } catch {
    return null;
  }
}

export function clearInviteContext(): void {
  try {
    localStorage.removeItem(ACADEMY_INVITE_CONTEXT_STORAGE_KEY);
  } catch {
    // Ignore — worst case the next read finds a stale entry from an already-accepted invitation.
  }
}
