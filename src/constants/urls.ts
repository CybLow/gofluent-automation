export function urls(domain: string) {
  const base = `https://${domain}.gofluent.com`;
  return {
    SAML_CONNECTOR: 'https://portal.gofluent.com/login/samlconnector',
    DASHBOARD: `${base}/app/dashboard`,
    PROFILE: `${base}/app/profile`,
    TRAINING: `${base}/app/training`,
    VOCABULARY: `${base}/app/dashboard/resources/vocabulary`,
    GRAMMAR: `${base}/app/dashboard/resources/grammar`,
    ARTICLE: `${base}/app/dashboard/resources/article`,
    VIDEO: `${base}/app/dashboard/resources/video`,
    HOWTO: `${base}/app/dashboard/resources/howto`,
    BASE: base,
  } as const;
}

export type Urls = ReturnType<typeof urls>;

export type ActivityCategory = 'vocabulary' | 'grammar' | 'article' | 'video' | 'howto';

export function getCategoryUrl(siteUrls: Urls, category: ActivityCategory): string {
  const map: Record<ActivityCategory, string> = {
    vocabulary: siteUrls.VOCABULARY,
    grammar: siteUrls.GRAMMAR,
    article: siteUrls.ARTICLE,
    video: siteUrls.VIDEO,
    howto: siteUrls.HOWTO,
  };
  return map[category];
}
