# CLAUDE.md

## Co to jest

Clubhouse — natywna appka klubowicza (Android/iOS, Ionic 8 + Capacitor 7 + Angular 20) platformy
LocalBiz. Wyekstrahowana 2026-07-18 z `Sandbox/src/Clients/Mobile` (dawniej opisywana jako appka
właściciela — w praktyce zawierała martwy kod po nieudanym pivocie w stronę weryfikacji autentyczności
produktów; ten kod został usunięty, nie zmigrowany).

**Nazewnictwo — repo vs. tożsamość appki (2026-07-24)**: "Clubhouse" to nazwa repo/projektu, nie
zmienia się. Rzeczywista tożsamość natywna appki (bundle id/`applicationId`, display name, custom
URL scheme) była na krótko rebrandowana na `pl.localbiz.clubhouse`/"Clubhouse", ale to zostało
cofnięte z powrotem na `pl.localbiz.fitnessclub`/"FitnessClub" — to jest ostateczny, docelowy stan
(nie stary/martwy kod do posprzątania). Zob. "Rebrand natywny" niżej po aktualne wartości.

Trzy frontendy platformy LocalBiz, wszystkie mówiące z jednym backendem w repo `Sandbox`:

| Appka | Repo | Odbiorca |
|---|---|---|
| LocalBizWeb | `Sandbox/src/Clients/LocalBizWeb` | właściciel klubu (panel `/club`: grafik, karnety) |
| Showcase | `Workspace/Showcase` (osobne repo) | odwiedzający — publiczna wizytówka, **bez logowania** |
| **Clubhouse** | `Workspace/Clubhouse` (to repo) | klubowicz — logowanie, grafik, karnety, zgody |

Pełny kontrakt backendu (Members/Classes/Carnets/Notifications, endpointy member-facing):
`Sandbox/ai/BACKEND_CAPABILITIES.md` + per-moduł `CLAUDE.md` w `Sandbox/src/Modules/*/CLAUDE.md`.
Ten plik nie jest `@`-importowany stamtąd (w przeciwieństwie do Showcase) — backend zmienia się
niezależnie, sprawdzaj tamte pliki bezpośrednio przy dużych zmianach kontraktu.

## Komendy

```bash
npm install
npm start                # ionic serve — web preview w przeglądarce
npm run build
npx cap sync android
npx cap sync ios
npx cap open android      # Android Studio
npx cap open ios          # Xcode
npm test                  # Karma/Jasmine — pokrycie minimalne, patrz "Testing" niżej
npm run lint
```

`npm start`/`ionic serve` renderuje te same komponenty co appka natywna, ale **nie może** zweryfikować
niczego zależnego od natywnych pluginów Capacitora (`@capacitor/browser`, `@capacitor/app`'s
`appUrlOpen`, deep linki) — te silently no-op-ują w zwykłej przeglądarce. Login CIAM (patrz niżej) da
się więc obejrzeć wizualnie w `ionic serve`, ale round-trip nigdy się nie zamknie bez realnego
urządzenia/emulatora.

**`ng build` domyślnie jest "production"** — `angular.json`'s `architect.build.configurations` ma
`"defaultConfiguration": "production"`, więc zwykłe `npm run build` **zawsze** robi `fileReplacements`
(`environment.ts` → `environment.prod.ts`), niezależnie od tego, co wpiszesz do `environment.ts`. Do
testów na urządzeniu/emulatorze (nie na produkcyjnym backendzie) zawsze trzeba jawnie:
```bash
npm run build -- --configuration development
```
Pominięcie tego objawia się białym ekranem po starcie appki — bootstrap próbuje `fetch()` na
`https://api.localbiz.pl`, co na urządzeniu deweloperskim kończy się `net::ERR_NAME_NOT_RESOLVED`
połkniętym przez ogólny `TypeError: Failed to fetch` w konsoli (widoczne tylko przez zdalny debugging
WebView — `chrome://inspect` albo CDP na `webview_devtools_remote_<pid>`, nie przez zwykłe `adb
logcat`). `npx cap sync`/`npx cap run` same w sobie **nie** robią `ng build` — kopiują to, co już jest
w `www/`, więc łatwo przeoczyć, że kopiują stary/zły build.

## Backend URL — środowiskowy, nie runtime-owy

