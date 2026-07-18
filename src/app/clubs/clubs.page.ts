import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonCard,
  IonCardContent,
  IonItem,
  IonLabel,
  IonInput,
  IonButton,
  IonList,
  IonIcon,
  IonText,
  AlertController,
  ToastController
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { peopleOutline, addOutline, exitOutline } from 'ionicons/icons';
import { MembersApiService } from '../core/services/members-api.service';
import { MembershipDto } from '../core/models/member.model';

@Component({
  selector: 'app-clubs',
  templateUrl: 'clubs.page.html',
  styleUrls: ['clubs.page.scss'],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    IonHeader,
    IonToolbar,
    IonTitle,
    IonContent,
    IonCard,
    IonCardContent,
    IonItem,
    IonLabel,
    IonInput,
    IonButton,
    IonList,
    IonIcon,
    IonText
  ],
})
export class ClubsPage implements OnInit {
  private membersApi = inject(MembersApiService);
  private formBuilder = inject(FormBuilder);
  private alertController = inject(AlertController);
  private toastController = inject(ToastController);

  memberships: MembershipDto[] = [];
  isLoading = true;
  joinForm: FormGroup;

  constructor() {
    addIcons({ peopleOutline, addOutline, exitOutline });
    this.joinForm = this.formBuilder.group({
      storefrontId: ['', [Validators.required]]
    });
  }

  ngOnInit() {
    this.loadMemberships();
  }

  loadMemberships() {
    this.isLoading = true;
    this.membersApi.getMyMemberships().subscribe({
      next: (memberships) => {
        this.memberships = memberships;
        this.isLoading = false;
      },
      error: (error: unknown) => {
        console.error('Failed to load memberships:', error);
        this.isLoading = false;
      }
    });
  }

  join() {
    if (!this.joinForm.valid) {
      return;
    }

    const storefrontId = this.joinForm.value.storefrontId;
    this.membersApi.join(storefrontId).subscribe({
      next: async () => {
        this.joinForm.reset();
        this.loadMemberships();
        const toast = await this.toastController.create({
          message: 'Dołączono do klubu!',
          duration: 2000,
          color: 'success',
          position: 'top'
        });
        await toast.present();
      },
      error: async (error: unknown) => {
        console.error('Failed to join storefront:', error);
        const toast = await this.toastController.create({
          message: 'Nie udało się dołączyć. Sprawdź identyfikator klubu.',
          duration: 3000,
          color: 'danger',
          position: 'top'
        });
        await toast.present();
      }
    });
  }

  async confirmLeave(storefrontId: string) {
    const alert = await this.alertController.create({
      header: 'Opuść klub',
      message: 'Czy na pewno chcesz opuścić ten klub?',
      buttons: [
        { text: 'Anuluj', role: 'cancel' },
        {
          text: 'Opuść',
          role: 'destructive',
          handler: () => this.leave(storefrontId)
        }
      ]
    });
    await alert.present();
  }

  private leave(storefrontId: string) {
    this.membersApi.leave(storefrontId).subscribe({
      next: () => this.loadMemberships(),
      error: (error: unknown) => console.error('Failed to leave storefront:', error)
    });
  }
}
