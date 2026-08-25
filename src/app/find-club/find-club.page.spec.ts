import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { ToastController } from '@ionic/angular/standalone';
import { of, throwError } from 'rxjs';
import { FindClubPage } from './find-club.page';
import { StorefrontDiscoveryService } from '../core/services/storefront-discovery.service';
import { MembersApiService } from '../core/services/members-api.service';
import { StorefrontProfileService } from '../core/services/storefront-profile.service';
import { StorefrontDiscoveryResultDto } from '../core/models/storefront.model';

describe('FindClubPage', () => {
  let fixture: ComponentFixture<FindClubPage>;
  let component: FindClubPage;
  let discovery: jasmine.SpyObj<StorefrontDiscoveryService>;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let router: jasmine.SpyObj<Router>;

  const sampleResults: StorefrontDiscoveryResultDto[] = [
    {
      id: 'club-1',
      name: 'Fit Club',
      address: 'ul. Testowa 1',
      businessType: 'Fitness',
      services: [],
      isOpenNow: true,
      rating: null,
      ratingCount: 0,
      distanceKm: 1.2
    }
  ];

  beforeEach(async () => {
    discovery = jasmine.createSpyObj('StorefrontDiscoveryService', ['search', 'getCurrentPosition']);
    discovery.getCurrentPosition.and.resolveTo(null);
    discovery.search.and.returnValue(of(sampleResults));

    membersApi = jasmine.createSpyObj('MembersApiService', ['join']);
    router = jasmine.createSpyObj('Router', ['navigate', 'navigateByUrl']);
    router.navigate.and.resolveTo(true);
    router.navigateByUrl.and.resolveTo(true);

    const toast = jasmine.createSpyObj('HTMLIonToastElement', ['present']);
    toast.present.and.resolveTo();
    const toastController = jasmine.createSpyObj('ToastController', ['create']);
    toastController.create.and.resolveTo(toast);

    // Not exercised by any test here — just needs to satisfy the embedded <app-manual-join>'s DI
    // (ManualJoinComponent injects it to resolve a scanned QR code's domain to a storefrontId).
    const storefrontProfile = jasmine.createSpyObj('StorefrontProfileService', ['resolveByDomain']);

    await TestBed.configureTestingModule({
      imports: [FindClubPage],
      providers: [
        { provide: StorefrontDiscoveryService, useValue: discovery },
        { provide: MembersApiService, useValue: membersApi },
        { provide: StorefrontProfileService, useValue: storefrontProfile },
        { provide: Router, useValue: router },
        { provide: ToastController, useValue: toastController }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(FindClubPage);
    component = fixture.componentInstance;
  });

  it('loads results on init and falls back to alphabetical sort when location is unavailable', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);

    expect(discovery.search).toHaveBeenCalledWith({ search: undefined, coordinates: null });
    expect(component.results).toEqual(sampleResults);
    expect(component.isUsingLocation).toBeFalse();
  }));

  it('uses the granted coordinates when geolocation succeeds', fakeAsync(() => {
    discovery.getCurrentPosition.and.resolveTo({ latitude: 52.1, longitude: 21.0 });

    fixture.detectChanges();
    tick(300);

    expect(discovery.search).toHaveBeenCalledWith({
      search: undefined,
      coordinates: { latitude: 52.1, longitude: 21.0 }
    });
    expect(component.isUsingLocation).toBeTrue();
  }));

  it('re-searches with the typed term after the debounce window', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);
    discovery.search.calls.reset();

    component.onSearchChange('fit');
    tick(300);

    expect(discovery.search).toHaveBeenCalledWith({ search: 'fit', coordinates: null });
  }));

  it('joins a club and returns to tabs on success', fakeAsync(() => {
    membersApi.join.and.returnValue(of(void 0));
    fixture.detectChanges();
    tick(300);

    component.join('club-1');
    tick();

    expect(membersApi.join).toHaveBeenCalledWith('club-1');
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs');
    expect(component.joiningId).toBeNull();
  }));

  it('redirects to the consents page when joining requires pending consent acceptance', fakeAsync(() => {
    const error = new HttpErrorResponse({
      status: 409,
      error: { errors: [{ code: 'member_consent_required' }] }
    });
    membersApi.join.and.returnValue(throwError(() => error));
    fixture.detectChanges();
    tick(300);

    component.join('club-1');
    tick();

    expect(router.navigate).toHaveBeenCalledWith(
      ['/tabs/clubs', 'club-1', 'consents'],
      { queryParams: { returnTo: 'join' } }
    );
    expect(component.joiningId).toBeNull();
  }));

  it('toggles the manual join ("Zeskanuj kod QR klubu") panel', fakeAsync(() => {
    fixture.detectChanges();
    tick(300);

    expect(component.showManualJoin).toBeFalse();
    component.showManualJoin = true;
    fixture.detectChanges();

    expect(component.showManualJoin).toBeTrue();
  }));
});
