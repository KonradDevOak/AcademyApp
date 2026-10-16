import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Observable, firstValueFrom } from 'rxjs';
import {
  CarnetCheckoutResultDto,
  CarnetDto,
  CarnetPaymentMethod,
  CarnetsApiService,
  ClassTypeDto,
  ClassesApiService,
  MembershipTypeDto,
  carnetPaymentMethodKey,
  carnetStatusKey,
  formatZloty
} from '@konraddevoak/fitness-api';
import { TranslatePipe } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { ClubTermsConsentComponent } from '../../shared/club-terms-consent/club-terms-consent';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog';
import { PaymentRedirectService } from '../../shared/payments/payment-redirect';
import { fitnessErrorKey } from '../fitness-errors';
import { formatDate } from '../fitness-format';
import { saveFitnessPaymentReturnContext } from '../fitness-payment-return-context';

type CarnetViewStatus = 'loading' | 'loaded' | 'error';

// The member's carnet in the active club: status and period, auto-renewal, notice-period cancellation, a
// staff-proposed price change to accept, and re-payment. Without a carnet (backend 404 → null) it shows the
// self-service sign-up form instead — membership type, starting class (when the type covers several), payment
// method from the club's payment options (+ pay at the front desk) and an optional discount code.
//
// Online checkout is a full-page redirect to P24/PayNow (PaymentRedirectService, mockable in specs); the
// outcome is picked up by /classes/payment-callback, which confirms/polls after the round trip.
@Component({
  selector: 'app-fitness-carnet',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe, ConfirmDialogComponent, ClubTermsConsentComponent],
  templateUrl: './fitness-carnet.html',
  styleUrl: './fitness-carnet.scss'
})
export class FitnessCarnetComponent implements OnInit {
  private readonly carnetsApi = inject(CarnetsApiService);
  private readonly classesApi = inject(ClassesApiService);
  private readonly storefrontContext = inject(StorefrontContextService);
  protected readonly storefrontId = this.storefrontContext.selectedStorefrontId;
  private readonly redirect = inject(PaymentRedirectService);
  private readonly fb = inject(FormBuilder);

  private readonly _status = signal<CarnetViewStatus>('loading');
  private readonly _carnet = signal<CarnetDto | null>(null);
  private readonly _membershipTypes = signal<MembershipTypeDto[]>([]);
  private readonly _classTypes = signal<ClassTypeDto[]>([]);
  private readonly _onlineMethods = signal<CarnetPaymentMethod[]>([]);
  private readonly _busy = signal(false);
  private readonly _actionError = signal<string | null>(null);
  private readonly _cancelDialogOpen = signal(false);
  private readonly _selectedTypeId = signal('');

  protected readonly status = this._status.asReadonly();
  protected readonly carnet = this._carnet.asReadonly();
  protected readonly membershipTypes = this._membershipTypes.asReadonly();
  protected readonly busy = this._busy.asReadonly();
  protected readonly actionError = this._actionError.asReadonly();
  protected readonly cancelDialogOpen = this._cancelDialogOpen.asReadonly();

  // Online methods the club offers ("Recurring" first — the default the native app used) plus the front desk.
  protected readonly paymentMethods = computed<CarnetPaymentMethod[]>(() => {
    const online = this._onlineMethods();
    const ordered = (['Recurring', 'OneTime'] as CarnetPaymentMethod[]).filter((m) => online.includes(m));
    return [...ordered, 'Manual'];
  });

  protected readonly selectedType = computed(
    () => this._membershipTypes().find((t) => t.id === this._selectedTypeId()) ?? null
  );

  protected readonly requiresStartingClass = computed(() => (this.selectedType()?.classTypeIds.length ?? 0) > 1);

  // Public (not protected): read by FitnessHomeComponent through a viewChild query to decide which
  // accordion panel opens by default, mirroring AcademyHomeComponent / AcademyPaymentsComponent.
  readonly resolved = computed(() => this._status() !== 'loading');
  readonly isActive = computed(() => this._carnet()?.status === 'Active');

  protected readonly signUpForm = this.fb.nonNullable.group({
    membershipTypeId: ['', Validators.required],
    startingClassTypeId: [''],
    paymentMethod: ['Manual' as CarnetPaymentMethod, Validators.required],
    discountCode: [''],
    // The club-terms checkbox — required for every sign-up (it concludes the carnet contract), whatever the
    // payment method.
    termsAccepted: [false, Validators.requiredTrue]
  });

  protected readonly formatZloty = formatZloty;
  protected readonly formatDate = formatDate;
  protected readonly carnetStatusKey = carnetStatusKey;
  protected readonly carnetPaymentMethodKey = carnetPaymentMethodKey;

  constructor() {
    this.signUpForm.controls.membershipTypeId.valueChanges.subscribe((id) => {
      this._selectedTypeId.set(id);
      this.signUpForm.controls.startingClassTypeId.setValue('');
    });
  }

