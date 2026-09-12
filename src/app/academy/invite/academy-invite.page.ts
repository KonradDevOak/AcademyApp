import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, Router } from '@angular/router';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonInput,
  IonIcon,
  IonButton,
  IonSpinner,
  IonText
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import {
  checkmarkCircle,
  checkmarkCircleOutline,
  closeCircleOutline,
  documentTextOutline,
  openOutline
} from 'ionicons/icons';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { Browser } from '@capacitor/browser';
import { Preferences } from '@capacitor/preferences';
import { MsalExternalAuthService } from '@shared/iam-msal-external';
import { AcademyApiService } from '@konraddevoak/academy-api';
import { MembersApiService } from '../../core/services/members-api.service';
import { StorefrontContextService } from '../../core/services/storefront-context.service';
import { MembershipsCacheService } from '../../core/services/memberships-cache.service';
import { getErrorCode, isConsentRequiredError } from '../../core/utils/consent-error.util';
import { PendingConsentDto } from '../../core/models/member.model';

type Step = 'resolving' | 'login' | 'profile' | 'consents' | 'working' | 'error';
type ErrorAction = 'retry' | 'relogin' | null;

const PENDING_INVITE_KEY = 'pending-academy-invite';

// Self-contained parent-invitation flow (route `academy-invite`, outside tabs / CustomerGuard).
// Steps: CIAM login → optional display-name (when the profile is not completed) → join the storefront
// (accepting pending consents inline if the backend asks) → accept the invitation → land on
// "add your first child". token + storefrontId are persisted so the flow survives the login
// system-browser round trip and a cold start (see DeepLinkService).
@Component({
  selector: 'app-academy-invite',
  templateUrl: 'academy-invite.page.html',
  styleUrls: ['academy-invite.page.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonInput,
    IonIcon,
    IonButton,
    IonSpinner,
    IonText,
    TranslatePipe
  ]
})
export class AcademyInvitePage implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private formBuilder = inject(FormBuilder);
  private auth = inject(MsalExternalAuthService);
  private academyApi = inject(AcademyApiService);
  private membersApi = inject(MembersApiService);
  private storefrontContext = inject(StorefrontContextService);
  private membershipsCache = inject(MembershipsCacheService);
  private translate = inject(TranslateService);

  step: Step = 'resolving';
  busy = false;
  errorKey = 'academy.invite.errors.generic';
  errorAction: ErrorAction = 'retry';

  pendingConsents: PendingConsentDto[] = [];
  acceptedDocumentTypes = new Set<string>();

  profileForm: FormGroup = this.formBuilder.group({
    displayName: ['', [Validators.required, Validators.minLength(2)]]
  });

  private token: string | null = null;
  private storefrontId: string | null = null;
  private membershipRetried = false;

  constructor() {
    addIcons({ documentTextOutline, checkmarkCircleOutline, checkmarkCircle, openOutline, closeCircleOutline });
  }

  async ngOnInit(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    this.token = params.get('token');
    this.storefrontId = params.get('storefrontId');

    if (!this.token || !this.storefrontId) {
      const stored = await this.readPendingInvite();
      this.token = stored?.token ?? null;
      this.storefrontId = stored?.storefrontId ?? null;
    }

    if (!this.token || !this.storefrontId) {
      this.fail('academy.invite.errors.notFound', null);
      return;
    }

    await Preferences.set({
      key: PENDING_INVITE_KEY,
      value: JSON.stringify({ token: this.token, storefrontId: this.storefrontId })
    });

    this.start();
  }

  start(): void {
    if (this.auth.isLoggedIn()) {
      this.continueFlow();
    } else {
      this.step = 'login';
    }
  }

  login(): void {
    this.busy = true;
    this.auth.login().subscribe({
      next: (ok) => {
        this.busy = false;
        if (ok) {
          this.continueFlow();
        } else {
          this.fail('academy.invite.errors.generic', 'retry');
        }
      },
      error: () => {
        this.busy = false;
        this.fail('academy.invite.errors.generic', 'retry');
      }
    });
  }

  saveProfile(): void {
    if (this.profileForm.invalid || this.busy) {
      return;
    }
    this.busy = true;
    this.membersApi.completeProfile(this.profileForm.value.displayName).subscribe({
      next: () => {
        this.busy = false;
        this.joinStorefront();
      },
      error: () => {
        this.busy = false;
        this.fail('academy.invite.errors.generic', 'retry');
      }
    });
  }

  openConsent(url: string): void {
    void Browser.open({ url });
  }

  isConsentAccepted(documentType: string): boolean {
    return this.acceptedDocumentTypes.has(documentType);
  }

  acceptConsent(consent: PendingConsentDto): void {
    this.membersApi
      .acceptConsent(this.storefrontId!, consent.documentType, consent.documentVersionId)
      .subscribe({
        next: () => this.acceptedDocumentTypes.add(consent.documentType),
        error: () => this.fail('academy.invite.errors.generic', 'retry')
      });
  }

  get allConsentsAccepted(): boolean {
    return (
      this.pendingConsents.length > 0 &&
      this.pendingConsents.every((c) => this.isConsentAccepted(c.documentType))
    );
  }

  continueAfterConsents(): void {
    this.joinStorefront();
  }

  retry(): void {
    if (this.errorAction === 'relogin') {
      this.busy = true;
      this.auth.logout().subscribe({
        next: () => {
          this.busy = false;
          this.step = 'login';
        },
        error: () => {
          this.busy = false;
          this.step = 'login';
        }
      });
      return;
    }
    this.start();
  }

  private continueFlow(): void {
    this.step = 'working';
    this.membersApi.getMe().subscribe({
      next: (member) => {
        if (!member || !member.profileCompletedAt) {
          this.step = 'profile';
        } else {
          this.joinStorefront();
        }
      },
      error: () => this.fail('academy.invite.errors.generic', 'retry')
    });
  }

  private joinStorefront(): void {
    this.step = 'working';
    this.membersApi.join(this.storefrontId!).subscribe({
      next: () => this.acceptInvitation(),
      error: (error: HttpErrorResponse) => {
        if (isConsentRequiredError(error)) {
          this.loadConsents();
        } else {
          this.fail('academy.invite.errors.generic', 'retry');
        }
      }
    });
  }

  private loadConsents(): void {
    this.step = 'consents';
    this.membersApi.getPendingConsents(this.storefrontId!).subscribe({
      next: (consents) => (this.pendingConsents = consents),
      error: () => this.fail('academy.invite.errors.generic', 'retry')
    });
  }

  private acceptInvitation(): void {
    this.step = 'working';
    this.academyApi.acceptInvitation({ token: this.token!, storefrontId: this.storefrontId! }).subscribe({
      next: () => this.finish('/tabs/academy-children/onboarding'),
      error: (error: HttpErrorResponse) => this.handleAcceptError(error)
    });
  }

  private handleAcceptError(error: HttpErrorResponse): void {
    switch (getErrorCode(error)) {
      case 'parent_invitation_not_found':
        void this.clearPendingInvite();
        this.fail('academy.invite.errors.notFound', null);
        break;
      case 'parent_invitation_expired':
        void this.clearPendingInvite();
        this.fail('academy.invite.errors.expired', null);
        break;
      case 'invitation_email_mismatch':
        this.fail('academy.invite.errors.emailMismatch', 'relogin');
        break;
      case 'parent_invitation_not_pending':
        // Already accepted (e.g. the link was tapped twice) — treat as success.
        void this.clearPendingInvite();
        this.finish('/tabs/academy-children');
        break;
      case 'membership_required':
        if (this.membershipRetried) {
          this.fail('academy.invite.errors.generic', 'retry');
        } else {
          this.membershipRetried = true;
          this.joinStorefront();
        }
        break;
      default:
        this.fail('academy.invite.errors.generic', 'retry');
    }
  }

  private async finish(target: string): Promise<void> {
    await this.clearPendingInvite();
    await this.storefrontContext.select(this.storefrontId!);
    // Force a fresh memberships fetch so the new SportsSchool membership (and its businessType) is
    // picked up — ActiveVerticalService then switches the tab bar to the Academy set.
    await this.membershipsCache.invalidate();
    await this.router.navigateByUrl(target);
  }

  private fail(errorKey: string, action: ErrorAction): void {
    this.errorKey = errorKey;
    this.errorAction = action;
    this.step = 'error';
  }

  get errorMessage(): string {
    return this.translate.instant(this.errorKey);
  }

  private async readPendingInvite(): Promise<{ token: string; storefrontId: string } | null> {
    const { value } = await Preferences.get({ key: PENDING_INVITE_KEY });
    if (!value) {
      return null;
    }
    try {
      return JSON.parse(value) as { token: string; storefrontId: string };
    } catch {
      return null;
    }
  }

  private async clearPendingInvite(): Promise<void> {
    await Preferences.remove({ key: PENDING_INVITE_KEY });
  }
}
