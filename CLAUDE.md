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

## Brakujący endpoint backendu (rozwiązany równolegle w Sandboxie, 2026-07-18)

`MemberClassesController` nie miał żadnego "przeglądaj dostępne sesje" — dodano
`GET api/classes/{storefrontId}/sessions?from=&to=` w tej samej sesji, żeby nie blokować przyszłego
Task B (grafik). Zob. `Sandbox/src/Modules/Classes/CLAUDE.md` → sekcja "Member-facing schedule browsing".

## Struktura appki (Task A — ten stan)

```
src/app/
├── app.routes.ts              # '' -> login, login, complete-profile (CustomerGuard), tabs
├── components/login/          # CIAM login (jeden przycisk, bez legacy email/hasło formularza)
├── complete-profile/          # POST members/complete-profile — pierwsze uzupełnienie profilu
├── tabs/                      # ion-tabs shell (Ionic CLI "tabs" convention — path 'tabs' zagnieżdżony
│                                 dwukrotnie to standardowy wzorzec generatora, nie błąd)
├── clubs/                     # "Moje kluby" — GET me/memberships, join/leave
├── tab1/                      # Profil — MsalExternalAuthService.getUserProfile()/logout()
├── core/
│   ├── models/member.model.ts       # MemberDto/MembershipDto — kamelCase, zgodne z backendem
│   └── services/members-api.service.ts
└── interceptors/auth-token.interceptor.ts   # Bearer na żądania zawierające '/api/'
```

**Znane uproszczenie**: `MembershipDto` z backendu ma tylko `storefrontId`/`joinedAt` — **brak nazwy
klubu**. Ekran "Moje kluby" pokazuje skrócony `storefrontId` zamiast nazwy. Brak dziś publicznego
endpointu "storefront po ID" (istniejące publiczne `resolve`/`public` w Storefronts rozwiązują po
domenie, nie po id — zob. `Sandbox/ai/BACKEND_CAPABILITIES.md` §2). Do doprecyzowania w Task B/C:
albo nowy member-facing bus route zwracający nazwy storefrontów po liście ID, albo backend dołącza
nazwę bezpośrednio do `MembershipDto`.

**Znane uproszczenie**: "dołącz do klubu" to dziś zwykłe pole tekstowe na `storefrontId` (GUID) —
brak realnego mechanizmu odkrywania/zapraszania (QR/link/kod). Wystarczające, żeby udowodnić że
`POST members/{storefrontId}/join` faktycznie działa end-to-end; realny onboarding UX to osobna decyzja
produktowa, nie zakładana tutaj.

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

**Co nie zostało i nie mogło zostać zweryfikowane w tej sesji** (brak emulatora/urządzenia w
środowisku):
- Cały round-trip logowania CIAM: `Browser.open()` → hostowany login Entra → redirect przez
  `pl.localbiz.clubhouse://auth-callback` → `appUrlOpen` → `handleRedirectPromise` → aktywne konto.
- Czy backendowe CORS w ogóle dopuszcza origin appki natywnej (`https://localhost` domyślnie na
  Capacitorze) — niesprawdzone, może wymagać dopisania do polityki CORS backendu.
- `npx cap sync android`/`npx cap sync ios` — nie uruchomiono w tej sesji (wymaga zainstalowanego
  Android SDK/Xcode), więc nawet strukturalna poprawność projektów natywnych po zmianach w
  `AndroidManifest.xml`/`Info.plist`/`build.gradle` jest niepotwierdzona.

## Następne kroki (świadomie poza zakresem Task A)

Pełny zakres pierwotnego zadania (`Sandbox/docs/fitness/faza-6-next-steps.md` punkt 3) obejmował też
grafik zajęć, karnety/P24, zgody, ankietę zdrowotną, push — rozbite na osobne przyszłe zadania:

- **Task B — Grafik i zapisy**: `GET classes/{storefrontId}/sessions`, enroll/cancel/waitlist,
  makeup credits, personal training self-service.
- **Task C — Karnety/P24**: zakup, auto-renewal, anulowanie, retry-payment. Najwyższe ryzyko biznesowe
  (prawdziwe pieniądze) — `CarnetsP24Client.cs` ma niepotwierdzone przeciw sandboxowi pola (zob.
  `Sandbox/src/Modules/Carnets/CLAUDE.md`). Dodatkowa natywna komplikacja: `POST carnets/me/carnets`
  zwraca hostowany URL P24 do otwarcia — w appce natywnej przez `@capacitor/browser`, z powrotem przez
  deep link (ten sam wzorzec co login), co wymaga też zmiany po stronie IaC/backendu (P24 return URL).
- **Task D — Zgody/ankieta zdrowotna/push**: `consents/pending|accept`, `health-questionnaire` (zestaw
  pytań **nieustalony** — zob. `Sandbox/src/Modules/Members/CLAUDE.md`, nie zgadywać). Push:
  **nierozstrzygnięta decyzja architektoniczna** — backend (`Sandbox/src/Modules/Notifications/
  CLAUDE.md` → "Web Push (VAPID)") zbudowany pod przeglądarkowy Web Push (VAPID + service worker), nie
  pod natywny FCM/APNs. Appka natywna prawdopodobnie chce `@capacitor/push-notifications` (FCM/APNs) —
  to **inna integracja backendowa** niż istniejąca (`PushSubscriptionsController`), wymagająca nowego
  `IPushService`/kształtu subskrypcji. Nie zaczynać kodu w żadnym kierunku bez jawnej decyzji z
  użytkownikiem — dwie opcje z realnymi trade-offami, nie oczywisty wybór.
