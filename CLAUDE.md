# CLAUDE.md

## Co to jest

AcademyApp — natywna appka klubowicza (Android/iOS, Ionic 8 + Capacitor 7 + Angular 20) platformy
LocalBiz. Wyekstrahowana 2026-07-18 z `Sandbox/src/Clients/Mobile` (dawniej opisywana jako appka
właściciela — w praktyce zawierała martwy kod po nieudanym pivocie w stronę weryfikacji autentyczności
produktów; ten kod został usunięty, nie zmigrowany).

**Nazewnictwo**: appka nazywa się "AcademyApp" (repo `Workspace/AcademyApp`), dla użytkownika
"Akademia"; bundle id/`applicationId`/custom URL scheme `pl.localbiz.academy`. Dawne nazwy
(nieaktualne, nie wracać do nich): "SportClub" (`pl.localbiz.sportclub`) i wcześniej "FitnessClub"
(`pl.localbiz.fitnessclub`). Appki nie było w sklepach przed zmianą identyfikatora, więc nie ma
starej pozycji do utrzymania. Zob. "Rebrand natywny" niżej po aktualne wartości.

Trzy frontendy platformy LocalBiz, wszystkie mówiące z jednym backendem w repo `Sandbox`:

| Appka | Repo | Odbiorca |
|---|---|---|
| LocalBizWeb | `Sandbox/src/Clients/LocalBizWeb` | właściciel klubu (panel `/club`: grafik, karnety) |
| Showcase | `Workspace/Showcase` (osobne repo) | odwiedzający — publiczna wizytówka, **bez logowania** |
| **AcademyApp** | `Workspace/AcademyApp` (to repo) | klubowicz — logowanie, grafik, karnety, zgody |

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
`localbiz.ciamlogin.com`), powrót przez `appUrlOpen`/`pl.localbiz.academy://auth-callback`, wymiana
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
   'pl.localbiz.academy://auth-callback'`, po czym `handleRedirectPromise(fragment)` kończy wymianę
   kodu na tokeny (MSAL nadal robi całą kryptografię — PKCE/state/nonce — sam).
   **Zweryfikowane na żywym urządzeniu 2026-07-24, znaleziony blocker**: `onRedirectNavigate`/
   `Browser.open()` poprawnie otwiera system browser na ekranie CIAM, logowanie się kończy, Entra
   poprawnie redirectuje przez `pl.localbiz.academy://auth-callback`, i Android poprawnie wznawia
   appkę przez `appUrlOpen` (widoczne w `adb logcat` jako `START ... dat=pl.localbiz.academy://
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

## Współdzielone pakiety z registry (`@konraddevoak/*`)

W odróżnieniu od wendorowanego forka `iam-msal-*` powyżej, `@konraddevoak/academy-api` jest
konsumowany jako **normalny, wersjonowany pakiet npm** z prywatnego GitHub Packages
(`npm.pkg.github.com`, scope `@konraddevoak`, publikowany z repo `Sandbox`, workflow
`publish-shared-libs.yml`). Powód różnicy: `academy-api` to czysty kontrakt HTTP (DTO + serwis +
helpery etykiet) — nie ma tu żadnej przepisanej pod Capacitora logiki OAuth, więc nie ma czego
forkować, a jedna wersjonowana kopia współdzielona z `AcademyWeb` chroni przed rozjazdem przy
zmianach kontraktu backendu (`Modules.Academy`).

- **Auth do registry**: `.npmrc` (w repo) wskazuje scope `@konraddevoak` na `npm.pkg.github.com` i
  czyta token z `NODE_AUTH_TOKEN`. Pakiety są prywatne — GitHub Packages npm **zawsze** wymaga tokenu
  do odczytu, a `GITHUB_TOKEN` z `packages: read` działa tylko dla pakietów z tego samego repo. CI
  (`build-and-test.yml`, `release-android.yml`) wstrzykuje `NODE_AUTH_TOKEN` z sekretu
  `GH_PACKAGES_READ_TOKEN` (PAT `read:packages` na org `KonradDevOak`) na kroku `npm ci`. W
  `release-android.yml` to jedyny GitHub Secret — reszta sekretów wydaniowych idzie z Key Vault przez
  OIDC. Lokalnie ten sam PAT trzymaj w env `GITHUB_PACKAGES_PAT`.
- **Wersja jest pinowana dokładnie** (`1.0.0-dev.<sha>`), nie `dev` dist-tag ani caret. `dev` to
  ruchomy cel — dla appki przechodzącej przez `release-android.yml`/App Store review build musi być
  reprodukowalny. Bump wersji to jedna linia w `package.json`, robiony świadomie gdy potrzebny nowy
  kontrakt. Od 2026-09-22 `Sandbox` nie ma już brancha `develop` — publikuje `X.Y.Z-dev.<sha>` przy
  merge'u `bugs/**`/`hotfixes/**`/`features/**` → `releases/<name>`, a prawdziwy stabilny semver
  (`X.Y.Z` bez sufiksu) dopiero przy merge'u `releases/<name>` → `master`. Zob. `Sandbox/CLAUDE.md`,
  sekcja "Shared npm packages".
- **Lokalny dev bez czekania na publish**: w `package.json` (niecommitowane) podmień wersję na
  `file:../Sandbox/src/Clients/libs/dist/shared/academy-api` i zbuduj lib w tamtym repo
  (`cd src/Clients/libs && npx ng build @shared/academy-api`). `AcademyApp` i `Sandbox` to sąsiednie
  katalogi. **Cofnij do wersji z registry przed commitem** — CI nie ma dostępu do `../Sandbox`.
- Provider `ACADEMY_API_BASE_URL` w `src/main.ts` (`useFactory` z `ExternalConfigService`) — pakiet
  nie zakłada własnego interceptora, Bearer dokleja globalny `authTokenInterceptor`.

## Manualny krok CIAM w Azure Portal (blokujący, nie do zautomatyzowania) + redirect URI (IaC)

**Tenant zmieniony (2026-07-24)**: `sandboxdevo` został usunięty, obecny CIAM tenant to
`ciamlocalbiz` (login domain `localbiz.ciamlogin.com`) — wszystkie odniesienia do `sandboxdevo` w tym
repo i w `Sandbox/src/Modules/Members/CLAUDE.md` są nieaktualne, sprawdzaj `ciamlocalbiz`.

Zob. `Sandbox/src/Modules/Members/CLAUDE.md` → "IaC — krok ręczny": w Azure Portal (tenant
`ciamlocalbiz`) trzeba ręcznie utworzyć User Flow Sign-up/Sign-in i powiązać go z app registration
Members — **to jedyny krok, którego Terraform naprawdę nie robi**. Żaden test logowania end-to-end
nie zadziała bez niego.

**Redirect URI `pl.localbiz.academy://auth-callback` NIE jest manualnym krokiem** — mimo że
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
├── find-club/                  # Wyszukiwarka/lista dostępnych klubów — wielowertykałowa (fitness + akademia)
├── tabs/                      # ion-tabs shell — warunkowy zestaw tabów per wertykał (zob. "Wielowertykałowość")
├── academy/                    # Wertykał "Akademia sportowa" — lista dzieci / onboarding / detal (6 segmentów)
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
│       ├── storefront-discovery.service.ts # GET api/storefronts/public (find-club, multi-wertykał) + geolokalizacja
│       ├── active-vertical.service.ts    # 'fitness' | 'academy' z MembershipDto.businessType aktywnego klubu
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

- `IonSearchbar` + lista wyników z `StorefrontDiscoveryService.search()` (`GET /api/storefronts/public`).
  Serwis jest **wielowertykałowy** (`vertical: 'fitness' | 'academy' | 'all'`, domyślnie `'all'`): dla
  `'all'` odpala po jednym żądaniu na wertykał (`businessType=Fitness&requireFitnessReadiness=true` oraz
  `businessType=SportsSchool&requireAcademyReadiness=true`) i scala wyniki (backendowy `businessType`
  przyjmuje jedną wartość). Każda karta wyniku ma badge wertykału po `result.businessType`. Zob.
  `Sandbox/ai/BACKEND_CAPABILITIES.md` §22 i `Sandbox/src/Modules/Storefronts/CLAUDE.md`.
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

## Wielowertykałowość (Klub fitness + Akademia sportowa)

Appka obsługuje dwa wertykały platformy: Klub fitness (istniejący) i Akademię sportową
(`Sandbox/src/Modules/Academy`, KS Master Gang — dzieci, akrobatyka/sztuki walki, panel rodzica).
Jedna appka, jeden bundle `pl.localbiz.academy`, jedna rejestracja CIAM.

- **Rozpoznanie aktywnego wertykału**: `ActiveVerticalService.activeVertical$` (`'fitness' | 'academy'`)
  = `MembershipDto.businessType` klubu wskazanego przez `StorefrontContextService.selectedStorefrontId$`.
  `businessType` jest już batchowane na `GET /members/me/memberships` i cache'owane
  (`MembershipsCacheService`) — **żadnego dodatkowego zapytania**. Cokolwiek nieznanego (brak aktywnego
  klubu, `businessType == null` z fail-open backendu) → `'fitness'` (zachowuje pierwotne zachowanie).
- **Warunkowy pasek tabów**: `tabs.page.html` renderuje zestaw `ion-tab-button` per wertykał — fitness:
  Kluby / Grafik / Karnet / Profil; akademia: Kluby / Moje dzieci / Profil. `clubs`/`profile` są
  wspólne. Trasy `academy-children`, `academy-children/onboarding`, `academy-children/:athleteId`
  w `tabs.routes.ts`.
- **Ekrany Akademii** (`src/app/academy/`): `academy-children.page` (lista dzieci — imię, grupa,
  dyscypliny, „Dodaj dziecko"), `academy-onboarding.page` (formularz „Dodaj dziecko" →
  `POST me/athletes`), `academy-child-detail.page` (6 segmentów `ion-segment`/`ion-segment-view` wzór
  `schedule.page` — Zawodnik / Opiekun [telefon edytowalny → `PATCH me/guardian`] / Harmonogram [tylko
  przy przypisanej grupie, II.3] / Frekwencja [„wrzesień 2026: 4/11"] / Płatności [OPŁACONO/DO ZAPŁATY] /
  Pasy [chip w kolorze `colorHex`]). Ładowanie danych: RxJS `forkJoin` + `catchError` (repo nie używa
  `rxResource`). Etykiety enumów backendu → klucze i18n przez helpery z `@konraddevoak/academy-api`
  (`disciplineKey`/`frequencyKey`/`dayKey`/`shortTime`/`formatZloty`).
- **Serwis API**: `AcademyApiService` z pakietu `@konraddevoak/academy-api` (`api/academy/me/*` +
  `invitations/accept`, DTO + helpery etykiet w tym samym pakiecie). Base URL przez token
  `ACADEMY_API_BASE_URL` (provider w `main.ts`, źródło jak dla reszty wywołań backendu). Zob.
  „Współdzielone pakiety z registry" niżej.
- **Deep link zaproszenia (G3)**: `DeepLinkService` (`core/services/`) — pierwszy centralny router
  deep linków w appce: jeden `appUrlOpen` + cold start przez `App.getLaunchUrl()` (appka odpalona
  linkiem, nie wznowiona), plugin `@capacitor/app` przez `CAPACITOR_APP` token (wzór `GEOLOCATION_PLUGIN`).
  Rozpoznaje custom scheme `pl.localbiz.academy://invite/academy?token=…&storefrontId=…` (backendowa
  strona-przelotka `GET api/academy/invite`) **oraz** ten sam URL https jako App Link. Wołany raz
  z `AppComponent`. Dwa starsze listenery `appUrlOpen` (`auth-callback`, `payment-callback`) zostały
  świadomie nietknięte — inne hosty, oba zweryfikowane na urządzeniu, konsolidacja to osobny task.
- **`AcademyInvitePage`** (`src/app/academy/invite/`, trasa `academy-invite` w `app.routes.ts` **poza
  `tabs` i bez `CustomerGuard`** — rodzic bywa wylogowany): samodzielny flow login CIAM → opcjonalne
  „Twoje imię" (gdy `profileCompletedAt == null`) → inline lista zgód (`member_consent_required`) →
  `join` → `invitations/accept` → redirect `/tabs/academy-children/onboarding`. `token`+`storefrontId`
  w `@capacitor/preferences` (`pending-academy-invite`) — przeżywa round-trip logowania i cold start.
  Zero zmian w `complete-profile.component` / `consents.page`.
- **App Links / Universal Links** (`AndroidManifest.xml` `autoVerify="true"` na
  `https://api.localbiz.pl/api/academy/invite`, `ios/App/App/App.entitlements`): podpięte, ale
  **weryfikacja nieaktywna** — Android czeka na `assetlinks.json` z odciskiem klucza podpisującego
  release (ten sam blocker co „Pipeline wydawniczy"), iOS na capability „Associated Domains" w Apple
  Developer portal + wpięcie `App.entitlements` w target Xcode (`CODE_SIGN_ENTITLEMENTS`, krok ręczny
  jak „Manualny krok CIAM"). Do tego czasu custom scheme + strona-przelotka w pełni działają.
- Plan całości: `Sandbox/docs/Akrobatyka/plan-realizacji.md`.

## Internacjonalizacja (i18n)

Wprowadzona w G1 (wcześniej appka nie miała żadnego mechanizmu — twarde polskie litera​ły). ngx-translate
v18, ten sam setup co LocalBizWeb: `provideTranslateService` + `provideTranslateHttpLoader` w `main.ts`,
pliki `src/assets/i18n/{pl,en}.json`. `pl` na sztywno, **bez przełącznika języka w UI**; `en.json`
istnieje jako plik równoległy pod przyszłe potrzeby. Loader czyta zbundlowany asset (`assets/i18n/` w
`www/` → też w `android/app/src/main/assets/public/`), więc działa offline; interceptor auth go pomija
(URL bez `/api/`).

**Zakres**: na kluczach są **tylko nowe stringi** (Akademia + dotknięte fragmenty `find-club`). Stary
kod Klubu (~14 komponentów) zostaje na twardych litera​łach — migracja stopniowa przy okazji edycji
danego pliku, nie jednorazowo.

## Rebrand natywny

`capacitor.config.ts`/`android/app/build.gradle`'s `applicationId`/`strings.xml`/iOS
`PRODUCT_BUNDLE_IDENTIFIER` → `pl.localbiz.academy`, `appName`/display name → "Akademia". Wszystkie
identyfikatory (bundle id, custom URL scheme dla deep linków, redirect URI w Azure, `bundleId`/
`androidPackageName` w backendzie) muszą się zgadzać na `pl.localbiz.academy`.
**Nie zmieniono**: Android `namespace` w `build.gradle` zostaje
`io.ionic.starter` (musi zgadzać się z faktyczną deklaracją `package` w `MainActivity.java`, która
wciąż mówi `com.getcapacitor.myapp` — kosmetyczne/porządkowe, nie wpływa na tożsamość appki w sklepie,
wymagałoby przeniesienia plików Javy, nie zrobione w tym zadaniu). Podpisywanie (signing config)
iOS — nie skonfigurowane, osobny krok użytkownika przed publikacją. Android — `signingConfigs.release`
w `android/app/build.gradle` jest okablowany (2026-08-26), ale bez realnego keystore'a wciąż buduje
się niepodpisany, zob. "Pipeline wydawniczy" niżej.

## Pipeline wydawniczy (Android → Google Play, 2026-08-26)

Zaprojektowany i okablowany, **jeszcze nieuruchomiony end-to-end** (blokuje: konto Google Play Console,
wygenerowanie keystore'a, `terraform apply` w `Sandbox/iac`). Pełny plan (z linkami/krokami do Play
Console) w `/home/konraddabrowski/.claude/plans/jak-wdro-y-aplikacj-angular-bubbly-lightning.md`.

- **Strategia gałęzi**: wprowadzona `develop` (lokalnie, nie wypchnięta) — feature branch → PR do
  `develop` → PR `develop → master` = release gate, wzorowane na
  `Showcase/.github/workflows/deploy-prod.yml`. Zakres celowo: **pełna automatyzacja aż do produkcji**
  (nie tylko internal/beta track) — świadomy wybór użytkownika, mimo ryzyka błędnej auto-publikacji.
- **`.github/workflows/release-android.yml`** (nowy) — trigger `pull_request closed` na `master` +
  guard `head_ref == 'develop' && merged == true`. `azure/login` (OIDC, bez GitHub Secrets) → pobiera
  keystore/hasła/Play service account JSON z Azure Key Vault → `cap sync android` → `fastlane android
  deploy_production` (`android/fastlane/Fastfile`, `upload_to_play_store` track `production`).
- **`android/app/build.gradle`** — `signingConfigs.release` czyta `android/keystore.properties`
  (gitignored, tworzony ręcznie raz przez `keytool`) lokalnie, albo `ANDROID_KEYSTORE_*` env (z Key
  Vault) w CI. Bez żadnego z nich buduje się bez podpisu (`assembleDebug` niezmienione).
- **Terraform (`Sandbox/iac`, osobne repo)** — nowy moduł `modules/academyapp-github-sp/` (OIDC SP,
  scoped do **Key Vault Secrets User**, nie subskrypcyjny Contributor jak `showcase-github-sp`) +
  `modules/azure-keyvault/academyapp-settings.tf` (5 nowych sekretów: keystore/hasła/alias/Play
  service account JSON). Gated w root `main.tf` na `var.academyapp_github_repository != ""` — moduł
  nic nie tworzy, dopóki `env/prod.tfvars`'s `academyapp_github_repository` (dziś `""`) nie zostanie
  uzupełnione realną ścieżką repo. `terraform validate`/`fmt` przeszły lokalnie (2026-08-26), **`plan`/
  `apply` nie uruchomione** — kod nieprzejrzany/niezmergowany w `Sandbox/iac`.
- **`ios/fastlane/Fastfile`** — pusty scaffold (`UI.user_error!`), nie wpięty do żadnego CI — Apple
  Developer Program nie założone, iOS świadomie poza zakresem tej iteracji.
- **Pierwszy release do Play zawsze ręczny** (Testing → Internal testing → Create release) — moment
  opt-in do Play App Signing i pierwszej walidacji store listing; `fastlane supply`/`upload_to_play_store`
  działa dopiero od drugiego uploadu.

## Testing

Zero realnego pokrycia CI odziedziczone z Mobile (`0 meaningful specs` per Sandbox `ai/TESTING.md`
pierwotnie) — nie traktować jak siatki bezpieczeństwa. `.github/workflows/build-and-test.yml` w tym
repo robi tylko `lint` + `ng build` (web bundle) na PR-ach i push do `master`. Osobny
`.github/workflows/release-android.yml` (2026-08-26, zob. "Pipeline wydawniczy" wyżej) buduje/podpisuje/
publikuje Androida do Play Store, ale tylko po zmergowanym PR `develop → master` — świadomie osobny
workflow, nie rozszerzenie `build-and-test.yml`. iOS build/sign/publish nadal poza zakresem.

**Stan weryfikacji na realnym urządzeniu** (zob. "Test na fizycznym urządzeniu Android przez USB"):
cały CIAM login round-trip (2026-07-24/25, patrz "Auth — Entra External ID" i "Manualny krok CIAM"
wyżej) zweryfikowany end-to-end. Wciąż niepotwierdzone: discovery klubów (`find-club`) na żywym
urządzeniu, push notifications, P24 checkout, cokolwiek na iOS — pełna, aktualna lista: "Znane luki /
do zrobienia" niżej.

**Karma**: 19 plików speców, wszystkie zielone (`npm test` / `ng test --watch=false
--browsers=ChromeHeadless`) — boilerplate (`app.component`, `tab1.page`, `tabs.page` — ostatni wymagał
doklejenia `provideHttpClient()`, bo `TabsPage.ngOnInit()` woła
`PushNotificationsService`→`NotificationsApiService`→`HttpClient`), discovery klubów
(`storefront-discovery.service.spec.ts`, `find-club.page.spec.ts`, `clubs.page.spec.ts`), Akademia
(`academy-api.service.spec.ts`, `active-vertical.service.spec.ts`, 3 ekrany `academy/**/*.page.spec.ts`
— wzór `schedule.page.spec.ts`: mock `*ApiService`, `getMyMemberships` → `of([membership])`,
`storefrontContext.resolve` → `resolveTo('sf-1')`, `provideRouter([])` + `provideTranslateService()`;
asercje kolorów/klas `ion-*` bywają zawodne w headless — testować logikę/propsy, nie hydrację web
componentu). Nadal nie liczyć tego jako realnej siatki bezpieczeństwa — nie ma pokrycia dla większości
appki (schedule/carnet/
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
`pl.localbiz.academy://payment-callback`), nowy intent-filter host w
`android/app/src/main/AndroidManifest.xml` (iOS nic nie wymaga — `Info.plist` rejestruje tylko schemat,
nie host). Backend: `GET api/carnets/p24/payment-callback` (`MemberCarnetsController`, `[AllowAnonymous]`)
serwuje statyczną stronę-lądowisko przekierowującą na ten deep link; `p24carnets--returnUrl` (Terraform)
zmieniony na ten endpoint zamiast stałej, nigdy nieużywanej kopii URL-a Subscriptions. Zob.
`Sandbox/src/Modules/Carnets/CLAUDE.md` → "P24 recurring integration" po szczegóły.

**Niezweryfikowane w żadnej sesji dotąd** (brak realnego urządzenia + brak potwierdzonego projektu
Firebase/prawdziwych sekretów APNs w Key Vault): prawdziwy prompt uprawnień push, realny token
FCM/APNs, realna dostawa po triggerze (np. odwołanie sesji), i cały P24 checkout→deep-link round-trip
(wymaga też punktu 2 z `faza-7-next-steps.md` — żywa weryfikacja P24 w sandboxie, wciąż otwarta).

**Rejestracja tokenu — potwierdzona jako kompletna po stronie kodu (2026-09-25)**: cały łańcuch
`push-notifications.service.ts` → `notifications-api.service.ts` → realny endpoint backendu
`POST api/notifications/native-push-subscriptions/member` jest już okablowany, nic tu nie zostało do
dopisania. Jedyny brakujący element to poświadczenia (`google-services.json`/klucz APNs) — flaga
`environment.pushNotificationsEnabled` zostaje `false`, dopóki nie trafią do repo/Key Vaulta.

## Skrzynka powiadomień (bell/inbox) — parytet z AcademyWeb (2026-09-25)

Natywny odpowiednik AcademyWeb's `notification-bell` (ten sam backendowy endpoint, ten sam wzorzec
pollingu — zob. `Sandbox/src/Modules/Notifications/CLAUDE.md` → "Member notification inbox"), nie
kolejny kanał pusha: `core/services/member-notifications-api.service.ts` (`GET/POST
api/notifications/member/inbox[...]`, tym samym wzorcem base-URL co istniejący
`notifications-api.service.ts` — `ExternalConfigService.getConfig()?.apiConfig?.uri`, **nie**
`environment.apiBaseUrl` jak w AcademyWeb) + `components/notification-bell/notification-bell.component.ts`
(`rxResource` + polling co 60s poza strefą Angulara, `ion-popover` z `ion-badge` na liczniku
nieprzeczytanych — nie absolutnie pozycjonowany div jak w wersji web, bo tu overlay jest idiomatyczny
Ionic). Wpięty w `ion-buttons slot="end"` w headerze każdej z 5 root-tab stron (`clubs`, `schedule`,
`carnet`, `academy-children`, `tab1` — ta ostatnia to zakładka "Profil"), bo `<ion-tabs>` nie ma jednego
współdzielonego headera jak web app-shell.

