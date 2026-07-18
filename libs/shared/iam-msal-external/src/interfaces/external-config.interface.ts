/**
 * Konfiguracja MSAL dla External ID
 */
export interface MsalExternalConfig {
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
}

/**
 * Konfiguracja API dla External ID
 */
export interface ApiExternalConfig {
  scopes: string[];
  uri: string;
}

/**
 * Konfiguracja aplikacji dla External ID (CIAM)
 * Standalone - używa standardowych nazw msalConfig/apiConfig
 */
export interface AppConfigWithExternal {
  production: boolean;
  
  // External ID (CIAM) - standardowe nazwy jak w @shared/iam-msal
  msalConfig: MsalExternalConfig;
  apiConfig: ApiExternalConfig;
}
