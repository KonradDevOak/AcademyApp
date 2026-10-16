import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NgTemplateOutlet } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { PendingMemberConsentDto } from '../core/models/member';
import { ClubPublicProfileDto, PublicDisciplineDto } from '../core/models/storefront';
import { Section, homeFor, sectionLabelKey, sectionsOf } from '../core/services/active-sections';
import { ClubDiscoveryService } from '../core/services/club-discovery';
import { MembersApiService } from '../core/services/members-api';
import { MembershipContextService } from '../core/services/membership-context';
import { StorefrontContextService } from '../core/services/storefront-context';
import { isConsentRequired } from '../invite/invite-errors';
import { ConfirmDialogComponent } from '../shared/confirm-dialog/confirm-dialog';
import { ThemeService } from '../shared/services/theme.service';
import { consentLabelKey } from '../shared/consent-label';

type LoadStatus = 'loading' | 'loaded' | 'error';
type JoinStep = 'idle' | 'checking' | 'needs-profile' | 'needs-consents' | 'joining' | 'error';

// Public card of one academy. For a visitor it is where joining happens — the same profile → consents → join
// steps as the academy invitation (InviteComponent), minus the invitation token: after joining, a parent of an
// academy with groups goes straight to adding a child (the academy then approves the enrollment request),
// otherwise the member lands on classes & passes. For a member it offers entering the academy, accepting newly
// published consents, the health questionnaire (classes & passes section) and leaving the academy.
@Component({
  selector: 'app-club-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [NgTemplateOutlet, ReactiveFormsModule, RouterLink, TranslatePipe, ConfirmDialogComponent],
  templateUrl: './club-detail.html',
  styleUrl: './club-detail.scss'
})
export class ClubDetailComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly discovery = inject(ClubDiscoveryService);
  private readonly membersApi = inject(MembersApiService);
  private readonly membershipContext = inject(MembershipContextService);
  private readonly storefrontContext = inject(StorefrontContextService);
  private readonly themeService = inject(ThemeService);

  protected readonly storefrontId = this.route.snapshot.paramMap.get('storefrontId') ?? '';

  private readonly _status = signal<LoadStatus>('loading');
  private readonly _profile = signal<ClubPublicProfileDto | null>(null);
  private readonly _disciplines = signal<PublicDisciplineDto[]>([]);
  private readonly _joinStep = signal<JoinStep>('idle');
  private readonly _error = signal<string | null>(null);
  private readonly _pendingConsents = signal<PendingMemberConsentDto[]>([]);
  private readonly _acceptedTypes = signal<ReadonlySet<string>>(new Set());
  private readonly _busy = signal(false);
  private readonly _leaveDialogOpen = signal(false);

  protected readonly status = this._status.asReadonly();
  protected readonly profile = this._profile.asReadonly();
  protected readonly disciplines = this._disciplines.asReadonly();
  protected readonly joinStep = this._joinStep.asReadonly();
  protected readonly error = this._error.asReadonly();
  protected readonly pendingConsents = this._pendingConsents.asReadonly();
  protected readonly busy = this._busy.asReadonly();
  protected readonly leaveDialogOpen = this._leaveDialogOpen.asReadonly();

  protected readonly isMember = computed(() =>
    this.membershipContext.memberships().some((m) => m.storefrontId === this.storefrontId)
  );
  protected readonly sections = computed<Section[]>(() => sectionsOf(this._profile()?.services));
  protected readonly hasGroups = computed(() => this.sections().includes('academy'));
  protected readonly hasClasses = computed(() => this.sections().includes('classes'));
  protected readonly sectionLabelKey = sectionLabelKey;
  // What leaving actually ends depends on the sections: children leave their groups (and the monthly fee stops),
  // a classes member loses their pass and bookings.
  protected readonly leaveMessageKey = computed(() => {
    const groups = this.hasGroups();
    const classes = this.hasClasses();
    if (groups && classes) return 'clubDetail.leaveDialog.messageBoth';
    if (groups) return 'clubDetail.leaveDialog.messageGroups';
    if (classes) return 'clubDetail.leaveDialog.messageClasses';
    return 'clubDetail.leaveDialog.message';
  });
  protected readonly allConsentsAccepted = computed(() =>
    this._pendingConsents().every((c) => this._acceptedTypes().has(c.documentType))
  );
  protected readonly websiteUrl = computed(() => {
    const domain = this._profile()?.domains?.[0];
    return domain ? `https://${domain}` : null;
  });
  protected readonly background = computed(() => {
    const profile = this._profile();
    const image = this.themeService.theme() === 'light'
      ? profile?.clubBackgroundLightImage ?? profile?.clubBackgroundDarkImage
      : profile?.clubBackgroundDarkImage ?? profile?.clubBackgroundLightImage;
    return image ? `url(${image.url})` : null;
  });

  protected readonly profileForm = this.fb.nonNullable.group({
    displayName: ['', Validators.required]
  });

  ngOnInit(): void {
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected readonly consentLabel = consentLabelKey;

  protected isAccepted(documentType: string): boolean {
    return this._acceptedTypes().has(documentType);
  }

  protected toggleConsent(documentType: string, checked: boolean): void {
    const next = new Set(this._acceptedTypes());
    if (checked) {
      next.add(documentType);
    } else {
      next.delete(documentType);
    }
    this._acceptedTypes.set(next);
  }

  protected enter(): void {
    this.storefrontContext.select(this.storefrontId);
    void this.router.navigateByUrl(homeFor(this.sections(), this.storefrontId));
  }

  // --- joining ---

  protected async startJoin(): Promise<void> {
    this._error.set(null);
    this._joinStep.set('checking');
    try {
      const me = await firstValueFrom(this.membersApi.getMe());
      if (me === null || me.profileCompletedAt === null) {
        this._joinStep.set('needs-profile');
        return;
      }
    } catch {
      this.fail('clubDetail.errors.profileLoadFailed');
      return;
    }
    await this.checkConsentsThenJoin();
  }

  protected async submitProfile(): Promise<void> {
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }
    this._busy.set(true);
    try {
      await firstValueFrom(this.membersApi.completeProfile(this.profileForm.getRawValue().displayName));
    } catch {
      this._busy.set(false);
      this.fail('clubDetail.errors.profileSaveFailed');
      return;
    }
    this._busy.set(false);
    await this.checkConsentsThenJoin();
  }

  protected async submitConsents(): Promise<void> {
    if (!this.allConsentsAccepted()) {
      return;
    }
    this._busy.set(true);
    try {
      await this.acceptPendingConsents();
    } catch {
      this._busy.set(false);
      this.fail('clubDetail.errors.consentsSaveFailed');
      return;
    }
    this._busy.set(false);
    if (this.isMember()) {
      this._pendingConsents.set([]);
      this._joinStep.set('idle');
      return;
    }
    await this.join();
  }

  private async checkConsentsThenJoin(): Promise<void> {
    const pending = await this.loadPendingConsents();
    if (pending === null) {
      this.fail('clubDetail.errors.consentsLoadFailed');
      return;
    }
    if (pending.length > 0) {
      this._joinStep.set('needs-consents');
      return;
    }
    await this.join();
  }

  private async join(): Promise<void> {
    this._joinStep.set('joining');
    try {
      await firstValueFrom(this.membersApi.join(this.storefrontId));
    } catch (error) {
      if (error instanceof HttpErrorResponse && isConsentRequired(error)) {
        // A document was published between the consents check and the join — show the consents again.
        await this.checkConsentsThenJoin();
        return;
      }
      this.fail('clubDetail.errors.joinFailed');
      return;
    }

    await this.membershipContext.reload();
    this.storefrontContext.select(this.storefrontId);
    void this.router.navigateByUrl(this.hasGroups() ? '/academy/add' : homeFor(this.sections(), this.storefrontId));
  }

  // --- member actions ---

  protected openLeaveDialog(): void {
    this._error.set(null);
    this._leaveDialogOpen.set(true);
  }

  protected closeLeaveDialog(): void {
    this._leaveDialogOpen.set(false);
  }

  protected async confirmLeave(): Promise<void> {
    this._busy.set(true);
    try {
      await firstValueFrom(this.membersApi.leave(this.storefrontId));
    } catch {
      this._busy.set(false);
      this._error.set('clubDetail.errors.leaveFailed');
      return;
    }
    this._busy.set(false);
    this._leaveDialogOpen.set(false);
    if (this.storefrontContext.selectedStorefrontId() === this.storefrontId) {
      this.storefrontContext.clear();
    }
    await this.membershipContext.reload();
    void this.router.navigateByUrl('/');
  }

  private async acceptPendingConsents(): Promise<void> {
    for (const consent of this._pendingConsents()) {
      await firstValueFrom(
        this.membersApi.acceptConsent(this.storefrontId, consent.documentType, consent.documentVersionId)
      );
    }
  }

  private async loadPendingConsents(): Promise<PendingMemberConsentDto[] | null> {
    try {
      const pending = await firstValueFrom(this.membersApi.getPendingConsents(this.storefrontId));
      this._pendingConsents.set(pending);
      this._acceptedTypes.set(new Set());
      return pending;
    } catch {
      return null;
    }
  }

  private fail(errorKey: string): void {
    this._error.set(errorKey);
    this._joinStep.set('error');
  }

  private async load(): Promise<void> {
    this._status.set('loading');
    await this.membershipContext.ensureLoaded();
    try {
      const profile = await firstValueFrom(this.discovery.getProfile(this.storefrontId));
      this._profile.set(profile);
      if (sectionsOf(profile.services).includes('academy')) {
        this._disciplines.set(await firstValueFrom(this.discovery.getAcademyDisciplines(this.storefrontId)).catch(() => []));
      }
      if (this.isMember()) {
        // Consents the academy published after this member joined — accepting them unblocks enrolling.
        await this.loadPendingConsents();
      }
      this._status.set('loaded');
    } catch (error) {
      console.error('Failed to load the academy:', error);
      this._status.set('error');
    }
  }
}
