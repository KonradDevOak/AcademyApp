import { Injectable } from '@angular/core';
import { BaseConfigService } from '@shared/iam-msal-core';
import { AppConfigWithExternal } from '../interfaces/external-config.interface';
import { environment } from '../../../../../src/environments/environment';

/**
 * Serwis rozszerzający BaseConfigService z @shared/iam-msal-core
 * Dodaje obsługę External ID config
 *
 * VENDORED FORK: `endpoint` is absolute (`environment.apiUrl` + path) rather than the upstream
 * library's relative `/api/member-configuration`. The upstream library targets web apps served
 * same-origin with the backend through an nginx proxy — a native Capacitor WebView has no such
 * proxy and a relative fetch would hit the WebView's own origin, not the real backend.
 */
@Injectable({
  providedIn: 'root'
})
export class ExternalConfigService extends BaseConfigService<AppConfigWithExternal> {
  protected override endpoint = `${environment.apiUrl}/api/member-configuration`;

  protected getConfigName(): string {
    return 'External (Employee + Customer)';
  }

  protected validateSpecificConfig(config: AppConfigWithExternal): void {
    // Walidacja External config
    if (!config.msalConfig) {
      throw new Error('msalConfig is missing from configuration');
    }
    
    if (!config.msalConfig.auth) {
      console.error('❌ msalConfig.auth is missing:', config.msalConfig);
      throw new Error('msalConfig.auth is missing from configuration');
    }
    
    if (!config.msalConfig.auth.clientId) {
      throw new Error('Required clientId missing in MSAL configuration');
    }
    if (!config.msalConfig.auth.authority) {
      throw new Error('Required authority missing in MSAL configuration');
    }
    
    if (!config.apiConfig?.scopes?.length) {
      throw new Error('Required scopes missing in API configuration');
    }
    
    console.log('✅ External ID configuration validated successfully');
  }

  /**
   * Sprawdza czy External ID jest skonfigurowany
   */
  isExternalIdConfigured(): boolean {
    const config = this.getConfig();
    return !!(config?.msalConfig && config?.apiConfig);
  }
}
