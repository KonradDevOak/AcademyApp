# @shared/iam-msal-external

Biblioteka do obsługi **Entra External ID (CIAM)** - autentykacja klientów zewnętrznych.

## 📦 Wymaga

- `@shared/iam-msal-core` - wspólne abstrakcje i interfejsy
- `@shared/core` - wspólne typy i serwisy

## ✨ Co zawiera

- ✅ **MsalExternalAuthService** - autentykacja przez External ID
- ✅ **ExternalConfigService** - konfiguracja z backendu
- ✅ **CustomerGuard** - route guard dla użytkowników
- ✅ **IamMsalExternalModule** - moduł Angular

## 🚀 Instalacja

```typescript
import { IamMsalExternalModule } from "@shared/iam-msal-external";

@NgModule({
  imports: [
    IamMsalExternalModule, // Customer auth (External ID)
  ],
})
export class AppModule {}
```

## 💡 Użycie

### 1. Konfiguracja backendu

Backend musi zwracać konfigurację z `/api/client-configuration`:

```json
{
  "production": false,
  "msalConfig": {
    "auth": {
      "clientId": "xxx-customer",
      "authority": "https://tenant.ciamlogin.com/tenant.onmicrosoft.com",
      "redirectUri": "http://localhost:4200",
      "postLogoutRedirectUri": "http://localhost:4200"
    },
    "cache": {
      "cacheLocation": "sessionStorage",
      "storeAuthStateInCookie": false
    }
  },
  "apiConfig": {
    "scopes": ["api://xxx-customer/access"],
    "uri": "https://api.example.com"
  }
}
```

### 2. Logowanie użytkownika

```typescript
import { MsalExternalAuthService } from '@shared/iam-msal-external';

@Component({...})
export class LoginComponent {
  constructor(private authService: MsalExternalAuthService) {}

  async login(): Promise<void> {
    await this.authService.loginRedirect();
  }

  async logout(): Promise<void> {
    await this.authService.logoutRedirect();
  }

  getUser() {
    return this.authService.getUserProfile();
  }

  isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }
}
```

### 3. Route Guards

```typescript
import { CustomerGuard } from "@shared/iam-msal-external";

const routes: Routes = [
  {
    path: "portal",
    canActivate: [CustomerGuard],
    loadChildren: () => import("./portal/portal.module"),
  },
];
```

## 🔐 Bezpieczeństwo

- Tokeny są przechowywane w `sessionStorage` (konfigurowane przez backend)
- Automatyczne odświeżanie tokenów przez MSAL
- Guard blokuje dostęp do route jeśli użytkownik nie jest zalogowany

## 📚 API Reference

### MsalExternalAuthService

```typescript
initialize(): Promise<void>
loginRedirect(): Promise<void>
logoutRedirect(): Promise<void>
getAccessToken(): Promise<Observable<string | null>>
getUserProfile(): UserProfile | null
isLoggedIn(): boolean
```

### ExternalConfigService

```typescript
loadConfig(): Observable<HttpResponse<AppConfigWithExternal>>
getConfig(): AppConfigWithExternal | null
isExternalIdConfigured(): boolean
```

## 🧪 Testowanie

```typescript
// Mock dla testów
providers: [
  {
    provide: ExternalConfigService,
    useValue: {
      getConfig: () => ({
        production: false,
        msalConfig: { /* ... */ },
        apiConfig: { /* ... */ }
      }),
    },
  },
];
```

## 📄 Licencja

MIT
