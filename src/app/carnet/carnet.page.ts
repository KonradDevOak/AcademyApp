import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonContent,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardSubtitle,
  IonCardContent,
  IonItem,
  IonSelect,
  IonSelectOption,
  IonToggle,
  IonButton,
  IonBadge,
  IonText,
  IonSpinner,
  IonList,
  ToastController,
  LoadingController,
  ToggleCustomEvent
} from '@ionic/angular/standalone';
import { Browser } from '@capacitor/browser';
import { CarnetsApiService } from '../core/services/carnets-api.service';
import { ClassesApiService } from '../core/services/classes-api.service';
import { MembersApiService } from '../core/services/members-api.service';
import { StorefrontContextService } from '../core/services/storefront-context.service';
import { CarnetPaymentCallbackService } from '../core/services/carnet-payment-callback.service';
import { CarnetDto, MembershipTypeDto } from '../core/models/carnets.model';
import { ClassTypeDto } from '../core/models/classes.model';
import { NotificationBellComponent } from '../components/notification-bell/notification-bell.component';

@Component({
  selector: 'app-carnet',
  templateUrl: 'carnet.page.html',
  styleUrls: ['carnet.page.scss'],
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonContent,
    IonCard,
    IonCardHeader,
    IonCardTitle,
    IonCardSubtitle,
    IonCardContent,
    IonItem,
    IonSelect,
    IonSelectOption,
    IonToggle,
    IonButton,
    IonBadge,
    IonText,
    IonSpinner,
    IonList,
    NotificationBellComponent
  ]
})
export class CarnetPage implements OnInit {
  private carnetsApi = inject(CarnetsApiService);
  private classesApi = inject(ClassesApiService);
  private membersApi = inject(MembersApiService);
  private storefrontContext = inject(StorefrontContextService);
  private paymentCallback = inject(CarnetPaymentCallbackService);
  private formBuilder = inject(FormBuilder);
  private toastController = inject(ToastController);
  private loadingController = inject(LoadingController);

  storefrontId: string | null = null;
  activeStorefrontName: string | null = null;
  hasNoClubs = false;
  isLoading = true;
  carnet: CarnetDto | null = null;

  membershipTypes: MembershipTypeDto[] = [];
  classTypes: ClassTypeDto[] = [];
  signUpForm: FormGroup;

  constructor() {
    this.signUpForm = this.formBuilder.group({
      membershipTypeId: ['', [Validators.required]],
      startingClassTypeId: [''],
      paymentMethod: ['Recurring', [Validators.required]]
    });
  }

  ngOnInit() {
    this.load();
  }

  private load() {
    this.isLoading = true;
    this.membersApi.getMyMemberships().subscribe({
      next: async (memberships) => {
        const storefrontId = await this.storefrontContext.resolve(memberships);
        this.storefrontId = storefrontId;
        this.activeStorefrontName = memberships.find((m) => m.storefrontId === storefrontId)?.storefrontName ?? null;
        this.hasNoClubs = memberships.length === 0;

        if (!storefrontId) {
          this.isLoading = false;
          return;
        }

        this.loadCarnet(storefrontId);
      },
      error: (error: unknown) => {
        console.error('Failed to load memberships:', error);
        this.isLoading = false;
      }
    });
  }