## Znane luki / do zrobienia (2026-07-25)

- **Skrzynka powiadomień (bell/inbox) niezweryfikowana na żywym urządzeniu** — przechodzi buildy/testy
  Karma, ale wymaga lokalnie odpalonego backendu (`dotnet run` w Sandbox) do realnego end-to-end testu
  (dzwonek w każdej z 5 zakładek, licznik, popover, oznaczanie jako przeczytane).
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
- **`npx cap sync ios` uruchomione z sukcesem na Linuksie (2026-09-25)** — kopiuje `www/` i aktualizuje
  listę pluginów w `Info.plist` bez Xcode; jedyny pominięty krok to `pod install` (brak CocoaPods na tej
  maszynie, oczekiwane). Realny build w Xcode i test na urządzeniu/symulatorze iOS **nadal
  niezweryfikowane** — wymaga Maca, którego w tej sesji nie było. Android **zweryfikowany 2026-07-24**
  (zob. "Test na fizycznym urządzeniu Android przez USB") — `AndroidManifest.xml`/`build.gradle` buildują
  się i instalują poprawnie na realnym urządzeniu.
- **CORS dla iOS — dev appsettings.json naprawiony (2026-09-25)**: `Sandbox/src/Bootstrapper/Bootstrapper/appsettings.json`'s
  `cors.allowedOrigins` ma teraz `capacitor://localhost` obok `http://localhost` (Android
  `androidScheme: 'http'` już działał, iOS nie mógł). To pokrywa tylko lokalny `dotnet run` — deployowane
  środowiska czytają CORS z Key Vaulta, zasilanego przez `member_native_app_cors_origins`
  (`Sandbox/iac/env/*.tfvars`), które **nadal** nie jest domieszane do `cors_extra_origins`
  (`Sandbox/iac/main.tf`, świadomie wstrzymane razem z resztą wdrożenia Android przez Terraform) —
  do zrobienia razem z odblokowaniem tego pipeline'u, nie osobno.
- **Pipeline wydawniczy Android niezweryfikowany end-to-end (2026-08-26)** — kod okablowany (zob.
  "Pipeline wydawniczy" wyżej), ale zablokowany na czysto ręcznych krokach użytkownika: konto Google
  Play Console nie założone, upload keystore nie wygenerowany, pierwszy ręczny upload do Play Console
  nie zrobiony, `terraform plan`/`apply` w `Sandbox/iac` nie uruchomione (więc Key Vault nie ma jeszcze
  tych sekretów ani nie istnieje service principal dla CI), gałąź `develop` istnieje tylko lokalnie
  (nie wypchnięta). `release-android.yml` nie uruchomi się z sukcesem, dopóki te kroki nie zostaną
  wykonane po kolei.
