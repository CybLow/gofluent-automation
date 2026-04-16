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
  questions: CachedQuestion[] = [];

  constructor(url: string, date: Date | null = null) {
    this.url = url;
    this.date = date;
  }

  getQuestion(questionStr: string): CachedQuestion | null {
    return this.questions.find(q => q.questionStr === questionStr) ?? null;
  }
}
