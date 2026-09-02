import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastController } from '@ionic/angular/standalone';
import { of, throwError } from 'rxjs';
import { BARCODE_SCANNER_PLUGIN, ManualJoinComponent } from './manual-join.component';
import { MembersApiService } from '../../core/services/members-api.service';
import { StorefrontProfileService } from '../../core/services/storefront-profile.service';
import { StorefrontContextService } from '../../core/services/storefront-context.service';
import { StorefrontPublicProfileDto } from '../../core/models/storefront.model';

describe('ManualJoinComponent', () => {
  let fixture: ComponentFixture<ManualJoinComponent>;
  let component: ManualJoinComponent;
  let barcodeScanner: jasmine.SpyObj<{
    scan: (options?: unknown) => Promise<{ barcodes: { rawValue?: string; displayValue?: string }[] }>;
    isGoogleBarcodeScannerModuleAvailable: () => Promise<{ available: boolean }>;
    installGoogleBarcodeScannerModule: () => Promise<void>;
  }>;
  let storefrontProfile: jasmine.SpyObj<StorefrontProfileService>;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let storefrontContext: jasmine.SpyObj<StorefrontContextService>;
  let router: jasmine.SpyObj<Router>;

  const profile: StorefrontPublicProfileDto = {
    id: 'club-1',
    name: 'Fit Club',
    businessType: 'Fitness',
    clubBackgroundDarkImage: null,
    clubBackgroundLightImage: null
  };

  function scanned(value: string) {
    barcodeScanner.scan.and.resolveTo({ barcodes: [{ rawValue: value }] });
  }

  beforeEach(async () => {
    barcodeScanner = jasmine.createSpyObj('BarcodeScanner', [
      'scan',
      'isGoogleBarcodeScannerModuleAvailable',
      'installGoogleBarcodeScannerModule'
    ]);
    storefrontProfile = jasmine.createSpyObj('StorefrontProfileService', ['resolveByDomain']);
    membersApi = jasmine.createSpyObj('MembersApiService', ['join']);
    storefrontContext = jasmine.createSpyObj('StorefrontContextService', ['select']);
    storefrontContext.select.and.resolveTo();
    router = jasmine.createSpyObj('Router', ['navigate']);
    router.navigate.and.resolveTo(true);

    const toast = jasmine.createSpyObj('HTMLIonToastElement', ['present']);
    toast.present.and.resolveTo();
    const toastController = jasmine.createSpyObj('ToastController', ['create']);
    toastController.create.and.resolveTo(toast);

    await TestBed.configureTestingModule({
      imports: [ManualJoinComponent],
      providers: [
        { provide: BARCODE_SCANNER_PLUGIN, useValue: barcodeScanner },
        { provide: StorefrontProfileService, useValue: storefrontProfile },
        { provide: MembersApiService, useValue: membersApi },
        { provide: StorefrontContextService, useValue: storefrontContext },
        { provide: Router, useValue: router },
        { provide: ToastController, useValue: toastController }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(ManualJoinComponent);
    component = fixture.componentInstance;
  });

  it('scans the club QR code, resolves it by domain, joins, activates the club and emits joined', fakeAsync(() => {
    scanned('https://jan-hydraulik.pl');
    storefrontProfile.resolveByDomain.and.returnValue(of(profile));
    membersApi.join.and.returnValue(of(void 0));
    let joinedEmitted = false;
    component.joined.subscribe(() => (joinedEmitted = true));

    component.scan();
    tick();

    expect(storefrontProfile.resolveByDomain).toHaveBeenCalledWith('jan-hydraulik.pl');
    expect(membersApi.join).toHaveBeenCalledWith('club-1');
    expect(storefrontContext.select).toHaveBeenCalledWith('club-1');
    expect(joinedEmitted).toBeTrue();
    expect(component.isScanning).toBeFalse();
  }));

  it('redirects to the consents page when joining requires pending consent acceptance', fakeAsync(() => {
    scanned('https://jan-hydraulik.pl');
    storefrontProfile.resolveByDomain.and.returnValue(of(profile));
    const error = new HttpErrorResponse({
      status: 409,
      error: { errors: [{ code: 'member_consent_required' }] }
    });
    membersApi.join.and.returnValue(throwError(() => error));

    component.scan();
    tick();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/tabs/clubs', 'club-1', 'consents'],
      { queryParams: { returnTo: 'join' } }
    );
    expect(storefrontContext.select).not.toHaveBeenCalled();
  }));

  it('shows an error and does not attempt to resolve when the scanned value is not a URL', fakeAsync(() => {
    scanned('not-a-url');

    component.scan();
    tick();

    expect(storefrontProfile.resolveByDomain).not.toHaveBeenCalled();
    expect(membersApi.join).not.toHaveBeenCalled();
    expect(component.isScanning).toBeFalse();
  }));

  it('shows an error when the scanned domain does not resolve to any storefront', fakeAsync(() => {
    scanned('https://not-a-localbiz-club.example');
    storefrontProfile.resolveByDomain.and.returnValue(throwError(() => new HttpErrorResponse({ status: 404 })));

    component.scan();
    tick();

    expect(membersApi.join).not.toHaveBeenCalled();
    expect(component.isScanning).toBeFalse();
  }));

  it('does nothing when the user cancels the scan (no barcode returned)', fakeAsync(() => {
    barcodeScanner.scan.and.resolveTo({ barcodes: [] });

    component.scan();
    tick();

    expect(storefrontProfile.resolveByDomain).not.toHaveBeenCalled();
    expect(component.isScanning).toBeFalse();
  }));

  it('ignores a second scan() call while one is already in progress', fakeAsync(() => {
    let resolveScan!: (value: { barcodes: { rawValue?: string }[] }) => void;
    barcodeScanner.scan.and.returnValue(new Promise((resolve) => (resolveScan = resolve)));

    component.scan();
    component.scan();
    resolveScan({ barcodes: [] });
    tick();

    expect(barcodeScanner.scan).toHaveBeenCalledTimes(1);
  }));
});
