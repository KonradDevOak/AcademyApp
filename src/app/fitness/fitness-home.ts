import { ChangeDetectionStrategy, Component, effect, signal, viewChild } from '@angular/core';
import { IonAccordion, IonAccordionGroup, IonItem, IonLabel } from '@ionic/angular/standalone';
import { TranslatePipe } from '@ngx-translate/core';
import { FitnessCarnetComponent } from './carnet/fitness-carnet';
import { FitnessScheduleComponent } from './schedule/fitness-schedule';

// "Zajęcia i karnety" landing (/classes) — the same single-open accordion layout as AcademyHomeComponent so both sections look
// alike: the carnet (the thing to pay/act on) and the class schedule. Seeded once from the carnet: an active
// carnet pushes it below the schedule and opens the schedule (nothing to act on), anything else keeps the
// carnet on top and open. After seeding the user's own clicks are left alone (see AcademyHomeComponent for
// why the binding isn't kept live).
@Component({
  selector: 'app-fitness-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [IonAccordionGroup, IonAccordion, IonItem, IonLabel, TranslatePipe, FitnessCarnetComponent, FitnessScheduleComponent],
  templateUrl: './fitness-home.html',
  styleUrl: './fitness-home.scss'
})
export class FitnessHomeComponent {
  protected readonly carnetCmp = viewChild.required(FitnessCarnetComponent);

  // true = schedule open, false = carnet open.
  protected readonly scheduleExpanded = signal(true);
  private seeded = false;

  constructor() {
    effect(() => {
      if (this.seeded) {
        return;
      }
      const carnet = this.carnetCmp();
      if (!carnet.resolved()) {
        return;
      }
      this.scheduleExpanded.set(carnet.isActive());
      this.seeded = true;
    });
  }

  // Same single-open rule as AcademyHomeComponent.onPanelChange.
  protected onPanelChange(event: Event): void {
    if (event.target !== event.currentTarget) {
      return;
    }
    const value = (event as CustomEvent<{ value?: string | string[] | null }>).detail.value;
    this.scheduleExpanded.set(value ? value === 'schedule' : !this.scheduleExpanded());
  }
}
