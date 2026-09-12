import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { ToastController } from '@ionic/angular/standalone';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { AcademyChildDetailPage } from './academy-child-detail.page';
import {
  AcademyApiService,
  AcademyGuardianDto,
  AthleteDetailsDto,
  AthleteGradeDto,
  FeeChargeDto,
  MonthlyAttendanceDto
} from '@konraddevoak/academy-api';
import { CarnetPaymentCallbackService } from '../../core/services/carnet-payment-callback.service';
import { MembersApiService } from '../../core/services/members-api.service';
import { StorefrontContextService } from '../../core/services/storefront-context.service';
import { MembershipDto } from '../../core/models/member.model';

describe('AcademyChildDetailPage', () => {
  let fixture: ComponentFixture<AcademyChildDetailPage>;
  let component: AcademyChildDetailPage;
  let academyApi: jasmine.SpyObj<AcademyApiService>;
  let membersApi: jasmine.SpyObj<MembersApiService>;
  let storefrontContext: jasmine.SpyObj<StorefrontContextService>;

  const membership: MembershipDto = {
    storefrontId: 'sf-1',
    storefrontName: 'KS Master Gang',
    joinedAt: new Date().toISOString(),
    businessType: 'SportsSchool'
  };

  const guardian: AcademyGuardianDto = {
    id: 'g-1',
    firstName: 'Anna',
    lastName: 'Kowalska',
    phone: '500600700',
    status: 'Active'
  };

  function athlete(overrides: Partial<AthleteDetailsDto> = {}): AthleteDetailsDto {
    return {
      id: 'ath-1',
      guardianId: 'g-1',
      guardianName: 'Anna Kowalska',
      guardianPhone: '500600700',
      firstName: 'Jaś',
      lastName: 'Kowalski',
      dateOfBirth: '2016-05-01',
      disciplines: ['Acrobatics'],
      trainingFrequency: 'OncePerWeek',
      preferredLocality: 'Drobin',
      currentGroupId: null,
      monthlyFeeGrosze: null,
      status: 'Active',
      createdAt: new Date().toISOString(),
      group: null,
      scheduleSlots: [],
      ...overrides
    };
  }

  async function setup(detail: AthleteDetailsDto, opts: {
    attendance?: MonthlyAttendanceDto[];
    grades?: AthleteGradeDto[];
    payments?: FeeChargeDto[];
  } = {}) {
    academyApi = jasmine.createSpyObj('AcademyApiService', [
      'getAthlete',
      'getMyGuardian',
      'getAthleteAttendance',
      'getAthleteGrades',
      'getAthletePayments',
      'updateGuardian',
      'payFeeCharge',
      'getBillingPlan',
      'enableBillingPlan',
      'setBillingPlanAutoRenewal',
      'retryBillingPlanCharge'
    ]);
    academyApi.getAthlete.and.returnValue(of(detail));
    academyApi.getMyGuardian.and.returnValue(of(guardian));
    academyApi.getAthleteAttendance.and.returnValue(of(opts.attendance ?? []));
    academyApi.getAthleteGrades.and.returnValue(of(opts.grades ?? []));
    academyApi.getAthletePayments.and.returnValue(of(opts.payments ?? []));
    academyApi.updateGuardian.and.returnValue(of(undefined));
    academyApi.getBillingPlan.and.returnValue(of(null));
    // Empty redirectUrl keeps the flow away from @capacitor/browser (see payFeeCharge).
    academyApi.payFeeCharge.and.returnValue(of({ feeChargeId: 'fc-1', redirectUrl: '' }));

    const paymentCallback = jasmine.createSpyObj('CarnetPaymentCallbackService', ['waitForReturn']);
    paymentCallback.waitForReturn.and.resolveTo();

    membersApi = jasmine.createSpyObj('MembersApiService', ['getMyMemberships']);
    membersApi.getMyMemberships.and.returnValue(of([membership]));

    storefrontContext = jasmine.createSpyObj('StorefrontContextService', ['resolve']);
    storefrontContext.resolve.and.resolveTo('sf-1');

    const toast = jasmine.createSpyObj('HTMLIonToastElement', ['present']);
    toast.present.and.resolveTo();
    const toastController = jasmine.createSpyObj('ToastController', ['create']);
    toastController.create.and.resolveTo(toast);

    await TestBed.configureTestingModule({
      imports: [AcademyChildDetailPage],
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: AcademyApiService, useValue: academyApi },
        { provide: CarnetPaymentCallbackService, useValue: paymentCallback },
        { provide: MembersApiService, useValue: membersApi },
        { provide: StorefrontContextService, useValue: storefrontContext },
        { provide: ToastController, useValue: toastController },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['athleteId', 'ath-1']]) } } }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(AcademyChildDetailPage);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
  }

  it('loads all six data sets and renders every segment button', async () => {
    await setup(athlete());

    const compiled: HTMLElement = fixture.nativeElement;
    const tabs = Array.from(compiled.querySelectorAll('ion-segment-button')).map((b) => b.getAttribute('value'));
    expect(tabs).toEqual(['athlete', 'guardian', 'schedule', 'attendance', 'payments', 'grades']);
    expect(academyApi.getAthletePayments).toHaveBeenCalledWith('sf-1', 'ath-1');
  });

  it('shows the not-assigned notice when the child has no group', async () => {
    await setup(athlete({ group: null }));

    expect(fixture.nativeElement.textContent).toContain('academy.childDetail.schedule.notAssigned');
  });

  it('renders a Paid badge for a covered fee charge', async () => {
    await setup(athlete(), {
      payments: [
        {
          id: 'fc-1',
          period: '2026-09',
          year: 2026,
          month: 9,
          expectedAmountGrosze: 9000,
          paidAmountGrosze: 9000,
          status: 'Paid',
          dueDate: null,
          payments: []
        }
      ]
    });

    const compiled: HTMLElement = fixture.nativeElement;
    const badge = compiled.querySelector('ion-badge');
    expect(badge?.textContent).toContain('academy.payments.paid');
    expect((badge as unknown as { color: string }).color).toBe('success');
  });

  it('offers "pay online" only for a Due charge and starts the payment for its period', async () => {
    await setup(athlete(), {
      payments: [
        {
          id: 'fc-2',
          period: '2026-10',
          year: 2026,
          month: 10,
          expectedAmountGrosze: 9000,
          paidAmountGrosze: 0,
          status: 'Due',
          dueDate: null,
          payments: []
        }
      ]
    });

    const compiled: HTMLElement = fixture.nativeElement;
    const payButtons = Array.from(compiled.querySelectorAll('#payments ion-button')).filter((b) =>
      b.textContent?.includes('academy.payments.payOnline')
    );
    expect(payButtons.length).toBe(1);

    component.payFeeCharge(component.payments[0]);

    expect(academyApi.payFeeCharge).toHaveBeenCalledWith('sf-1', 'ath-1', '2026-10');
  });

  it('does not offer "pay online" for a Paid charge', async () => {
    await setup(athlete(), {
      payments: [
        {
          id: 'fc-1',
          period: '2026-09',
          year: 2026,
          month: 9,
          expectedAmountGrosze: 9000,
          paidAmountGrosze: 9000,
          status: 'Paid',
          dueDate: null,
          payments: []
        }
      ]
    });

    const compiled: HTMLElement = fixture.nativeElement;
    const payButtons = Array.from(compiled.querySelectorAll('#payments ion-button')).filter((b) =>
      b.textContent?.includes('academy.payments.payOnline')
    );
    expect(payButtons.length).toBe(0);
  });

  it('sends a full guardian PATCH when the phone is edited', async () => {
    await setup(athlete());

    component.guardianForm.setValue({ phone: '111222333' });
    component.guardianForm.markAsDirty();
    component.saveGuardianPhone();

    expect(academyApi.updateGuardian).toHaveBeenCalledWith({
      storefrontId: 'sf-1',
      firstName: 'Anna',
      lastName: 'Kowalska',
      phone: '111222333'
    });
  });
});
