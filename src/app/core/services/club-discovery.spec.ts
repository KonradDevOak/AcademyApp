import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ClubDiscoveryService } from './club-discovery';

describe('ClubDiscoveryService', () => {
  let service: ClubDiscoveryService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ClubDiscoveryService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for ready academies in one request', () => {
    service.search({ search: '  Krak ' }).subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/storefronts/public'));
    expect(req.request.params.get('businessType')).toBe('Academy');
    expect(req.request.params.get('requireReadiness')).toBe('true');
    expect(req.request.params.get('search')).toBe('Krak');
    expect(req.request.params.has('lat')).toBeFalse();
    req.flush([]);
  });

  it('passes coordinates', () => {
    service.search({ latitude: 50.06, longitude: 19.94 }).subscribe();

    const req = http.expectOne((r) => r.url.endsWith('/api/storefronts/public'));
    expect(req.request.params.get('businessType')).toBe('Academy');
    expect(req.request.params.get('requireReadiness')).toBe('true');
    expect(req.request.params.has('requireAcademyReadiness')).toBeFalse();
    expect(req.request.params.has('requireFitnessReadiness')).toBeFalse();
    expect(req.request.params.has('search')).toBeFalse();
    expect(req.request.params.get('lat')).toBe('50.06');
    expect(req.request.params.get('lng')).toBe('19.94');
    req.flush([]);
  });
});
