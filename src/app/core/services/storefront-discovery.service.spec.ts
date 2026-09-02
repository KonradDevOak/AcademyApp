import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExternalConfigService } from '@shared/iam-msal-external';
import { GEOLOCATION_PLUGIN, StorefrontDiscoveryService } from './storefront-discovery.service';

describe('StorefrontDiscoveryService', () => {
  let service: StorefrontDiscoveryService;
  let httpMock: HttpTestingController;
  let geolocation: jasmine.SpyObj<{
    checkPermissions: () => Promise<{ location: string }>;
    requestPermissions: () => Promise<{ location: string }>;
    getCurrentPosition: () => Promise<{ coords: { latitude: number; longitude: number } }>;
  }>;

  beforeEach(() => {
    geolocation = jasmine.createSpyObj('Geolocation', [
      'checkPermissions',
      'requestPermissions',
      'getCurrentPosition'
    ]);

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ExternalConfigService,
          useValue: { getConfig: () => ({ apiConfig: { uri: 'https://api.test' } }) }
        },
        { provide: GEOLOCATION_PLUGIN, useValue: geolocation }
      ]
    });

    service = TestBed.inject(StorefrontDiscoveryService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('search', () => {
    const url = 'https://api.test/api/storefronts/public';

    it('scopes a fitness search to fitness-ready clubs and forwards search/coordinates', () => {
      service
        .search({ search: 'fit klub', coordinates: { latitude: 52.1, longitude: 21.0 }, vertical: 'fitness' })
        .subscribe();

      const req = httpMock.expectOne((r) => r.url === url);
      expect(req.request.params.get('businessType')).toBe('Fitness');
      expect(req.request.params.get('requireFitnessReadiness')).toBe('true');
      expect(req.request.params.has('requireAcademyReadiness')).toBeFalse();
      expect(req.request.params.get('search')).toBe('fit klub');
      expect(req.request.params.get('lat')).toBe('52.1');
      expect(req.request.params.get('lng')).toBe('21');
      req.flush([]);
    });

    it('scopes an academy search to academy-ready sports schools', () => {
      service.search({ vertical: 'academy' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === url);
      expect(req.request.params.get('businessType')).toBe('SportsSchool');
      expect(req.request.params.get('requireAcademyReadiness')).toBe('true');
      expect(req.request.params.has('requireFitnessReadiness')).toBeFalse();
      req.flush([]);
    });

    it('fans out to both verticals by default and merges the results', () => {
      const merged: string[] = [];
      service.search({}).subscribe((results) => merged.push(...results.map((r) => r.id)));

      const reqs = httpMock.match((r) => r.url === url);
      expect(reqs.length).toBe(2);
      expect(reqs.map((r) => r.request.params.get('businessType')).sort()).toEqual(['Fitness', 'SportsSchool']);

      reqs.find((r) => r.request.params.get('businessType') === 'Fitness')!.flush([
        { id: 'fit', name: 'Fit', address: null, businessType: 'Fitness', services: [], isOpenNow: true, rating: null, ratingCount: 0, distanceKm: null }
      ]);
      reqs.find((r) => r.request.params.get('businessType') === 'SportsSchool')!.flush([
        { id: 'acad', name: 'Acro', address: null, businessType: 'SportsSchool', services: [], isOpenNow: true, rating: null, ratingCount: 0, distanceKm: null }
      ]);

      expect(merged.sort()).toEqual(['acad', 'fit']);
    });

    it('omits lat/lng and search when not provided', () => {
      service.search({ vertical: 'fitness' }).subscribe();

      const req = httpMock.expectOne((r) => r.url === url);
      expect(req.request.params.has('lat')).toBeFalse();
      expect(req.request.params.has('search')).toBeFalse();
      req.flush([]);
    });
  });

  describe('getCurrentPosition', () => {
    it('returns coordinates immediately when permission is already granted', async () => {
      geolocation.checkPermissions.and.resolveTo({ location: 'granted' });
      geolocation.getCurrentPosition.and.resolveTo({ coords: { latitude: 10, longitude: 20 } });

      const result = await service.getCurrentPosition();

      expect(result).toEqual({ latitude: 10, longitude: 20 });
    });

    it('requests permission when in prompt state and returns coordinates once granted', async () => {
      geolocation.checkPermissions.and.resolveTo({ location: 'prompt' });
      geolocation.requestPermissions.and.resolveTo({ location: 'granted' });
      geolocation.getCurrentPosition.and.resolveTo({ coords: { latitude: 5, longitude: 6 } });

      const result = await service.getCurrentPosition();

      expect(result).toEqual({ latitude: 5, longitude: 6 });
    });

    it('returns null without calling getCurrentPosition when permission is denied', async () => {
      geolocation.checkPermissions.and.resolveTo({ location: 'denied' });

      const result = await service.getCurrentPosition();

      expect(result).toBeNull();
      expect(geolocation.getCurrentPosition).not.toHaveBeenCalled();
    });

    it('returns null when the plugin throws (e.g. unavailable on this platform)', async () => {
      geolocation.checkPermissions.and.rejectWith(new Error('unavailable'));

      const result = await service.getCurrentPosition();

      expect(result).toBeNull();
    });
  });
});