  ngOnInit(): void {
    void this.load();
  }

  protected retry(): void {
    void this.load();
  }

  protected classTypeName(id: string): string {
    return this._classTypes().find((t) => t.id === id)?.name ?? id.substring(0, 8);
  }

  protected canRepay(carnet: CarnetDto): boolean {
    if (carnet.paymentMethod === 'Recurring') {
      return carnet.status === 'PaymentFailed' || carnet.status === 'Expired';
    }
    return carnet.paymentMethod === 'OneTime' && (carnet.status === 'Active' || carnet.status === 'Expired');
  }

  protected hasPendingPrice(carnet: CarnetDto): boolean {
    return carnet.pendingPriceGrosze !== null && !carnet.pendingPriceAcceptedAt;
  }

  protected async signUp(): Promise<void> {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || this.signUpForm.invalid || this._busy()) {
      this.signUpForm.markAllAsTouched();
      return;
    }
    const value = this.signUpForm.getRawValue();
    if (this.requiresStartingClass() && !value.startingClassTypeId) {
      this._actionError.set('fitness.carnet.startingClassRequired');
      return;
    }

    await this.runAction(async () => {
      const result = await firstValueFrom(
        this.carnetsApi.signUp({
          storefrontId,
          membershipTypeId: value.membershipTypeId,
          startingClassTypeId: value.startingClassTypeId || null,
          paymentMethod: value.paymentMethod,
          discountCode: value.discountCode.trim() || null,
          termsAccepted: value.termsAccepted
        })
      );
      this.continueCheckout(storefrontId, result);
    });
  }

  protected async repay(): Promise<void> {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId) {
      return;
    }
    await this.runAction(async () => {
      const result = await firstValueFrom(this.carnetsApi.retryPayment(storefrontId));
      this.continueCheckout(storefrontId, result);
    });
  }

  protected async setAutoRenewal(enabled: boolean): Promise<void> {
    await this.runStorefrontAction((id) => this.carnetsApi.setAutoRenewal(id, enabled));
  }

  protected openCancelDialog(): void {
    this._actionError.set(null);
    this._cancelDialogOpen.set(true);
  }

  protected closeCancelDialog(): void {
    this._cancelDialogOpen.set(false);
  }

  protected async confirmCancellation(): Promise<void> {
    await this.runStorefrontAction((id) => this.carnetsApi.requestCancellation(id));
    this._cancelDialogOpen.set(false);
  }

  protected async withdrawCancellation(): Promise<void> {
    await this.runStorefrontAction((id) => this.carnetsApi.withdrawCancellation(id));
  }

  protected async acceptPriceChange(): Promise<void> {
    await this.runStorefrontAction((id) => this.carnetsApi.acceptPriceChange(id));
  }

  private continueCheckout(storefrontId: string, result: CarnetCheckoutResultDto): void {
    if (!result.redirectUrl) {
      // Front-desk payment: the carnet waits for staff to confirm the cash/transfer.
      void this.load();
      return;
    }
    const current = this._carnet();
    saveFitnessPaymentReturnContext({
      storefrontId,
      previousStatus: current?.status ?? null,
      previousPeriodEnd: current?.currentPeriodEnd ?? null
    });
    this.redirect.redirectTo(result.redirectUrl);
  }

  private async runStorefrontAction(action: (storefrontId: string) => Observable<void>): Promise<void> {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId) {
      return;
    }
    await this.runAction(async () => {
      await firstValueFrom(action(storefrontId));
      await this.load();
    });
  }

  private async runAction(action: () => Promise<void>): Promise<void> {
    if (this._busy()) {
      return;
    }
    this._busy.set(true);
    this._actionError.set(null);
    try {
      await action();
    } catch (error) {
      console.error('Carnet action failed:', error);
      this._actionError.set(fitnessErrorKey(error));
    } finally {
      this._busy.set(false);
    }
  }

  private async load(): Promise<void> {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId) {
      this._status.set('error');
      return;
    }

    this._status.set('loading');
    try {
      const carnet = await firstValueFrom(this.carnetsApi.getMyCarnet(storefrontId));
      this._carnet.set(carnet);
      if (!carnet) {
        const [types, classTypes, options] = await Promise.all([
          firstValueFrom(this.carnetsApi.getMembershipTypes(storefrontId)),
          firstValueFrom(this.classesApi.getClassTypes(storefrontId)),
          firstValueFrom(this.carnetsApi.getPaymentOptions(storefrontId))
        ]);
        this._membershipTypes.set(types);
        this._classTypes.set(classTypes);
        this._onlineMethods.set(options.methods ?? []);
        this.signUpForm.controls.paymentMethod.setValue(this.paymentMethods()[0]);
      }
      this._status.set('loaded');
    } catch (error) {
      console.error('Failed to load carnet:', error);
      this._status.set('error');
    }
  }
}