W przeciwieństwie do LocalBizWeb/Admin/Showcase (serwowane same-origin z backendem przez nginx/SWA
linked-backend, `/api/...` bez CORS), appka natywna nie ma takiego proxy — `src/environments/
environment.ts`/`environment.prod.ts` mają jawny `apiUrl` (`http://localhost:5000` dev,
`https://api.localbiz.pl` prod). Android emulator: podmień na `http://10.0.2.2:5000` (loopback z
emulatora do hosta ma inny adres niż `localhost`). Backendowe CORS musi dopuszczać origin WebView'a
(domyślnie `https://localhost` na Androidzie/iOS dla Capacitora) — niesprawdzone, patrz "Known gaps".

### Test na fizycznym urządzeniu Android przez USB (zweryfikowane 2026-07-24)

Zamiast emulatora/Wi-Fi — kabel USB + `adb reverse`, bez LAN IP, firewalla ani zależności od sieci
Wi-Fi (router z client isolation by to zablokował, USB nie):

1. USB debugging włączone na telefonie, `adb devices` widzi urządzenie jako `device`.
2. `adb reverse tcp:4214 tcp:4214` — przekierowuje `localhost:4214` na telefonie do `:4214` na hoście
   (nginx dev proxy, `Sandbox/dev/nginx.conf`). Trzeba powtórzyć po każdym nowym podłączeniu kabla.
3. `environment.ts`'s `apiUrl` zostaje `http://localhost:4214` (nie LAN IP, nie `10.0.2.2` — te są dla
   Wi-Fi/emulatora, zob. komentarze w pliku).
4. `android/app/src/main/res/xml/network_security_config.xml` musi mieć wyjątek
   `cleartextTrafficPermitted="true"` dla domeny `localhost`, nie tylko dla `10.0.2.2` (emulator) —
   inaczej Android blokuje cały ruch `http://` z WebView do backendu mimo poprawnego `adb reverse`.
5. `npm run build -- --configuration development` (zob. wyżej) — inaczej biały ekran mimo poprawnych
   punktów 1-4.
6. `npx cap sync android && npx cap run android` (lub `npx cap open android` → Run z Android Studio).

**Zweryfikowane na żywym urządzeniu (Infinix X676C), CIAM login round-trip w pełni działający
(2026-07-25)**: cały bootstrap (`member-configuration` fetch), routing do `/login`, otwarcie systemowej
przeglądarki przez `onRedirectNavigate`/`Browser.open()` na prawdziwy ekran CIAM (tenant `ciamlocalbiz`,
`localbiz.ciamlogin.com`), powrót przez `appUrlOpen`/`pl.localbiz.fitnessclub://auth-callback`, wymiana
kodu na token (`handleRedirectPromise()`), i walidacja tego tokenu przez backend (`MemberBearer`) — cały
łańcuch potwierdzony end-to-end aż do ekranu "Uzupełnij profil". Po drodze znalezione i naprawione dwa
osobne błędy (jeden IaC, jeden backendowy, żaden w kodzie appki): `AADSTS9002326` (redirect URI
zarejestrowany pod złą platformą w Terraformie, zob. "Manualny krok CIAM w Azure Portal" niżej) i
`IDX40001` (biblioteka Microsoft.Identity.Web nie rozpoznawała formatu issuera `*.ciamlogin.com`, zob.
"Auth — Entra External ID" niżej po szczegóły fixu w `Sandbox`).

## Auth — Entra External ID (CIAM), nie ten sam schemat co LocalBizWeb

Backend ma trzy schematy JWT: `Bearer` (właściciel/LocalBizWeb), `AdminBearer` (operator/Admin),
`MemberBearer` (klubowicz — **ta appka**, osobny tenant Entra External ID). Zob.
`Sandbox/src/Modules/Members/CLAUDE.md` dla pełnego modelu (jeden `Member` może należeć do wielu
storefrontów — jak karta lojalnościowa, nie osobne konto na klub).

Config endpoint: `GET /api/member-configuration` (anonimowy, zwraca `msalConfig`/`apiConfig` — pobrany
przy starcie appki przez `AppInitService`/`ExternalConfigService`).

**`IDX40001` (issuer validation) — znaleziony i naprawiony 2026-07-25.** Pierwszy raz, kiedy realny
token CIAM dotarł do backendu (zaraz po naprawie `AADSTS9002326` niżej), `MemberBearer` go odrzucał:
"Issuer ... does not match any of the valid issuers provided for this application." Root cause: wbudowany
w Microsoft.Identity.Web walidator (`AadIssuerValidator`) nie rozpoznaje formatu issuera domen
`*.ciamlogin.com` (Entra External ID/CIAM) — mimo że `Instance`/`TenantId` w Key Vault były w 100%
poprawne (potwierdzone porównaniem dokumentu OIDC discovery obu aliasów domeny z realnym `iss` z tokenu
— identyczne). To nie był błąd konfiguracji, tylko luka w bibliotece. Fix (Sandbox,
`Shared.Infrastructure/Auth/Extensions.cs`, wewnątrz rejestracji `MemberBearer`):
`services.Configure<JwtBearerOptions>(MemberBearerScheme, options => options.TokenValidationParameters
.ValidIssuers = [...])`, jawnie dodający ten jeden potwierdzony issuer zamiast polegać na niekompletnej
wbudowanej liście — nie osłabia walidacji, tylko uzupełnia brakującą wartość.

