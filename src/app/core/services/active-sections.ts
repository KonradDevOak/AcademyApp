import { Injectable, Signal, computed, inject } from '@angular/core';
import { NavItem, PROFILE_NAV_ITEM } from '../models/nav-item';
import { MembershipDto } from '../models/member';
import { MembershipContextService } from './membership-context';
import { StorefrontContextService } from './storefront-context';

// A section of the app an academy can offer: "Grupy" (children's groups, the academy module) and
// "Zajęcia i karnety" (class schedule and passes). An academy may offer one or both.
export type Section = 'academy' | 'classes';

// Fixed display order — groups first.
const SECTION_ORDER: readonly Section[] = ['academy', 'classes'];

const SECTION_HOME: Record<Section, string> = {
  academy: '/academy',
  classes: '/classes'
};

const SECTION_NAV_LABEL: Record<Section, string> = {
  academy: 'shell.nav.academy',
  classes: 'shell.nav.classes'
};

const SECTION_BADGE_LABEL: Record<Section, string> = {
  academy: 'clubs.verticalAcademy',
  classes: 'clubs.verticalFitness'
};

// Service sets that make a section usable — the same readiness rule the backend applies
// (BusinessTypeServiceRequirements for Academy): groups need the `academy` gate, classes need the
// schedule, passes and member registry together. A lone sub-feature never opens a section whose API
// calls would be refused.
const SECTION_REQUIRED_SERVICES: Record<Section, readonly string[]> = {
  academy: ['academy'],
  classes: ['classes_schedule', 'carnets_billing', 'club_members']
};

// Sections an academy offers, derived from its enabled services.
export function sectionsOf(services: readonly string[] | null | undefined): Section[] {
  const enabled = new Set(services ?? []);
  return SECTION_ORDER.filter((section) => SECTION_REQUIRED_SERVICES[section].every((id) => enabled.has(id)));
}

// Landing route of an academy: its first section. An academy with no recognised section (services not
// loaded, or switched off since joining) lands on its card, which still offers consents and leaving.
export function homeFor(sections: readonly Section[], storefrontId?: string | null): string {
  if (sections.length > 0) {
    return SECTION_HOME[sections[0]];
  }
  return storefrontId ? `/clubs/${storefrontId}` : '/clubs';
}

export function sectionHome(section: Section): string {
  return SECTION_HOME[section];
}

// i18n key of a section's badge (club cards, finder results).
export function sectionLabelKey(section: Section): string {
  return SECTION_BADGE_LABEL[section];
}

// Home of a membership's academy — shorthand for the switcher, the dashboard and the guards.
export function membershipHome(membership: MembershipDto): string {
  return homeFor(sectionsOf(membership.services), membership.storefrontId);
}

// Derives the active academy's sections from the active membership's services, which ride along on
// GET /members/me/memberships (no extra request). Switching the active academy switches the sections
// (and so the header nav) with it.
@Injectable({ providedIn: 'root' })
export class ActiveSectionsService {
  private readonly membershipContext = inject(MembershipContextService);
  private readonly storefrontContext = inject(StorefrontContextService);

  readonly activeMembership: Signal<MembershipDto | null> = computed(() => {
    const selectedId = this.storefrontContext.selectedStorefrontId();
    return this.membershipContext.memberships().find((m) => m.storefrontId === selectedId) ?? null;
  });

  readonly sections: Signal<Section[]> = computed(() => sectionsOf(this.activeMembership()?.services));

  readonly homePath: Signal<string> = computed(() => {
    const membership = this.activeMembership();
    return membership ? membershipHome(membership) : '/';
  });

  readonly navItems: Signal<readonly NavItem[]> = computed(() => [
    ...this.sections().map((section) => ({ path: SECTION_HOME[section], label: SECTION_NAV_LABEL[section] })),
    PROFILE_NAV_ITEM
  ]);

  readonly activeClubName: Signal<string | null> = computed(
    () => this.activeMembership()?.storefrontName ?? null
  );
}
