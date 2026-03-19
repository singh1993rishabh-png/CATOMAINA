'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { createClient } from '@/app/utils/supabase/client';
import {
  Trophy, Target, Zap, RotateCcw, ArrowLeft, CheckCircle2, XCircle, Crown, Medal,
  Clock, BookOpen, BarChart3, Brain, Minus, Eye, EyeOff,
  Layers, Award, Timer, Flame, Hash, Filter, Search, Home,
  TrendingUp, ChevronRight, Star
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface Summary {
  score: number; attempted: number; correct: number; wrong: number;
  skipped?: number; totalQuestions?: number; totalMarks?: number; timeTaken?: number;
}
interface QuestionResult {
  id: string | number;
  question_text?: string; question?: string;
  question_image_url?: string; question_type?: string;
  subject?: string; chapter?: string; topic?: string; difficulty?: string;
  options?: any[];
  correct_option?: string; correctAnswer?: string;
  userAnswer?: string; isCorrect: boolean; isAttempted: boolean;
  explanation?: string; solution_text?: string; solution_image_url?: string;
  positive_marks?: number; negative_marks?: number; timeSpent?: number;
}
interface SetInfo { title?: string; id?: string; contest_title?: string; exam_name?: string; }
interface Props {
  summary: Summary; questions: QuestionResult[]; setInfo: SetInfo;
  onReset: () => void; responses?: Record<string, any>; timeSpentMap?: Record<string, number>;
}

// ─── Helpers ──────────────────────────────────────────────────
function renderText(text: string) {
  if (!text) return null;
  return text.split(/(\$.*?\$)/g).map((p, i) =>
    p.startsWith('$') && p.endsWith('$') ? <InlineMath key={i} math={p.slice(1, -1)} /> : <span key={i}>{p}</span>
  );
}
function fmtTime(s: number) {
  if (!s || s < 0) return '—';
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec}s`;
  return `${sec}s`;
}
function pct(num: number, den: number) { return den === 0 ? 0 : Math.max(0, Math.min(100, Math.round((num / den) * 100))); }

// ─── 3D Card ──────────────────────────────────────────────────
function Card3D({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 6}deg) rotateX(${-y * 6}deg) translateZ(5px)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = 'perspective(900px) rotateY(0) rotateX(0) translateZ(0)'; };
  return <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={className} style={{ transition: 'transform 0.2s ease-out', willChange: 'transform' }}>{children}</div>;
}

// ─── Animated Ring ────────────────────────────────────────────
function Ring({ value, max = 100, size = 140, stroke = 11, color = '#facc15' }: any) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  // Clamp to [0, 100] — score can be negative if negative marking applies
  const pctVal = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  const [off, setOff] = useState(circ);
  useEffect(() => { const t = setTimeout(() => setOff(circ - (pctVal / 100) * circ), 150); return () => clearTimeout(t); }, [pctVal, circ]);
  return (
    <svg width={size} height={size} className="-rotate-90 absolute inset-0">
      <circle cx={size/2} cy={size/2} r={r} stroke="rgba(255,255,255,0.05)" strokeWidth={stroke} fill="none" />
      <circle cx={size/2} cy={size/2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 1.4s cubic-bezier(0.22,1,0.36,1)' }} />
    </svg>
  );
}

// ─── Counter ──────────────────────────────────────────────────
function Counter({ to, duration = 1200 }: { to: number; duration?: number }) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (to === 0) { setV(0); return; }
    let step = 0; const steps = 50, inc = to / steps;
    // Handle negative scores (net negative marking)
    const clamp = to >= 0 ? (n: number) => Math.min(to, Math.round(n + inc)) : (n: number) => Math.max(to, Math.round(n + inc));
    const t = setInterval(() => { step++; setV(clamp); if (step >= steps) { setV(to); clearInterval(t); } }, duration / steps);
    return () => clearInterval(t);
  }, [to, duration]);
  return <>{v}</>;
}

// ─── Progress Bar ─────────────────────────────────────────────
function ProgressBar({ value, max, color, delay = 0 }: { value: number; max: number; color: string; delay?: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = setTimeout(() => setW(pct(value, max)), 300 + delay); return () => clearTimeout(t); }, [value, max, delay]);
  return (
    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${w}%`, background: color }} />
    </div>
  );
}

