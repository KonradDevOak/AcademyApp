import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AcademyApiService } from '@konraddevoak/academy-api';
import { TranslatePipe } from '@ngx-translate/core';
import { StorefrontContextService } from '../../core/services/storefront-context';
import { registerAthleteErrorKey } from '../register-athlete-errors';

// Serves both add (route `academy/add`) and edit (`academy/children/:athleteId/edit`) — the form is
// small (4 fields, no cross-field logic) so branching on the route param here keeps this a single
// self-contained component, matching every other Academy screen in this app, instead of splitting
// into a form component + two thin wrappers.
@Component({
  selector: 'app-academy-add-child',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, TranslatePipe],
  templateUrl: './academy-add-child.html',
  styleUrl: './academy-add-child.scss'
})
export class AcademyAddChildComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(AcademyApiService);
  private readonly storefrontContext = inject(StorefrontContextService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);

  protected readonly athleteId = this.route.snapshot.paramMap.get('athleteId');
  protected readonly isEditMode = this.athleteId !== null;

  private readonly _saving = signal(false);
  protected readonly saving = this._saving.asReadonly();
  private readonly _loading = signal(this.isEditMode);
  protected readonly loading = this._loading.asReadonly();
  protected readonly errorMessage = signal<string | null>(null);

  // No discipline field — an athlete's discipline is derived from the training group the operator
  // assigns later, never chosen by the parent at registration.
  protected readonly form = this.fb.nonNullable.group({
    firstName: ['', Validators.required],
    lastName: ['', Validators.required],
    dateOfBirth: ['', Validators.required]
  });

  ngOnInit(): void {
    if (!this.isEditMode) {
      return;
    }

    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (!storefrontId || !this.athleteId) {
      this._loading.set(false);
      return;
    }

    this.api.getAthlete(storefrontId, this.athleteId).subscribe({
      next: (athlete) => {
        this.form.patchValue({
          firstName: athlete.firstName,
          lastName: athlete.lastName,
          dateOfBirth: athlete.dateOfBirth
        });
        this._loading.set(false);
      },
      error: () => this._loading.set(false)
    });
  }

  protected submit(): void {
    const storefrontId = this.storefrontContext.selectedStorefrontId();
    if (this.form.invalid || !storefrontId) {
      this.form.markAllAsTouched();
      return;
    }

    this._saving.set(true);
    this.errorMessage.set(null);
    const value = this.form.getRawValue();

    const onSuccess = () => {
      this._saving.set(false);
      void this.router.navigateByUrl(this.isEditMode ? `/academy/children/${this.athleteId}` : '/academy');
    };
    const onError = (error: HttpErrorResponse) => {
      this._saving.set(false);
      this.errorMessage.set(registerAthleteErrorKey(error));
    };

    if (this.isEditMode && this.athleteId) {
      this.api
        .updateAthlete(storefrontId, this.athleteId, {
          storefrontId,
          firstName: value.firstName,
          lastName: value.lastName,
          dateOfBirth: value.dateOfBirth
        })
        .subscribe({ next: onSuccess, error: onError });
      return;
    }

    this.api
      .registerAthlete({
        storefrontId,
        firstName: value.firstName,
        lastName: value.lastName,
        dateOfBirth: value.dateOfBirth
      })
      .subscribe({ next: onSuccess, error: onError });
  }

  protected async cancel(): Promise<void> {
    await this.router.navigateByUrl(
      this.isEditMode ? `/academy/children/${this.athleteId}` : '/academy'
    );
  }
}
