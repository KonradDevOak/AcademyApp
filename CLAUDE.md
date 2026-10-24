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

Frontendy platformy LocalBiz, wszystkie mówiące z jednym backendem w repo `Sandbox`:

| Appka | Repo | Odbiorca |
|---|---|---|
| LocalBizWeb | `Sandbox/src/Clients/LocalBizWeb` | właściciel klubu (panel `/club`: grafik, karnety) |
| Showcase | `Workspace/Showcase` (osobne repo) | odwiedzający — publiczna wizytówka, **bez logowania** |
| AcademyWeb | `Sandbox/src/Clients/AcademyWeb` | członek akademii w przeglądarce — **referencja wyglądu i działania tej appki** |
| **AcademyApp** | `Workspace/AcademyApp` (to repo) | członek akademii (rodzic/opiekun albo dorosły uczestnik) — natywnie |

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

Appka nie ma proxy same-origin do backendu, więc `src/environments/environment.ts`/`environment.prod.ts`
mają jawny `apiBaseUrl` (dev `http://localhost:4214` — nginx z `Sandbox/dev`, prod `https://localbiz.pl`,
ten sam origin co AcademyWeb). Jedno źródło dla **każdego** wywołania: bootstrap `member-configuration`
(fork `ExternalConfigService`), `MembersApiService`, `ClubDiscoveryService`, `ACADEMY_API_BASE_URL`,
`FITNESS_API_BASE_URL`, powiadomienia. Nigdy `apiConfig.uri` z `member-configuration` — to wartość
współdzielona między klientami. `webAppBaseUrl` to adres portalu AcademyWeb (linki do portalu otwierane w
appce, adres panelu członka w regulaminie klubu). Android emulator: `http://10.0.2.2:5000`. Backendowe
CORS musi dopuszczać origin WebView'a (`http://localhost` Android, `capacitor://localhost` iOS) — patrz
"Znane luki".

### Test na fizycznym urządzeniu Android przez USB (zweryfikowane 2026-07-24)

Zamiast emulatora/Wi-Fi — kabel USB + `adb reverse`, bez LAN IP, firewalla ani zależności od sieci
Wi-Fi (router z client isolation by to zablokował, USB nie):

1. USB debugging włączone na telefonie, `adb devices` widzi urządzenie jako `device`.
2. `adb reverse tcp:4214 tcp:4214` — przekierowuje `localhost:4214` na telefonie do `:4214` na hoście
   (nginx dev proxy, `Sandbox/dev/nginx.conf`). Trzeba powtórzyć po każdym nowym podłączeniu kabla.
3. `environment.ts`'s `apiBaseUrl` zostaje `http://localhost:4214` (nie LAN IP, nie `10.0.2.2` — te są dla
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
   (`${environment.apiBaseUrl}/api/member-configuration`) — potrzebne, bo appka natywna nie ma same-origin
   proxy do backendu jak appki webowe. Import `environment` przez długą relatywną ścieżkę z
   `libs/shared/iam-msal-external/src/services/` do `src/environments/` — świadome sprzężenie
   wendorowanej biblioteki z appką-hostem, nieuniknione przy tym podejściu.
4. **`logoutRedirect()` = wyczyszczenie cache + `window.location.replace('/')`** — natywny odpowiednik
   upstreamowego powrotu na origin po wylogowaniu: WebView ładuje się od nowa, każdy serwis w pamięci
   (członkostwa, aktywny klub) startuje czysto, a `CustomerGuard` kieruje na `/login`. Ekrany z
   AcademyWeb wołają `logoutRedirect()` bez zmian.
5. **Inicjalizacja MSAL w `provideAppInitializer` (`src/main.ts`)** — najpierw config, potem
   `MsalExternalAuthService.initialize()`, bo `CustomerGuard` czyta `isLoggedIn()` synchronicznie przy
   pierwszej nawigacji.

## Współdzielone pakiety z registry (`@konraddevoak/*`)

`@konraddevoak/academy-api`, `@konraddevoak/fitness-api` i `@konraddevoak/club-legal` to **normalne,
wersjonowane pakiety npm** z prywatnego GitHub Packages (scope `@konraddevoak`, publikowane z `Sandbox`
workflow `publish-shared-libs.yml`) — **te same wersje co w `AcademyWeb`** (jej `package.json` jest
wzorcem; przy przenoszeniu zmian z AcademyWeb podbij pin razem z kodem). To czyste kontrakty HTTP/
komponenty bez logiki OAuth, więc nie ma czego forkować (w przeciwieństwie do `iam-msal-*` wyżej, których
z registry **nie** bierzemy). Peery tylko `@angular/core|common` + rxjs — bez Material/CDK.

