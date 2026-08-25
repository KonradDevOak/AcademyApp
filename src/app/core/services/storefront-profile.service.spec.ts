import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExternalConfigService } from '@shared/iam-msal-external';
import { StorefrontProfileService } from './storefront-profile.service';
import { StorefrontPublicProfileDto } from '../models/storefront.model';

describe('StorefrontProfileService', () => {
  let service: StorefrontProfileService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: ExternalConfigService,
          useValue: { getConfig: () => ({ apiConfig: { uri: 'https://api.test' } }) }
        }
      ]
    });

    service = TestBed.inject(StorefrontProfileService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  describe('getPublicProfile', () => {
    it('fetches the public profile by storefrontId', () => {
      service.getPublicProfile('club-1').subscribe();

      const req = httpMock.expectOne('https://api.test/api/storefronts/club-1/public');
      expect(req.request.method).toBe('GET');
      req.flush({ id: 'club-1', name: 'Fit Club', clubBackgroundDarkImage: null, clubBackgroundLightImage: null });
    });
  });

  describe('resolveByDomain', () => {
    it('resolves a storefront by its public domain, e.g. scanned from the owner\'s QR code', () => {
      const dto: StorefrontPublicProfileDto = {
        id: 'club-1',
        name: 'Fit Club',
        clubBackgroundDarkImage: null,
        clubBackgroundLightImage: null
      };

      service.resolveByDomain('jan-hydraulik.pl').subscribe((result) => {
        expect(result).toEqual(dto);
      });

      const req = httpMock.expectOne(
        (r) => r.url === 'https://api.test/api/storefronts/resolve'
      );
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('domain')).toBe('jan-hydraulik.pl');
      req.flush(dto);
    });
  });
});
