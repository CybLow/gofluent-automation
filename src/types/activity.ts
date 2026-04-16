export type ActivityCategory = 'vocabulary' | 'grammar' | 'article' | 'video' | 'howto';

export const ALL_CATEGORIES: ActivityCategory[] = ['vocabulary', 'grammar', 'article', 'video', 'howto'];

export const CATEGORY_TARGET_TYPE: Record<ActivityCategory, string> = {
  vocabulary: 'glossary',
  grammar: 'rules',
  article: 'article',
  video: 'video',
  howto: 'practical-guide',
};

export interface ActivityInfo {
  contentUuid: string;
  url: string;
  date: Date;
  score: number | null;
  title: string;
  contentType: string;
}
