export interface Question {
  id: string;
  questionType?: string;
  questionSubType?: string;
  solutions?: string[];
  receivers?: { solutions?: string[] }[];
  metadata?: { teachingConcepts?: string[] };
}

export class QuestionScanner {
  scan(obj: unknown): Question[] {
    const out: Question[] = [];
    this.walk(obj, out, new Set());
    return out;
  }

  has(obj: unknown): boolean {
    const probe: Question[] = [];
    this.walk(obj, probe, new Set());
    return probe.length > 0;
  }

  private walk(obj: unknown, out: Question[], seen: Set<unknown>): void {
    if (!obj || typeof obj !== 'object' || seen.has(obj)) return;
    seen.add(obj);
    const node = obj as Record<string, unknown> & Partial<Question>;
    if (node.questionType && node.id) out.push(node as Question);
    for (const v of Object.values(node)) {
      if (Array.isArray(v)) v.forEach(item => this.walk(item, out, seen));
      else if (v && typeof v === 'object') this.walk(v, out, seen);
    }
  }
}
