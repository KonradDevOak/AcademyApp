import { Component, EventEmitter, InjectionToken, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { IonButton, IonIcon, ToastController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { qrCodeOutline } from 'ionicons/icons';
import { MembersApiService } from '../../core/services/members-api.service';
import { StorefrontProfileService } from '../../core/services/storefront-profile.service';
import { StorefrontContextService } from '../../core/services/storefront-context.service';
import { isConsentRequiredError } from '../../core/utils/consent-error.util';

// Capacitor plugin objects (like `BarcodeScanner`) are a Proxy whose `get` trap always returns a fresh
// wrapper regardless of property assignment — spyOn() in Jasmine silently has no effect. Routing
// through an injection token (same singleton at runtime, swappable in tests) is what actually makes it
// testable — same pattern as GEOLOCATION_PLUGIN in storefront-discovery.service.ts.
export const BARCODE_SCANNER_PLUGIN = new InjectionToken<typeof BarcodeScanner>('BARCODE_SCANNER_PLUGIN', {
  providedIn: 'root',
  factory: () => BarcodeScanner
});

// Join path for members scanning the club's QR code — the same code the owner already generates in
// LocalBizWeb's "Kod QR" section (it encodes nothing but https://{their-domain}). Used both as the
// "Zeskanuj kod QR" expander in find-club.page.html and as the join action on clubs.page.html's empty
// state. Owns the full scan+resolve+join+consent-redirect+toast flow itself so both call sites stay in
// sync — the historical name/selector (app-manual-join) predates the switch from typed-in codes to
// scanning and is kept to avoid churning both templates for a rename alone.
@Component({
  selector: 'app-manual-join',
  templateUrl: 'manual-join.component.html',
  imports: [CommonModule, IonButton, IonIcon],
})
export class ManualJoinComponent {
  private barcodeScanner = inject(BARCODE_SCANNER_PLUGIN);
  private membersApi = inject(MembersApiService);
  private storefrontProfile = inject(StorefrontProfileService);
  private storefrontContext = inject(StorefrontContextService);
  private toastController = inject(ToastController);
  private router = inject(Router);

  @Output() joined = new EventEmitter<void>();

  isScanning = false;

  constructor() {
    addIcons({ qrCodeOutline });
  }

  async scan() {
    if (this.isScanning) return;
    this.isScanning = true;

    try {
      if (Capacitor.getPlatform() === 'android') {
        const { available } = await this.barcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await this.barcodeScanner.installGoogleBarcodeScannerModule();
          await this.showToast('Pobieranie modułu skanera… Spróbuj ponownie za chwilę.', 'warning');
          return;
        }
      }

      const { barcodes } = await this.barcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
      const scannedValue = barcodes[0]?.rawValue || barcodes[0]?.displayValue;
      if (!scannedValue) return; // user cancelled the scan

      await this.resolveAndJoin(scannedValue);
    } catch (error) {
      console.error('QR scan failed:', error);
      await this.showToast('Nie udało się zeskanować kodu. Spróbuj ponownie.', 'danger');
    } finally {
      this.isScanning = false;
    }
  }

  private async resolveAndJoin(scannedValue: string): Promise<void> {
    let domain: string;
    try {
      domain = new URL(scannedValue).hostname;
    } catch {
      await this.showToast('Nie rozpoznano kodu QR klubu.', 'danger');
      return;
    }

    let storefrontId: string;
    try {
      const profile = await firstValueFrom(this.storefrontProfile.resolveByDomain(domain));
      storefrontId = profile.id;
    } catch {
      await this.showToast('Nie rozpoznano kodu QR klubu.', 'danger');
      return;
    }

    await this.join(storefrontId);
  }

  private async join(storefrontId: string): Promise<void> {
    try {
      await firstValueFrom(this.membersApi.join(storefrontId));
      await this.storefrontContext.select(storefrontId);
      this.joined.emit();
      await this.showToast('Dołączono do klubu!', 'success');
    } catch (error) {
      if (isConsentRequiredError(error as HttpErrorResponse)) {
        await this.router.navigate(['/tabs/clubs', storefrontId, 'consents'], {
          queryParams: { returnTo: 'join' }
        });
        return;
      }
      console.error('Failed to join storefront:', error);
      await this.showToast('Nie udało się dołączyć. Spróbuj ponownie.', 'danger');
    }
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({ message, duration: 3000, color, position: 'top' });
    await toast.present();
  }
}
