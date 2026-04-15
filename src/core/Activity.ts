import type { SectionData } from '../types.js';

export interface CachedQuestion {
  questionStr: string;
  correctAnswer: string[] | null;
  cacheUsed: boolean;
  firstUse: boolean;
  skipCompletion: boolean;
}

export class Activity {
  url: string;
  date: Date | null;
  data: SectionData[] = [];
  questions: CachedQuestion[] = [];
  valid = true;

  constructor(url: string, date: Date | null = null) {
    this.url = url;
    this.date = date;
  }

  getQuestion(questionStr: string): CachedQuestion | null {
    return this.questions.find(q => q.questionStr === questionStr) ?? null;
  }

  asMarkdown(): string {
    const parts: string[] = [];

    for (const section of this.data) {
      switch (section.type) {
        case 'TITLE':
          this.renderTitle(section, parts);
          break;

        case 'SUMMARY':
          this.renderSummary(section, parts);
          break;

        case 'VOCABULARY_COLS_IMAGES':
        case 'VOCABULARY_ROWS_IMAGES':
        case 'VOCABULARY_ROWS':
          this.renderVocabulary(section, parts);
          break;
      }
    }

    return parts.join('\n\n');
  }

  private renderTitle(section: SectionData, parts: string[]): void {
    if (section.title) parts.push(`# ${section.title}`);
    if (section.description) parts.push(section.description);
  }

  private renderSummary(section: SectionData, parts: string[]): void {
    parts.push('## Summary');
    if (typeof section.data === 'string') {
      parts.push(section.data);
    }
  }

  private renderVocabulary(section: SectionData, parts: string[]): void {
    if (section.title) parts.push(`## ${section.title}`);
    if (section.definitions) {
      for (const def of section.definitions) {
        parts.push(`- **${def.key}**: ${def.value}`);
      }
    }
    if (Array.isArray(section.data)) {
      for (const item of section.data) {
        parts.push(`- ${item}`);
      }
    }
  }
}
