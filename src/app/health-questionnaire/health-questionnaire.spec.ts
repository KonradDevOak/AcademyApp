import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { of } from 'rxjs';
import { MembersApiService } from '../core/services/members-api';
import { HealthQuestionnaireComponent } from './health-questionnaire';

describe('HealthQuestionnaireComponent', () => {
  let fixture: ComponentFixture<HealthQuestionnaireComponent>;
  let api: jasmine.SpyObj<MembersApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<MembersApiService>(['getHealthQuestionnaire', 'submitHealthQuestionnaire']);
    api.getHealthQuestionnaire.and.returnValue(of({
      id: 'h', memberId: 'm', storefrontId: 'sf-1', submittedAt: '2026-10-01T10:00:00Z',
      answersJson: JSON.stringify({ hasHealthContraindications: true, hasChronicCondition: false,
        takesRegularMedication: false, additionalNotes: 'kolano' })
    }));
    api.submitHealthQuestionnaire.and.returnValue(of('new-id'));
    TestBed.configureTestingModule({
      providers: [
        provideRouter([]),
        provideTranslateService(),
        { provide: MembersApiService, useValue: api },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: convertToParamMap({ storefrontId: 'sf-1' }) } } }
      ]
    });
    fixture = TestBed.createComponent(HealthQuestionnaireComponent);
    fixture.detectChanges();
    await fixture.whenStable();
  });

  type Form = { getRawValue(): Record<string, unknown>; patchValue(v: object): void };

  it('prefills the latest submission', () => {
    const form = (fixture.componentInstance as unknown as { form: Form }).form;
    expect(form.getRawValue()['additionalNotes']).toBe('kolano');
    expect(form.getRawValue()['hasHealthContraindications']).toBeTrue();
  });

  it('refuses to submit without the health-data consent', async () => {
    await (fixture.componentInstance as unknown as { submit(): Promise<void> }).submit();
    expect(api.submitHealthQuestionnaire).not.toHaveBeenCalled();
  });

  it('submits the answers without the consent flag inside the JSON', async () => {
    const component = fixture.componentInstance as unknown as { form: Form; submit(): Promise<void> };
    component.form.patchValue({ healthDataConsentAccepted: true });

    await component.submit();

    const [storefrontId, answersJson, consent] = api.submitHealthQuestionnaire.calls.mostRecent().args;
    expect(storefrontId).toBe('sf-1');
    expect(JSON.parse(answersJson)).toEqual({
      hasHealthContraindications: true, hasChronicCondition: false, takesRegularMedication: false, additionalNotes: 'kolano'
    });
    expect(consent).toBeTrue();
  });
});
