import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ExternalConfigService } from '@shared/iam-msal-external';
import { AcademyApiService } from './academy-api.service';

describe('AcademyApiService', () => {
  let service: AcademyApiService;
  let httpMock: HttpTestingController;
  const base = 'https://api.test/api/academy';

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
    service = TestBed.inject(AcademyApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('gets the guardian for a storefront', () => {
    service.getMyGuardian('sf-1').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/me/guardian`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('storefrontId')).toBe('sf-1');
    req.flush({});
  });

  it('updates the guardian with the request body', () => {
    const body = { storefrontId: 'sf-1', firstName: 'Anna', lastName: 'Kowalska', phone: '+48111222333' };
    service.updateGuardian(body).subscribe();
    const req = httpMock.expectOne(`${base}/me/guardian`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual(body);
    req.flush(null);
  });

  it('lists athletes for a storefront', () => {
    service.getMyAthletes('sf-1').subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/me/athletes`);
    expect(req.request.params.get('storefrontId')).toBe('sf-1');
    req.flush([]);
  });

  it('registers an athlete via POST', () => {
    const body = {
      storefrontId: 'sf-1',
      firstName: 'Jan',
      lastName: 'Kowalski',
      dateOfBirth: '2016-05-01',
      disciplines: ['Acrobatics'],
      trainingFrequency: 'OncePerWeek',
      preferredLocality: 'Drobin'
    };
    service.registerAthlete(body).subscribe();
    const req = httpMock.expectOne(`${base}/me/athletes`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(body);
    req.flush('"new-athlete-id"');
  });

  it('gets an athlete detail, attendance, grades and payments scoped by storefront', () => {
    service.getAthlete('sf-1', 'ath-1').subscribe();
    service.getAthleteAttendance('sf-1', 'ath-1').subscribe();
    service.getAthleteGrades('sf-1', 'ath-1').subscribe();
    service.getAthletePayments('sf-1', 'ath-1').subscribe();

    for (const path of [
      'me/athletes/ath-1',
      'me/athletes/ath-1/attendance',
      'me/athletes/ath-1/grades',
      'me/athletes/ath-1/payments'
    ]) {
      const req = httpMock.expectOne((r) => r.url === `${base}/${path}`);
      expect(req.request.method).toBe('GET');
      expect(req.request.params.get('storefrontId')).toBe('sf-1');
      req.flush(path.endsWith('ath-1') ? {} : []);
    }
  });

  it('accepts an invitation via the non-me route', () => {
    service.acceptInvitation({ token: 'tok', storefrontId: 'sf-1' }).subscribe();
    const req = httpMock.expectOne(`${base}/invitations/accept`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ token: 'tok', storefrontId: 'sf-1' });
    req.flush(null);
  });
});
