import { chromium, type Browser } from 'playwright';
import { platform } from 'node:os';
import type { ILogger } from '@/infra/logging/ILogger';
import type { IBrowserLauncher } from './IBrowserLauncher';

const LAUNCH_ARGS = ['--disable-blink-features=AutomationControlled'];

function preferredChannels(): string[] {
  switch (platform()) {
    case 'darwin': return ['chrome', 'msedge'];
    case 'win32': return ['msedge', 'chrome'];
    default: return ['chrome'];
  }
}

export class PlaywrightLauncher implements IBrowserLauncher {
  constructor(private readonly logger: ILogger) {}

  async launch(): Promise<Browser> {
    const os = platform();
    for (const channel of preferredChannels()) {
      try {
        const browser = await chromium.launch({ headless: true, channel, args: LAUNCH_ARGS });
        this.logger.debug(`System browser: ${channel} (${os})`);
        return browser;
      } catch { /* fall through */ }
    }
    this.logger.debug(`Bundled Chromium (${os})`);
    return chromium.launch({ headless: true, args: LAUNCH_ARGS });
  }
}
