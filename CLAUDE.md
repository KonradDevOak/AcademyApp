# CLAUDE.md

## Co to jest

Clubhouse — natywna appka klubowicza (Android/iOS, Ionic 8 + Capacitor 7 + Angular 20) platformy
LocalBiz. Wyekstrahowana 2026-07-18 z `Sandbox/src/Clients/Mobile` (dawniej opisywana jako appka
właściciela — w praktyce zawierała martwy kod po nieudanym pivocie w stronę weryfikacji autentyczności
produktów; ten kod został usunięty, nie zmigrowany).

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

## Backend URL — środowiskowy, nie runtime-owy

W przeciwieństwie do LocalBizWeb/Admin/Showcase (serwowane same-origin z backendem przez nginx/SWA
linked-backend, `/api/...` bez CORS), appka natywna nie ma takiego proxy — `src/environments/
environment.ts`/`environment.prod.ts` mają jawny `apiUrl` (`http://localhost:5000` dev,
`https://api.localbiz.pl` prod). Android emulator: podmień na `http://10.0.2.2:5000` (loopback z
emulatora do hosta ma inny adres niż `localhost`). Backendowe CORS musi dopuszczać origin WebView'a
(domyślnie `https://localhost` na Androidzie/iOS dla Capacitora) — niesprawdzone, patrz "Known gaps".

## Auth — Entra External ID (CIAM), nie ten sam schemat co LocalBizWeb

Backend ma trzy schematy JWT: `Bearer` (właściciel/LocalBizWeb), `AdminBearer` (operator/Admin),
`MemberBearer` (klubowicz — **ta appka**, osobny tenant Entra External ID). Zob.
`Sandbox/src/Modules/Members/CLAUDE.md` dla pełnego modelu (jeden `Member` może należeć do wielu
storefrontów — jak karta lojalnościowa, nie osobne konto na klub).

Config endpoint: `GET /api/member-configuration` (anonimowy, zwraca `msalConfig`/`apiConfig` — pobrany
przy starcie appki przez `AppInitService`/`ExternalConfigService`).

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
   'pl.localbiz.clubhouse://auth-callback'`, po czym `handleRedirectPromise(fragment)` kończy wymianę
   kodu na tokeny (MSAL nadal robi całą kryptografię — PKCE/state/nonce — sam).
   **UNVERIFIED**: brak środowiska z emulatorem/urządzeniem w tej sesji do przetestowania. To
   najwyższego ryzyka nieprzetestowany element całego zadania — zweryfikować przed jakimkolwiek
   demo/produkcją.
2. **`doLogout()` uproszczony** — czyści tylko lokalny cache MSAL (`clearCache`/`setActiveAccount(null)`)
   zamiast `logoutPopup()` (ten sam problem WebView co login). Świadomy kompromis: nie kończy sesji
   hostowanej po stronie Entra, więc kolejne logowanie może cicho się SSO-wać z powrotem przez cookie
   sesji w system browserze. Do rewizji, jeśli potrzebny prawdziwy single-logout.
3. **`external-config.service.ts` — `endpoint` absolutny**, nie `/api/member-configuration` względny
   (`${environment.apiUrl}/api/member-configuration`) — potrzebne, bo appka natywna nie ma same-origin
   proxy do backendu jak appki webowe. Import `environment` przez długą relatywną ścieżkę z
   `libs/shared/iam-msal-external/src/services/` do `src/environments/` — świadome sprzężenie
   wendorowanej biblioteki z appką-hostem, nieuniknione przy tym podejściu.

## Manualny krok CIAM w Azure Portal (blokujący, nie do zautomatyzowania)

Zob. `Sandbox/src/Modules/Members/CLAUDE.md` → "IaC — krok ręczny": w Azure Portal (tenant
`sandboxdevo`) trzeba ręcznie utworzyć User Flow Sign-up/Sign-in i powiązać go z app registration
Members. **Dodatkowo dla tej appki**: redirect URI `pl.localbiz.clubhouse://auth-callback` musi zostać
dodany jako dozwolony redirect URI na tym samym app registration (obok istniejących web redirect URIs
dla Showcase/LocalBizWeb) — inaczej Entra odrzuci callback z "invalid redirect URI" niezależnie od tego,
jak poprawny jest kod appki. Żaden test logowania end-to-end nie zadziała bez obu tych kroków.

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

## Struktura appki (po Task B/C/D, 2026-07-21)

