import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, Router, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { AcademyApiService, AthleteDetailsDto } from '@konraddevoak/academy-api';
import { provideTranslateService } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { AcademyAddChildComponent } from './academy-add-child';

function athleteDetails(overrides: Partial<AthleteDetailsDto> = {}): AthleteDetailsDto {
  return {
    id: 'ath-1',
    guardianMemberId: 'member-1',
    firstName: 'Jaś',
    lastName: 'Kowalski',
    dateOfBirth: '2016-05-01',
    sessionsPerWeek: 0,
    monthlyFeeGrosze: null,
    status: 'Active',
    createdAt: '2026-01-01T00:00:00Z',
    guardianName: 'Anna Kowalska',
    guardianPhone: '500600700',
    enrolledSlots: [],
    ...overrides
  };
}

describe('AcademyAddChildComponent', () => {
  const selectedId = signal<string | null>('sf-1');
  let registerAthlete: jasmine.Spy;
  let updateAthlete: jasmine.Spy;
  let getAthlete: jasmine.Spy;
  let navigateByUrl: jasmine.Spy;
  let fixture: ComponentFixture<AcademyAddChildComponent>;
  let component: AcademyAddChildComponent;

  function fillValidForm(): void {
    component['form'].setValue({
      firstName: 'Jan',
      lastName: 'Kowalski',
      dateOfBirth: '2016-05-01'
    });
  }

  function submit(): void {
    component['submit']();
  }

  function configure(athleteId: string | null): void {
    selectedId.set('sf-1');
    registerAthlete = jasmine.createSpy('registerAthlete').and.returnValue(of('new-athlete-id'));
    updateAthlete = jasmine.createSpy('updateAthlete').and.returnValue(of(undefined));
    getAthlete = jasmine.createSpy('getAthlete').and.returnValue(of(athleteDetails()));
    navigateByUrl = jasmine.createSpy('navigateByUrl').and.resolveTo(true);

    TestBed.configureTestingModule({
      providers: [
        provideTranslateService(),
        { provide: AcademyApiService, useValue: { registerAthlete, updateAthlete, getAthlete } },
        { provide: StorefrontContextService, useValue: { selectedStorefrontId: selectedId.asReadonly() } },
        { provide: Router, useValue: { navigateByUrl } },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap(athleteId ? { athleteId } : {}) } }
        }
      ]
    });

    fixture = TestBed.createComponent(AcademyAddChildComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }

  describe('in add mode', () => {
    beforeEach(() => configure(null));

    it('is invalid and does not call the API when required fields are missing', () => {
      component['form'].patchValue({ firstName: '', lastName: '', dateOfBirth: '' });

      expect(component['form'].invalid).toBeTrue();

      submit();
      expect(registerAthlete).not.toHaveBeenCalled();
    });

    it('submits the payload (no discipline field) and returns to the roster on success', () => {
      fillValidForm();

      submit();

      expect(registerAthlete).toHaveBeenCalledWith({
        storefrontId: 'sf-1',
        firstName: 'Jan',
        lastName: 'Kowalski',
        dateOfBirth: '2016-05-01'
      });
      expect(navigateByUrl).toHaveBeenCalledWith('/academy');
      expect(component['saving']()).toBeFalse();
    });

    it('maps guardian_not_found (404) to its i18n key', () => {
      registerAthlete.and.returnValue(
        throwError(
          () => new HttpErrorResponse({ status: 404, error: { errors: [{ code: 'guardian_not_found' }] } })
        )
      );
      fillValidForm();

      submit();

      expect(component['errorMessage']()).toBe('academy.onboarding.errors.guardianNotFound');
    });

    it('does not submit when no storefront is selected', () => {
      selectedId.set(null);
      fillValidForm();

      submit();

      expect(registerAthlete).not.toHaveBeenCalled();
    });
  });

  describe('in edit mode', () => {
    beforeEach(() => configure('ath-1'));

    it('prefills the form from the existing athlete', () => {
      expect(getAthlete).toHaveBeenCalledWith('sf-1', 'ath-1');
      expect(component['form'].getRawValue()).toEqual({
        firstName: 'Jaś',
        lastName: 'Kowalski',
        dateOfBirth: '2016-05-01'
      });
      expect(component['loading']()).toBeFalse();
    });

    it('calls updateAthlete on submit and navigates back to the detail page', () => {
      fillValidForm();

      submit();

      expect(updateAthlete).toHaveBeenCalledWith('sf-1', 'ath-1', {
        storefrontId: 'sf-1',
        firstName: 'Jan',
        lastName: 'Kowalski',
        dateOfBirth: '2016-05-01'
      });
      expect(registerAthlete).not.toHaveBeenCalled();
      expect(navigateByUrl).toHaveBeenCalledWith('/academy/children/ath-1');
    });
  });
});