// ─── Subject Breakdown ────────────────────────────────────────
function SubjectBreakdown({ questions }: { questions: QuestionResult[] }) {
  const subs = [...new Set(questions.map(q => q.subject).filter(Boolean))];
  if (subs.length === 0) return <p className="text-gray-700 text-xs text-center py-4">No subject data in questions.</p>;
  const data = subs.map(sub => {
    const qs = questions.filter(q => q.subject === sub);
    const correct = qs.filter(q => q.isCorrect).length;
    const wrong = qs.filter(q => q.isAttempted && !q.isCorrect).length;
    const skipped = qs.filter(q => !q.isAttempted).length;
    const acc = pct(correct, qs.filter(q => q.isAttempted).length);
    return { sub, total: qs.length, correct, wrong, skipped, acc };
  });
  return (
    <div className="space-y-3">
      {data.map(d => (
        <div key={d.sub} className="bg-white/3 border border-white/8 rounded-2xl p-4 hover:border-white/12 transition-colors">
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-white font-black text-xs">{d.sub}</h4>
            <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg ${d.acc >= 70 ? 'bg-emerald-500/15 text-emerald-400' : d.acc >= 40 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-red-500/15 text-red-400'}`}>{d.acc}%</span>
          </div>
          <div className="flex gap-2 mb-2">
            {[{ v: d.correct, l: 'Correct', c: 'text-emerald-400' }, { v: d.wrong, l: 'Wrong', c: 'text-red-400' }, { v: d.skipped, l: 'Skip', c: 'text-gray-500' }, { v: d.total, l: 'Total', c: 'text-gray-300' }].map(m => (
              <div key={m.l} className="flex-1 bg-white/3 rounded-xl p-2 text-center">
                <p className={`text-sm font-black ${m.c}`}>{m.v}</p>
                <p className="text-[9px] text-gray-700 uppercase">{m.l}</p>
              </div>
            ))}
          </div>
          <div className="h-1 bg-white/5 rounded-full overflow-hidden flex">
            <div className="bg-emerald-500 transition-all duration-1000" style={{ width: `${pct(d.correct, d.total)}%` }} />
            <div className="bg-red-500 transition-all duration-1000" style={{ width: `${pct(d.wrong, d.total)}%` }} />
            <div className="bg-gray-700 transition-all duration-1000" style={{ width: `${pct(d.skipped, d.total)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Question Card ────────────────────────────────────────────
function QuestionCard({ q, num, showSolution }: { q: QuestionResult; num: number; showSolution: boolean }) {
  const [open, setOpen] = useState(false);
  const qText = q.question_text || q.question || '';
  const correctId = q.correct_option || q.correctAnswer || '';
  const userAnsId = q.userAnswer || '';
  const opts = q.options ?? [];
  const diffColor = q.difficulty === 'easy' ? '#34d399' : q.difficulty === 'hard' ? '#f87171' : '#fbbf24';

  return (
    <div className={`rounded-2xl border transition-all ${q.isCorrect ? 'bg-emerald-950/20 border-emerald-500/15' : q.isAttempted ? 'bg-red-950/20 border-red-500/15' : 'bg-white/2 border-white/6'}`}>
      <button onClick={() => setOpen(o => !o)} className="w-full flex items-start gap-3 p-4 text-left hover:opacity-90 transition">
        <span className={`flex-shrink-0 w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black ${q.isCorrect ? 'bg-emerald-500/20 text-emerald-400' : q.isAttempted ? 'bg-red-500/20 text-red-400' : 'bg-white/5 text-gray-500'}`}>{num}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-lg ${q.isCorrect ? 'bg-emerald-500/15 text-emerald-400' : q.isAttempted ? 'bg-red-500/15 text-red-400' : 'bg-white/5 text-gray-500'}`}>
              {q.isCorrect ? '✓ Correct' : q.isAttempted ? '✗ Wrong' : '— Skipped'}
            </span>
            {q.subject && <span className="text-[10px] text-gray-600 font-bold">{q.subject}</span>}
            {q.difficulty && <span className="text-[10px] font-bold" style={{ color: diffColor }}>● {q.difficulty}</span>}
            {(q.timeSpent ?? 0) > 0 && <span className="text-[10px] text-gray-700 flex items-center gap-0.5"><Clock size={9} />{fmtTime(q.timeSpent!)}</span>}
          </div>
          <p className="text-white/80 text-sm leading-relaxed line-clamp-2">{renderText(qText)}</p>
        </div>
        <ChevronRight size={14} className={`text-gray-600 flex-shrink-0 mt-1.5 transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {open && (
        <div className="px-4 pb-5 space-y-4 border-t border-white/5 pt-4">
          {/* Full question */}
          <p className="text-white/90 text-sm leading-relaxed">{renderText(qText)}</p>
          {q.question_image_url && <img src={q.question_image_url} alt="q" className="rounded-xl max-h-52 object-contain border border-white/10" />}

          {/* Options */}
          {opts.length > 0 ? (
            <div className="space-y-2">
              {opts.map((o: any, i: number) => {
                const oId = o.id || o.option_label || String.fromCharCode(65 + i);
                const oText = o.t || o.option_text || o.text || '';
                const isCorr = oId === correctId || o.is_correct === true;
                const isUser = oId === userAnsId;
                return (
                  <div key={oId} className={`flex items-start gap-3 p-3 rounded-xl border text-sm ${isCorr ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : isUser && !isCorr ? 'bg-red-500/10 border-red-500/25 text-red-300' : 'bg-white/3 border-white/5 text-gray-400'}`}>
                    <span className={`flex-shrink-0 w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-black border ${isCorr ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-400' : isUser && !isCorr ? 'bg-red-500/20 border-red-500/40 text-red-400' : 'bg-white/5 border-white/10 text-gray-500'}`}>{oId}</span>
                    <span className="flex-1 leading-relaxed">{renderText(oText)}</span>
                    {isCorr && <CheckCircle2 size={13} className="text-emerald-400 flex-shrink-0 mt-0.5" />}
                    {isUser && !isCorr && <XCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5" />}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex gap-3">
              <div className="flex-1 bg-emerald-500/8 border border-emerald-500/20 rounded-xl p-3">
                <p className="text-[9px] font-black text-emerald-500/70 uppercase tracking-widest mb-1">Correct Answer</p>
                <p className="text-emerald-400 font-black text-lg">{correctId || '—'}</p>
              </div>
              {userAnsId && (
                <div className={`flex-1 rounded-xl p-3 border ${q.isCorrect ? 'bg-emerald-500/8 border-emerald-500/20' : 'bg-red-500/8 border-red-500/20'}`}>
                  <p className="text-[9px] font-black text-gray-600 uppercase tracking-widest mb-1">Your Answer</p>
                  <p className={`font-black text-lg ${q.isCorrect ? 'text-emerald-400' : 'text-red-400'}`}>{userAnsId}</p>
                </div>
              )}
            </div>
          )}

          {/* Solution */}
          {showSolution && (q.explanation || q.solution_text) && (
            <div className="bg-indigo-500/8 border border-indigo-500/20 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2"><BookOpen size={12} className="text-indigo-400" /><span className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Solution</span></div>
              <p className="text-gray-300 text-sm leading-relaxed">{renderText(q.solution_text || q.explanation || '')}</p>
              {q.solution_image_url && <img src={q.solution_image_url} alt="sol" className="rounded-xl mt-3 max-h-48 object-contain border border-white/10" />}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Result Leaderboard ──────────────────────────────────────
// Inline leaderboard shown in the analysis page for this specific test
function ResultLeaderboard({ contestId, totalMarks }: { contestId: string; totalMarks: number }) {
  const supabase = useMemo(() => createClient(), []);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [myUserId, setMyUserId] = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setMyUserId(user.id);
    });
  }, [supabase]);

  useEffect(() => {
    if (!contestId) return;
    async function load() {
      setLoading(true);

      // Step 1: contest_results for this test
      const { data: results } = await supabase
        .from('contest_results')
        .select('id, user_id, score, total_marks, time_taken')
        .eq('contest_id', contestId)
        .order('score', { ascending: false })
        .order('time_taken', { ascending: true })
        .limit(50);

      if (!results || results.length === 0) { setLoading(false); return; }

      // Step 2: profiles lookup
      const userIds = [...new Set(results.map((r: any) => r.user_id as string))];
      const { data: profiles } = await supabase
        .from('profiles').select('id, name, avatar_url').in('id', userIds);

      const nameMap: Record<string, string> = {};
      (profiles ?? []).forEach((p: any) => { nameMap[p.id] = p.name?.trim() || 'Student'; });

      setEntries(results.map((row: any, i: number) => ({
        id: row.id,
        user_id: row.user_id,
        name: nameMap[row.user_id] ?? 'Student',
        score: row.score ?? 0,
        total_marks: row.total_marks || totalMarks || 100,
        time_taken: row.time_taken ?? 0,
        rank: i + 1,
      })));
      setLoading(false);
    }
    load();
  }, [contestId, totalMarks, supabase]);

  // Find current user's rank
  const myEntry = entries.find(e => e.user_id === myUserId);
  const myRank = myEntry?.rank;

  function fmtT(s: number) {
    if (!s || s <= 0) return '—';
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return h > 0 ? `${h}h ${m}m` : m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="w-8 h-8 border-2 border-yellow-500/30 border-t-yellow-400 rounded-full animate-spin"/>
    </div>
  );

  if (entries.length === 0) return (
    <div className="bg-white/3 border border-white/8 rounded-3xl p-10 text-center">
      <div className="text-4xl mb-3">🏆</div>
      <p className="text-gray-500 text-sm">No rankings yet for this test.</p>
      <p className="text-gray-700 text-xs mt-1">You may be the first to submit!</p>
    </div>
  );

  const top3 = entries.slice(0, 3);
  const rest = entries.slice(3);

  const podiumColor = [
    'from-yellow-500/15 border-yellow-500/30',
    'from-gray-400/10 border-gray-400/20',
    'from-orange-600/10 border-orange-600/20',
  ];
  const scoreColor = ['text-yellow-400', 'text-gray-300', 'text-orange-300'];
  const avatarBg   = ['bg-yellow-600/30','bg-gray-600','bg-orange-700/30'];
  const avatarBdr  = ['border-yellow-400/50','border-gray-400/40','border-orange-600/30'];

  return (
    <div className="space-y-5">

      {/* My Rank highlight */}
      {myRank && (
        <div className="flex items-center justify-between bg-indigo-500/10 border border-indigo-500/25 rounded-2xl px-5 py-3">
          <div className="flex items-center gap-3">
            <Trophy size={16} className="text-indigo-400"/>
            <div>
              <p className="text-indigo-300 font-black text-sm">Your Rank</p>
              <p className="text-gray-500 text-[11px]">{entries.length} students attempted</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-indigo-400 font-black text-2xl">#{myRank}</p>
            <p className="text-gray-600 text-[11px]">{myEntry?.score} / {myEntry?.total_marks} pts</p>
          </div>
        </div>
      )}

      {/* Podium — top 3 */}
      <div className="flex items-end justify-center gap-3">
        {[1, 0, 2].map(pos => {
          const e = top3[pos];
          const podiumRank = pos === 0 ? 1 : pos === 1 ? 2 : 3;
          const isMe = e?.user_id === myUserId;
          return (
            <div key={pos} className={`flex-1 flex flex-col items-center p-4 rounded-3xl bg-gradient-to-b ${podiumColor[pos]} border ${pos === 0 ? 'scale-105' : ''} ${isMe ? 'ring-2 ring-indigo-500/40' : ''}`}>
              {/* Crown icons */}
              {pos === 0 && <Crown size={16} className="text-yellow-400 mb-1"/>}
              {pos === 1 && <Medal size={14} className="text-gray-300 mb-1"/>}
              {pos === 2 && <Medal size={14} className="text-orange-400 mb-1"/>}

              <div className={`${pos === 0 ? 'w-12 h-12 text-lg' : 'w-10 h-10 text-base'} rounded-full ${avatarBg[pos]} flex items-center justify-center mb-1 border-2 ${avatarBdr[pos]} text-white font-black`}>
                {e?.name?.[0]?.toUpperCase() ?? '?'}
              </div>
              <p className={`font-black text-[9px] mt-1 text-center truncate w-full ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                {isMe ? 'You' : (e?.name?.split(' ')[0] ?? '—')}
              </p>
              <p className={`text-[11px] font-black mt-0.5 ${scoreColor[pos]}`}>
                {e?.score ?? '—'}
              </p>
              <p className="text-gray-700 text-[9px]">#{podiumRank}</p>
            </div>
          );
        })}
      </div>

      {/* Full ranked list */}
      <div className="bg-white/3 border border-white/8 rounded-2xl overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between">
          <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">All Rankings</p>
          <p className="text-gray-700 text-[10px]">{entries.length} students</p>
        </div>
        <div className="divide-y divide-white/5 max-h-80 overflow-y-auto" style={{ scrollbarWidth:'thin', scrollbarColor:'#333 transparent' }}>
          {entries.map(e => {
            const isMe = e.user_id === myUserId;
            return (
              <div key={e.id}
                className={`flex items-center gap-3 px-4 py-3 transition-colors ${isMe ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : 'hover:bg-white/3'}`}>
                {/* Rank */}
                <div className={`w-8 text-center text-xs font-black flex-shrink-0 ${e.rank <= 3 ? ['text-yellow-400','text-gray-300','text-orange-400'][e.rank-1] : 'text-gray-600'}`}>
                  #{e.rank}
                </div>
                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-white border flex-shrink-0 ${isMe ? 'bg-indigo-500/30 border-indigo-500/50' : 'bg-white/8 border-white/10'}`}>
                  {e.name[0]?.toUpperCase()}
                </div>
                {/* Name */}
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-bold truncate ${isMe ? 'text-indigo-300' : 'text-white'}`}>
                    {isMe ? `${e.name} (You)` : e.name}
                  </p>
                  <p className="text-gray-600 text-[10px]">{fmtT(e.time_taken)}</p>
                </div>
                {/* Score */}
                <div className="text-right flex-shrink-0">
                  <p className={`text-sm font-black ${isMe ? 'text-indigo-400' : 'text-white'}`}>{e.score}</p>
                  <p className="text-gray-600 text-[10px]">/{e.total_marks}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function CATResultAnalysis({ summary, questions, setInfo, onReset, responses = {}, timeSpentMap = {} }: Props) {
  // useMemo ensures one stable Supabase client per component mount
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<'overview' | 'solutions' | 'leaderboard'>('overview');
  const [filterStatus, setFilterStatus] = useState<'all' | 'correct' | 'wrong' | 'skipped'>('all');
  const [filterSubject, setFilterSubject] = useState('all');
  const [showSolution, setShowSolution] = useState(true);
  const [search, setSearch] = useState('');
  const [userName, setUserName] = useState('');

  const total = summary.totalQuestions ?? questions.length;
  const totalMarks = summary.totalMarks ?? total * 4;
  const skipped = total - summary.attempted;
  const timeTaken = summary.timeTaken ?? 0;
  const scorePercent = pct(summary.score, totalMarks);
  const accuracy = pct(summary.correct, summary.attempted);
  const completionRate = pct(summary.attempted, total);

  const verdict =
    scorePercent >= 85 ? { label: 'Outstanding', color: '#fbbf24', emoji: '🏆' }
    : scorePercent >= 70 ? { label: 'Excellent', color: '#34d399', emoji: '✨' }
    : scorePercent >= 50 ? { label: 'Good', color: '#60a5fa', emoji: '👍' }
    : scorePercent >= 35 ? { label: 'Average', color: '#fb923c', emoji: '📈' }
    : { label: 'Needs Work', color: '#f87171', emoji: '💪' };

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.from('profiles').select('name').eq('id', user.id).single()
        .then(({ data }) => { if (data?.name) setUserName(data.name.split(' ')[0]); });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const enriched: QuestionResult[] = questions.map(q => ({ ...q, timeSpent: timeSpentMap[q.id as string] ?? 0 }));
  const subjects = ['all', ...new Set(enriched.map(q => q.subject).filter(Boolean) as string[])];

  const filtered = enriched.filter(q => {
    if (filterStatus === 'correct' && !q.isCorrect) return false;
    if (filterStatus === 'wrong' && (!q.isAttempted || q.isCorrect)) return false;
    if (filterStatus === 'skipped' && q.isAttempted) return false;
    if (filterSubject !== 'all' && q.subject !== filterSubject) return false;
    if (search && !(q.question_text || q.question || '').toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const RING_SIZE = 150;

  return (
    <div className="min-h-screen bg-[#050505] text-white overflow-x-hidden">
      {/* Background grid */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.025]"
        style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.7) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.7) 1px,transparent 1px)', backgroundSize: '40px 40px' }} />
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(99,102,241,0.1),transparent)]" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-8">

        {/* ── Header ── */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button onClick={onReset} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 transition text-xs font-bold">
              <ArrowLeft size={13} />Back
            </button>
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold">{setInfo?.title || setInfo?.contest_title || 'Test Result'}</p>
              <h1 className="text-white font-black text-lg tracking-tight">Analysis Report</h1>
            </div>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => setView('overview')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'overview' ? 'bg-white/10 text-white border border-white/15' : 'text-gray-600 hover:text-gray-400 border border-transparent'}`}>
              <BarChart3 size={12} className="inline mr-1.5" />Overview
            </button>
            {setInfo?.id && !setInfo.id.startsWith('drill-') && (
              <button onClick={() => setView('leaderboard')}
                className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'leaderboard' ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30' : 'text-gray-600 hover:text-gray-400 border border-transparent'}`}>
                <Trophy size={12} className="inline mr-1.5" />Leaderboard
              </button>
            )}
            <button onClick={() => setView('solutions')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${view === 'solutions' ? 'bg-white/10 text-white border border-white/15' : 'text-gray-600 hover:text-gray-400 border border-transparent'}`}>
              <BookOpen size={12} className="inline mr-1.5" />Questions ({enriched.length})
            </button>
          </div>
        </div>

        {/* ══════════════ OVERVIEW ══════════════ */}
        {view === 'overview' && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-500">

            {/* Hero Card */}
            <Card3D className="rounded-3xl bg-gradient-to-br from-[#0e0e1c] via-[#0b0b16] to-[#080810] border border-white/8 overflow-hidden">
              <div className="p-6 md:p-8 flex flex-col md:flex-row items-center gap-8">

                {/* Score Ring */}
                <div className="relative flex-shrink-0 flex items-center justify-center" style={{ width: RING_SIZE, height: RING_SIZE }}>
                  <Ring value={summary.score} max={totalMarks} size={RING_SIZE} stroke={12} color={verdict.color} />
                  <div className="flex flex-col items-center justify-center">
                    <span className="text-white font-black text-3xl leading-none"><Counter to={summary.score} /></span>
                    <span className="text-gray-600 text-[10px] uppercase tracking-widest">/ {totalMarks}</span>
                  </div>
                </div>

                {/* Info block */}
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center gap-2 mb-1 justify-center md:justify-start">
                    <span className="text-xl">{verdict.emoji}</span>
                    <span className="text-xl font-black" style={{ color: verdict.color }}>{verdict.label}</span>
                  </div>
                  {userName && <p className="text-gray-600 text-sm mb-4">Great effort, <span className="text-white font-bold">{userName}</span>!</p>}

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
                    {[
                      { icon: <CheckCircle2 size={14}/>, val: summary.correct, label: 'Correct', c: 'emerald' },
                      { icon: <XCircle size={14}/>, val: summary.wrong, label: 'Wrong', c: 'red' },
                      { icon: <Minus size={14}/>, val: skipped, label: 'Skipped', c: 'gray' },
                      { icon: <Target size={14}/>, val: `${accuracy}%`, label: 'Accuracy', c: 'yellow' },
                    ].map(s => (
                      <div key={s.label} className={`bg-${s.c}-500/8 rounded-2xl p-3 border border-${s.c}-500/15 text-center`}>
                        <div className={`flex justify-center mb-1 text-${s.c}-400`}>{s.icon}</div>
                        <p className={`text-lg font-black text-${s.c}-400`}>{s.val}</p>
                        <p className="text-gray-700 text-[9px] uppercase tracking-widest">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  {/* Stacked bars */}
                  <div className="space-y-2">
                    {[
                      { label: 'Correct', val: summary.correct, color: '#34d399', delay: 0 },
                      { label: 'Wrong', val: summary.wrong, color: '#f87171', delay: 100 },
                      { label: 'Skipped', val: skipped, color: '#6b7280', delay: 200 },
                    ].map(b => (
                      <div key={b.label} className="flex items-center gap-3">
                        <span className="text-gray-600 text-[10px] font-bold w-14 text-right uppercase">{b.label}</span>
                        <ProgressBar value={b.val} max={total} color={b.color} delay={b.delay} />
                        <span className="text-white text-xs font-black w-5">{b.val}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* KPI strip — vertical */}
                <div className="hidden md:flex flex-col gap-3 flex-shrink-0 w-36">
                  {[
                    { icon: <Flame size={13} className="text-orange-400"/>, label: 'Score %', val: `${scorePercent}%`, hint: scorePercent >= 70 ? 'Strong' : 'Needs push' },
                    { icon: <Target size={13} className="text-yellow-400"/>, label: 'Accuracy', val: `${accuracy}%`, hint: accuracy >= 80 ? 'Precise' : 'Improve' },
                    { icon: <Hash size={13} className="text-blue-400"/>, label: 'Coverage', val: `${completionRate}%`, hint: completionRate >= 80 ? 'Great' : 'Attempt more' },
                    timeTaken > 0 ? { icon: <Timer size={13} className="text-purple-400"/>, label: 'Time', val: fmtTime(timeTaken), hint: 'Total taken' } : null,
                  ].filter(Boolean).map((m: any) => (
                    <div key={m.label} className="bg-white/3 border border-white/8 rounded-2xl p-3">
                      <div className="flex items-center gap-1.5 mb-1">{m.icon}<span className="text-gray-600 text-[9px] uppercase tracking-widest font-bold">{m.label}</span></div>
                      <p className="text-white font-black text-base">{m.val}</p>
                      <p className="text-gray-700 text-[9px] mt-0.5">{m.hint}</p>
                    </div>
                  ))}
                </div>
              </div>
            </Card3D>

            {/* Two-column breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Subject breakdown */}
              <div className="bg-white/3 border border-white/8 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-4"><Layers size={14} className="text-indigo-400"/><h3 className="text-white font-black text-sm">Subject Breakdown</h3></div>
                <SubjectBreakdown questions={enriched} />
              </div>

              {/* Difficulty + Time */}
              <div className="space-y-4">
                {/* Difficulty */}
                <div className="bg-white/3 border border-white/8 rounded-3xl p-5">
                  <div className="flex items-center gap-2 mb-3"><Award size={14} className="text-yellow-400"/><h3 className="text-white font-black text-sm">Difficulty Breakdown</h3></div>
                  <div className="grid grid-cols-3 gap-2">
                    {(['easy','medium','hard'] as const).map(lvl => {
                      const qs = enriched.filter(q => (q.difficulty ?? 'medium') === lvl);
                      const correct = qs.filter(q => q.isCorrect).length;
                      const acc = pct(correct, qs.filter(q => q.isAttempted).length);
                      const colors = { easy:'#34d399', medium:'#fbbf24', hard:'#f87171' };
                      return (
                        <Card3D key={lvl} className={`rounded-2xl p-3 border text-center ${lvl === 'easy' ? 'bg-emerald-500/6 border-emerald-500/15' : lvl === 'medium' ? 'bg-yellow-500/6 border-yellow-500/15' : 'bg-red-500/6 border-red-500/15'}`}>
                          <p className="text-white text-xl font-black">{correct}<span className="text-gray-600 text-sm font-bold">/{qs.length}</span></p>
                          <p className="text-[9px] uppercase tracking-widest font-black mt-1" style={{ color: colors[lvl] }}>{lvl}</p>
                          <p className="text-gray-700 text-[9px] mt-0.5">{acc}% acc</p>
                        </Card3D>
                      );
                    })}
                  </div>
                </div>

                {/* Time per question */}
                <div className="bg-white/3 border border-white/8 rounded-3xl p-5">
                  <div className="flex items-center gap-2 mb-3"><Timer size={14} className="text-blue-400"/><h3 className="text-white font-black text-sm">Time Insights</h3></div>
                  {Object.keys(timeSpentMap).length > 0 ? (() => {
                    const withTime = enriched.filter(q => (q.timeSpent ?? 0) > 0);
                    const sorted = [...withTime].sort((a,b) => (b.timeSpent??0)-(a.timeSpent??0));
                    const avg = sorted.length > 0 ? Math.round(sorted.reduce((s,q) => s+(q.timeSpent??0),0)/sorted.length) : 0;
                    return (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2">
                          {[{l:'Avg',v:fmtTime(avg),c:'text-blue-400'},{l:'Slowest',v:fmtTime(sorted[0]?.timeSpent??0),c:'text-red-400'},{l:'Fastest',v:fmtTime(sorted[sorted.length-1]?.timeSpent??0),c:'text-emerald-400'}].map(m=>(
                            <div key={m.l} className="bg-white/3 rounded-xl p-2 text-center">
                              <p className={`text-sm font-black ${m.c}`}>{m.v}</p>
                              <p className="text-gray-700 text-[9px] uppercase">{m.l}</p>
                            </div>
                          ))}
                        </div>
                        <div className="space-y-1.5 max-h-36 overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'#333 transparent'}}>
                          {sorted.slice(0,12).map(q=>{
                            const idx = enriched.indexOf(q)+1;
                            const w = pct(q.timeSpent??0, sorted[0]?.timeSpent??1);
                            return (
                              <div key={q.id} className="flex items-center gap-2 text-[10px]">
                                <span className="text-gray-600 w-5 text-right font-bold">Q{idx}</span>
                                <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full ${q.isCorrect?'bg-emerald-500':q.isAttempted?'bg-red-500':'bg-gray-600'}`} style={{width:`${w}%`,transition:'width 0.8s ease-out'}} />
                                </div>
                                <span className="text-gray-600 w-10">{fmtTime(q.timeSpent??0)}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })() : <p className="text-gray-700 text-xs text-center py-3">No per-question timing data.</p>}
                </div>
              </div>
            </div>

            {/* Smart Insights */}
            <div className="bg-gradient-to-r from-indigo-950/40 to-purple-950/40 border border-indigo-500/15 rounded-3xl p-6">
              <div className="flex items-center gap-2 mb-4"><Brain size={15} className="text-indigo-400"/><h3 className="text-white font-black text-sm">Smart Insights</h3></div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {([
                  accuracy < 60 && { icon:'🎯', text:`Your accuracy is ${accuracy}%. Attempt only questions you're confident about to protect marks.`, c:'border-yellow-500/20 bg-yellow-500/5' },
                  completionRate < 70 && { icon:'⏩', text:`Only ${completionRate}% attempted. Speed drills will help you attempt more in time.`, c:'border-blue-500/20 bg-blue-500/5' },
                  summary.wrong > summary.correct && { icon:'⚠️', text:`More wrong than correct. Consider revising fundamentals before your next attempt.`, c:'border-red-500/20 bg-red-500/5' },
                  scorePercent >= 70 && completionRate >= 70 && { icon:'🚀', text:`Solid performance! Aim for ${Math.min(100, scorePercent + 10)}% next by reducing skips.`, c:'border-emerald-500/20 bg-emerald-500/5' },
                  skipped > summary.correct && { icon:'📖', text:`${skipped} questions skipped — more than you got right! Topic drills on weak areas will help.`, c:'border-purple-500/20 bg-purple-500/5' },
                  accuracy >= 80 && completionRate >= 80 && { icon:'⭐', text:`Excellent balance of accuracy and coverage. You're prepared for a real exam!`, c:'border-yellow-500/20 bg-yellow-500/5' },
                ] as any[]).filter(Boolean).slice(0, 4).map((ins: any, i: number) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-2xl border ${ins.c}`}>
                    <span className="text-xl flex-shrink-0">{ins.icon}</span>
                    <p className="text-gray-300 text-xs leading-relaxed">{ins.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setView('solutions')} className="flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-black text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_0_25px_rgba(99,102,241,0.25)]">
                <Eye size={15} />Review All {enriched.length} Questions
              </button>
              <button onClick={onReset} className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-white/10 transition-all">
                <RotateCcw size={15} />Try Again
              </button>
              <a href="/dashboard" className="flex items-center justify-center gap-2 px-6 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-white/10 transition-all">
                <Home size={15} />Dashboard
              </a>
            </div>
          </div>
        )}

        {/* ══════════════ LEADERBOARD ══════════════ */}
        {view === 'leaderboard' && setInfo?.id && (
          <div className="space-y-5 animate-in fade-in slide-in-from-bottom-3 duration-500">
            <ResultLeaderboard contestId={setInfo.id} totalMarks={totalMarks} />
            <button onClick={() => setView('overview')} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-white/10 transition-all">
              <BarChart3 size={15} />Back to Overview
            </button>
          </div>
        )}

        {/* ══════════════ SOLUTIONS ══════════════ */}
        {view === 'solutions' && (
          <div className="space-y-4 animate-in fade-in slide-in-from-bottom-3 duration-400">
            {/* Filters bar */}
            <div className="bg-white/3 border border-white/8 rounded-2xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex gap-1.5 flex-wrap">
                {([
                  { id:'all', label:`All (${enriched.length})` },
                  { id:'correct', label:`✓ ${summary.correct}` },
                  { id:'wrong', label:`✗ ${summary.wrong}` },
                  { id:'skipped', label:`— ${skipped}` },
                ] as const).map(f => (
                  <button key={f.id} onClick={() => setFilterStatus(f.id as any)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      filterStatus === f.id
                        ? f.id === 'correct' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-400'
                        : f.id === 'wrong' ? 'bg-red-500/15 border-red-500/40 text-red-400'
                        : f.id === 'skipped' ? 'bg-white/8 border-white/15 text-gray-400'
                        : 'bg-white/10 border-white/20 text-white'
                        : 'bg-white/3 border-white/8 text-gray-600 hover:text-gray-400'
                    }`}>{f.label}</button>
                ))}
              </div>

              {subjects.length > 2 && (
                <select value={filterSubject} onChange={e => setFilterSubject(e.target.value)}
                  className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white font-bold focus:outline-none focus:border-white/20">
                  {subjects.map(s => <option key={s} value={s} className="bg-[#111]">{s === 'all' ? 'All Subjects' : s}</option>)}
                </select>
              )}

              <button onClick={() => setShowSolution(s => !s)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ml-auto ${showSolution ? 'bg-indigo-500/15 border-indigo-500/40 text-indigo-400' : 'bg-white/3 border-white/8 text-gray-500'}`}>
                {showSolution ? <Eye size={11}/> : <EyeOff size={11}/>}{showSolution ? 'Solutions ON' : 'Solutions OFF'}
              </button>

              <div className="relative">
                <Search size={11} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-600" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search..."
                  className="pl-7 pr-3 py-1.5 bg-white/5 border border-white/10 rounded-xl text-xs text-white placeholder-gray-700 focus:outline-none w-36 transition" />
              </div>

              <p className="text-gray-700 text-[10px] font-bold w-full mt-0.5">{filtered.length} question{filtered.length !== 1 ? 's' : ''} shown</p>
            </div>

            {/* Questions */}
            <div className="space-y-2">
              {filtered.map(q => (
                <QuestionCard key={q.id} q={q} num={enriched.indexOf(q) + 1} showSolution={showSolution} />
              ))}
              {filtered.length === 0 && (
                <div className="text-center py-12 text-gray-600">
                  <Filter size={28} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No questions match your filters.</p>
                </div>
              )}
            </div>

            <button onClick={() => setView('overview')} className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 border border-white/10 text-white font-black text-sm hover:bg-white/10 transition-all">
              <BarChart3 size={15} />Back to Overview
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
