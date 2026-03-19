'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import {
  ArrowLeft, FileText, Video, HelpCircle, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, RotateCcw, Lightbulb, Clock,
  Calculator, Network, BookOpen, ExternalLink
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────
interface StudyTopic {
  id: string; subject_section: string; module: string; topic: string;
  description: string | null; difficulty: string;
  pdf_url: string | null; video_url: string | null; video_type: string;
  estimated_mins: number;
}

interface StudyQuestion {
  id: string; question_text: string; question_image_url: string | null;
  question_type: string; options: { id: string; t: string }[] | null;
  correct_option: string; difficulty: string;
  solution_text: string | null; solution_image_url: string | null;
  order_index: number;
}

// ─── Helpers ───────────────────────────────────────────────────
const SECTIONS: Record<string, { color: string; bg: string; border: string; icon: any; label: string }> = {
  qa:   { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: Calculator, label: 'Quants' },
  dilr: { color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: Network,    label: 'DILR'   },
  varc: { color: 'text-emerald-400',bg: 'bg-emerald-500/10',border: 'border-emerald-500/20',icon: BookOpen,   label: 'Verbal' },
};

function RenderText({ text }: { text: string }) {
  if (!text) return null;
  return (
    <>
      {text.split(/(\$.*?\$)/g).map((p, i) =>
        p.startsWith('$') && p.endsWith('$')
          ? <InlineMath key={i} math={p.slice(1, -1)} />
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

function extractYoutubeId(url: string) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}

// ─── Tab: PDF ──────────────────────────────────────────────────
function PdfTab({ url, topic }: { url: string | null; topic?: string }) {
  const [zoom,    setZoom]    = useState(100);
  const [loading, setLoading] = useState(true);
  const [errored, setErrored] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Clamp zoom
  const zoomIn  = () => setZoom(z => Math.min(z + 15, 200));
  const zoomOut = () => setZoom(z => Math.max(z - 15, 50));

  if (!url) return (
    <div className="flex flex-col items-center justify-center py-28 gap-5">
      {/* Empty state — styled */}
      <div className="relative">
        <div className="w-20 h-24 rounded-2xl border-2 border-dashed border-white/10 flex items-center justify-center bg-white/[0.02]">
          <FileText size={32} className="text-white/20" />
        </div>
        <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-[#111] border border-white/10 flex items-center justify-center">
          <span className="text-white/30 text-xs font-black">?</span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-white/40 font-bold text-sm">No PDF notes yet</p>
        <p className="text-white/20 text-xs mt-1">The admin hasn't uploaded study material for this topic.</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col gap-0 rounded-3xl overflow-hidden border border-white/[0.08] bg-[#0d0e18]"
      style={{ boxShadow: '0 0 0 1px rgba(255,255,255,0.04), 0 24px 64px rgba(0,0,0,0.5)' }}>

      {/* ── Reader toolbar ── */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.06] bg-[#10111e]">
        {/* Left — title */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-red-500/15 border border-red-500/20 flex items-center justify-center flex-shrink-0">
            <FileText size={14} className="text-red-400" />
          </div>
          <div className="min-w-0">
            <p className="text-white text-xs font-black truncate">{topic ?? 'Study Notes'}</p>
            <p className="text-white/30 text-[10px]">PDF document</p>
          </div>
        </div>

        {/* Center — zoom controls */}
        <div className="flex items-center gap-1.5 bg-white/[0.04] border border-white/[0.07] rounded-xl px-2 py-1.5">
          <button onClick={zoomOut} disabled={zoom <= 50}
            className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition disabled:opacity-30 text-white/60 hover:text-white font-black text-base leading-none">
            −
          </button>
          <span className="text-white/60 text-[11px] font-black w-9 text-center tabular-nums">{zoom}%</span>
          <button onClick={zoomIn} disabled={zoom >= 200}
            className="w-6 h-6 rounded-lg hover:bg-white/10 flex items-center justify-center transition disabled:opacity-30 text-white/60 hover:text-white font-black text-base leading-none">
            +
          </button>
        </div>

        {/* Right — actions */}
        <div className="flex items-center gap-2">
          <button onClick={() => { setLoading(true); setErrored(false); if (iframeRef.current) iframeRef.current.src = iframeRef.current.src; }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black text-white/40 hover:text-white bg-white/[0.04] border border-white/[0.07] hover:bg-white/[0.08] transition">
            ↺ Reload
          </button>
          <a href={url} target="_blank" rel="noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[10px] font-black text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 transition">
            <ExternalLink size={10} /> Open
          </a>
        </div>
      </div>

      {/* ── PDF frame ── */}
      <div className="relative" style={{ height: 720 }}>

        {/* Loading shimmer */}
        {loading && !errored && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0d0e18] gap-5">
            {/* Animated page stack */}
            <div className="relative w-16 h-20">
              {[2,1,0].map(i => (
                <div key={i} className="absolute inset-0 rounded-xl border border-white/[0.08] bg-white/[0.03]"
                  style={{
                    transform: `translateY(${i * -4}px) translateX(${i * 2}px) rotate(${i * -1.5}deg)`,
                    opacity: 1 - i * 0.25,
                  }}
                />
              ))}
              <div className="absolute inset-0 flex items-center justify-center">
                <FileText size={22} className="text-white/20" />
              </div>
            </div>
            <div className="flex flex-col items-center gap-2">
              <p className="text-white/40 text-xs font-bold">Loading PDF…</p>
              {/* Animated dots */}
              <div className="flex gap-1.5">
                {[0,1,2].map(i => (
                  <div key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400/50"
                    style={{ animation: `pulse 1.2s ease-in-out ${i * 0.2}s infinite` }} />
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Error state */}
        {errored && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0d0e18] gap-5">
            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
              <span className="text-2xl">📄</span>
            </div>
            <div className="text-center">
              <p className="text-white/60 font-bold text-sm mb-1">Can't preview in browser</p>
              <p className="text-white/30 text-xs mb-4">This PDF can't be embedded.<br/>Open it directly to read.</p>
              <a href={url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-xs transition">
                <ExternalLink size={12} /> Open PDF
              </a>
            </div>
          </div>
        )}

        {/* The iframe — zoomed via CSS scale */}
        <div className="w-full h-full overflow-auto bg-[#0d0e18]"
          style={{ scrollbarWidth: 'thin', scrollbarColor: '#333 transparent' }}>
          <div style={{
            width: zoom === 100 ? '100%' : `${zoom}%`,
            minHeight: '100%',
            transition: 'width 0.3s ease',
            margin: zoom > 100 ? '0' : '0 auto',
          }}>
            <iframe
              ref={iframeRef}
              src={`${url}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
              className="w-full border-none"
              style={{ height: 720, display: errored ? 'none' : 'block' }}
              title="Study PDF"
              onLoad={() => setLoading(false)}
              onError={() => { setLoading(false); setErrored(true); }}
            />
          </div>
        </div>
      </div>

      {/* ── Bottom bar ── */}
      <div className="flex items-center justify-between px-5 py-2.5 border-t border-white/[0.06] bg-[#10111e]">
        <p className="text-white/20 text-[10px] font-bold">
          💡 Tip: Use Ctrl + scroll to zoom in your browser, or use the controls above
        </p>
        <a href={url} download
          className="text-[10px] text-white/30 hover:text-white/60 font-bold transition flex items-center gap-1">
          ↓ Download
        </a>
      </div>
    </div>
  );
}

// ─── Tab: Video ────────────────────────────────────────────────
function VideoTab({ url, type }: { url: string | null; type: string }) {
  if (!url) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-600">
      <Video size={40} className="mb-3 opacity-40" />
      <p className="font-bold">No video available for this topic.</p>
    </div>
  );
  const isYoutube = type === 'youtube' || url.includes('youtube.com') || url.includes('youtu.be');
  return (
    <div className="flex flex-col gap-4">
      <p className="text-gray-500 text-xs font-bold">{isYoutube ? 'YouTube lecture' : 'Video lecture'}</p>
      <div className="rounded-2xl overflow-hidden border border-white/[0.07] aspect-video bg-black">
        {isYoutube ? (
          <iframe
            src={`https://www.youtube.com/embed/${extractYoutubeId(url)}?rel=0&modestbranding=1`}
            className="w-full h-full" allowFullScreen title="Video lecture" />
        ) : (
          <video src={url} controls className="w-full h-full" />
        )}
      </div>
      <a href={url} target="_blank" rel="noreferrer"
        className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold w-fit transition">
        Open in new tab <ExternalLink size={12} />
      </a>
    </div>
  );
}

// ─── Tab: Practice ─────────────────────────────────────────────
function PracticeTab({ questions }: { questions: StudyQuestion[] }) {
  const [idx,         setIdx]         = useState(0);
  const [selected,    setSelected]    = useState<string>('');
  const [submitted,   setSubmitted]   = useState(false);
  const [showSol,     setShowSol]     = useState(false);
  const [results,     setResults]     = useState<Record<string, 'correct'|'wrong'|null>>({});
  const [sessionDone, setSessionDone] = useState(false);

  if (questions.length === 0) return (
    <div className="flex flex-col items-center justify-center py-20 text-gray-600">
      <HelpCircle size={40} className="mb-3 opacity-40" />
      <p className="font-bold">No practice questions yet for this topic.</p>
      <p className="text-sm mt-1">Check back after the admin adds questions.</p>
    </div>
  );

  const q = questions[idx];
  const isCorrect  = selected === q.correct_option;
  const answered   = Object.keys(results).length;
  const correctCnt = Object.values(results).filter(r => r === 'correct').length;

  function submit() {
    if (!selected) return;
    const r = selected === q.correct_option ? 'correct' : 'wrong';
    setResults(prev => ({ ...prev, [q.id]: r }));
    setSubmitted(true);
  }

  function next() {
    if (idx < questions.length - 1) {
      setIdx(i => i + 1);
      setSelected('');
      setSubmitted(false);
      setShowSol(false);
    } else {
      setSessionDone(true);
    }
  }

  function reset() {
    setIdx(0); setSelected(''); setSubmitted(false);
    setShowSol(false); setResults({}); setSessionDone(false);
  }

  // Summary screen
  if (sessionDone) return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-6">
      <div className="w-20 h-20 rounded-3xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center">
        <span className="text-4xl">🎉</span>
      </div>
      <div>
        <h2 className="text-white font-black text-2xl mb-2">Practice Complete!</h2>
        <p className="text-gray-500 text-sm">
          You scored <span className="text-white font-black">{correctCnt}</span> out of{' '}
          <span className="text-white font-black">{questions.length}</span>
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4 w-full max-w-xs">
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-emerald-400">{correctCnt}</p>
          <p className="text-gray-600 text-[10px] uppercase tracking-widest mt-0.5">Correct</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-rose-400">{answered - correctCnt}</p>
          <p className="text-gray-600 text-[10px] uppercase tracking-widest mt-0.5">Wrong</p>
        </div>
        <div className="bg-white/[0.03] border border-white/[0.07] rounded-2xl p-4 text-center">
          <p className="text-2xl font-black text-indigo-400">{Math.round((correctCnt/questions.length)*100)}%</p>
          <p className="text-gray-600 text-[10px] uppercase tracking-widest mt-0.5">Score</p>
        </div>
      </div>
      <button onClick={reset}
        className="flex items-center gap-2 px-8 py-3.5 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black transition">
        <RotateCcw size={16} />Practice Again
      </button>
    </div>
  );

  return (
    <div className="max-w-2xl mx-auto">
      {/* Progress */}
      <div className="flex items-center justify-between mb-6">
        <span className="text-gray-500 text-xs font-bold">Question {idx + 1} of {questions.length}</span>
        <div className="flex gap-1.5">
          {questions.map((qq, i) => (
            <div key={qq.id} className={`h-1.5 rounded-full transition-all ${
              i < idx ? (results[qq.id] === 'correct' ? 'bg-emerald-500 w-5' : 'bg-rose-500 w-5')
              : i === idx ? 'bg-indigo-500 w-8' : 'bg-white/10 w-5'
            }`} />
          ))}
        </div>
        <span className={`text-xs font-black ${
          q.difficulty === 'easy' ? 'text-emerald-400' : q.difficulty === 'hard' ? 'text-rose-400' : 'text-amber-400'
        }`}>{q.difficulty}</span>
      </div>

      {/* Question */}
      <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6 mb-4">
        {q.question_image_url && (
          <img src={q.question_image_url} alt="Question" className="max-h-52 rounded-2xl mb-4 object-contain border border-white/[0.07]" />
        )}
        <p className="text-white text-base leading-relaxed font-medium">
          <RenderText text={q.question_text} />
        </p>

        {/* No negative marking banner */}
        <div className="mt-3 flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-500/5 border border-emerald-500/15 px-3 py-1.5 rounded-full w-fit">
          ✅ No negative marking — attempt freely
        </div>
      </div>

      {/* Options / TITA */}
      {q.question_type === 'tita' ? (
        <div className="mb-4">
          <input
            type="text" inputMode="decimal" value={selected}
            onChange={e => setSelected(e.target.value)}
            disabled={submitted}
            placeholder="Type your numerical answer…"
            className="w-full bg-white/[0.03] border border-white/[0.07] rounded-2xl px-5 py-4 text-white text-lg font-mono outline-none focus:border-indigo-500/40 transition disabled:opacity-60"
          />
        </div>
      ) : (
        <div className="space-y-2.5 mb-4">
          {(q.options ?? []).map(opt => {
            const isSelected = selected === opt.id;
            const isRight    = submitted && opt.id === q.correct_option;
            const isWrong    = submitted && isSelected && opt.id !== q.correct_option;
            return (
              <button key={opt.id} disabled={submitted} onClick={() => setSelected(opt.id)}
                className={`w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all ${
                  isRight  ? 'bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30' :
                  isWrong  ? 'bg-rose-500/10 border-rose-500/40 ring-1 ring-rose-500/30' :
                  isSelected ? 'bg-indigo-500/10 border-indigo-500/40 ring-1 ring-indigo-500/30' :
                  'bg-white/[0.03] border-white/[0.07] hover:border-white/[0.15] hover:bg-white/[0.05]'
                } disabled:cursor-default`}>
                <span className={`w-8 h-8 rounded-xl text-xs font-black flex-shrink-0 flex items-center justify-center ${
                  isRight ? 'bg-emerald-500 text-white' : isWrong ? 'bg-rose-500 text-white' :
                  isSelected ? 'bg-indigo-600 text-white' : 'bg-white/5 text-gray-400'
                }`}>{opt.id}</span>
                <span className="text-gray-200 text-sm leading-relaxed flex-1 pt-0.5">
                  <RenderText text={opt.t} />
                </span>
                {isRight && <CheckCircle2 size={18} className="text-emerald-400 flex-shrink-0 mt-0.5" />}
                {isWrong && <XCircle size={18} className="text-rose-400 flex-shrink-0 mt-0.5" />}
              </button>
            );
          })}
        </div>
      )}

      {/* Feedback after submit */}
      {submitted && (
        <div className={`rounded-2xl p-4 mb-4 border ${
          (q.question_type === 'tita'
            ? Math.abs(parseFloat(selected) - parseFloat(q.correct_option)) <= 0.01
            : selected === q.correct_option)
            ? 'bg-emerald-500/8 border-emerald-500/20'
            : 'bg-rose-500/8 border-rose-500/20'
        }`}>
          <p className={`text-sm font-black mb-1 ${
            (q.question_type === 'tita'
              ? Math.abs(parseFloat(selected) - parseFloat(q.correct_option)) <= 0.01
              : selected === q.correct_option)
              ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {(q.question_type === 'tita'
              ? Math.abs(parseFloat(selected) - parseFloat(q.correct_option)) <= 0.01
              : selected === q.correct_option)
              ? '✓ Correct!' : `✗ Incorrect — Answer: ${q.correct_option}`}
          </p>

          {/* Solution toggle */}
          {(q.solution_text || q.solution_image_url) && (
            <button onClick={() => setShowSol(s => !s)}
              className="flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold mt-2 transition">
              <Lightbulb size={12} />
              {showSol ? 'Hide solution' : 'Show solution'}
            </button>
          )}
          {showSol && (
            <div className="mt-3 pt-3 border-t border-white/[0.07]">
              {q.solution_text && (
                <p className="text-gray-300 text-sm leading-relaxed">
                  <RenderText text={q.solution_text} />
                </p>
              )}
              {q.solution_image_url && (
                <img src={q.solution_image_url} alt="Solution" className="mt-3 max-h-48 rounded-xl object-contain" />
              )}
            </div>
          )}
        </div>
      )}

      {/* Action buttons */}
      <div className="flex items-center justify-between gap-3">
        <button onClick={() => { if (idx > 0) { setIdx(i => i-1); setSelected(''); setSubmitted(false); setShowSol(false); } }}
          disabled={idx === 0}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-white/[0.03] border border-white/[0.07] text-gray-400 text-sm font-bold hover:text-white hover:bg-white/[0.07] disabled:opacity-30 transition">
          <ChevronLeft size={15} />Prev
        </button>

        {!submitted ? (
          <button onClick={submit} disabled={!selected}
            className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition disabled:opacity-40">
            Check Answer
          </button>
        ) : (
          <button onClick={next}
            className="flex-1 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm transition">
            {idx < questions.length - 1 ? 'Next Question →' : 'Finish Practice 🎉'}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── MAIN PAGE ─────────────────────────────────────────────────
const TABS = [
  { id: 'pdf',      label: 'PDF',      icon: FileText   },
  { id: 'video',    label: 'Video',    icon: Video      },
  { id: 'practice', label: 'Practice', icon: HelpCircle },
] as const;

export default function StudyTopicPage() {
  const supabase = useMemo(() => createClient(), []);
  const router   = useRouter();
  const { id }   = useParams<{ id: string }>();

  const [topic,     setTopic]     = useState<StudyTopic | null>(null);
  const [questions, setQuestions] = useState<StudyQuestion[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [tab,       setTab]       = useState<'pdf'|'video'|'practice'>('pdf');

  // Auth guard — middleware protects /study prefix, but validate here too
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) router.replace('/login');
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: t } = await supabase.from('study_topics').select('*').eq('id', id).single();
      if (!t) { router.replace('/study'); return; }
      setTopic(t);

      const { data: qs } = await supabase
        .from('study_questions')
        .select('*')
        .eq('topic_id', id)
        .order('order_index', { ascending: true });
      setQuestions(qs ?? []);
      setLoading(false);

      // Auto-select first available tab
      if (!t.pdf_url && t.video_url) setTab('video');
      else if (!t.pdf_url && !t.video_url) setTab('practice');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, supabase, router]);

  if (loading) return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );
  if (!topic) return null;

  const sec = SECTIONS[topic.subject_section] ?? SECTIONS.qa;

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      <div className="fixed inset-0 z-0 opacity-[0.022]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />

      <div className="relative z-10 max-w-5xl mx-auto px-4 md:px-8 py-8">

        {/* Header */}
        <div className="flex items-start gap-4 mb-8">
          <button onClick={() => router.push('/study')}
            className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition flex-shrink-0 mt-0.5">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`text-[10px] font-black uppercase tracking-widest ${sec.color}`}>{sec.label}</span>
              <span className="text-gray-700">·</span>
              <span className="text-gray-500 text-[10px] font-bold">{topic.module}</span>
            </div>
            <h1 className="text-2xl font-black tracking-tight">{topic.topic}</h1>
            {topic.description && (
              <p className="text-gray-500 text-sm mt-1">{topic.description}</p>
            )}
          </div>
          <span className="flex items-center gap-1.5 text-gray-600 text-xs font-bold flex-shrink-0">
            <Clock size={12} />{topic.estimated_mins}m
          </span>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-8 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-1.5 w-fit">
          {TABS.map(t => {
            const hasContent =
              t.id === 'pdf'      ? !!topic.pdf_url :
              t.id === 'video'    ? !!topic.video_url :
              questions.length > 0;
            return (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all relative ${
                  tab === t.id
                    ? 'bg-indigo-600 text-white shadow-[0_0_12px_rgba(99,102,241,0.3)]'
                    : `text-gray-500 hover:text-gray-300 ${!hasContent ? 'opacity-40' : ''}`
                }`}>
                <t.icon size={13} />
                {t.label}
                {t.id === 'practice' && questions.length > 0 && (
                  <span className="text-[9px] bg-indigo-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                    {questions.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab content */}
        {tab === 'pdf'      && <PdfTab      url={topic.pdf_url} topic={topic.topic} />}
        {tab === 'video'    && <VideoTab    url={topic.video_url} type={topic.video_type} />}
        {tab === 'practice' && <PracticeTab questions={questions} />}

      </div>
    </div>
  );
}
