'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { Settings2, BookOpen, Layers, Trophy, Clock, ChevronRight, Star, Brain, RotateCcw, Play, Plus, Minus } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Exam { id: string; name: string; icon: string; display_name: string; }
interface DrillConfig {
  exam_id: string; mode: 'topic'|'sectional'|'full_length'|'pyq'|'custom';
  subjects: string[]; chapters: string[]; topics: string[];
  difficulty: ('easy'|'medium'|'hard')[]; question_type: ('mcq'|'numerical'|'multiple_correct')[];
  source_filter: 'all'|'pyq'|'new'; question_count: number;
  time_mode: 'timed'|'untimed'|'custom'; custom_minutes: number;
  order: 'sequential'|'random'|'difficulty_asc'|'difficulty_desc';
  show_solution: 'after_each'|'at_end'|'never'; negative_marking: boolean;
}

function Card3D({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateZ(6px)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = 'perspective(800px) rotateY(0) rotateX(0) translateZ(0)'; };
  return <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={className} style={{ transition: 'transform 0.2s ease-out', willChange: 'transform' }}>{children}</div>;
}

function Toggle({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${active ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400' : 'bg-white/3 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'}`}>
      {children}
    </button>
  );
}

const MODES = [
  { id: 'topic',       icon: <BookOpen size={15}/>,  label: 'Topic'     },
  { id: 'sectional',   icon: <Layers size={15}/>,    label: 'Sectional' },
  { id: 'full_length', icon: <Trophy size={15}/>,    label: 'Full Mock' },
  { id: 'pyq',         icon: <Star size={15}/>,      label: 'PYQ'       },
  { id: 'custom',      icon: <Settings2 size={15}/>, label: 'Custom'    },
] as const;

const DEFAULT: DrillConfig = {
  exam_id: '', mode: 'topic', subjects: [], chapters: [], topics: [],
  difficulty: ['easy','medium','hard'], question_type: ['mcq'],
  source_filter: 'all', question_count: 20, time_mode: 'timed',
  custom_minutes: 30, order: 'random', show_solution: 'at_end', negative_marking: true,
};

export default function StudentDrillCard() {
  // useMemo ensures one stable Supabase client per component mount
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [exams, setExams]       = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<string[]>([]);
  const [chapters, setChapters] = useState<string[]>([]);
  const [topics, setTopics]     = useState<string[]>([]);
  const [qCount, setQCount]     = useState(0);
  const [config, setConfig]     = useState<DrillConfig>(DEFAULT);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [configured, setConfigured] = useState(false);

  // ── Fetch exams from Supabase ─────────────────────────────
  useEffect(() => {
    supabase.from('exams').select('id,name,icon,display_name').eq('is_active', true)
      .then(({ data }) => { if (data) setExams(data); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // ── Cascade: exam → subjects ──────────────────────────────
  useEffect(() => {
    if (!config.exam_id) { setSubjects([]); return; }
    supabase.from('questions').select('subject').eq('exam_id', config.exam_id)
      .then(({ data }) => {
        if (data) setSubjects([...new Set(data.map((d: any) => d.subject).filter(Boolean))].sort());
      });
  }, [config.exam_id]);

  // ── Cascade: subjects → chapters ─────────────────────────
  useEffect(() => {
    if (!config.exam_id || config.subjects.length === 0) { setChapters([]); return; }
    supabase.from('questions').select('chapter').eq('exam_id', config.exam_id).in('subject', config.subjects)
      .then(({ data }) => {
        if (data) setChapters([...new Set(data.map((d: any) => d.chapter).filter(Boolean))].sort());
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.subjects, supabase]);

  // ── Cascade: chapters → topics ───────────────────────────
  useEffect(() => {
    if (config.chapters.length === 0) { setTopics([]); return; }
    supabase.from('questions').select('topic').in('chapter', config.chapters)
      .then(({ data }) => {
        if (data) setTopics([...new Set(data.map((d: any) => d.topic).filter(Boolean))].sort());
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.chapters, supabase]);

  // ── Live question count ───────────────────────────────────
  useEffect(() => {
    if (!config.exam_id) { setQCount(0); return; }
    let q = supabase.from('questions').select('id', { count: 'exact', head: true }).eq('exam_id', config.exam_id);
    if (config.subjects.length)   q = q.in('subject', config.subjects);
    if (config.chapters.length)   q = q.in('chapter', config.chapters);
    if (config.topics.length)     q = q.in('topic', config.topics);
    if (config.difficulty.length < 3) q = q.in('difficulty', config.difficulty);
    if (config.question_type.length)  q = q.in('question_type', config.question_type);
    if (config.source_filter === 'pyq')  q = q.not('source', 'is', null);
    if (config.source_filter === 'new')  q = q.is('source', null);
    q.then(({ count }) => setQCount(count ?? 0));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.exam_id, config.subjects, config.chapters, config.topics, config.difficulty, config.question_type, config.source_filter, supabase]);

  function set<K extends keyof DrillConfig>(key: K, val: DrillConfig[K]) { setConfig(prev => ({ ...prev, [key]: val })); }
  function toggle<T>(arr: T[], val: T): T[] { return arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val]; }

  const timePreset = () => ({ topic:20, sectional:60, full_length:180, pyq:30, custom:config.custom_minutes }[config.mode] ?? 30);
  const effectiveTime = config.time_mode === 'custom' ? config.custom_minutes : config.time_mode === 'timed' ? timePreset() : 0;

  // ── Launch drill — fetches real questions from Supabase ───
  async function startDrill() {
    if (!config.exam_id) return;
    setLoading(true); setError('');

    try {
      // Build query
      let q = supabase.from('questions')
        .select('id, question_text, question_image_url, question_type, difficulty, positive_marks, negative_marks, numerical_answer, subject, chapter, topic, source, question_options(id, option_label, option_text, option_image_url, is_correct, option_order)')
        .eq('exam_id', config.exam_id);

      if (config.subjects.length)   q = q.in('subject', config.subjects);
      if (config.chapters.length)   q = q.in('chapter', config.chapters);
      if (config.topics.length)     q = q.in('topic', config.topics);
      if (config.difficulty.length < 3) q = q.in('difficulty', config.difficulty);
      if (config.question_type.length)  q = q.in('question_type', config.question_type);
      if (config.source_filter === 'pyq') q = q.not('source', 'is', null);
      if (config.source_filter === 'new') q = q.is('source', null);

      // Order
      if (config.order === 'difficulty_asc')  q = q.order('difficulty', { ascending: true });
      else if (config.order === 'difficulty_desc') q = q.order('difficulty', { ascending: false });
      else q = q.order('id'); // will shuffle client-side if random

      q = q.limit(config.question_count * 3); // fetch extra for random shuffle

      const { data, error: fetchErr } = await q;
      if (fetchErr) throw fetchErr;
      if (!data || data.length === 0) { setError('No questions found with these filters. Try broadening your selection.'); setLoading(false); return; }

      // Shuffle if random
      let questions = [...data];
      if (config.order === 'random') {
        for (let i = questions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [questions[i], questions[j]] = [questions[j], questions[i]];
        }
      }
      questions = questions.slice(0, config.question_count);

      // Store everything in sessionStorage for the test engine
      const drillSession = {
        questions,
        config: { ...config, time_minutes: effectiveTime },
        mode: 'drill',
        created_at: new Date().toISOString(),
        total: questions.length,
      };
      sessionStorage.setItem('drill_session', JSON.stringify(drillSession));

      router.push('/mocktest?drill=1');
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load questions. Check Supabase connection.');
      setLoading(false);
    }
  }

  return (
    <Card3D>
      <div className="rounded-3xl bg-[#0f0f1a] border border-white/8 overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="px-5 pt-5 pb-4 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
              <Brain size={15} className="text-purple-400" />
            </div>
            <div>
              <h3 className="text-white font-black text-sm">Student Drill</h3>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest">Custom Practice</p>
            </div>
          </div>
          {configured && (
            <button onClick={() => { setConfig(DEFAULT); setConfigured(false); setError(''); }}
              className="flex items-center gap-1 text-xs text-gray-600 hover:text-white transition">
              <RotateCcw size={11} />Reset
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">

          {/* Mode */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-2">Mode</p>
            <div className="grid grid-cols-5 gap-1.5">
              {MODES.map(m => (
                <button key={m.id} onClick={() => { set('mode', m.id); setConfigured(true); }}
                  className={`flex flex-col items-center gap-1 p-2 rounded-xl border text-center transition-all ${config.mode === m.id ? 'bg-purple-500/15 border-purple-500/40 text-purple-300' : 'bg-white/3 border-white/8 text-gray-600 hover:border-white/15 hover:text-gray-400'}`}>
                  <span>{m.icon}</span>
                  <span className="text-[9px] font-black">{m.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Exam */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-2">Exam</p>
            <div className="flex gap-2 flex-wrap">
              {exams.length > 0 ? exams.map(e => (
                <button key={e.id} onClick={() => { set('exam_id', e.id); set('subjects', []); set('chapters', []); set('topics', []); setConfigured(true); }}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${config.exam_id === e.id ? 'bg-yellow-500/15 border-yellow-500/40 text-yellow-400' : 'bg-white/3 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'}`}>
                  <span>{e.icon}</span>{e.name}
                </button>
              )) : (
                <p className="text-gray-700 text-xs">No exams found. Add exams via Admin Panel.</p>
              )}
            </div>
          </div>

          {/* Subject */}
          {subjects.length > 0 && (
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-2">Subject <span className="text-gray-700 normal-case font-normal">(optional)</span></p>
              <div className="flex gap-1.5 flex-wrap">
                {subjects.map(s => <Toggle key={s} active={config.subjects.includes(s)} onClick={() => set('subjects', toggle(config.subjects, s))}>{s}</Toggle>)}
              </div>
            </div>
          )}

          {/* Chapter */}
          {chapters.length > 0 && (
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-2">Chapter <span className="text-gray-700 normal-case font-normal">(optional)</span></p>
              <div className="flex gap-1.5 flex-wrap max-h-20 overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'#333 transparent'}}>
                {chapters.map(c => <Toggle key={c} active={config.chapters.includes(c)} onClick={() => set('chapters', toggle(config.chapters, c))}>{c}</Toggle>)}
              </div>
            </div>
          )}

          {/* Topic */}
          {topics.length > 0 && (
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-2">Topic <span className="text-gray-700 normal-case font-normal">(optional)</span></p>
              <div className="flex gap-1.5 flex-wrap max-h-16 overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'#333 transparent'}}>
                {topics.map(t => <Toggle key={t} active={config.topics.includes(t)} onClick={() => set('topics', toggle(config.topics, t))}>{t}</Toggle>)}
              </div>
            </div>
          )}

          {/* Difficulty */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-2">Difficulty</p>
            <div className="flex gap-1.5">
              {(['easy','medium','hard'] as const).map(d => (
                <Toggle key={d} active={config.difficulty.includes(d)} onClick={() => set('difficulty', toggle(config.difficulty, d))}>
                  {d==='easy'?'🟢 Easy':d==='medium'?'🟡 Medium':'🔴 Hard'}
                </Toggle>
              ))}
            </div>
          </div>

          {/* Question Type */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-2">Type</p>
            <div className="flex gap-1.5 flex-wrap">
              {(['mcq','numerical','multiple_correct'] as const).map(t => (
                <Toggle key={t} active={config.question_type.includes(t)} onClick={() => set('question_type', toggle(config.question_type, t))}>
                  {t==='mcq'?'MCQ':t==='numerical'?'Numerical':'Multi-Correct'}
                </Toggle>
              ))}
            </div>
          </div>

          {/* Source */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-2">Source</p>
            <div className="flex gap-1.5">
              {(['all','pyq','new'] as const).map(s => (
                <Toggle key={s} active={config.source_filter===s} onClick={() => set('source_filter',s)}>
                  {s==='all'?'All':s==='pyq'?'⭐ PYQ Only':'New Questions'}
                </Toggle>
              ))}
            </div>
          </div>

          {/* Question Count */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-2">
              Questions: <span className="text-white font-black">{config.question_count}</span>
              {config.exam_id && <span className="text-gray-700 ml-1 font-normal">({qCount} available)</span>}
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => set('question_count', Math.max(5, config.question_count - 5))}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition text-white flex-shrink-0"><Minus size={12}/></button>
              <div className="flex-1 relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                <div className="absolute left-0 top-0 h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all"
                  style={{width:`${Math.min(100, qCount > 0 ? (config.question_count/qCount)*100 : (config.question_count/100)*100)}%`}}/>
              </div>
              <button onClick={() => set('question_count', Math.min(qCount||200, config.question_count + 5))}
                className="w-7 h-7 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition text-white flex-shrink-0"><Plus size={12}/></button>
              <div className="flex gap-1 flex-shrink-0">
                {[10,20,30,50].map(n => (
                  <button key={n} onClick={() => set('question_count', n)}
                    className={`w-7 h-6 rounded-lg text-[10px] font-bold transition-all ${config.question_count===n?'bg-purple-500/20 text-purple-400 border border-purple-500/40':'text-gray-600 hover:text-gray-400'}`}>{n}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Timing */}
          <div>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-2">Timing</p>
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {(['timed','untimed','custom'] as const).map(t => (
                <Toggle key={t} active={config.time_mode===t} onClick={() => set('time_mode',t)}>
                  {t==='timed'?`⏱ Auto (${timePreset()}m)`:t==='untimed'?'∞ No limit':'✎ Custom'}
                </Toggle>
              ))}
            </div>
            {config.time_mode==='custom' && (
              <div className="flex items-center gap-3 mt-2">
                <Clock size={13} className="text-gray-600 flex-shrink-0"/>
                <input type="range" min={5} max={180} step={5} value={config.custom_minutes}
                  onChange={e => set('custom_minutes', parseInt(e.target.value))}
                  className="flex-1 accent-purple-500 h-1"/>
                <span className="text-white text-xs font-black w-10 text-right flex-shrink-0">{config.custom_minutes}m</span>
              </div>
            )}
          </div>

          {/* Advanced */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1.5">Order</p>
              {(['random','sequential','difficulty_asc','difficulty_desc'] as const).map(o => (
                <button key={o} onClick={() => set('order',o)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold mb-1 transition-all ${config.order===o?'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30':'text-gray-600 hover:text-gray-400'}`}>
                  {o==='random'?'🎲 Random':o==='sequential'?'📋 Sequential':o==='difficulty_asc'?'↑ Easy→Hard':'↓ Hard→Easy'}
                </button>
              ))}
            </div>
            <div>
              <p className="text-gray-600 text-[10px] uppercase tracking-widest font-bold mb-1.5">Solutions</p>
              {(['after_each','at_end','never'] as const).map(s => (
                <button key={s} onClick={() => set('show_solution',s)}
                  className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold mb-1 transition-all ${config.show_solution===s?'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30':'text-gray-600 hover:text-gray-400'}`}>
                  {s==='after_each'?'✅ After each Q':s==='at_end'?'📊 At end':'🙈 Never'}
                </button>
              ))}
              <button onClick={() => set('negative_marking', !config.negative_marking)}
                className={`w-full text-left px-2 py-1.5 rounded-lg text-[10px] font-bold transition-all mt-1 ${config.negative_marking?'bg-red-500/10 text-red-400 border border-red-500/20':'bg-white/3 text-gray-600 border border-white/5 hover:text-gray-400'}`}>
                {config.negative_marking?'⚠️ Negative ON':'✅ No Negative'}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && <p className="text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2">{error}</p>}

          {/* Launch */}
          <button
            onClick={startDrill}
            disabled={loading || !config.exam_id || config.question_type.length===0 || config.difficulty.length===0}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(139,92,246,0.25)]"
          >
            {loading
              ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
              : <><Play size={15} className="fill-white"/>Start Drill — {config.question_count}Q · {effectiveTime>0?`${effectiveTime}m`:'∞'}</>
            }
          </button>

          {!config.exam_id && <p className="text-center text-gray-700 text-[11px]">Select an exam to enable drill</p>}
        </div>
      </div>
    </Card3D>
  );
}
