# @shared/iam-msal-core

Wspólne abstrakcje i kod dla bibliotek **@shared/iam-msal** i **@shared/iam-msal-external**.

## 🎯 Wzorce projektowe

### 1. **Strategy Pattern** (`IAuthenticationStrategy`)

Definiuje wspólny interfejs dla strategii autentykacji Employee i Customer.

```typescript
export interface IAuthenticationStrategy {
  initialize(): Promise<void>;
  login(): Promise<Observable<any>>;
  getAccessToken(): Promise<Observable<string | null>>;
  getUserProfile(): UserProfile | null;
  // ...
}
```

### 2. **Template Method Pattern** (`BaseAuthService`)

Klasa bazowa definiująca szkielet algorytmu autentykacji z hook methods.

```typescript
export abstract class BaseAuthService implements IAuthenticationStrategy {
  // Wspólny algorytm
  async initialize(): Promise<void> {
    /* ... */
  }
  async login(): Promise<Observable<any>> {
    /* ... */
  }

  // Hook methods (do implementacji)
  protected abstract getMsalConfig(): MsalAuthConfig;
  protected abstract getApiConfig(): ApiConfig;
  protected abstract getTenantName(): string;
}
```

### 3. **Template Method Pattern** (`BaseConfigService`)

Klasa bazowa dla serwisów konfiguracji z cache'owaniem.

```typescript
export abstract class BaseConfigService<T extends AppConfig> {
  // Wspólny algorytm ładowania i walidacji
  loadConfig(): Observable<HttpResponse<T>> {
    /* ... */
  }

  // Hook methods
  protected abstract getConfigName(): string;
  protected abstract validateSpecificConfig(config: T): void;
}
```

### 4. **Factory Method Pattern**

Tworzenie MSAL instance w `BaseAuthService.initialize()`.

## 📦 Co zawiera

### Enums

- `TenantType` - Employee | Customer

### Interfaces

- `AppConfig` - pełna konfiguracja z oboma tenantami
- `MsalAuthConfig` - wspólna struktura MSAL config
- `ApiConfig` - wspólna struktura API config
- `UserProfile` - wspólny profil użytkownika

### Abstracts

- `BaseAuthService` - bazowa klasa dla auth services (Template Method)
- `BaseConfigService` - bazowa klasa dla config services (Template Method)

### Strategies

- `IAuthenticationStrategy` - interfejs dla strategii autentykacji (Strategy Pattern)

### Services

- `TenantService` - zarządzanie aktywnym tenantem

## 🚀 Użycie w bibliotekach pochodnych

### @shared/iam-msal (Employee)

```typescript
import { BaseAuthService, MsalAuthConfig, ApiConfig } from "@shared/iam-msal-core";

export class MsalAuthService extends BaseAuthService {
  constructor(private configService: ConfigService) {
    super();
  }

  // Hook methods implementation
  protected getMsalConfig(): MsalAuthConfig {
    return this.configService.getConfig()!.msalConfig;
  }

  protected getApiConfig(): ApiConfig {
    return this.configService.getConfig()!.apiConfig;
  }

  protected getTenantName(): string {
    return "Employee";
  }
}
```

### @shared/iam-msal-external (Customer)

```typescript
import { BaseAuthService, MsalAuthConfig, ApiConfig } from "@shared/iam-msal-core";

export class MsalExternalAuthService extends BaseAuthService {
  constructor(private configService: ExternalConfigService) {
    super();
  }

  // Hook methods implementation
  protected getMsalConfig(): MsalAuthConfig {
    return this.configService.getConfig()!.msalExternalConfig!;
  }

  protected getApiConfig(): ApiConfig {
    return this.configService.getConfig()!.apiExternalConfig!;
  }

  protected getTenantName(): string {
    return "Customer";
  }
}
```

## 🎨 Diagram klas

```
┌─────────────────────────────┐
│  IAuthenticationStrategy    │ ◄─── Strategy Pattern
└─────────────────────────────┘
            △
            │ implements
            │
┌─────────────────────────────┐
│     BaseAuthService          │ ◄─── Template Method Pattern
│  (Abstract)                  │
├─────────────────────────────┤
│ + initialize()               │ ◄─── Wspólny algorytm
│ + login()                    │
│ + getAccessToken()           │
│ # getMsalConfig()            │ ◄─── Hook methods
│ # getApiConfig()             │
│ # getTenantName()            │
└─────────────────────────────┘
            △
            │ extends
    ┌───────┴───────┐
    │               │
┌───────────┐  ┌────────────────┐
│  MsalAuth │  │ MsalExternalAuth│
│  Service  │  │     Service     │
└───────────┘  └─────────────────┘
 (Employee)       (Customer)
```

## ✅ Korzyści

1. **DRY** - eliminacja duplikacji kodu między iam-msal i iam-msal-external
2. **Consistency** - wspólne interfejsy zapewniają spójność API
3. **Extensibility** - łatwe dodanie nowych tenant types (np. Partner)
4. **Testability** - bazowe klasy łatwiejsze do testowania
5. **Maintainability** - zmiany w wspólnej logice w jednym miejscu

## 📝 Licencja

MIT
