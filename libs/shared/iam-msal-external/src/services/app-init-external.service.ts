import { Injectable } from '@angular/core';
import { enableProdMode } from '@angular/core';
import { ExternalConfigService } from './external-config.service';
import { tap, firstValueFrom } from 'rxjs';
import { AppConfigWithExternal } from '../interfaces/external-config.interface';

@Injectable({
  providedIn: 'root'
})
export class AppInitService {
  
  constructor(
    private configService: ExternalConfigService
  ) {}

  public init(): () => Promise<any> {
    return async () => {
      try {
        console.log('🚀 Starting application initialization...');
        console.log('�� Loading External (CIAM) configuration from API...');
        
        const configResponse = await firstValueFrom(
          this.configService.loadConfig().pipe(
            tap(config => {
              console.log('📥 Received External (CIAM) configuration response:', config);
              console.log('🔍 Validating External config:', config?.body);
              this.tryToEnableProdMode(config?.body);
            })
          )
        );
        
        console.log('✅ External (CIAM) configuration loaded and validated successfully');
        console.log('📋 Configuration received in AppInit:', configResponse?.body);
        
        return configResponse;
      } catch (error) {
        console.error('❌ Failed to initialize application:', error);
        console.error('📋 Config service state:', {
          hasConfig: !!this.configService.getConfig(),
          config: this.configService.getConfig()
        });
        
        throw error;
      }
    };
  }

  private tryToEnableProdMode(config: AppConfigWithExternal | null | undefined): void {
    if (!!config?.production) {
      enableProdMode();
    }
  }
}
