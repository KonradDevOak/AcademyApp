import { ComponentFixture, TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { provideTranslateService } from '@ngx-translate/core';
import { of, throwError } from 'rxjs';
import { AcademyOnboardingPage } from './academy-onboarding.page';
import { AcademyApiService } from '@konraddevoak/academy-api';
import { MembersApiService } from '../../core/services/members-api.service';
import { StorefrontContextService } from '../../core/services/storefront-context.service';
import { MembershipDto } from '../../core/models/member.model';

describe('AcademyOnboardingPage', () => {
  let fixture: ComponentFixture<AcademyOnboardingPage>;
  let component: AcademyOnboardingPage;
  let academyApi: jasmine.SpyObj<AcademyApiService>;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let storefrontContext: jasmine.SpyObj<StorefrontContextService>;
  let router: Router;
  let toastController: jasmine.SpyObj<ToastController>;

  const membership: MembershipDto = {
    storefrontId: 'sf-1',
    storefrontName: 'KS Master Gang',
    joinedAt: new Date().toISOString(),
    businessType: 'SportsSchool'
  };

  async function setup() {
    academyApi = jasmine.createSpyObj('AcademyApiService', ['registerAthlete']);
    academyApi.registerAthlete.and.returnValue(of('new-athlete-id'));

    membersApi = jasmine.createSpyObj('MembersApiService', ['getMyMemberships']);
    membersApi.getMyMemberships.and.returnValue(of([membership]));

    storefrontContext = jasmine.createSpyObj('StorefrontContextService', ['resolve']);
    storefrontContext.resolve.and.resolveTo('sf-1');

    const toast = jasmine.createSpyObj('HTMLIonToastElement', ['present']);
    toast.present.and.resolveTo();
    toastController = jasmine.createSpyObj('ToastController', ['create']);
    toastController.create.and.resolveTo(toast);

    await TestBed.configureTestingModule({
      imports: [AcademyOnboardingPage],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: AcademyApiService, useValue: academyApi },
        { provide: MembersApiService, useValue: membersApi },
        { provide: StorefrontContextService, useValue: storefrontContext },
        { provide: ToastController, useValue: toastController }
      ]
    }).compileComponents();

    router = TestBed.inject(Router);
    spyOn(router, 'navigateByUrl').and.resolveTo(true);

    fixture = TestBed.createComponent(AcademyOnboardingPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  function fillValidForm() {
    component.form.setValue({
      firstName: 'Jan',
      lastName: 'Kowalski',
      dateOfBirth: '2016-05-01',
      acrobatics: true,
      martialArts: false,
      trainingFrequency: 'OncePerWeek'
    });
  }

  it('cannot submit without at least one discipline', async () => {
    await setup();
    component.form.patchValue({
      firstName: 'Jan',
      lastName: 'Kowalski',
      dateOfBirth: '2016-05-01',
      acrobatics: false,
      martialArts: false
    });

    expect(component.canSubmit).toBeFalse();
  });

  it('submits the mapped request and navigates to the new child', async () => {
    await setup();
    fillValidForm();

    component.submit();

    expect(academyApi.registerAthlete).toHaveBeenCalledWith(
      jasmine.objectContaining({
        storefrontId: 'sf-1',
        firstName: 'Jan',
        disciplines: ['Acrobatics'],
        trainingFrequency: 'OncePerWeek'
      })
    );
    expect(router.navigateByUrl).toHaveBeenCalledWith('/tabs/academy-children/new-athlete-id');
  });

  it('shows a specific message when the backend reports a missing guardian', async () => {
    await setup();
    fillValidForm();
    academyApi.registerAthlete.and.returnValue(
      throwError(() => new HttpErrorResponse({ status: 400, error: { errors: [{ code: 'guardian_not_found' }] } }))
    );

    component.submit();

    expect(toastController.create).toHaveBeenCalledWith(
      jasmine.objectContaining({ message: 'academy.onboarding.errors.guardianNotFound', color: 'danger' })
    );
  });
});
