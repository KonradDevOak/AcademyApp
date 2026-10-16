import { inject } from '@angular/core';
import { CanActivateChildFn, CanActivateFn, Router } from '@angular/router';
import { Section, membershipHome, sectionsOf } from '../services/active-sections';
import { MembershipContextService } from '../services/membership-context';
import { StorefrontContextService } from '../services/storefront-context';

// Runs after CustomerGuard (auth) on the shell's content routes. Ensures the membership list is
// loaded, then routes the user based on how many academies they belong to:
//   0            -> /find-club
//   1            -> proceed (academy auto-selected)
//   >1, chosen   -> proceed
//   >1, no pick  -> /clubs
// A failed fetch fails open (proceed) — the shell surfaces the error state itself.
const resolveActiveStorefront: CanActivateFn = async () => {
  const membershipContext = inject(MembershipContextService);
  const storefrontContext = inject(StorefrontContextService);
  const router = inject(Router);

  await membershipContext.ensureLoaded();

  if (membershipContext.status() === 'error') {
    return true;
  }

  const resolution = storefrontContext.resolveForNavigation(membershipContext.memberships());
  switch (resolution.outcome) {
    case 'empty':
      return router.parseUrl('/find-club');
    case 'needs-picker':
      return router.parseUrl('/clubs');
    default:
      return true;
  }
};

export const activeStorefrontGuard: CanActivateFn = resolveActiveStorefront;
export const activeStorefrontChildGuard: CanActivateChildFn = resolveActiveStorefront;

// Keeps /academy/* and /classes/* consistent with the active academy: a deep link into a section the academy
// does not offer (or a stale tab after switching academies) lands on the academy's own home instead of
// rendering screens whose API calls would target a module it has switched off. Runs after
// activeStorefrontChildGuard, so an academy is already selected (or the membership fetch failed, which
// fails open here too).
export function requireSection(section: Section): CanActivateChildFn {
  return () => {
    const membershipContext = inject(MembershipContextService);
    const storefrontContext = inject(StorefrontContextService);
    const router = inject(Router);

    const selectedId = storefrontContext.selectedStorefrontId();
    const membership = membershipContext.memberships().find((m) => m.storefrontId === selectedId);
    if (!membership) {
      return true;
    }

    return sectionsOf(membership.services).includes(section) ? true : router.parseUrl(membershipHome(membership));
  };
}

// Entry route ('' inside the shell): many academies -> the "Moje akademie" dashboard, one academy ->
// straight into its first section, none -> the academy finder. Always redirects, never renders.
export const homeRedirectGuard: CanActivateFn = async () => {
  const membershipContext = inject(MembershipContextService);
  const storefrontContext = inject(StorefrontContextService);
  const router = inject(Router);

  await membershipContext.ensureLoaded();
  const memberships = membershipContext.memberships();

  if (membershipContext.status() === 'error' || memberships.length > 1) {
    return router.parseUrl('/clubs');
  }
  if (memberships.length === 0) {
    return router.parseUrl('/find-club');
  }

  storefrontContext.select(memberships[0].storefrontId);
  return router.parseUrl(membershipHome(memberships[0]));
};