- **Auth do registry**: `.npmrc` wskazuje scope na `npm.pkg.github.com` i czyta `NODE_AUTH_TOKEN`. CI
  (`build-and-test.yml`, `release-android.yml`) wstrzykuje go z sekretu `GH_PACKAGES_READ_TOKEN` (PAT
  `read:packages`); w `release-android.yml` to jedyny GitHub Secret — reszta idzie z Key Vault przez OIDC.
- **Wersja pinowana dokładnie** (nigdy dist-tag `dev` ani caret) — build wydania musi być reprodukowalny.
- **Lokalny dev bez czekania na publish**: w `package.json` (niecommitowane) podmień wersję na
  `file:../Sandbox/src/Clients/libs/dist/shared/<pkg>` i zbuduj lib w Sandboxie. **Cofnij przed commitem**
  — CI nie ma dostępu do `../Sandbox`.
- `ACADEMY_API_BASE_URL`/`FITNESS_API_BASE_URL` w `src/main.ts` = `environment.apiBaseUrl`; Bearer dokleja
  globalny `authTokenInterceptor`.

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

## Appka = ekrany AcademyWeb na Ionic

Wygląd i działanie mają być takie jak w `Sandbox/src/Clients/AcademyWeb` (widok telefonu). Ekrany są
**przeniesione 1:1** z AcademyWeb (te same nazwy plików i ścieżki w `src/app/`, ten sam ręczny HTML z
globalnymi klasami `.page/.card/.btn/.pill/.banner`, te same trasy, guardy i sekcje); Ionic daje tylko
strukturę (menu, `ion-content`, akordeony, popover, overlaye). Zmiana w AcademyWeb = przenieś ją tutaj
tym samym plikiem — rozjazd jest błędem, nie wariantem. Świadome różnice są wyłącznie natywne (niżej).

- **Motyw**: `src/theme/_tokens.scss`/`_fonts.scss`/`_base.scss`/`_components.scss` skopiowane z
  `AcademyWeb/src/styles/` („Neon night”, fonty Anton/Inter w `src/assets/fonts/`), ładowane przez
  `src/theme/app.scss` **po** CSS Ionica (`angular.json` → `styles`), żeby wygrywały z jego typografią.
  `src/theme/variables.scss` mapuje te same kolory na zmienne Ionica (`--ion-color-*`, step-palety dla
  overlayów) — wartości hex powtórzone, trzymać w sync z `_tokens.scss`. Bez palety `dark.class.css` Ionica.
- **Shell** (`shell/app-shell`): nagłówek (logo, dzwonek, hamburger) + prawa szuflada `ion-menu`
  (`mobile-menu-content`: linki sekcji, lista akademii `club-switcher`, motyw, wylogowanie) + jedno
  `ion-content` z `<router-outlet>` i stopką prawną — układ mobilny AcademyWeb. Routing to zwykły
  Angular (`<router-outlet>`, bez `ion-router-outlet`/`IonicRouteStrategy`), więc ekrany zachowują
  przewijanie i historię jak strona. Ekrany publiczne (`login`, `invite`, regulaminy) w
  `shell/public-layout` (samo `ion-content`).
- **Sekcje** z usług akademii (`core/services/active-sections.ts`): Grupy `/academy` (`academy`) i Zajęcia
  i karnety `/classes` (`classes_schedule`+`carnets_billing`+`club_members`) — nie z `businessType`.
- **Akordeony** na `/academy` i `/classes`: `ion-accordion-group` w miejscu `mat-accordion` AcademyWeb
  (zawsze jeden otwarty; style w `theme/_components.scss`).

### Natywne odpowiedniki (`src/app/core/native/` + `shared/payments/payment-redirect.ts`)

- **Płatności**: `PaymentRedirectService.redirectTo()` otwiera bramkę w przeglądarce systemowej
  (`@capacitor/browser`) i zapamiętuje ekran powrotu po sekcji, z której ruszył checkout
  (`academy.pending-payment-return`). Backend (`AcademyPaymentCallbackController`,
  `MemberCarnetsController`) odbija mobilną przeglądarkę na `pl.localbiz.academy://payment-callback?…`
  — jeden link dla opłaty akademii i karnetu, stąd zapamiętana sekcja. `DeepLinkService` zamyka kartę i
  otwiera `/academy|classes/payment-callback` z query (paymentId); zamknięcie karty bez powrotu
  (`browserFinished`) też ląduje na callbacku (polluje i uczciwie pokazuje „w toku”).
