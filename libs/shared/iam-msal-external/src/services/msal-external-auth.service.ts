import { Injectable, NgZone } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of, from } from 'rxjs';
import { RedirectRequest, SilentRequest } from '@azure/msal-browser';
import { App, URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { ExternalConfigService } from './external-config.service';
import { IAuthenticationStrategy, UserProfile } from '@shared/iam-msal-core';

/**
 * Native custom URL scheme Entra redirects back to after the system-browser auth flow completes.
 * Must be registered as a redirect URI on the Members app registration in Entra External ID
 * (tenant `sandboxdevo`) — the same manual Azure Portal step already required for the User Flow
 * itself (see CLAUDE.md "Manual CIAM steps").
 */
const NATIVE_REDIRECT_URI = 'pl.localbiz.fitnessclub://auth-callback';

/**
 * Serwis autentykacji dla Entra External ID (klienci/CIAM)
 *
 * VENDORED FORK — this file was forked from `@shared/iam-msal-external` in the Sandbox repo and
 * modified for a Capacitor native shell. The upstream service uses `loginPopup`/`loginRedirect`
 * directly, which rely on real browser popup/full-page-navigation semantics that don't hold up
 * inside a Capacitor WebView (no real popup support; a full in-webview redirect away from the
 * app's own origin is a common source of native OAuth bugs). This fork instead uses MSAL's own
 * `onRedirectNavigate` extension point to hand the actual navigation off to `@capacitor/browser`
 * (system browser / Custom Tabs / ASWebAuthenticationSession) and completes the flow via
 * `handleRedirectPromise()` once Entra redirects back through a custom URL scheme, caught by
 * `@capacitor/app`'s `appUrlOpen` listener. This is MSAL's documented extension point for this
 * scenario — not a hand-rolled reimplementation of the OAuth/PKCE exchange itself.
 *
 * UNVERIFIED: this flow has not been exercised on a real device/emulator (no such environment is
 * available in this session — see CLAUDE.md "Testing"). Treat as the highest-risk unverified piece
 * of the auth rework until confirmed manually.
 */
@Injectable({ providedIn: 'root' })
export class MsalExternalAuthService implements IAuthenticationStrategy {
  private readonly _isLoadingSource = new BehaviorSubject<boolean>(false);
  private readonly _destroy = new Subject<void>();
  private _isLoggedIn = new BehaviorSubject<boolean>(false);
  private externalMsalInstance: any = null;
  private pendingRedirectResolve: ((success: boolean) => void) | null = null;

  public readonly isLoading$ = this._isLoadingSource.asObservable();
  public readonly isLoggedIn$ = this._isLoggedIn.asObservable();

  constructor(private configService: ExternalConfigService, private zone: NgZone) {
    // Registered eagerly (not lazily on first login) so a redirect callback arriving while the
    // app was merely backgrounded (not killed) during the system-browser round trip is still
    // caught. A fully-killed-and-relaunched-via-deep-link cold start is NOT handled — known gap.
    App.addListener('appUrlOpen', (event: URLOpenListenerEvent) =>
      this.zone.run(() => this.handleAppUrlOpen(event.url)));
  }

  /**
   * IAuthenticationStrategy: Initialize
   */
  async initialize(): Promise<void> {
    await this.initializeExternalInstance();
  }

  /**
   * Inicjalizuje External MSAL instance dynamicznie
   */
  async initializeExternalInstance(): Promise<void> {
    if (this.externalMsalInstance) {
      console.log('✅ External MSAL instance already initialized');
      return;
    }

    const config = this.configService.getConfig();
    if (!config?.msalConfig) {
      throw new Error('External MSAL configuration not available');
    }

    try {
      const { PublicClientApplication } = await import('@azure/msal-browser');

      this.externalMsalInstance = new PublicClientApplication({
        auth: config.msalConfig.auth,
        cache: config.msalConfig.cache
      });

      await this.externalMsalInstance.initialize();
      console.log('✅ External MSAL instance initialized successfully');

      this.checkAndSetActiveAccount();
    } catch (error) {
      console.error('❌ Failed to initialize External MSAL instance:', error);
      throw error;
    }
  }

  public checkAndSetActiveAccount(): void {
    if (!this.externalMsalInstance) {
      console.warn('External MSAL instance not initialized');
      return;
    }

    let activeAccount = this.externalMsalInstance.getActiveAccount();

    if (!activeAccount && this.externalMsalInstance.getAllAccounts().length > 0) {
      let accounts = this.externalMsalInstance.getAllAccounts();
      this.externalMsalInstance.setActiveAccount(accounts[0]);
      activeAccount = accounts[0];
    }

    this._isLoggedIn.next(!!activeAccount);
    this._isLoadingSource.next(false);
  }

  private getConfig() {
    const config = this.configService.getConfig();
    if (!config?.msalConfig || !config?.apiConfig) {
      throw new Error('External configuration not loaded - cannot authenticate external users');
    }
    return config;
  }

  public login(): Observable<boolean> {
    return from(this.doLogin());
  }

  private async doLogin(): Promise<boolean> {
    await this.ensureInitialized();

    this._isLoadingSource.next(true);

    if (this.externalMsalInstance.getActiveAccount()) {
      this._isLoadingSource.next(false);
      return true;
    }

    return new Promise<boolean>((resolve) => {
      this.pendingRedirectResolve = resolve;

      const loginRequest: RedirectRequest = {
        scopes: this.getConfig().apiConfig!.scopes,
        redirectUri: NATIVE_REDIRECT_URI,
        onRedirectNavigate: (url: string) => {
          Browser.open({ url });
          return false; // tell MSAL not to navigate the WebView itself
        }
      };

      this.externalMsalInstance.loginRedirect(loginRequest).catch((error: unknown) => {
        console.error('External login failed:', error);
        this._isLoadingSource.next(false);
        this.pendingRedirectResolve = null;
        resolve(false);
      });
    });
  }

  public async loginRedirect(): Promise<void> {
    await this.ensureInitialized();

    this._isLoadingSource.next(true);

    const loginRequest: RedirectRequest = {
      scopes: this.getConfig().apiConfig!.scopes,
      redirectUri: NATIVE_REDIRECT_URI,
      onRedirectNavigate: (url: string) => {
        Browser.open({ url });
        return false;
      }
    };

    await this.externalMsalInstance.loginRedirect(loginRequest);
  }

  /**
   * Login z email hint (używane w LoginHintComponent)
   */
  public async loginWithHint(loginHint: string): Promise<void> {
    await this.ensureInitialized();

    this._isLoadingSource.next(true);

    const loginRequest: RedirectRequest = {
      scopes: this.getConfig().apiConfig!.scopes,
      redirectUri: NATIVE_REDIRECT_URI,
      loginHint: loginHint,
      onRedirectNavigate: (url: string) => {
        Browser.open({ url });
        return false;
      }
    };

    await this.externalMsalInstance.loginRedirect(loginRequest);
  }

  /**
   * Called by the `appUrlOpen` listener once Entra redirects back through NATIVE_REDIRECT_URI.
   * Completes whichever login()/loginRedirect()/loginWithHint() call is in flight by finishing
   * MSAL's redirect handshake (handleRedirectPromise) against the callback URL's fragment.
   */
  private async handleAppUrlOpen(url: string): Promise<void> {
    if (!url.startsWith(NATIVE_REDIRECT_URI)) {
      return;
    }

    await Browser.close().catch(() => { /* already closed, ignore */ });

    try {
      await this.ensureInitialized();

      const fragment = url.includes('#') ? url.substring(url.indexOf('#')) : '';
      const result = await this.externalMsalInstance.handleRedirectPromise(fragment);

      if (result?.account) {
        this.externalMsalInstance.setActiveAccount(result.account);
      }
      this.checkAndSetActiveAccount();
      this.pendingRedirectResolve?.(!!result?.account);
    } catch (error) {
      console.error('External login redirect handling failed:', error);
      this._isLoadingSource.next(false);
      this.pendingRedirectResolve?.(false);
    } finally {
      this.pendingRedirectResolve = null;
    }
  }

  public logout(): Observable<boolean> {
    return from(this.doLogout());
  }

  /**
   * Clears the local MSAL token cache/active account only — does NOT end the Entra hosted session
   * (that would need the same system-browser round trip as login, via logoutRedirect). Deliberate
   * simplification for a native "sign out" button: a subsequent login may silently SSO back in via
   * the IdP-side session cookie still held in the system browser. Acceptable for v1; revisit if a
   * true single-logout is required.
   */
  private async doLogout(): Promise<boolean> {
    await this.ensureInitialized();

    this._isLoadingSource.next(true);

    try {
      const account = this.externalMsalInstance.getActiveAccount();
      if (account) {
        await this.externalMsalInstance.clearCache({ account });
      }
      this.externalMsalInstance.setActiveAccount(null);
      this._isLoggedIn.next(false);
      this._isLoadingSource.next(false);
      return true;
    } catch (error) {
      console.error('External logout failed:', error);
      this._isLoadingSource.next(false);
      return false;
    }
  }

  public async logoutRedirect(): Promise<void> {
    await this.doLogout();
  }

  public async getAccessToken(): Promise<Observable<string | null>> {
    await this.ensureInitialized();

    if (!this.externalMsalInstance.getActiveAccount()) {
      return of(null);
    }

    const request: SilentRequest = {
      scopes: this.getConfig().apiConfig!.scopes,
      account: this.externalMsalInstance.getActiveAccount()!
    };

    try {
      const result = await this.externalMsalInstance.acquireTokenSilent(request);
      return of(result.accessToken);
    } catch (error) {
      console.error('External token acquisition failed:', error);
      return of(null);
    }
  }

  public getUserProfile(): UserProfile | null {
    if (!this.externalMsalInstance) {
      return null;
    }

    const account = this.externalMsalInstance.getActiveAccount();
    if (account) {
      const claims = account.idTokenClaims as any;
      const user: UserProfile = {
        id: claims?.oid ?? '',
        email: account.username ?? '',
        name: account.name ?? '',
        roles: [],
      };

      if (claims) {
        if (claims.roles && Array.isArray(claims.roles)) {
          user.roles = claims.roles;
        } else if (claims.groups && Array.isArray(claims.groups)) {
          user.roles = claims.groups;
        }
      }

      return user;
    }

    return null;
  }

  public async authorize(): Promise<Observable<{ isAuthorized: boolean }>> {
    await this.ensureInitialized();

    const account = this.externalMsalInstance.getActiveAccount();
    return of({ isAuthorized: !!account });
  }

  public get isLoading(): boolean {
    return this._isLoadingSource.getValue();
  }

  public set isLoading(value: boolean) {
    this._isLoadingSource.next(value);
  }

  // IAuthenticationStrategy: isLoggedIn as method
  isLoggedIn(): boolean {
    return this._isLoggedIn.getValue();
  }

  public getAccountInfo() {
    if (!this.externalMsalInstance) {
      return {
        activeAccount: null,
        allAccounts: [],
        hasAccounts: false
      };
    }

    const activeAccount = this.externalMsalInstance.getActiveAccount();
    const allAccounts = this.externalMsalInstance.getAllAccounts();

    return {
      activeAccount,
      allAccounts,
      hasAccounts: allAccounts.length > 0
    };
  }

  public destroy(): void {
    this._destroy.next();
    this._destroy.complete();
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.externalMsalInstance) {
      await this.initializeExternalInstance();
    }
  }
}
