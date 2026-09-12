import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { catchError, of } from 'rxjs';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonButtons,
  IonButton,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonText,
  IonSpinner,
  IonRefresher,
  IonRefresherContent,
  RefresherCustomEvent
} from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { addIcons } from 'ionicons';
import { addOutline, chevronForwardOutline } from 'ionicons/icons';
import { AcademyApiService, AthleteDto, disciplineKey } from '@konraddevoak/academy-api';
import { MembersApiService } from '../../core/services/members-api.service';
import { StorefrontContextService } from '../../core/services/storefront-context.service';

// "Moje dzieci" — the guardian's roster for the active academy. Storefront resolution mirrors
// schedule.page.ts / carnet.page.ts (memberships -> StorefrontContextService.resolve).
@Component({
  selector: 'app-academy-children',
  templateUrl: 'academy-children.page.html',
  styleUrls: ['academy-children.page.scss'],
  imports: [
    CommonModule,
    RouterLink,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonButtons,
    IonButton,
    IonContent,
    IonList,
    IonItem,
    IonLabel,
    IonIcon,
    IonText,
    IonSpinner,
    IonRefresher,
    IonRefresherContent,
    TranslatePipe
  ]
})
export class AcademyChildrenPage implements OnInit {
  private academyApi = inject(AcademyApiService);
  private membersApi = inject(MembersApiService);
  private storefrontContext = inject(StorefrontContextService);

  storefrontId: string | null = null;
  hasNoClubs = false;
  isLoading = true;
  athletes: AthleteDto[] = [];

  readonly disciplineKey = disciplineKey;

  constructor() {
    addIcons({ addOutline, chevronForwardOutline });
  }

  ngOnInit() {
    this.load();
  }

  private load(refresherEvent?: RefresherCustomEvent) {
    this.isLoading = !refresherEvent;
    this.membersApi.getMyMemberships().subscribe({
      next: async (memberships) => {
        const storefrontId = await this.storefrontContext.resolve(memberships);
        this.storefrontId = storefrontId;
        this.hasNoClubs = memberships.length === 0;

        if (!storefrontId) {
          this.isLoading = false;
          refresherEvent?.target.complete();
          return;
        }

        this.academyApi
          .getMyAthletes(storefrontId)
          .pipe(
            catchError((error: unknown) => {
              console.error('Failed to load athletes:', error);
              return of([] as AthleteDto[]);
            })
          )
          .subscribe((athletes) => {
            this.athletes = athletes;
            this.isLoading = false;
            refresherEvent?.target.complete();
          });
      },
      error: (error: unknown) => {
        console.error('Failed to load memberships:', error);
        this.isLoading = false;
        refresherEvent?.target.complete();
      }
    });
  }

  refresh(event: RefresherCustomEvent) {
    this.load(event);
  }
}