- **Deep linki** (`DeepLinkService`, warm `appUrlOpen` + cold `getLaunchUrl`): zaproszenie w trzech
  kształtach (`https://academy.localbiz.pl/invite` z maila, `pl.localbiz.academy://invite/academy`,
  `…/api/academy/invite`) → `/invite`; `pl.localbiz.academy://carnet` → `/classes`. Callback CIAM
  obsługuje fork MSAL sam.
- **Linki** (`ExternalLinkService`, jeden listener na `document`): link do portalu albo względny →
  trasa w appce; inny `http(s)` (dokumenty klubu, `target="_blank"`) → przeglądarka systemowa;
  `tel:`/`mailto:` → system. Szablony z AcademyWeb zostają bez zmian.
- **Przycisk wstecz** (`BackButtonService`): zamyka otwarty `<dialog>` (zdarzenie `cancel`, jak Esc),
  na ekranach z menu minimalizuje appkę, poza tym `Location.back()`. Menu/overlaye Ionica mają wyższy
  priorytet.
- **Storage**: konteksty płatności i zaproszenia w `localStorage` (nie `sessionStorage` jak w web) —
  Android może ubić appkę w tle w trakcie checkoutu/logowania. `localStorage` WebView'a jest trwałe w
  danych appki na Androidzie; na iOS do rozważenia `@capacitor/preferences`, jeśli okaże się czyszczone.
- **Geolokalizacja** w `find-club`: `@capacitor/geolocation` (token `GEOLOCATION_PLUGIN`, natywny prompt).
- **Motyw**: `ThemeService` jak w web (domyślnie ciemny, klasa `.dark`/`.light` na `<html>`) **plus tryb
  „systemowy”** (dodatek ponad web); synchronizuje kolor paska statusu. Okno Androida i paski systemowe
  ciemne od startu (`res/values/academy_colors.xml`, `styles.xml`).
- **Logowanie**: `login` zamiast `pageshow`/bfcache słucha `browserFinished` (zamknięta karta CIAM bez
  logowania przywraca przycisk).

### Natywne dodatki ponad AcademyWeb

- **Skaner QR** (`find-club/qr-join`, ML Kit, token `BARCODE_SCANNER_PLUGIN`): kod QR akademii z
  LocalBizWeb (`https://{domena}`) → `GET api/storefronts/resolve?domain=` → karta `/clubs/:id`, gdzie
  dołączenie przebiega jak dla wyniku wyszukiwania.
- **Dzwonek/skrzynka** (`components/notification-bell`, `GET/POST api/notifications/member/inbox[...]`,
  polling 60 s poza strefą Angulara) — w nagłówku shella.
- **Push FCM/APNs** — sekcja niżej.

### Zasady przy dalszej pracy

- Kopiuj z AcademyWeb plik po pliku (`cp`), potem tylko adaptacje z listy wyżej; specy razem z kodem.
- Importy auth z `@shared/iam-msal-external` (fork), nie z `@konraddevoak/iam-msal-external`.
- Angular i TS trzymane na tej samej linii co AcademyWeb (dziś 20.3 / 5.9) — szablony używają składni,
  której starszy kompilator nie zna.

## Internacjonalizacja (i18n)

ngx-translate v18, `src/assets/i18n/{pl,en}.json` = pliki AcademyWeb (`public/assets/i18n/`) + klucze
tylko-natywne (`notifications.*`, `findClub.qr.*`, `shell.theme.*` dla trybu systemowego). Przy
przenoszeniu zmian z AcademyWeb dosyp jej nowe klucze `jq`-iem (nie nadpisuj całego pliku — zginą klucze
natywne). `pl` na sztywno, bez przełącznika języka; loader czyta zbundlowany asset, więc działa offline.

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

- **Strategia gałęzi**: feature branch → PR do `develop`; wydanie = PR `releases/**` albo `hotfix/**`
  → `master` (release gate, guard wzorowany na `Showcase/.github/workflows/deploy-prod.yml`). PR
  `develop → master` **nie** wydaje. Zakres celowo: **pełna automatyzacja aż do produkcji**
  (nie tylko internal/beta track) — świadomy wybór użytkownika, mimo ryzyka błędnej auto-publikacji.
- **`.github/workflows/release-android.yml`** (nowy) — trigger `pull_request closed` na `master` +
  guard `merged == true` i `head_ref` = `releases/*` albo `hotfix/*`. `versionCode` = `run_number + 100`
  (env `ANDROID_VERSION_CODE` czytany w `android/app/build.gradle`; lokalnie 1) — Play odrzuca
  powtórzony versionCode. `azure/login` (OIDC, bez GitHub Secrets) → pobiera
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

