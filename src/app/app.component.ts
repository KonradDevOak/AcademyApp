import { Component } from '@angular/core';
import { IonApp, IonRouterOutlet } from '@ionic/angular/standalone';
import { ClubBackgroundComponent } from './components/club-background/club-background.component';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  imports: [IonApp, IonRouterOutlet, ClubBackgroundComponent],
})
export class AppComponent {}
