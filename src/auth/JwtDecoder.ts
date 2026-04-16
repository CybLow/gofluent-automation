interface JwtPayload {
  sub?: string;
  uuid?: string;
  userId?: string;
  exp?: number;
}

export class JwtDecoder {
  decode(jwt: string): JwtPayload {
    try {
      const raw = jwt.replaceAll(/^Bearer\s+/gi, '');
      const segment = raw.split('.')[1];
      if (!segment) return {};
      return JSON.parse(Buffer.from(segment, 'base64').toString()) as JwtPayload;
    } catch {
      return {};
    }
  }

  extractUserId(jwt: string): string {
    const p = this.decode(jwt);
    return p.sub || p.uuid || p.userId || '';
  }

  extractExpiry(jwt: string, fallbackSeconds: number): number {
    const p = this.decode(jwt);
    return typeof p.exp === 'number' ? p.exp : fallbackSeconds;
  }
}