Karma/Jasmine (`npm test -- --watch=false --browsers=ChromeHeadless`): specy przeniesione z AcademyWeb
razem z ekranami + natywne (`core/native/*`, `payment-redirect`, `qr-join`, `notification-bell`, shell z
`ion-menu`). Szum `"X.ngOnDestroy()" is not implemented on web` w logu to tokeny opakowujące proxy
pluginów Capacitora przy niszczeniu TestBeda — nie błąd testu. `.github/workflows/build-and-test.yml`
robi `lint` + `ng build` na PR-ach; `release-android.yml` to osobny pipeline wydania (niżej).
`cd android && ./gradlew assembleDebug` buduje APK lokalnie (SDK w `~/Android/Sdk`).

**Stan weryfikacji na urządzeniu**: login CIAM round-trip zweryfikowany (2026-07-24/25). Ekrany
przeniesione z AcademyWeb, płatności przez przeglądarkę systemową, deep linki zaproszeń/płatności,
QR, geolokalizacja, przycisk wstecz, safe area/edge-to-edge na Androidzie 15 — **niezweryfikowane na
urządzeniu**. iOS — nic.

## Push notifications — natywny FCM (decyzja 2026-07-21, nie web-push)

Świadomie **nie** konsumuje backendu istniejącego web-push (VAPID/`PushSubscriptionsController`) — appka
to natywny Capacitor WebView, gdzie "dostawa nawet gdy appka zamknięta" nie jest tak pewna jak w
prawdziwej karcie przeglądarki. Zamiast tego: `@capacitor/push-notifications` + nowy backendowy kanał
FCM. Pełny design (fan-out `IPushService`→`IPushChannel`, `CompositePushService`,
`NativePushSubscription`) w `Sandbox/src/Modules/Notifications/CLAUDE.md` → "Natywny push (FCM/APNs)".

`push-notifications.service.ts` — `init()` wołane raz z konstruktora `AppShellComponent` (po `CustomerGuard`, więc
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


**Niezweryfikowane w żadnej sesji dotąd** (brak realnego urządzenia + brak potwierdzonego projektu
Firebase/prawdziwych sekretów APNs w Key Vault): prawdziwy prompt uprawnień push, realny token
FCM/APNs, realna dostawa po triggerze (np. odwołanie sesji), i cały P24 checkout→deep-link round-trip
(wymaga też punktu 2 z `faza-7-next-steps.md` — żywa weryfikacja P24 w sandboxie, wciąż otwarta).

**Rejestracja tokenu — potwierdzona jako kompletna po stronie kodu (2026-09-25)**: cały łańcuch
`push-notifications.service.ts` → `notifications-api.service.ts` → realny endpoint backendu
`POST api/notifications/native-push-subscriptions/member` jest już okablowany, nic tu nie zostało do
dopisania. Jedyny brakujący element to poświadczenia (`google-services.json`/klucz APNs) — flaga
`environment.pushNotificationsEnabled` zostaje `false`, dopóki nie trafią do repo/Key Vaulta.


## Znane luki / do zrobienia

- **Weryfikacja na urządzeniu całości** — patrz "Testing"; porównanie ekranów obok AcademyWeb (`:4213`)
  w obu motywach.
- **App Link zaproszeń** (`academy.localbiz.pl/invite`, `autoVerify`) czeka na
  `https://academy.localbiz.pl/.well-known/assetlinks.json` (SWA AcademyWeb w Sandboxie) z odciskiem
  klucza podpisującego release — zablokowane jak "Pipeline wydawniczy". Do tego czasu link z maila
  otwiera portal w przeglądarce; zaproszenie w appce działa przez stronę-przelotkę `api/academy/invite`.
- **P24 sandbox nadal "documented, not live-verified"** (`Sandbox/src/Modules/Carnets/CLAUDE.md`).
- **CORS w środowiskach wdrożonych**: `member_native_app_cors_origins` (`Sandbox/iac/env/*.tfvars`) nie
  jest domieszane do `cors_extra_origins` (`Sandbox/iac/main.tf`) — appka na prod `https://localbiz.pl`
  nie przejdzie CORS, dopóki to nie zostanie włączone (lokalny `appsettings.json` ma już `http://localhost`
  i `capacitor://localhost`).
- **Splash** (`android/.../drawable*/splash.png`) to nadal domyślny obraz Capacitora — do podmiany na grafikę
  „Akademii”.
- **iOS**: `npx cap sync ios` działa na Linuksie, build w Xcode niezweryfikowany (brak Maca).
- **Pipeline wydawniczy Android** niezweryfikowany end-to-end (konto Play Console, keystore, `terraform
  apply` w `Sandbox/iac`).

