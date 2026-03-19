// ─────────────────────────────────────────────────────────────
// Question Normalizer
// Converts any question shape (catquestions OR questions table)
// into one canonical NormalizedQuestion format used by ExamEngine
// ─────────────────────────────────────────────────────────────

export interface NormalizedOption {
  id: string;       // 'A' | 'B' | 'C' | 'D'
  text: string;     // display text
  image_url?: string;
  is_correct: boolean;
}

export interface NormalizedQuestion {
  id: string;
  question_text: string;
  question_image_url?: string;
  question_type: 'mcq' | 'numerical' | 'multiple_correct' | 'tita';
  difficulty?: string;
  subject?: string;
  chapter?: string;
  topic?: string;
  options: NormalizedOption[];       // normalized options
  correct_option: string;            // 'A' | 'B' | 'C' | 'D' or numerical answer string
  numerical_answer?: number;
  positive_marks: number;
  negative_marks: number;
  solution_text?: string;
  solution_image_url?: string;
  explanation?: string;
}

export interface NormalizedSetInfo {
  id: string;
  title: string;
  duration_mins: number;
  passage_text?: string;
  image_url?: string;
  exam_name?: string;
  /** CAT section: 'qa' | 'dilr' | 'varc' — from catquestion_sets.subject_section */
  subject_section?: string;
  /** Module/chapter label — from catquestion_sets.module */
  module?: string;
  /** true when the test came from the contests table */
  isContest?: boolean;
}

// ── Normalize a single question from either schema ──────────
export function normalizeQuestion(q: any): NormalizedQuestion {
  // Detect which schema we have
  // catquestions schema: q.options = [{ id: 'A', t: 'text' }], q.correct_option = 'A'
  // questions table: q.question_options = [{ option_label: 'A', option_text: '...', is_correct: true }]

  let options: NormalizedOption[] = [];
  let correct_option = '';

  const rawOptions = q.question_options ?? q.options ?? [];

  if (Array.isArray(rawOptions) && rawOptions.length > 0) {
    const first = rawOptions[0];

    if ('option_label' in first || 'option_text' in first) {
      // ── New schema (questions table, admin panel) ──────────
      // question_options: { option_label, option_text, is_correct, option_image_url }
      const sorted = [...rawOptions].sort((a: any, b: any) =>
        (a.option_order ?? 0) - (b.option_order ?? 0)
      );
      options = sorted.map((o: any) => ({
        id: o.option_label ?? String.fromCharCode(65 + sorted.indexOf(o)),
        text: o.option_text ?? '',
        image_url: o.option_image_url ?? undefined,
        is_correct: o.is_correct === true,
      }));
      // Derive correct_option from is_correct flag
      const correctOpt = options.find(o => o.is_correct);
      correct_option = correctOpt?.id ?? q.correct_option ?? '';

    } else if ('id' in first || 't' in first) {
      // ── Legacy schema (catquestions) ──────────────────────
      // options: [{ id: 'A', t: 'text' }], q.correct_option = 'A'
      options = rawOptions.map((o: any) => ({
        id: o.id ?? o.option_label ?? '',
        text: o.t ?? o.text ?? o.option_text ?? '',
        image_url: o.image_url ?? undefined,
        is_correct: o.id === q.correct_option,
      }));
      correct_option = q.correct_option ?? '';

    } else {
      // Unknown — try best-effort
      options = rawOptions.map((o: any, i: number) => ({
        id: o.id ?? o.option_label ?? String.fromCharCode(65 + i),
        text: o.t ?? o.text ?? o.option_text ?? '',
        is_correct: o.is_correct ?? (o.id === q.correct_option),
      }));
      correct_option = q.correct_option ?? (options.find(o => o.is_correct)?.id ?? '');
    }
  }

  // For numerical questions, use the numerical_answer
  const isNumerical = q.question_type === 'numerical' || q.question_type === 'tita';
  if (isNumerical && q.numerical_answer != null) {
    correct_option = String(q.numerical_answer);
  }

  // Derive solution from either question_solutions array or direct fields
  const solutionObj = Array.isArray(q.question_solutions)
    ? q.question_solutions[0]
    : null;

  return {
    id: q.id,
    question_text: q.question_text ?? q.question ?? '',
    question_image_url: q.question_image_url ?? q.image_url ?? undefined,
    question_type: q.question_type ?? 'mcq',
    difficulty: q.difficulty ?? undefined,
    subject: q.subject ?? undefined,
    chapter: q.chapter ?? undefined,
    topic: q.topic ?? undefined,
    options,
    correct_option,
    numerical_answer: q.numerical_answer ?? undefined,
    positive_marks: q.positive_marks ?? 3,
    negative_marks: q.negative_marks ?? 1,
    solution_text: solutionObj?.solution_text ?? q.solution_text ?? q.explanation ?? undefined,
    solution_image_url: solutionObj?.solution_image_url ?? q.solution_image_url ?? undefined,
    explanation: q.explanation ?? solutionObj?.solution_text ?? undefined,
  };
}

export function normalizeQuestions(questions: any[]): NormalizedQuestion[] {
  return questions.map(normalizeQuestion);
}

export function normalizeSetInfo(info: any, isContest = false): NormalizedSetInfo {
  return {
    id:              info?.id ?? '',
    title:           info?.title ?? info?.subject_section ?? 'Test',
    duration_mins:   info?.duration_mins ?? info?.duration_minutes ?? 0,
    passage_text:    info?.passage_text ?? undefined,
    image_url:       info?.image_url ?? undefined,
    exam_name:       info?.exam_name ?? info?.exams?.display_name ?? undefined,
    subject_section: info?.subject_section ?? undefined,
    module:          info?.module ?? undefined,
    isContest,
  };
}
