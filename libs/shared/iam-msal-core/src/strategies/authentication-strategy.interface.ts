import { Observable } from 'rxjs';
import { UserProfile } from '../interfaces/auth-config.interface';

/**
 * Strategy Pattern: Interfejs dla strategii autentykacji
 * Implementowany przez EmployeeAuthStrategy i CustomerAuthStrategy
 */
export interface IAuthenticationStrategy {
  /**
   * Inicjalizacja MSAL instance
   */
  initialize(): Promise<void>;
  
  /**
   * Login (redirect-based)
   */
  login(): Observable<boolean>;

  /**
   * Login redirect
   */
  loginRedirect(): Promise<void>;

  /**
   * Login z email hint
   */
  loginWithHint(email: string): Promise<void>;

  /**
   * Logout (redirect-based)
   */
  logout(): Observable<boolean>;
  
  /**
   * Logout redirect
   */
  logoutRedirect(): Promise<void>;
  
  /**
   * Pobierz access token
   */
  getAccessToken(): Promise<Observable<string | null>>;
  
  /**
   * Pobierz profil użytkownika
   */
  getUserProfile(): UserProfile | null;
  
  /**
   * Sprawdź czy użytkownik jest zalogowany
   */
  isLoggedIn(): boolean;
  
  /**
   * Sprawdź czy użytkownik jest autoryzowany
   */
  authorize(): Promise<Observable<{ isAuthorized: boolean }>>;
  
  /**
   * Pobierz informacje o koncie
   */
  getAccountInfo(): {
    activeAccount: any;
    allAccounts: any[];
    hasAccounts: boolean;
  };
}
