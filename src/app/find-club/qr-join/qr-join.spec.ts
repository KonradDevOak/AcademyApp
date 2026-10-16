import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { ClubPublicProfileDto } from '../../core/models/storefront';
import { ClubDiscoveryService } from '../../core/services/club-discovery';
import { BARCODE_SCANNER_PLUGIN, QrJoinComponent } from './qr-join';

describe('QrJoinComponent', () => {
  let component: QrJoinComponent;
  let barcodeScanner: jasmine.SpyObj<{
    scan: (options?: unknown) => Promise<{ barcodes: { rawValue?: string; displayValue?: string }[] }>;
    isGoogleBarcodeScannerModuleAvailable: () => Promise<{ available: boolean }>;
    installGoogleBarcodeScannerModule: () => Promise<void>;
  }>;
  let discovery: jasmine.SpyObj<ClubDiscoveryService>;
  let router: jasmine.SpyObj<Router>;

  function scanned(value: string): void {
    barcodeScanner.scan.and.resolveTo({ barcodes: [{ rawValue: value }] });
  }

  beforeEach(() => {
    barcodeScanner = jasmine.createSpyObj('BarcodeScanner', [
      'scan',
      'isGoogleBarcodeScannerModuleAvailable',
      'installGoogleBarcodeScannerModule'
    ]);
    barcodeScanner.isGoogleBarcodeScannerModuleAvailable.and.resolveTo({ available: true });
    discovery = jasmine.createSpyObj('ClubDiscoveryService', ['resolveByDomain']);
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    TestBed.configureTestingModule({
      imports: [QrJoinComponent],
      providers: [
        provideTranslateService(),
        { provide: BARCODE_SCANNER_PLUGIN, useValue: barcodeScanner },
        { provide: ClubDiscoveryService, useValue: discovery },
        { provide: Router, useValue: router }
      ]
    });
    component = TestBed.createComponent(QrJoinComponent).componentInstance;
  });

  it('opens the card of the academy whose domain the QR code encodes', async () => {
    scanned('https://master-gang.pl/');
    discovery.resolveByDomain.and.returnValue(of({ id: 'club-1' } as ClubPublicProfileDto));

    await component.scan();

    expect(discovery.resolveByDomain).toHaveBeenCalledWith('master-gang.pl');
    expect(router.navigate).toHaveBeenCalledWith(['/clubs', 'club-1']);
  });

  it('reports an unknown code when the domain resolves to no academy', async () => {
    scanned('https://unknown.example/');
    discovery.resolveByDomain.and.returnValue(throwError(() => new Error('404')));

    await component.scan();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component['error']()).toBe('unknown');
  });

  it('reports an unknown code when the QR content is not a URL', async () => {
    scanned('not a url');

    await component.scan();

    expect(discovery.resolveByDomain).not.toHaveBeenCalled();
    expect(component['error']()).toBe('unknown');
  });

  it('does nothing when the scan is cancelled', async () => {
    barcodeScanner.scan.and.resolveTo({ barcodes: [] });

    await component.scan();

    expect(router.navigate).not.toHaveBeenCalled();
    expect(component['error']()).toBeNull();
  });
});
