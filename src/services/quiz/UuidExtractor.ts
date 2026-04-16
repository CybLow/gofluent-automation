import { UUID_REGEX } from '@/constants';

export class UuidExtractor {
  static extract(input: string): string | null {
    const m = UUID_REGEX.exec(input);
    return m ? m[0] : null;
  }

  static isUuid(input: string): boolean {
    return /^[0-9a-f-]{36}$/i.test(input);
  }
}
