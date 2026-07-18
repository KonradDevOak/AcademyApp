/**
 * Wspólna konfiguracja MSAL (Employee i Customer mają taką samą strukturę)
 */
export interface MsalAuthConfig {
  auth: {
    clientId: string;
    authority: string;
    redirectUri: string;
    postLogoutRedirectUri: string;
  };
  cache: {
    cacheLocation: string;
    storeAuthStateInCookie: boolean;
  };
  system?: {
    allowNativeBroker: boolean;
  };
}

/**
 * Wspólna konfiguracja API
 */
export interface ApiConfig {
  scopes: string[];
  uri: string;
}

/**
 * Bazowa konfiguracja aplikacji
 */
export interface BaseAppConfig {
  production: boolean;
}

/**
 * Pełna konfiguracja aplikacji z oboma tenantami
 */
export interface AppConfig extends BaseAppConfig {
  // Employee (Entra ID)
  msalConfig: MsalAuthConfig;
  apiConfig: ApiConfig;
  
  // Customer (External ID) - opcjonalne
  msalExternalConfig?: MsalAuthConfig;
  apiExternalConfig?: ApiConfig;
}

/**
 * Profil użytkownika (wspólny dla Employee i Customer).
 * id/email/name/roles pochodzą z claims tokenu ID. Pozostałe pola są opcjonalne —
 * uzupełniane przez backend (zob. MsalAuthService.loadUserProfile() w @shared/iam-msal),
 * którego token nie przenosi.
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  roles: string[];
  photoUrl?: string;
  givenName?: string;
  surname?: string;
  streetAddress?: string;
  city?: string;
  stateProvince?: string;
  postalCode?: string;
  country?: string;
}
