import { ChangeDetectionStrategy, Component, computed, inject, input, output, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { TranslatePipe } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { getErrorCode } from '../register-athlete-errors';
import { AcademyAthletePhotoApiService } from './academy-athlete-photo-api';
import { ACCEPTED_PHOTO_TYPES, MAX_SOURCE_BYTES, resizeToJpeg } from './photo-resize';

// Backend error code -> i18n key (academy.childPhoto.errors.*); anything else falls back to the generic message.
const PHOTO_ERROR_KEYS: Record<string, string> = {
  invalid_athlete_photo: 'academy.childPhoto.errors.rejected'
};

// The child's single, optional photo: shown to the trainer on the attendance card. The parent picks a picture,
// it is scaled down and re-encoded in the browser (which also strips location data) and uploaded; choosing another
// one replaces it.
@Component({
  selector: 'app-academy-child-photo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './academy-child-photo.html',
  styleUrl: './academy-child-photo.scss'
})
export class AcademyChildPhotoComponent {
  private readonly storefrontContext = inject(StorefrontContextService);
  private readonly api = inject(AcademyAthletePhotoApiService);

  readonly athleteId = input.required<string>();
  readonly firstName = input('');
  readonly lastName = input('');
  readonly photoUrl = input<string | null | undefined>(null);

  // Emitted after the photo was added, replaced or removed — the parent reloads the athlete to get a fresh URL.
  readonly changed = output<void>();

  protected readonly acceptAttr = ACCEPTED_PHOTO_TYPES.join(',');
  protected readonly busy = signal(false);
  protected readonly noteOpen = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  private readonly failedUrl = signal<string | null>(null);

  protected readonly showPhoto = computed(() => !!this.photoUrl() && this.failedUrl() !== this.photoUrl());
  protected readonly initials = computed(
    () => `${this.firstName().charAt(0)}${this.lastName().charAt(0)}`.toUpperCase() || '?'
  );

  // An expired or deleted link degrades to the initials instead of a broken image.
  protected onImageError(): void {
    this.failedUrl.set(this.photoUrl() ?? null);
  }

  protected async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    // Reset so choosing the same file again still fires `change`.
    input.value = '';
    if (!file) return;

    if (!(ACCEPTED_PHOTO_TYPES as readonly string[]).includes(file.type)) {
      this.errorKey.set('academy.childPhoto.errors.type');
      return;
    }
    if (file.size > MAX_SOURCE_BYTES) {
      this.errorKey.set('academy.childPhoto.errors.tooLarge');
      return;
    }

    await this.run(async storefrontId => {
      let photo: Blob;
      try {
        photo = await resizeToJpeg(file);
      } catch {
        this.errorKey.set('academy.childPhoto.errors.decode');
        return false;
      }
      await firstValueFrom(this.api.upload(storefrontId, this.athleteId(), photo));
      return true;
    });
  }

  protected async remove(): Promise<void> {
    await this.run(async storefrontId => {
      await firstValueFrom(this.api.remove(storefrontId, this.athleteId()));
      return true;
    });
  }

  private async run(action: (storefrontId: string) => Promise<boolean>): Promise<void> {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || this.busy()) return;

    this.busy.set(true);
    this.errorKey.set(null);
    try {
      if (await action(storefrontId)) this.changed.emit();
    } catch (error) {
      const code = error instanceof HttpErrorResponse ? getErrorCode(error) : undefined;
      this.errorKey.set((code && PHOTO_ERROR_KEYS[code]) || 'academy.childPhoto.errors.generic');
    } finally {
      this.busy.set(false);
    }
  }
}