  private loadCarnet(storefrontId: string) {
    this.carnetsApi.getMyCarnet(storefrontId).subscribe({
      next: (carnet) => {
        this.carnet = carnet;
        this.isLoading = false;
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 404) {
          this.carnet = null;
          this.loadSignUpOptions(storefrontId);
          return;
        }
        console.error('Failed to load carnet:', error);
        this.isLoading = false;
      }
    });
  }

  private loadSignUpOptions(storefrontId: string) {
    this.carnetsApi.getMembershipTypes(storefrontId).subscribe({
      next: (types) => {
        this.membershipTypes = types;
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Failed to load membership types:', error);
        this.isLoading = false;
      }
    });

    this.classesApi.getClassTypes(storefrontId).subscribe({
      next: (types) => (this.classTypes = types),
      error: (error: unknown) => console.error('Failed to load class types:', error)
    });
  }

  get selectedMembershipType(): MembershipTypeDto | undefined {
    return this.membershipTypes.find((t) => t.id === this.signUpForm.value.membershipTypeId);
  }

  get requiresStartingClassType(): boolean {
    return (this.selectedMembershipType?.classTypeIds.length ?? 0) > 1;
  }

  classTypeName(id: string): string {
    return this.classTypes.find((t) => t.id === id)?.name ?? id.substring(0, 8);
  }

  async signUp() {
    if (!this.signUpForm.valid || !this.storefrontId) return;
    if (this.requiresStartingClassType && !this.signUpForm.value.startingClassTypeId) {
      await this.showToast('Wybierz zajęcia, od których zaczynasz.', 'danger');
      return;
    }

    const loading = await this.loadingController.create({ message: 'Zapisywanie...' });
    await loading.present();

    this.carnetsApi
      .signUp({
        storefrontId: this.storefrontId,
        membershipTypeId: this.signUpForm.value.membershipTypeId,
        startingClassTypeId: this.signUpForm.value.startingClassTypeId || undefined,
        paymentMethod: this.signUpForm.value.paymentMethod
      })
      .subscribe({
        next: async (result) => {
          await loading.dismiss();
          if (result.redirectUrl) {
            await Browser.open({ url: result.redirectUrl });
            // Arrival back at this deep link is UX-only — it does not mean payment succeeded, the
            // real outcome comes from the backend's async P24 IPN, so just re-fetch actual state.
            await this.paymentCallback.waitForReturn();
          }
          this.loadCarnet(this.storefrontId!);
        },
        error: async (error: unknown) => {
          await loading.dismiss();
          console.error('Failed to sign up for a carnet:', error);
          await this.showToast('Nie udało się zapisać. Spróbuj ponownie.', 'danger');
        }
      });
  }

  toggleAutoRenewal(event: ToggleCustomEvent) {
    if (!this.storefrontId) return;
    const enabled = event.detail.checked;
    this.carnetsApi.setAutoRenewal(this.storefrontId, enabled).subscribe({
      next: () => this.loadCarnet(this.storefrontId!),
      error: async () => this.showToast('Nie udało się zmienić ustawienia odnowienia.', 'danger')
    });
  }

  requestCancellation() {
    if (!this.storefrontId) return;
    this.carnetsApi.requestCancellation(this.storefrontId).subscribe({
      next: () => this.loadCarnet(this.storefrontId!),
      error: async () => this.showToast('Nie udało się anulować karnetu.', 'danger')
    });
  }

  withdrawCancellation() {
    if (!this.storefrontId) return;
    this.carnetsApi.withdrawCancellation(this.storefrontId).subscribe({
      next: () => this.loadCarnet(this.storefrontId!),
      error: async () => this.showToast('Nie udało się cofnąć anulowania.', 'danger')
    });
  }

  acceptPriceChange() {
    if (!this.storefrontId) return;
    this.carnetsApi.acceptPriceChange(this.storefrontId).subscribe({
      next: () => this.loadCarnet(this.storefrontId!),
      error: async () => this.showToast('Nie udało się zaakceptować nowej ceny.', 'danger')
    });
  }

  async retryPayment() {
    if (!this.storefrontId) return;
    this.carnetsApi.retryPayment(this.storefrontId).subscribe({
      next: async (result) => {
        if (result.redirectUrl) {
          await Browser.open({ url: result.redirectUrl });
          await this.paymentCallback.waitForReturn();
        }
        this.loadCarnet(this.storefrontId!);
      },
      error: async () => this.showToast('Nie udało się ponowić płatności.', 'danger')
    });
  }

  private async showToast(message: string, color: 'success' | 'danger') {
    const toast = await this.toastController.create({ message, duration: 3000, color, position: 'top' });
    await toast.present();
  }
}
