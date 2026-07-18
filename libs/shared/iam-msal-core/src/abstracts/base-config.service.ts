import { HttpResponse } from '@angular/common/http';
import { Observable, defer } from 'rxjs';
import { AppConfig } from '../interfaces/auth-config.interface';

/**
 * Template Method Pattern: Bazowa klasa dla konfiguracji
 * Definiuje wspólny algorytm ładowania i cache'owania konfiguracji
 *
 * @remarks
 * Uses native fetch() instead of HttpClient deliberately: this config is loaded
 * during APP_INITIALIZER, before the MSAL instance exists. Since AuthTokenInterceptor
 * (HTTP_INTERCEPTORS) needs MsalAuthService, which needs MSAL_INSTANCE, which needs
 * this config to already be loaded, routing this call through HttpClient would create
 * a circular bootstrap dependency (the interceptor chain would try to construct MSAL
 * before the config it depends on has arrived).
 */
export abstract class BaseConfigService<T extends AppConfig> {
  protected endpoint: string = '/api/client-configuration';
  protected config: T | null = null;
  protected configLoading: Observable<HttpResponse<T>> | null = null;

  /**
   * Template Method: Ładowanie konfiguracji
   * Wspólny algorytm dla Employee i Customer config
   */
  loadConfig(): Observable<HttpResponse<T>> {
    // Cache hit
    if (this.config) {
      return defer(() => Promise.resolve(new HttpResponse({ body: this.config })));
    }

    // Prevent race condition
    if (this.configLoading) {
      return this.configLoading;
    }

    this.configLoading = defer(() => this.fetchConfig());

    return this.configLoading;
  }

  private async fetchConfig(): Promise<HttpResponse<T>> {
    const response = await fetch(this.endpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) {
      this.configLoading = null;
      throw new Error(`Failed to load ${this.getConfigName()} configuration: ${response.status} ${response.statusText}`);
    }

    const body = await response.json() as T;

    if (!body) {
      this.configLoading = null;
      throw new Error(`Empty ${this.getConfigName()} configuration received from API`);
    }

    this.validateConfig(body);
    this.config = body;
    this.configLoading = null;

    return new HttpResponse({ body, status: response.status });
  }

  /**
   * Pobierz konfigurację z cache
   */
  getConfig(): T | null {
    return this.config;
  }

  /**
   * Sprawdza czy konfiguracja została już załadowana
   */
  isConfigLoaded(): boolean {
    return this.config !== null;
  }

  /**
   * Template Method: Walidacja konfiguracji
   * Wspólna logika + hook dla specyficznej walidacji
   */
  protected validateConfig(config: T): void {
    if (!config) {
      throw new Error(`${this.getConfigName()} configuration is null or undefined`);
    }

    // Walidacja Employee config (zawsze wymagana)
    this.validateEmployeeConfig(config);

    // Hook: Walidacja specyficzna dla implementacji (np. External config)
    this.validateSpecificConfig(config);
  }

  /**
   * Walidacja Employee config (wspólna dla wszystkich)
   */
  protected validateEmployeeConfig(config: T): void {
    if (!config.msalConfig) {
      console.error('❌ msalConfig is missing from configuration:', config);
      throw new Error('msalConfig is missing from configuration');
    }
    
    if (!config.msalConfig.auth) {
      console.error('❌ msalConfig.auth is missing from configuration:', config.msalConfig);
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
  }

  // ============================================
  // ABSTRACT METHODS (Hook Methods)
  // ============================================

  /**
   * Hook Method: Nazwa konfiguracji (do logowania)
   */
  protected abstract getConfigName(): string;

  /**
   * Hook Method: Specyficzna walidacja dla implementacji
   * @param config Konfiguracja do walidacji
   */
  protected abstract validateSpecificConfig(config: T): void;
}
