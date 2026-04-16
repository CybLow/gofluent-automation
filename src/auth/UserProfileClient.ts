import { UUID_REGEX } from '@/constants';
import type { ILogger } from '@/infra/logging/ILogger';

export class UserProfileClient {
  constructor(
    private readonly siteBase: string,
    private readonly logger: ILogger,
  ) {}

  async fetchUserId(token: string): Promise<string> {
    this.logger.debug('Fetching userId via /learner-preferences/user-profile/');
    const resp = await fetch(`${this.siteBase}/api/v1/learner-preferences/user-profile/`, {
      headers: { Authorization: token },
      redirect: 'follow',
    });
    if (!resp.ok) return '';
    const fromBody = await this.parseBody(resp);
    if (fromBody) return fromBody;
    const match = UUID_REGEX.exec(resp.url);
    return match ? match[0] : '';
  }

  private async parseBody(resp: Response): Promise<string> {
    try {
      const body = await resp.clone().json().catch(() => null) as
        { uuid?: string; id?: string; userUuid?: string } | null;
      const candidate = body?.uuid || body?.id || body?.userUuid;
      if (typeof candidate === 'string' && UUID_REGEX.test(candidate)) return candidate;
    } catch { /* ignore */ }
    return '';
  }
}
