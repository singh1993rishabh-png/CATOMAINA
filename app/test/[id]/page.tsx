import { createClient } from '../../utils/supabase/server';
import { notFound } from 'next/navigation';
import { normalizeQuestions, normalizeSetInfo } from '../../utils/normalizeQuestion';
import ExamEngine from '../../components/ExamEngine';

export default async function TestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  // ── Path 1: contests table (linked from dashboard / active contests) ────
  const { data: contest } = await supabase
    .from('contests')
    .select('*, exams(name, display_name, icon)')
    .eq('id', id)
    .single();

  if (contest) {
    const { data: rawQuestions } = await supabase
      .from('questions')
      .select('*, question_options(*), question_solutions(*)')
      .eq('contest_id', id)
      .order('question_number', { ascending: true });

    if (!rawQuestions || rawQuestions.length === 0) {
      // Contest exists but has no questions yet — show a helpful message
      return (
        <div className="min-h-screen bg-[#060608] flex items-center justify-center text-white p-8">
          <div className="text-center space-y-4 max-w-md">
            <div className="text-5xl">📋</div>
            <h1 className="text-2xl font-black">{contest.title}</h1>
            <p className="text-gray-500 text-sm leading-relaxed">
              This contest has no questions yet. An admin needs to add questions via the Admin Panel before the test can begin.
            </p>
            <a href="/dashboard" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 border border-white/15 text-white font-bold text-sm hover:bg-white/15 transition">
              ← Back to Dashboard
            </a>
          </div>
        </div>
      );
    }

    const questions = normalizeQuestions(rawQuestions);
    const setInfo = normalizeSetInfo({
      id: contest.id,
      title: contest.title,
      duration_mins: contest.duration_minutes,
      exam_name: contest.exams?.display_name ?? contest.exams?.name,
    }, true); // isContest=true → saves to contest_results for leaderboard

    return <ExamEngine questions={questions} setInfo={setInfo} />;
  }

  // ── Path 2: catquestion_sets (legacy mock test sets) ────────────────────
  const { data: catSet } = await supabase
    .from('catquestion_sets')
    .select('*')
    .eq('id', id)
    .single();

  if (catSet) {
    const { data: rawQuestions } = await supabase
      .from('catquestions')
      .select('*')
      .eq('set_id', id)
      .order('order_index', { ascending: true });

    const questions = normalizeQuestions(rawQuestions ?? []);
    const setInfo = normalizeSetInfo(catSet);

    return <ExamEngine questions={questions} setInfo={setInfo} />;
  }

  // Neither found — 404
  return notFound();
}