```
src/app/
├── app.routes.ts              # '' -> login, login, complete-profile (CustomerGuard), tabs
├── components/login/          # CIAM login (jeden przycisk, bez legacy email/hasło formularza)
├── complete-profile/          # POST members/complete-profile — pierwsze uzupełnienie profilu
├── tabs/                      # ion-tabs shell — 4 taby: Kluby, Grafik, Karnet, Profil
├── clubs/                     # "Moje kluby" — GET me/memberships, join (z retry po zgodach)/leave
├── club-detail/                # Hub klubu (clubs/:storefrontId) — linki do Zgody/Ankieta
├── consents/                   # Lista+akceptacja zgód (clubs/:storefrontId/consents, ?returnTo=join)
├── health-questionnaire/       # Ankieta zdrowotna (append-only) + gate zgody RODO art.9
├── schedule/                   # Tab "Grafik" — sesje/zapisy/lista rezerwowa/odrobienia
├── carnet/                     # Tab "Karnet" — aktualny karnet lub sign-up + akcje P24
├── tab1/                       # Profil — MsalExternalAuthService.getUserProfile()/logout()
├── core/
│   ├── models/                 # member/classes/carnets .model.ts — kamelCase, zgodne z backendem
│   └── services/
│       ├── members-api.service.ts       # api/members/* (rozszerzone o consents/health-questionnaire)
│       ├── classes-api.service.ts       # api/classes/*
│       ├── carnets-api.service.ts       # api/carnets/*
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

**Wciąż uproszczone**: "dołącz do klubu" to zwykłe pole tekstowe na `storefrontId` (GUID) — brak
realnego mechanizmu odkrywania/zapraszania (QR/link/kod). Świadomie poza zakresem tego zadania.

**Nawigacja wielu klubów**: `StorefrontContextService` trzyma "aktywny" `storefrontId` dla tabów
Grafik/Karnet — jeden klub: auto-wybór po cichu; wiele: `ActionSheetController` picker przy pierwszym
wejściu w sesji, zapamiętany w `@capacitor/preferences`. Zgody/Ankieta nie potrzebują tego kontekstu —
są zawsze per-konkretny-klub, osiągane z `ClubDetailPage`.

## Rebrand natywny

`capacitor.config.ts`/`android/app/build.gradle`'s `applicationId`/`strings.xml`/iOS
`PRODUCT_BUNDLE_IDENTIFIER` → `pl.localbiz.clubhouse`. **Nie zmieniono**: Android `namespace` w
`build.gradle` zostaje `io.ionic.starter` (musi zgadzać się z faktyczną deklaracją `package` w
`MainActivity.java`, która wciąż mówi `com.getcapacitor.myapp` — kosmetyczne/porządkowe, nie wpływa na
tożsamość appki w sklepie, wymagałoby przeniesienia plików Javy, nie zrobione w tym zadaniu). Podpisywanie
(signing config) Android/iOS — nie skonfigurowane, osobny krok użytkownika przed publikacją.

## Testing

Zero realnego pokrycia CI odziedziczone z Mobile (`0 meaningful specs` per Sandbox `ai/TESTING.md`
pierwotnie) — nie traktować jak siatki bezpieczeństwa. `.github/workflows/build-and-test.yml` w tym
repo robi tylko `lint` + `ng build` (web bundle) — **nie** builduje/podpisuje/publikuje Android/iOS,
to świadomie poza zakresem, większa inwestycja CI na później.

**Co nie zostało i nie mogło zostać zweryfikowane w żadnej sesji dotąd** (brak emulatora/urządzenia w
środowisku) — pełna, aktualna lista: "Znane luki / do zrobienia" niżej. W skrócie: cały CIAM login
round-trip, `npx cap sync android`/`ios`, i wszystko zależne od realnego urządzenia (push, P24 checkout).

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
`pl.localbiz.clubhouse://payment-callback`), nowy intent-filter host w
`android/app/src/main/AndroidManifest.xml` (iOS nic nie wymaga — `Info.plist` rejestruje tylko schemat,
nie host). Backend: `GET api/carnets/p24/payment-callback` (`MemberCarnetsController`, `[AllowAnonymous]`)
serwuje statyczną stronę-lądowisko przekierowującą na ten deep link; `p24carnets--returnUrl` (Terraform)
zmieniony na ten endpoint zamiast stałej, nigdy nieużywanej kopii URL-a Subscriptions. Zob.
`Sandbox/src/Modules/Carnets/CLAUDE.md` → "P24 recurring integration" po szczegóły.

**Niezweryfikowane w żadnej sesji dotąd** (brak realnego urządzenia + brak potwierdzonego projektu
Firebase/prawdziwych sekretów APNs w Key Vault): prawdziwy prompt uprawnień push, realny token
FCM/APNs, realna dostawa po triggerze (np. odwołanie sesji), i cały P24 checkout→deep-link round-trip
(wymaga też punktu 2 z `faza-7-next-steps.md` — żywa weryfikacja P24 w sandboxie, wciąż otwarta).

## Znane luki / do zrobienia (2026-07-21)

- **CIAM login round-trip nadal niezweryfikowany end-to-end** — status User Flow w Azure Portalu
  (tenant `sandboxdevo`) niepewny, użytkownik sam to sprawdza (zob. `Sandbox/src/Modules/Members/
  CLAUDE.md` → "IaC — krok ręczny"). Backend/frontend obu stron gotowe, ale bez tego żaden realny test
  logowania nie zadziała niezależnie od jakości kodu.
- **P24 sandbox nadal "documented, not live-verified"** (`Sandbox/src/Modules/Carnets/CLAUDE.md`) —
  realne pieniądze, nie testować na produkcyjnym storefroncie przed potwierdzeniem.
- **Zestaw pytań ankiety zdrowotnej** (`health-questionnaire.page.ts`) to rozsądne minimum wymyślone na
  potrzeby v1 (3 toggle + notatka), nie ustalony z klientką zestaw — `AnswersJson` jest opaque po stronie
  backendu, więc zmiana formularza później nie wymaga migracji.
- **`npx cap sync android`/`ios` nieuruchomione w tej sesji** (brak SDK/Xcode) — strukturalna poprawność
  `AndroidManifest.xml`/`Info.plist`/`build.gradle` po dodaniu `@capacitor/push-notifications`
  niepotwierdzona.
- **CORS dla iOS** — dev CORS dopuszcza `http://localhost` (Android `androidScheme: 'http'`), ale
  domyślny schemat Capacitor dla iOS (`capacitor://localhost`) nie jest dziś na liście
  `member_native_app_cors_origins` (`Sandbox/iac/env/*.tfvars`) — do sprawdzenia przed testami na iOS.
