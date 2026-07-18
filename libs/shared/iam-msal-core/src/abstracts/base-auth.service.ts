import { BehaviorSubject, Observable, Subject, defer, of } from 'rxjs';
import { RedirectRequest, SilentRequest, PublicClientApplication } from '@azure/msal-browser';
import { IAuthenticationStrategy } from '../strategies/authentication-strategy.interface';
import { UserProfile, MsalAuthConfig, ApiConfig } from '../interfaces/auth-config.interface';

/**
 * Template Method Pattern: Abstrakcyjna klasa bazowa dla serwisów autentykacji
 * Definiuje szkielet algorytmu autentykacji, z hooka mi dla konkretnych implementacji
 */
export abstract class BaseAuthService implements IAuthenticationStrategy {
  protected readonly _isLoadingSource = new BehaviorSubject<boolean>(false);
  protected readonly _destroy = new Subject<void>();
  protected _isLoggedIn = new BehaviorSubject<boolean>(false);
  protected msalInstance: PublicClientApplication | null = null;

  public readonly isLoading$ = this._isLoadingSource.asObservable();
  public readonly isLoggedIn$ = this._isLoggedIn.asObservable();

  /**
   * Template Method: Inicjalizacja MSAL instance
   * Wykorzystuje Factory Method Pattern dla utworzenia instance
   */
  async initialize(): Promise<void> {
    if (this.msalInstance) {
      console.log(`✅ ${this.getTenantName()} MSAL instance already initialized`);
      return;
    }

    const config = this.getMsalConfig();
    if (!config) {
      throw new Error(`${this.getTenantName()} MSAL configuration not available`);
    }

    try {
      this.msalInstance = new PublicClientApplication({
        auth: config.auth,
        cache: config.cache
      });

      await this.msalInstance.initialize();
      console.log(`✅ ${this.getTenantName()} MSAL instance initialized successfully`);
      
      this.checkAndSetActiveAccount();
    } catch (error) {
      console.error(`❌ Failed to initialize ${this.getTenantName()} MSAL instance:`, error);
      throw error;
    }
  }

  /**
   * Template Method: Sprawdza i ustawia aktywne konto
   */
  checkAndSetActiveAccount(): void {
    if (!this.msalInstance) {
      console.warn(`${this.getTenantName()} MSAL instance not initialized`);
      return;
    }

    let activeAccount = this.msalInstance.getActiveAccount();

    if (!activeAccount && this.msalInstance.getAllAccounts().length > 0) {
      const accounts = this.msalInstance.getAllAccounts();
      this.msalInstance.setActiveAccount(accounts[0]);
      activeAccount = accounts[0];
    }

    this._isLoggedIn.next(!!activeAccount);
    this._isLoadingSource.next(false);
  }

  /**
   * Template Method: Login popup
   */
  login(): Observable<boolean> {
    return defer(async () => {
      await this.ensureInitialized();

      this._isLoadingSource.next(true);

      if (this.msalInstance!.getActiveAccount()) {
        this._isLoadingSource.next(false);
        return true;
      }

      const loginRequest: RedirectRequest = {
        scopes: this.getApiConfig().scopes
      };

      try {
        await this.msalInstance!.loginPopup(loginRequest);
        this.checkAndSetActiveAccount();
        this._isLoadingSource.next(false);
        return true;
      } catch (error) {
        console.error(`${this.getTenantName()} login failed:`, error);
        this._isLoadingSource.next(false);
        throw error;
      }
    });
  }

  /**
   * Template Method: Login redirect
   */
  async loginRedirect(): Promise<void> {
    await this.ensureInitialized();
    
    this._isLoadingSource.next(true);

    const loginRequest: RedirectRequest = {
      scopes: this.getApiConfig().scopes
    };

    await this.msalInstance!.loginRedirect(loginRequest);
  }

  /**
   * Template Method: Login z email hint
   */
  async loginWithHint(email: string): Promise<void> {
    await this.ensureInitialized();
    
    this._isLoadingSource.next(true);

    const loginRequest: RedirectRequest = {
      scopes: this.getApiConfig().scopes,
      loginHint: email
    };

    await this.msalInstance!.loginRedirect(loginRequest);
  }

