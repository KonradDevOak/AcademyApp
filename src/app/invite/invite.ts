import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AcademyApiService } from '@konraddevoak/academy-api';
import { TranslatePipe } from '@ngx-translate/core';
import { MsalExternalAuthService } from '@shared/iam-msal-external';
import { PendingMemberConsentDto } from '../core/models/member';
import { MembersApiService } from '../core/services/members-api';
import { MembershipContextService } from '../core/services/membership-context';
import { StorefrontContextService } from '../core/services/storefront-context';
import { clearInviteContext, readInviteContext, saveInviteContext } from './invite-context';
import { inviteErrorKey, isConsentRequired, isEmailMismatch, isInvitationAlreadyAccepted } from './invite-errors';
import { consentLabelKey } from '../shared/consent-label';

type InviteStatus =
  | 'resolving'
  | 'needs-profile'
  | 'needs-consents'
  | 'joining'
  | 'accepting'
  | 'success'
  | 'invalid-link'
  | 'error';

// Web equivalent of the native app's AcademyInvitePage/DeepLinkService. Public route —
// this is the ENTRY into login, not a screen behind CustomerGuard (mirrors /login).
//
// The invitation e-mail links straight to {academy:invitations:webAppBaseUrl}/invite?token=&storefrontId=
// (older e-mails still go through the backend's GET api/academy/invite landing page, which also ends here
// via its "continue in the browser" link). After a successful accept this page stays on a confirmation
// screen with a button to /academy instead of redirecting on its own.
@Component({
  selector: 'app-invite',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './invite.html',
  styleUrl: './invite.scss'
})
export class InviteComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly authService = inject(MsalExternalAuthService);
  private readonly membersApi = inject(MembersApiService);
  private readonly academyApi = inject(AcademyApiService);
  private readonly membershipContext = inject(MembershipContextService);
  private readonly storefrontContext = inject(StorefrontContextService);

  private token = '';
  private storefrontId = '';

  private readonly _status = signal<InviteStatus>('resolving');
  private readonly _errorMessage = signal<string | null>(null);
  private readonly _canRetryLogin = signal(false);
  private readonly _pendingConsents = signal<PendingMemberConsentDto[]>([]);
  private readonly _acceptedConsentTypes = signal<ReadonlySet<string>>(new Set());
  private readonly _savingProfile = signal(false);
  private readonly _submittingConsents = signal(false);

  protected readonly status = this._status.asReadonly();
  protected readonly errorMessage = this._errorMessage.asReadonly();
  protected readonly canRetryLogin = this._canRetryLogin.asReadonly();
  protected readonly pendingConsents = this._pendingConsents.asReadonly();
  protected readonly savingProfile = this._savingProfile.asReadonly();
  protected readonly submittingConsents = this._submittingConsents.asReadonly();

  protected readonly allConsentsAccepted = computed(() =>
    this._pendingConsents().every((consent) => this._acceptedConsentTypes().has(consent.documentType))
  );

  protected readonly profileForm = this.fb.nonNullable.group({
    displayName: ['', Validators.required]
  });

  ngOnInit(): void {
    void this.resolve();
  }

  protected readonly consentLabel = consentLabelKey;

  protected isConsentAccepted(documentType: string): boolean {
    return this._acceptedConsentTypes().has(documentType);
  }

  protected toggleConsent(documentType: string, checked: boolean): void {
    const next = new Set(this._acceptedConsentTypes());
    if (checked) {
      next.add(documentType);
    } else {
      next.delete(documentType);
    }
    this._acceptedConsentTypes.set(next);
  }

  protected submitProfile(): void {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this._savingProfile.set(true);
    const { displayName } = this.profileForm.getRawValue();
    firstValueFrom(this.membersApi.completeProfile(displayName))
      .then(() => {
        this._savingProfile.set(false);
        return this.checkConsents();
      })
      .catch(() => {
        this._savingProfile.set(false);
        this._status.set('error');
        this._errorMessage.set('academy.invite.errors.profileSaveFailed');
      });
  }

  protected async submitConsents(): Promise<void> {
    if (!this.allConsentsAccepted()) {
      return;
    }

    this._submittingConsents.set(true);
    try {
      for (const consent of this._pendingConsents()) {
        await firstValueFrom(
          this.membersApi.acceptConsent(this.storefrontId, consent.documentType, consent.documentVersionId)
        );
      }
      this._submittingConsents.set(false);
      await this.join();
    } catch {
      this._submittingConsents.set(false);
      this._status.set('error');
      this._errorMessage.set('academy.invite.errors.consentsSaveFailed');
    }
  }

  // Re-runs the whole resolution from scratch — safe to call after any 'error' state since neither
  // the query string nor the sessionStorage context is cleared until a successful accept.
  protected retry(): void {
    this._errorMessage.set(null);
    this._canRetryLogin.set(false);
    this._status.set('resolving');
    void this.resolve();
  }

  protected retryLogin(): void {
    this.authService.logoutRedirect();
  }

  private async resolve(): Promise<void> {
    const params = this.route.snapshot.queryParamMap;
    const queryToken = params.get('token');
    const queryStorefrontId = params.get('storefrontId');

    if (queryToken && queryStorefrontId) {
      this.token = queryToken;
      this.storefrontId = queryStorefrontId;
      saveInviteContext({ token: queryToken, storefrontId: queryStorefrontId });
    } else {
      const stored = readInviteContext();
      if (!stored) {
        this._status.set('invalid-link');
        return;
      }
      this.token = stored.token;
      this.storefrontId = stored.storefrontId;
    }

    if (!this.authService.isLoggedIn()) {
      // Same pattern as CustomerGuard for protected routes: send to /login with a returnUrl, which
      // MSAL's navigateToLoginRequestUrl restores in full (query string included) after CIAM.
      // Rebuilt from the resolved token/storefrontId instead of router.url: ngOnInit runs while the
      // initial navigation is still in flight, so on a cold load from the e-mail link router.url is
      // still '/' and the parent would be sent to /academy after login, skipping the accept flow.
      const returnUrl = `/invite?token=${encodeURIComponent(this.token)}&storefrontId=${encodeURIComponent(this.storefrontId)}`;
      void this.router.navigate(['/login'], { queryParams: { returnUrl } });
      return;
    }

    await this.checkProfile();
  }

  private async checkProfile(): Promise<void> {
    let profileCompleted: boolean;
    try {
      const me = await firstValueFrom(this.membersApi.getMe());
      // `me` is null when this identity has never called complete-profile yet (no Member row at
      // all) — same "needs-profile" outcome as an existing row with profileCompletedAt === null.
      profileCompleted = me !== null && me.profileCompletedAt !== null;
    } catch {
      this._status.set('error');
      this._errorMessage.set('academy.invite.errors.profileLoadFailed');
      return;
    }

    if (!profileCompleted) {
      this._status.set('needs-profile');
      return;
    }

    await this.checkConsents();
  }

  private async checkConsents(): Promise<void> {
    let pending: PendingMemberConsentDto[];
    try {
      pending = await firstValueFrom(this.membersApi.getPendingConsents(this.storefrontId));
    } catch {
      this._status.set('error');
      this._errorMessage.set('academy.invite.errors.consentsLoadFailed');
      return;
    }

    if (pending.length > 0) {
      this._pendingConsents.set(pending);
      this._acceptedConsentTypes.set(new Set());
      this._status.set('needs-consents');
      return;
    }

    await this.join();
  }

  private async join(): Promise<void> {
    this._status.set('joining');
    try {
      await firstValueFrom(this.membersApi.join(this.storefrontId));
    } catch (error) {
      if (error instanceof HttpErrorResponse && isConsentRequired(error)) {
        // Backstop for a race (e.g. the owner published a new document version between our
        // consents/pending fetch and this join) — re-check and show the consent screen again.
        await this.checkConsents();
        return;
      }
      this._status.set('error');
      this._errorMessage.set('academy.invite.errors.joinFailed');
      return;
    }

    await this.acceptInvitation();
  }

  private async acceptInvitation(): Promise<void> {
    this._status.set('accepting');
    try {
      await firstValueFrom(
        this.academyApi.acceptInvitation({ token: this.token, storefrontId: this.storefrontId })
      );
    } catch (error) {
      if (error instanceof HttpErrorResponse) {
        if (isInvitationAlreadyAccepted(error)) {
          await this.finishSuccess();
          return;
        }
        this._status.set('error');
        this._canRetryLogin.set(isEmailMismatch(error));
        this._errorMessage.set(inviteErrorKey(error));
        return;
      }
      this._status.set('error');
      this._errorMessage.set('academy.invite.errors.acceptFailed');
      return;
    }

    await this.finishSuccess();
  }

  private async finishSuccess(): Promise<void> {
    clearInviteContext();
    await this.membershipContext.reload();
    this.storefrontContext.select(this.storefrontId);
    this._status.set('success');
  }

  protected goToPanel(): void {
    void this.router.navigateByUrl('/academy');
  }
}
