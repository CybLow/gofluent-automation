import type { Browser } from 'playwright';

export interface IBrowserLauncher {
  launch(): Promise<Browser>;
}