## Vendoring `@shared/iam-msal-external`/`@shared/iam-msal-core`

`libs/shared/{iam-msal-core,iam-msal-external}/` to **jednorazowa kopia źródła TypeScript** (nie
skompilowanego `dist/`) ze `Sandbox/src/Clients/libs/projects/shared/`, wpięta przez `tsconfig.json`
`paths` bezpośrednio jako część kompilacji tej appki (**nie** npm `file:` dependency, nie symlink w
`node_modules` — stąd cały temat `preserveSymlinks`/NG0203, znany z LocalBizWeb, tutaj **nie
występuje**, bo nie ma mechanizmu symlinkowania w grze wcale).

**Dlaczego źródło, nie `dist/`**: pierwotny plan zakładał wendoring skompilowanego `ng-packagr` builda
(jak submodule/npm-registry były odrzucone jako opcje). Okazało się to niepraktyczne dla tego zadania,
bo appka natywna wymagała realnej zmiany logiki wewnątrz `MsalExternalAuthService` (patrz niżej) —
patchowanie zminifikowanego `dist/` byłoby dużo bardziej kruche niż edycja czytelnego źródła.

**To jest fork, nie żywy link.** Zmiany w `@shared/iam-msal-external`/`@shared/iam-msal-core` w
Sandboxie **nie propagują się tutaj automatycznie** — wymagany ręczny re-copy (`cp -r` odpowiednich
katalogów `src/` + ręczne scalenie z lokalnymi zmianami poniżej, jeśli coś się zmieniło na górze).
`@shared/core` **nie jest** wendorowany wcale — ani `iam-msal-core`, ani `iam-msal-external` nie mają w
praktyce żadnego importu z niego (tylko nieużywana wzmianka w `package.json`'s `peerDependencies`).

### Zmiany lokalne w wendorowanej kopii (nie ma ich w Sandboxie — nie kopiować mechanicznie z powrotem)

1. **`msal-external-auth.service.ts` — OAuth flow przepisany na system browser + deep link.**
   Oryginał używa `loginPopup`/`loginRedirect` z `@azure/msal-browser` wprost — działa w przeglądarce,
   ale nie w WebView Capacitora (brak realnego popup, in-webview redirect bywa zawieszać appkę).
   Fork używa **`onRedirectNavigate`** (oficjalny hook MSAL Browser do podmiany nawigacji, nie
   reimplementacja PKCE/OAuth) — `loginRedirect()`/`loginWithHint()`/`login()` przekazują
   `onRedirectNavigate: (url) => { Browser.open({ url }); return false; }`, co zatrzymuje wewnętrzną
   nawigację MSAL i zamiast tego otwiera `@capacitor/browser`'owy system browser. Powrót łapie
   `@capacitor/app`'s `App.addListener('appUrlOpen', ...)` na `NATIVE_REDIRECT_URI =
   'pl.localbiz.fitnessclub://auth-callback'`, po czym `handleRedirectPromise(fragment)` kończy wymianę
   kodu na tokeny (MSAL nadal robi całą kryptografię — PKCE/state/nonce — sam).
   **Zweryfikowane na żywym urządzeniu 2026-07-24, znaleziony blocker**: `onRedirectNavigate`/
   `Browser.open()` poprawnie otwiera system browser na ekranie CIAM, logowanie się kończy, Entra
   poprawnie redirectuje przez `pl.localbiz.fitnessclub://auth-callback`, i Android poprawnie wznawia
   appkę przez `appUrlOpen` (widoczne w `adb logcat` jako `START ... dat=pl.localbiz.fitnessclub://
   auth-callback/`). Ale `handleRedirectPromise()` rzuca `ServerError: AADSTS9002326 — Cross-origin
   token redemption is permitted only for the 'Single-Page Application' client-type. Request origin:
   'http://localhost'` — bo ten `fetch()` do endpointu tokenowego wykonuje się z poziomu JS w WebView
   (origin `http://localhost`), a Entra pozwala na taką wymianę kodu na token z poziomu przeglądarki
   tylko dla redirect URI zarejestrowanego pod platformą **"Single-page application"**. To nie jest
   kwestia kodu appki — root cause i fix (Terraform, `Sandbox/iac`) w "Manualny krok CIAM w Azure
   Portal" niżej.
2. **`doLogout()` uproszczony** — czyści tylko lokalny cache MSAL (`clearCache`/`setActiveAccount(null)`)
   zamiast `logoutPopup()` (ten sam problem WebView co login). Świadomy kompromis: nie kończy sesji
   hostowanej po stronie Entra, więc kolejne logowanie może cicho się SSO-wać z powrotem przez cookie
   sesji w system browserze. Do rewizji, jeśli potrzebny prawdziwy single-logout.
3. **`external-config.service.ts` — `endpoint` absolutny**, nie `/api/member-configuration` względny
   (`${environment.apiUrl}/api/member-configuration`) — potrzebne, bo appka natywna nie ma same-origin
   proxy do backendu jak appki webowe. Import `environment` przez długą relatywną ścieżkę z
   `libs/shared/iam-msal-external/src/services/` do `src/environments/` — świadome sprzężenie
   wendorowanej biblioteki z appką-hostem, nieuniknione przy tym podejściu.

## Manualny krok CIAM w Azure Portal (blokujący, nie do zautomatyzowania) + redirect URI (IaC)

**Tenant zmieniony (2026-07-24)**: `sandboxdevo` został usunięty, obecny CIAM tenant to
`ciamlocalbiz` (login domain `localbiz.ciamlogin.com`) — wszystkie odniesienia do `sandboxdevo` w tym
repo i w `Sandbox/src/Modules/Members/CLAUDE.md` są nieaktualne, sprawdzaj `ciamlocalbiz`.

Zob. `Sandbox/src/Modules/Members/CLAUDE.md` → "IaC — krok ręczny": w Azure Portal (tenant
`ciamlocalbiz`) trzeba ręcznie utworzyć User Flow Sign-up/Sign-in i powiązać go z app registration
Members — **to jedyny krok, którego Terraform naprawdę nie robi**. Żaden test logowania end-to-end
nie zadziała bez niego.

**Redirect URI `pl.localbiz.fitnessclub://auth-callback` NIE jest manualnym krokiem** — mimo że
wcześniejsza wersja tej notatki tak twierdziła. Jest w pełni zarządzany Terraformem, w `Sandbox/iac`:
`member_native_redirect_uris` (`Sandbox/iac/variables.tf`, wartość w `Sandbox/iac/env/{dev,prod}.tfvars`)
→ `modules/azure-ad-external/ad-application-spa.tf`.

**Znaleziony, naprawiony i zweryfikowany blocker (2026-07-24/25, `AADSTS9002326`)** —
`ad-application-spa.tf` rejestrował ten redirect URI w osobnym zasobie `azuread_application_redirect_uris`
z `type = "PublicClient"` ("Mobile and desktop applications"), bo takie było (błędne) założenie w
komentarzu przy tym kodzie. Ale wendorowany `msal-external-auth.service.ts` w tym repo nadal używa
MSAL Browser, które wymienia kod na token przez `fetch()` wykonywany z poziomu WebView (origin
`http://localhost`) — a Entra dopuszcza taką wymianę (cross-origin token redemption z poziomu
przeglądarki) tylko dla redirect URI zarejestrowanych pod platformą **"Single-page application"**,
niezależnie od tego, że to custom URI scheme, nie `https://`. Fix (zaaplikowany w
`Sandbox/iac/modules/azure-ad-external/ad-application-spa.tf`): `native_redirect_uris` scalone do
tego samego bloku `type = "SPA"` co `spa_redirect_uris` (`concat(...)`), zamiast osobnego bloku
PublicClient. `terraform apply` w `Sandbox/iac` wykonany 2026-07-24 — **potwierdzone na żywym
urządzeniu, że login przechodzi przez ten krok bez błędu**. Zaraz po tym fixie ujawnił się kolejny,
osobny błąd (`IDX40001`, backendowa walidacja issuera) — zob. "Auth — Entra External ID" wyżej —
naprawiony tego samego dnia; cały łańcuch logowania jest dziś w pełni zweryfikowany end-to-end.

## Brakujące endpointy backendu dodane przy okazji Task B/C/D (2026-07-18/21)

- `GET api/classes/{storefrontId}/sessions?from=&to=` (2026-07-18, Task B) — zob.
  `Sandbox/src/Modules/Classes/CLAUDE.md` → "Member-facing schedule browsing".
- `GET api/classes/{storefrontId}/class-types` (2026-07-21, Task C) — nazwy zajęć dla pickera
  "zajęcia startowe" w formularzu sign-up karnetu (multi-class-type `MembershipType`).
- `GET api/carnets/{storefrontId}/membership-types` (2026-07-21, Task C) — katalog karnetów do wyboru
  przy self-service sign-up; backend dotąd miał tylko wersję owner-facing.
- `CarnetNotFoundException` (2026-07-21) naprawiony, żeby mapować się na `404`, nie generyczny `500` —
  zob. `Sandbox/src/Modules/Carnets/CLAUDE.md`. `carnet.page.ts` polega na tym rozróżnieniu, żeby wiedzieć
  kiedy pokazać formularz sign-up zamiast karty istniejącego karnetu.
- `POST/DELETE api/notifications/native-push-subscriptions/member` (2026-07-21, Task D) — nowy, osobny
  od istniejącego web-push endpointu; zob. "Push notifications" niżej.
- `GET api/carnets/p24/payment-callback` (2026-07-21) — strona-lądowisko dla P24 checkout return-URL;
  zob. "P24 payment-callback zbudowane 2026-07-21" niżej.

## Struktura appki (po discovery klubów, 2026-07-25)

```
src/app/
├── app.routes.ts              # '' -> login, login, complete-profile (CustomerGuard), find-club, tabs
├── components/
│   ├── login/                  # CIAM login (jeden przycisk, bez legacy email/hasło formularza)
│   └── manual-join/             # "Mam kod od recepcji" — współdzielony przez clubs.page i find-club.page
├── complete-profile/          # POST members/complete-profile — pierwsze uzupełnienie profilu; potem
│                               # find-club (0 członkostw) albo tabs (1+), zob. "Znajdź klub" niżej
├── find-club/                  # Wyszukiwarka/lista dostępnych klubów fitness — główny sposób dołączania
├── tabs/                      # ion-tabs shell — 4 taby: Kluby, Grafik, Karnet, Profil
├── clubs/                     # "Moje kluby" — GET me/memberships, leave, CTA "Znajdź klub" → /find-club
├── club-detail/                # Hub klubu (clubs/:storefrontId) — linki do Zgody/Ankieta
├── consents/                   # Lista+akceptacja zgód (clubs/:storefrontId/consents, ?returnTo=join)
├── health-questionnaire/       # Ankieta zdrowotna (append-only) + gate zgody RODO art.9
├── schedule/                   # Tab "Grafik" — sesje/zapisy/lista rezerwowa/odrobienia
├── carnet/                     # Tab "Karnet" — aktualny karnet lub sign-up + akcje P24
├── tab1/                       # Profil — MsalExternalAuthService.getUserProfile()/logout()
├── core/
│   ├── models/                 # member/classes/carnets/storefront .model.ts — kamelCase, zgodne z backendem
│   ├── utils/consent-error.util.ts # isConsentRequiredError() — dzielony przez manual-join i find-club
│   └── services/
│       ├── members-api.service.ts       # api/members/* (rozszerzone o consents/health-questionnaire)
│       ├── classes-api.service.ts       # api/classes/*
│       ├── carnets-api.service.ts       # api/carnets/*
│       ├── storefront-discovery.service.ts # GET api/storefronts/public (find-club) + geolokalizacja
│       ├── notifications-api.service.ts # api/notifications/native-push-subscriptions
│       ├── push-notifications.service.ts # wrapper @capacitor/push-notifications, patrz "Push" niżej
│       ├── storefront-context.service.ts # który klub jest "aktywny" dla Grafik/Karnet, @capacitor/preferences
│       └── carnet-payment-callback.service.ts # deep link powrotny z checkoutu P24, mirror MsalExternalAuthService
└── interceptors/auth-token.interceptor.ts   # Bearer na żądania zawierające '/api/'
```

**Rozwiązane uproszczenie (było w Task A)**: `MembershipDto` teraz niesie `storefrontName` — backend
(`GetMyMembershipsHandler`, `Sandbox/src/Modules/Members/CLAUDE.md`) dobatchowuje nazwę przez nową trasę
busa `storefronts/names-by-ids`, fail-open do `null` przy błędzie. Ekran "Moje kluby" i picker
klubu (`StorefrontContextService.pickStorefront`) pokazują realną nazwę, z fallbackiem na skrócony
`storefrontId` gdy `null`.

## Wyszukiwanie/dołączanie do klubu (`find-club`, 2026-07-25)

Appka ma być **jedna appka na całą branżę fitness**, nie osobna appka na każdego klienta LocalBiz
(nieopłacalne przy dystrybucji Android/iOS per klient) — więc dołączenie do klubu nie może dłużej
polegać wyłącznie na ręcznym wpisaniu GUID-a od recepcji. `src/app/find-club/find-club.page.ts` to
teraz **główny** sposób dołączania:

- `IonSearchbar` + lista wyników z `StorefrontDiscoveryService.search()` (`GET /api/storefronts/public`,
  zawsze ze stałym `businessType=Fitness&requireFitnessReadiness=true` — appka jest dedykowana branży
  fitness, zob. `Sandbox/ai/BACKEND_CAPABILITIES.md` §22 i `Sandbox/src/Modules/Storefronts/CLAUDE.md`).
- Domyślnie sortowane po dystansie (do 30km) — `StorefrontDiscoveryService.getCurrentPosition()` prosi
  o uprawnienie `@capacitor/geolocation`, cicho zwraca `null` przy odmowie/niedostępności/timeout,
  appka wtedy pada na sort alfabetyczny (`isUsingLocation` steruje komunikatem w UI).
  **Gotcha znaleziony przy pisaniu testów**: obiekt pluginu Capacitora (`Geolocation` z
  `@capacitor/geolocation`) to `Proxy`, którego `get`-trap zawsze zwraca świeży wrapper niezależnie od
  przypisania właściwości — `spyOn(Geolocation, 'checkPermissions')` w Jasmine **nie działa** (podmiana
  nigdy nie jest odczytana). Naprawione przez owinięcie pluginu w `InjectionToken`
  (`GEOLOCATION_PLUGIN` w `storefront-discovery.service.ts`) — ten sam singleton w runtime (fabryka
  zwraca realny `Geolocation`), ale podmienialny w testach przez zwykły provider. Ten sam wzorzec
  potrzebny dla każdego przyszłego testu dotykającego bezpośrednio obiektu wtyczki Capacitora.
- Przycisk "Dołącz" na każdym wyniku woła `MembersApiService.join()`, z tą samą logiką przekierowania
  na zgody przy `member_consent_required` co dotychczas — wydzieloną do `isConsentRequiredError()`
  (`core/utils/consent-error.util.ts`), używaną też przez `manual-join.component.ts`.
- Panel "Mam kod od recepcji" (zwijany) pokazuje dotychczasowe ręczne pole na `storefrontId` — **nie
  usunięte**, tylko przeniesione do współdzielonego `ManualJoinComponent`
  (`components/manual-join/`), używanego identycznie w `clubs.page.html` (stan pusty/dodatkowa opcja)
  i `find-club.page.html` (zwinięty panel).
- Onboarding: `complete-profile.component.ts` po zapisaniu profilu sprawdza liczbę członkostw —
  0 → `/find-club`, 1+ → `/tabs` (fails open do `/tabs` przy błędzie zapytania). Poza onboardingiem
  `find-club` jest też dostępny z przycisku "Znajdź klub" na `clubs.page.html`.
- **Backend**: nowe pole `Storefront.BusinessType` (enum `General`/`Fitness`, string w DB) — właściciel
  ustawia je w LocalBizWeb (`storefront-settings` → "Profil firmy"). Storefront musi mieć zarówno
  `BusinessType=Fitness`, jak i włączone usługi `"Grafik zajęć"`/`"Karnety i płatności"`/`"Klubowicze"`,
  żeby pojawić się w wynikach (`requireFitnessReadiness=true`) — inaczej klubowicz mógłby dołączyć do
  "klubu", który nie ma jeszcze uruchomionego grafiku/karnetów.
- **`@capacitor/geolocation`** dodany do `package.json`; `ACCESS_COARSE_LOCATION`/`ACCESS_FINE_LOCATION`
  w `AndroidManifest.xml`, `NSLocationWhenInUseUsageDescription` w iOS `Info.plist`. **Zweryfikowane
  tylko przez `npx cap sync android` + `ng build`/testy Karma — brak jeszcze testu na fizycznym
  urządzeniu** (osobny krok, jak reszta tego repo — zob. "Testing" niżej).

**Nawigacja wielu klubów**: `StorefrontContextService` trzyma "aktywny" `storefrontId` dla tabów
Grafik/Karnet — jeden klub: auto-wybór po cichu; wiele: `ActionSheetController` picker przy pierwszym
wejściu w sesji, zapamiętany w `@capacitor/preferences`. Zgody/Ankieta nie potrzebują tego kontekstu —
są zawsze per-konkretny-klub, osiągane z `ClubDetailPage`.

## Rebrand natywny

`capacitor.config.ts`/`android/app/build.gradle`'s `applicationId`/`strings.xml`/iOS
`PRODUCT_BUNDLE_IDENTIFIER` → `pl.localbiz.fitnessclub`, `appName`/display name → "FitnessClub".
**Historia (2026-07-24)**: appka była na krótko rebrandowana na `pl.localbiz.clubhouse`/"Clubhouse"
(zgodnie z ówczesną nazwą repo), ale to zostało cofnięte z powrotem na `fitnessclub` — to jest
ostateczna, docelowa tożsamość appki, mimo że repo samo w sobie nadal nazywa się `Clubhouse`. Wszystkie
identyfikatory (bundle id, custom URL scheme dla deep linków, redirect URI w Azure) muszą się zgadzać
na `pl.localbiz.fitnessclub`. **Nie zmieniono**: Android `namespace` w `build.gradle` zostaje
`io.ionic.starter` (musi zgadzać się z faktyczną deklaracją `package` w `MainActivity.java`, która
wciąż mówi `com.getcapacitor.myapp` — kosmetyczne/porządkowe, nie wpływa na tożsamość appki w sklepie,
wymagałoby przeniesienia plików Javy, nie zrobione w tym zadaniu). Podpisywanie (signing config)
Android/iOS — nie skonfigurowane, osobny krok użytkownika przed publikacją.

## Testing

Zero realnego pokrycia CI odziedziczone z Mobile (`0 meaningful specs` per Sandbox `ai/TESTING.md`
pierwotnie) — nie traktować jak siatki bezpieczeństwa. `.github/workflows/build-and-test.yml` w tym
repo robi tylko `lint` + `ng build` (web bundle) — **nie** builduje/podpisuje/publikuje Android/iOS,
to świadomie poza zakresem, większa inwestycja CI na później.

**Stan weryfikacji na realnym urządzeniu** (zob. "Test na fizycznym urządzeniu Android przez USB"):
cały CIAM login round-trip (2026-07-24/25, patrz "Auth — Entra External ID" i "Manualny krok CIAM"
wyżej) zweryfikowany end-to-end. Wciąż niepotwierdzone: discovery klubów (`find-club`) na żywym
urządzeniu, push notifications, P24 checkout, cokolwiek na iOS — pełna, aktualna lista: "Znane luki /
do zrobienia" niżej.

**Karma (2026-07-25)**: 18 speców, wszystkie zielone (`npm test` / `ng test --watch=false
--browsers=ChromeHeadless`) — 3 boilerplate sprzed tego zadania (`app.component`, `tab1.page`,
`tabs.page` — ostatni wymagał doklejenia `provideHttpClient()`, bo `TabsPage.ngOnInit()` woła
`PushNotificationsService`→`NotificationsApiService`→`HttpClient`) + nowe dla discovery klubów:
`storefront-discovery.service.spec.ts`, `find-club.page.spec.ts`, `clubs.page.spec.ts`. Nadal nie
liczyć tego jako realnej siatki bezpieczeństwa — nie ma pokrycia dla większości appki (schedule/carnet/
consents/health-questionnaire), tylko dla kodu dotkniętego tym zadaniem.

## Push notifications — natywny FCM (decyzja 2026-07-21, nie web-push)

Świadomie **nie** konsumuje backendu istniejącego web-push (VAPID/`PushSubscriptionsController`) — appka
to natywny Capacitor WebView, gdzie "dostawa nawet gdy appka zamknięta" nie jest tak pewna jak w
prawdziwej karcie przeglądarki. Zamiast tego: `@capacitor/push-notifications` + nowy backendowy kanał
FCM. Pełny design (fan-out `IPushService`→`IPushChannel`, `CompositePushService`,
`NativePushSubscription`) w `Sandbox/src/Modules/Notifications/CLAUDE.md` → "Natywny push (FCM/APNs)".

`push-notifications.service.ts` — `init()` wołane raz z `TabsPage.ngOnInit()` (po `CustomerGuard`, więc
prompt uprawnień pojawia się tylko dla zalogowanego membera). No-op poza `Capacitor.isNativePlatform()`
(przeglądarka/`ionic serve` nigdy nie triggeruje realnego promptu). Sekwencja: `checkPermissions()` →
`requestPermissions()` gdy `'prompt'` → jeśli `'granted'`, `register()` + listenery: `'registration'`
(token → `notificationsApi.registerDeviceToken(platform, token)`), `'registrationError'` (tylko log,
push jest best-effort), `'pushNotificationReceived'` (foreground → `ToastController`),
`'pushNotificationActionPerformed'` (tap → `router.navigateByUrl(data.url)`, jeśli backend je ustawi —
dziś żaden trigger tego nie robi, zob. Notifications CLAUDE.md).

**iOS/APNs zbudowane 2026-07-21** — backend ma teraz `ApnsPushChannel` (dotAPNS, mirror
`FcmPushChannel`, ten sam `IPushChannel`/`CompositePushService` fan-out) obok FCM, zob.
`Sandbox/src/Modules/Notifications/CLAUDE.md` → "Natywny push (FCM/APNs)". Konto Apple Developer
Program + klucz `.p8` potwierdzone przez użytkownika jako istniejące — realne poświadczenia wciąż
trzeba ręcznie wkleić do Key Vault po `terraform apply` (jak FCM/wFirma), kod jest gotowy.

**P24 payment-callback zbudowane 2026-07-21** — `carnet.page.ts`'s `signUp()`/`retryPayment()` teraz
`await CarnetPaymentCallbackService.waitForReturn()` po `Browser.open()`, zamiast odświeżać stan
karnetu od razu. Nowy serwis `core/services/carnet-payment-callback.service.ts` (mirror
`msal-external-auth.service.ts` — własny `App.addListener('appUrlOpen', ...)`, własny prefiks
`pl.localbiz.fitnessclub://payment-callback`), nowy intent-filter host w
`android/app/src/main/AndroidManifest.xml` (iOS nic nie wymaga — `Info.plist` rejestruje tylko schemat,
nie host). Backend: `GET api/carnets/p24/payment-callback` (`MemberCarnetsController`, `[AllowAnonymous]`)
serwuje statyczną stronę-lądowisko przekierowującą na ten deep link; `p24carnets--returnUrl` (Terraform)
zmieniony na ten endpoint zamiast stałej, nigdy nieużywanej kopii URL-a Subscriptions. Zob.
`Sandbox/src/Modules/Carnets/CLAUDE.md` → "P24 recurring integration" po szczegóły.

**Niezweryfikowane w żadnej sesji dotąd** (brak realnego urządzenia + brak potwierdzonego projektu
Firebase/prawdziwych sekretów APNs w Key Vault): prawdziwy prompt uprawnień push, realny token
FCM/APNs, realna dostawa po triggerze (np. odwołanie sesji), i cały P24 checkout→deep-link round-trip
(wymaga też punktu 2 z `faza-7-next-steps.md` — żywa weryfikacja P24 w sandboxie, wciąż otwarta).

## Znane luki / do zrobienia (2026-07-25)

- **Discovery klubów (`find-club`) niezweryfikowana na fizycznym urządzeniu** — zbudowana, przechodzi
  `ng build`/lint/testy Karma i `npx cap sync android`, ale prompt uprawnień geolokalizacji, realny
  sort po dystansie i cały flow onboardingu (`complete-profile` → `find-club` → dołączenie → ewentualne
  zgody) nie były jeszcze przetestowane na żywym urządzeniu (kolejny krok po CIAM, zob. "Test na
  fizycznym urządzeniu Android przez USB" wyżej). Backendowe testy (Unit/Integration/EndToEnd w
  Sandbox) zielone przeciw realnemu Postgresowi.
- **P24 sandbox nadal "documented, not live-verified"** (`Sandbox/src/Modules/Carnets/CLAUDE.md`) —
  realne pieniądze, nie testować na produkcyjnym storefroncie przed potwierdzeniem.
- **Zestaw pytań ankiety zdrowotnej** (`health-questionnaire.page.ts`) to rozsądne minimum wymyślone na
  potrzeby v1 (3 toggle + notatka), nie ustalony z klientką zestaw — `AnswersJson` jest opaque po stronie
  backendu, więc zmiana formularza później nie wymaga migracji.
- **`npx cap sync ios` nadal nieuruchomione** (brak Xcode) — strukturalna poprawność `Info.plist` po
  dodaniu `@capacitor/push-notifications` niepotwierdzona. Android **zweryfikowany 2026-07-24** (zob.
  "Test na fizycznym urządzeniu Android przez USB") — `AndroidManifest.xml`/`build.gradle` buildują się
  i instalują poprawnie na realnym urządzeniu.
- **CORS dla iOS** — dev CORS dopuszcza `http://localhost` (Android `androidScheme: 'http'`), ale
  domyślny schemat Capacitor dla iOS (`capacitor://localhost`) nie jest dziś na liście
  `member_native_app_cors_origins` (`Sandbox/iac/env/*.tfvars`) — do sprawdzenia przed testami na iOS.
