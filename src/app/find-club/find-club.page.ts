import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { debounceTime, distinctUntilChanged, switchMap } from 'rxjs/operators';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonSearchbar,
  IonList,
  IonItem,
  IonLabel,
  IonButton,
  IonIcon,
  IonSpinner,
  IonText,
  ToastController
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { addOutline, locationOutline, chevronDownOutline, chevronUpOutline } from 'ionicons/icons';
import { StorefrontDiscoveryService, Coordinates } from '../core/services/storefront-discovery.service';
import { MembersApiService } from '../core/services/members-api.service';
import { StorefrontDiscoveryResultDto } from '../core/models/storefront.model';
import { isConsentRequiredError } from '../core/utils/consent-error.util';
import { ManualJoinComponent } from '../components/manual-join/manual-join.component';

// Primary way for a member to join a club — replaces the old "paste a GUID you got from reception"
// flow as the default (that flow still exists, collapsed behind "Mam kod od recepcji" below, via the
// shared ManualJoinComponent). Reached both during first-time onboarding (complete-profile.component.ts
// redirects here when the member has zero memberships) and any time afterwards from clubs.page.html's
// "Znajdź klub" button.
@Component({
  selector: 'app-find-club',
  templateUrl: 'find-club.page.html',
  styleUrls: ['find-club.page.scss'],
  imports: [
    CommonModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonSearchbar,
    IonList,
    IonItem,
    IonLabel,
    IonButton,
    IonIcon,
    IonSpinner,
    IonText,
    ManualJoinComponent,
    TranslatePipe
  ],
})
export class FindClubPage implements OnInit {
  private discovery = inject(StorefrontDiscoveryService);
  private membersApi = inject(MembersApiService);
  private router = inject(Router);
  private toastController = inject(ToastController);

  results: StorefrontDiscoveryResultDto[] = [];
  isLoading = true;
  isUsingLocation = false;
  joiningId: string | null = null;
  showManualJoin = false;

  private coordinates: Coordinates | null = null;
  private searchTerm$ = new Subject<string>();

  constructor() {
    addIcons({ addOutline, locationOutline, chevronDownOutline, chevronUpOutline });
  }

  ngOnInit() {
    this.searchTerm$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(term => this.discovery.search({ search: term || undefined, coordinates: this.coordinates }))
      )
      .subscribe({
        next: (results) => {
          this.results = results;
          this.isLoading = false;
        },
        error: (error: unknown) => {
          console.error('Failed to load clubs:', error);
          this.results = [];
          this.isLoading = false;
        }
      });

    void this.init();
  }

  private async init() {
    // Best-effort — StorefrontDiscoveryService.getCurrentPosition() already falls back to null on
    // denial/timeout, at which point the backend sorts alphabetically instead of by distance.
    this.coordinates = await this.discovery.getCurrentPosition();
    this.isUsingLocation = !!this.coordinates;
    this.searchTerm$.next('');
  }

  onSearchChange(term: string | null | undefined) {
    this.isLoading = true;
    this.searchTerm$.next(term ?? '');
  }

  join(storefrontId: string) {
    if (this.joiningId) return;

    this.joiningId = storefrontId;
    this.membersApi.join(storefrontId).subscribe({
      next: async () => {
        this.joiningId = null;
        const toast = await this.toastController.create({
          message: 'Dołączono do klubu!',
          duration: 2000,
          color: 'success',
          position: 'top'
        });
        await toast.present();
        await this.router.navigateByUrl('/tabs');
      },
      error: async (error: HttpErrorResponse) => {
        this.joiningId = null;

        if (isConsentRequiredError(error)) {
          await this.router.navigate(['/tabs/clubs', storefrontId, 'consents'], {
            queryParams: { returnTo: 'join' }
          });
          return;
        }

        console.error('Failed to join storefront:', error);
        const toast = await this.toastController.create({
          message: 'Nie udało się dołączyć do klubu. Spróbuj ponownie.',
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
      }
    });
  }

  onJoinedManually() {
    void this.router.navigateByUrl('/tabs');
  }
}