  /**
   * Template Method: Logout popup
   */
  logout(): Observable<boolean> {
    return defer(async () => {
      await this.ensureInitialized();

      this._isLoadingSource.next(true);

      try {
        const config = this.getMsalConfig();
        await this.msalInstance!.logoutPopup({
          postLogoutRedirectUri: config.auth.postLogoutRedirectUri,
          mainWindowRedirectUri: config.auth.postLogoutRedirectUri
        });

        this._isLoggedIn.next(false);
        this._isLoadingSource.next(false);
        return true;
      } catch (error) {
        console.error(`${this.getTenantName()} logout failed:`, error);
        this._isLoadingSource.next(false);
        throw error;
      }
    });
  }

  /**
   * Template Method: Logout redirect
   */
  async logoutRedirect(): Promise<void> {
    await this.ensureInitialized();
    
    const config = this.getMsalConfig();
    await this.msalInstance!.logoutRedirect({
      postLogoutRedirectUri: config.auth.postLogoutRedirectUri
    });
  }

  /**
   * Template Method: Pobierz access token
   */
  async getAccessToken(): Promise<Observable<string | null>> {
    await this.ensureInitialized();
    
    if (!this.msalInstance!.getActiveAccount()) {
      return of(null);
    }

    const request: SilentRequest = {
      scopes: this.getApiConfig().scopes,
      account: this.msalInstance!.getActiveAccount()!
    };

    try {
      const result = await this.msalInstance!.acquireTokenSilent(request);
      return of(result.accessToken);
    } catch (error) {
      console.error(`${this.getTenantName()} token acquisition failed:`, error);
      return of(null);
    }
  }

  /**
   * Template Method: Pobierz profil użytkownika
   */
  getUserProfile(): UserProfile | null {
    if (!this.msalInstance) {
      return null;
    }

    const account = this.msalInstance.getActiveAccount();
    if (account) {
      const claims = account.idTokenClaims as any;
      const user: UserProfile = {
        id: claims?.oid ?? '',
        email: account.username ?? '',
        name: account.name ?? '',
        roles: this.extractRoles(claims),
      };

      return user;
    }

    return null;
  }

  /**
   * Template Method: Ekstrakcja ról z claims
   * Hook method - może być nadpisany w klasach pochodnych
   */
  protected extractRoles(claims: any): string[] {
    if (!claims) return [];
    
    if (claims.roles && Array.isArray(claims.roles)) {
      return claims.roles;
    } else if (claims.groups && Array.isArray(claims.groups)) {
      return claims.groups;
    }
    
    return [];
  }

  /**
   * Template Method: Autoryzacja
   */
  async authorize(): Promise<Observable<{ isAuthorized: boolean }>> {
    await this.ensureInitialized();
    
    const account = this.msalInstance!.getActiveAccount();
    return of({ isAuthorized: !!account });
  }

  /**
   * Template Method: Informacje o koncie
   */
  getAccountInfo() {
    if (!this.msalInstance) {
      return {
        activeAccount: null,
        allAccounts: [],
        hasAccounts: false
      };
    }

    const activeAccount = this.msalInstance.getActiveAccount();
    const allAccounts = this.msalInstance.getAllAccounts();

    return {
      activeAccount,
      allAccounts,
      hasAccounts: allAccounts.length > 0
    };
  }

  /**
   * Gettery/Settery
   */
  isLoggedIn(): boolean {
    return this._isLoggedIn.getValue();
  }

  get isLoading(): boolean {
    return this._isLoadingSource.getValue();
  }

  set isLoading(value: boolean) {
    this._isLoadingSource.next(value);
  }

  /**
   * Cleanup
   */
  destroy(): void {
    this._destroy.next();
    this._destroy.complete();
  }

  /**
   * Pomocnicza metoda - zapewnia inicjalizację
   */
  protected async ensureInitialized(): Promise<void> {
    if (!this.msalInstance) {
      await this.initialize();
    }
  }

  // ============================================
  // ABSTRACT METHODS (Hook Methods) - muszą być zaimplementowane przez klasy pochodne
  // ============================================

  /**
   * Hook Method: Pobiera konfigurację MSAL specyficzną dla tenant'a
   */
  protected abstract getMsalConfig(): MsalAuthConfig;

  /**
   * Hook Method: Pobiera konfigurację API specyficzną dla tenant'a
   */
  protected abstract getApiConfig(): ApiConfig;

  /**
   * Hook Method: Zwraca nazwę tenant'a (do logowania)
   */
  protected abstract getTenantName(): string;
}
