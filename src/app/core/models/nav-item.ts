// Navigation entries rendered by the app shell header. `label` is an i18n key (see
// public/assets/i18n/pl.json shell.nav.*), rendered through TranslatePipe in app-shell.html — not
// translated text itself. The section entries come first and depend on the active academy's services
// (ActiveSectionsService.navItems); the profile entry is always there.

export interface NavItem {
  path: string;
  label: string;
}

export const PROFILE_NAV_ITEM: NavItem = { path: '/profile', label: 'shell.nav.profile' };
