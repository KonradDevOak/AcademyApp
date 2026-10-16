import { ChangeDetectionStrategy, Component, InjectionToken, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { Capacitor } from '@capacitor/core';
import { BarcodeFormat, BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { TranslatePipe } from '@ngx-translate/core';
import { ClubDiscoveryService } from '../../core/services/club-discovery';

// Capacitor plugin objects are a Proxy whose `get` trap always returns a fresh wrapper — spyOn() in
// Jasmine silently has no effect, so specs swap the plugin through this token instead.
export const BARCODE_SCANNER_PLUGIN = new InjectionToken<typeof BarcodeScanner>('BARCODE_SCANNER_PLUGIN', {
  providedIn: 'root',
  factory: () => BarcodeScanner
});

type QrError = 'unknown' | 'failed' | 'installing';

// Native extra on the academy finder: scan the academy's QR code (the one the owner generates in
// LocalBizWeb's "Kod QR" section — it encodes nothing but https://{their-domain}) and open its card, where
// joining happens exactly as for a search result.
@Component({
  selector: 'app-qr-join',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslatePipe],
  templateUrl: './qr-join.html'
})
export class QrJoinComponent {
  private readonly barcodeScanner = inject(BARCODE_SCANNER_PLUGIN);
  private readonly discovery = inject(ClubDiscoveryService);
  private readonly router = inject(Router);

  protected readonly scanning = signal(false);
  protected readonly error = signal<QrError | null>(null);

  async scan(): Promise<void> {
    if (this.scanning()) {
      return;
    }
    this.scanning.set(true);
    this.error.set(null);

    try {
      if (Capacitor.getPlatform() === 'android') {
        const { available } = await this.barcodeScanner.isGoogleBarcodeScannerModuleAvailable();
        if (!available) {
          await this.barcodeScanner.installGoogleBarcodeScannerModule();
          this.error.set('installing');
          return;
        }
      }

      const { barcodes } = await this.barcodeScanner.scan({ formats: [BarcodeFormat.QrCode] });
      const scannedValue = barcodes[0]?.rawValue || barcodes[0]?.displayValue;
      if (!scannedValue) {
        return; // scan cancelled
      }
      await this.openClub(scannedValue);
    } catch {
      this.error.set('failed');
    } finally {
      this.scanning.set(false);
    }
  }

  private async openClub(scannedValue: string): Promise<void> {
    let domain: string;
    try {
      domain = new URL(scannedValue).hostname;
    } catch {
      this.error.set('unknown');
      return;
    }

    try {
      const club = await firstValueFrom(this.discovery.resolveByDomain(domain));
      await this.router.navigate(['/clubs', club.id]);
    } catch {
      this.error.set('unknown');
    }
  }
}
