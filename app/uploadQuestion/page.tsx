"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import 'katex/dist/katex.min.css';
import { InlineMath } from 'react-katex';
import {
  BookOpen, Network, Calculator, Tag, Check, X, ArrowLeft,
  ChevronDown, Plus, Trash2, AlignLeft, Image as ImageIcon,
  Sigma, Eye, Layers, Edit3, Clock, Type, LayoutGrid,
  FileEdit, RefreshCw, Search, AlertTriangle, ShieldCheck,
  ChevronUp, FileText, Video, Lightbulb
} from 'lucide-react';
import { createClient } from '../utils/supabase/client';

// ─── Types ────────────────────────────────────────────────────
interface CatSet {
  id: string; title: string; mock_type: 'topic' | 'sectional' | 'full';
  duration_mins: number; subject_section: string; module: string; topic: string;
  passage_text?: string; image_url?: string; created_at: string; question_count?: number;
}

interface Solution {
  text: string;
  imageBase64: string | null;   // local preview (data: URL)
  imageUrl: string | null;      // already-uploaded URL from DB
  videoUrl: string;             // YouTube / direct link
  videoFile: string | null;     // local preview for uploaded video
  videoFileName: string;        // display name for uploaded file
}

interface FormQuestion {
  id: number;
  dbId?: string;
  type: 'mcq' | 'tita';
  text: string;
  questionImage: string | null;
  options: { id: string; t: string }[];
  correct: string;
  difficulty: string;
  solution: Solution;
  solutionOpen: boolean;        // collapse state
}

// ─── Subject config ───────────────────────────────────────────
const SD: Record<string, { modules: string[]; subTopics: Record<string, string[]>; color: string; Icon: any }> = {
  qa: {
    modules: ['Arithmetic', 'Algebra', 'Geometry', 'Number Systems', 'Modern Math'],
    subTopics: {
      Arithmetic: ['Percentages', 'Profit & Loss', 'SI & CI', 'Averages', 'Time & Work', 'TDS'],
      Algebra: ['Linear Equations', 'Quadratic Equations', 'Logarithms', 'Functions', 'Progressions'],
      Geometry: ['Triangles', 'Circles', 'Polygons', 'Coordinate Geometry', 'Mensuration'],
      'Number Systems': ['Remainders', 'Factors', 'LCM & HCF'],
      'Modern Math': ['P&C', 'Probability', 'Set Theory'],
    },
    color: 'bg-orange-500', Icon: Calculator,
  },
  dilr: {
    modules: ['Logical Reasoning', 'Data Interpretation', 'Puzzles'],
    subTopics: {
      'Logical Reasoning': ['Blood Relations', 'Seating Arrangement', 'Syllogisms', 'Clocks & Calendars'],
      'Data Interpretation': ['Tables', 'Bar Charts', 'Pie Charts', 'Caselets'],
      Puzzles: ['Matrix Match', 'Grid Puzzles', 'Ranking'],
    },
    color: 'bg-blue-500', Icon: Network,
  },
  varc: {
    modules: ['Verbal Ability', 'Reading Comprehension'],
    subTopics: {
      'Verbal Ability': ['Para Jumbles', 'Odd One Out', 'Para Summary', 'Sentence Completion'],
      'Reading Comprehension': ['Philosophy', 'Social Science', 'Business & Economics', 'Science & Tech'],
    },
    color: 'bg-emerald-500', Icon: BookOpen,
  },
};

const MATH_SYMS = [
  { l: '√', v: '\\sqrt{x}' }, { l: 'xⁿ', v: 'x^{n}' },
  { l: 'Σ', v: '\\sum' },     { l: 'π', v: '\\pi' },
  { l: '≠', v: '\\neq' },     { l: 'log', v: '\\log_{b}x' },
  { l: 'θ', v: '\\theta' },   { l: '±', v: '\\pm' },
];

const DIFF = [
  { id: 'easy',     label: 'Easy',     color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  { id: 'moderate', label: 'Moderate', color: 'text-amber-400',   bg: 'bg-amber-400/10'   },
  { id: 'hard',     label: 'Hard',     color: 'text-rose-400',    bg: 'bg-rose-400/10'    },
];

const TYPE_COLORS: Record<string, string> = {
  topic:     'bg-orange-500/15 text-orange-400 border-orange-500/25',
  sectional: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  full:      'bg-purple-500/15 text-purple-400 border-purple-500/25',
};

// ─── Blank helpers ────────────────────────────────────────────
const blankSolution = (): Solution => ({
  text: '', imageBase64: null, imageUrl: null,
  videoUrl: '', videoFile: null, videoFileName: '',
});

const blankQ = (): FormQuestion => ({
  id: Date.now() + Math.random(),
  type: 'mcq', text: '', questionImage: null,
  options: [{ id: 'A', t: '' }, { id: 'B', t: '' }, { id: 'C', t: '' }, { id: 'D', t: '' }],
  correct: 'A', difficulty: 'moderate',
  solution: blankSolution(),
  solutionOpen: false,
});

// ─── Math preview ─────────────────────────────────────────────
function MathPrev({ text }: { text: string }) {
  if (!text?.includes('$')) return null;
  return (
    <div className="mt-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
      <p className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mb-1">Preview</p>
      <div className="text-sm text-gray-200 overflow-x-auto">
        {text.split(/(\$.*?\$)/g).map((p, i) =>
          p.startsWith('$') && p.endsWith('$')
            ? <InlineMath key={i} math={p.slice(1, -1)} />
            : <span key={i}>{p}</span>
        )}
      </div>
    </div>
  );
}

// ─── Toast ────────────────────────────────────────────────────
function Toast({ t }: { t: { msg: string; type: 'success' | 'error' } | null }) {
  if (!t) return null;
  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl
      ${t.type === 'success' ? 'bg-emerald-900 border border-emerald-500/40 text-emerald-300' : 'bg-red-900 border border-red-500/40 text-red-300'}`}>
      {t.type === 'success' ? '✅ ' : '❌ '}{t.msg}
    </div>
  );
}

// ─── Delete modal ─────────────────────────────────────────────
function DelModal({ title, onOk, onCancel, busy }: { title: string; onOk: () => void; onCancel: () => void; busy: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111221] border border-red-500/20 rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center">
        <div className="w-14 h-14 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle size={24} className="text-red-400" />
        </div>
        <h3 className="text-white font-black text-xl mb-2">Delete Set?</h3>
        <p className="text-gray-500 text-sm mb-6">
          Permanently deletes <span className="text-white font-bold">"{title}"</span> and all its questions.
        </p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-2xl border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/5 transition">Cancel</button>
          <button onClick={onOk} disabled={busy} className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 transition disabled:opacity-50">
            {busy ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Solution Panel (per question) ───────────────────────────
function SolutionPanel({
  q, idx, activeF, setActiveF, setQuestions, uploadImg, say
}: {
  q: FormQuestion;
  idx: number;
  activeF: { type: string; qId?: number; optId?: string } | null;
  setActiveF: React.Dispatch<React.SetStateAction<any>>;
  setQuestions: React.Dispatch<React.SetStateAction<FormQuestion[]>>;
  uploadImg: (base64: string, path: string) => Promise<string>;
  say: (msg: string, type?: 'success' | 'error') => void;
}) {
  const solImgRef = useRef<HTMLInputElement>(null);
  const solVidRef = useRef<HTMLInputElement>(null);

  const setSol = (patch: Partial<Solution>) =>
    setQuestions(qs => qs.map((qx, i) => i === idx ? { ...qx, solution: { ...qx.solution, ...patch } } : qx));

  const hasSolution = q.solution.text || q.solution.imageBase64 || q.solution.imageUrl || q.solution.videoUrl || q.solution.videoFile;

  return (
    <div className="mt-6 rounded-[2rem] overflow-hidden border border-emerald-500/20">

      {/* Toggle header */}
      <button
        onClick={() => setQuestions(qs => qs.map((qx, i) => i === idx ? { ...qx, solutionOpen: !qx.solutionOpen } : qx))}
        className="w-full flex items-center justify-between px-6 py-4 bg-emerald-500/5 hover:bg-emerald-500/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center">
            <Lightbulb size={13} className="text-emerald-400" />
          </div>
          <span className="text-emerald-400 text-xs font-black uppercase tracking-widest">Solution</span>
          {hasSolution && (
            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/25">
              Added
            </span>
          )}
        </div>
        {q.solutionOpen
          ? <ChevronUp size={16} className="text-gray-500" />
          : <ChevronDown size={16} className="text-gray-500" />}
      </button>

      {/* Solution body */}
      {q.solutionOpen && (
        <div className="bg-[#0d1a12] p-6 space-y-5">

          {/* ── Text solution ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <FileText size={12} className="text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Solution Text</span>
              <span className="text-[9px] text-gray-700 font-mono">supports $LaTeX$</span>
            </div>
            <textarea
              value={q.solution.text}
              onFocus={() => setActiveF({ type: 'solution', qId: q.id })}
              onChange={e => setSol({ text: e.target.value })}
              placeholder="Write the full solution here… use $formula$ for math"
              className="w-full bg-[#0a0b14] border border-white/5 rounded-2xl p-5 text-gray-200 outline-none resize-none text-sm leading-relaxed focus:border-emerald-500/40 transition-all"
              rows={5}
            />
            <MathPrev text={q.solution.text} />
          </div>

          {/* ── Solution image ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <ImageIcon size={12} className="text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Solution Image</span>
            </div>

            {/* Preview existing/new image */}
            {(q.solution.imageBase64 || q.solution.imageUrl) ? (
              <div className="relative w-fit mb-3">
                <img
                  src={q.solution.imageBase64 ?? q.solution.imageUrl!}
                  className="max-h-48 rounded-2xl border border-white/10 object-contain"
                  alt="solution"
                />
                <button
                  onClick={() => setSol({ imageBase64: null, imageUrl: null })}
                  className="absolute -top-2 -right-2 p-1.5 bg-red-500 rounded-full shadow-xl hover:scale-110 transition"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <button
                onClick={() => solImgRef.current?.click()}
                className="flex items-center gap-3 px-5 py-3.5 bg-[#0a0b14] border border-dashed border-white/10 rounded-2xl text-gray-500 hover:border-emerald-500/40 hover:text-emerald-400 transition-all text-sm w-full"
              >
                <ImageIcon size={16} />
                <span className="text-xs font-bold">Upload solution image (PNG / JPG / SVG)</span>
              </button>
            )}
            <input
              type="file" ref={solImgRef} className="hidden" accept="image/*"
              onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                const r = new FileReader();
                r.onloadend = () => setSol({ imageBase64: r.result as string, imageUrl: null });
                r.readAsDataURL(f);
              }}
            />
            {(q.solution.imageBase64 || q.solution.imageUrl) && (
              <button
                onClick={() => solImgRef.current?.click()}
                className="mt-2 text-[10px] text-gray-600 hover:text-gray-400 transition underline"
              >
                Change image
              </button>
            )}
          </div>

          {/* ── Solution video ── */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Video size={12} className="text-emerald-400" />
              <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">Solution Video</span>
            </div>

            {/* Video tabs: URL vs Upload */}
            <div className="flex bg-[#0a0b14] p-1 rounded-xl border border-white/5 mb-4 w-fit">
              <button
                onClick={() => setSol({ videoFile: null, videoFileName: '' })}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${!q.solution.videoFile ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-gray-400'}`}
              >
                URL / YouTube
              </button>
              <button
                onClick={() => setSol({ videoUrl: '' })}
                className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${q.solution.videoFile ? 'bg-emerald-600 text-white' : 'text-gray-600 hover:text-gray-400'}`}
              >
                Upload File
              </button>
            </div>

            {!q.solution.videoFile ? (
              /* URL input */
              <div>
                <input
                  value={q.solution.videoUrl}
                  onChange={e => setSol({ videoUrl: e.target.value })}
                  placeholder="https://youtube.com/watch?v=... or direct video link"
                  className="w-full bg-[#0a0b14] border border-white/5 rounded-2xl p-4 text-sm text-gray-200 outline-none focus:border-emerald-500/40 transition-all font-mono placeholder-gray-700"
                />
                {/* YouTube embed preview */}
                {q.solution.videoUrl && (q.solution.videoUrl.includes('youtube.com') || q.solution.videoUrl.includes('youtu.be')) && (
                  <div className="mt-3 rounded-2xl overflow-hidden border border-white/10">
                    <iframe
                      src={`https://www.youtube.com/embed/${extractYoutubeId(q.solution.videoUrl)}`}
                      className="w-full aspect-video"
                      allowFullScreen
                      title="Solution video"
                    />
                  </div>
                )}
              </div>
            ) : (
              /* Uploaded file preview */
              <div className="flex items-center gap-4 p-4 bg-[#0a0b14] border border-emerald-500/20 rounded-2xl">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center flex-shrink-0">
                  <Video size={18} className="text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white text-xs font-bold truncate">{q.solution.videoFileName || 'video.mp4'}</p>
                  <p className="text-gray-600 text-[10px]">Ready to upload</p>
                </div>
                <button
                  onClick={() => setSol({ videoFile: null, videoFileName: '' })}
                  className="p-1.5 text-red-400 hover:bg-red-500/10 rounded-lg transition"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {!q.solution.videoFile && (
              <button
                onClick={() => solVidRef.current?.click()}
                className="mt-3 flex items-center gap-2 text-[10px] text-gray-600 hover:text-emerald-400 transition font-bold uppercase tracking-widest"
              >
                <Video size={11} /> Or upload a video file instead
              </button>
            )}
            <input
              type="file" ref={solVidRef} className="hidden" accept="video/*"
              onChange={e => {
                const f = e.target.files?.[0]; if (!f) return;
                const r = new FileReader();
                r.onloadend = () => setSol({ videoFile: r.result as string, videoFileName: f.name, videoUrl: '' });
                r.readAsDataURL(f);
              }}
            />
          </div>

        </div>
      )}
    </div>
  );
}

// ─── YouTube ID extractor ─────────────────────────────────────
function extractYoutubeId(url: string): string {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([a-zA-Z0-9_-]{11})/);
  return m ? m[1] : '';
}

// ═════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═════════════════════════════════════════════════════════════
export default function CATMockStudio() {
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  const [authed,  setAuthed]  = useState(false);
  const [view,    setView]    = useState<'list' | 'form'>('list');
  const [editing, setEditing] = useState<CatSet | null>(null);

  // list
  const [sets,        setSets]        = useState<CatSet[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterType,  setFilterType]  = useState<'all' | 'topic' | 'sectional' | 'full'>('all');
  const [delTarget,   setDelTarget]   = useState<CatSet | null>(null);
  const [delBusy,     setDelBusy]     = useState(false);

  // form
  const [title,     setTitle]     = useState('');
  const [mockType,  setMockType]  = useState<'topic' | 'sectional' | 'full'>('topic');
  const [duration,  setDuration]  = useState(40);
  const [section,   setSection]   = useState('qa');
  const [module,    setModule]    = useState('');
  const [topic,     setTopic]     = useState('');
  const [passage,   setPassage]   = useState('');
  const [passImg,   setPassImg]   = useState<string | null>(null);
  const [modOpen,   setModOpen]   = useState(false);
  const [topOpen,   setTopOpen]   = useState(false);
  const [questions, setQuestions] = useState<FormQuestion[]>([blankQ()]);
  const [activeF,   setActiveF]   = useState<{ type: string; qId?: number; optId?: string } | null>(null);
  const [saving,    setSaving]    = useState(false);

  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const say = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type }); setTimeout(() => setToast(null), 3500);
  };

  const passImgRef = useRef<HTMLInputElement>(null);

  // ── Auth guard ───────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const { data: p } = await supabase.from('admin_profiles').select('id').eq('id', user.id).single();
      if (!p) { router.replace('/dashboard'); return; }
      setAuthed(true);
    })();
  }, [supabase, router]);

  // ── Fetch sets ───────────────────────────────────────────
  const fetchSets = useCallback(async () => {
    setLoadingList(true);
    const { data, error } = await supabase.from('catquestion_sets').select('*').order('created_at', { ascending: false });
    if (error) { say(error.message, 'error'); setLoadingList(false); return; }
    const withCounts = await Promise.all((data ?? []).map(async (s: CatSet) => {
      const { count } = await supabase.from('catquestions').select('id', { count: 'exact', head: true }).eq('set_id', s.id);
      return { ...s, question_count: count ?? 0 };
    }));
    setSets(withCounts);
    setLoadingList(false);
  }, [supabase]);

  useEffect(() => { if (authed) fetchSets(); }, [authed, fetchSets]);

  // ── Upload image to Supabase storage ─────────────────────
  async function uploadImg(base64: string, path: string): Promise<string> {
    const b64 = base64.split(',')[1];
    const blob = await fetch(`data:image/png;base64,${b64}`).then(r => r.blob());
    const name = `${Date.now()}-${path}.png`;
    const { data, error } = await supabase.storage.from('catImage').upload(name, blob);
    if (error) throw error;
    return supabase.storage.from('catImage').getPublicUrl(data.path).data.publicUrl;
  }

  // ── Upload video file to Supabase storage ─────────────────
  async function uploadVideo(base64: string, fileName: string): Promise<string> {
    const [meta, b64] = base64.split(',');
    const mimeMatch = meta.match(/data:([^;]+);/);
    const mime = mimeMatch ? mimeMatch[1] : 'video/mp4';
    const ext = fileName.split('.').pop() ?? 'mp4';
    const blob = await fetch(`${meta},${b64}`).then(r => r.blob());
    const name = `${Date.now()}-solution.${ext}`;
    const { data, error } = await supabase.storage.from('catImage').upload(name, blob, { contentType: mime });
    if (error) throw error;
    return supabase.storage.from('catImage').getPublicUrl(data.path).data.publicUrl;
  }

  // ── Open edit — load questions with solution fields ───────
  async function openEdit(set: CatSet) {
    const { data: qs } = await supabase
      .from('catquestions').select('*').eq('set_id', set.id).order('order_index', { ascending: true });

    setTitle(set.title ?? '');
    setMockType(set.mock_type ?? 'topic');
    setDuration(set.duration_mins ?? 40);
    setSection(set.subject_section ?? 'qa');
    setModule(set.module ?? '');
    setTopic(set.topic ?? '');
    setPassage(set.passage_text ?? '');
    setPassImg(set.image_url ?? null);
    setEditing(set);

    const fqs: FormQuestion[] = (qs ?? []).map((q: any, i: number) => ({
      id: i + Date.now(),
      dbId: q.id,
      type: q.question_type as 'mcq' | 'tita',
      text: q.question_text ?? '',
      questionImage: q.question_image_url ?? null,
      options: q.options ?? [{ id: 'A', t: '' }, { id: 'B', t: '' }, { id: 'C', t: '' }, { id: 'D', t: '' }],
      correct: q.correct_option ?? 'A',
      difficulty: q.difficulty ?? 'moderate',
      solution: {
        text:          q.solution_text ?? '',
        imageBase64:   null,
        imageUrl:      q.solution_image_url ?? null,
        videoUrl:      q.solution_video_url ?? '',
        videoFile:     null,
        videoFileName: '',
      },
      solutionOpen: !!(q.solution_text || q.solution_image_url || q.solution_video_url),
    }));

    setQuestions(fqs.length > 0 ? fqs : [blankQ()]);
    setView('form');
  }

  // ── Delete set ───────────────────────────────────────────
  async function doDelete() {
    if (!delTarget) return;
    setDelBusy(true);
    await supabase.from('catquestions').delete().eq('set_id', delTarget.id);
    const { error } = await supabase.from('catquestion_sets').delete().eq('id', delTarget.id);
    if (error) say(error.message, 'error');
    else { say(`"${delTarget.title}" deleted`); await fetchSets(); }
    setDelTarget(null); setDelBusy(false);
  }

  // ── Reset form ───────────────────────────────────────────
  function resetForm() {
    setTitle(''); setMockType('topic'); setDuration(40); setSection('qa');
    setModule(''); setTopic(''); setPassage(''); setPassImg(null);
    setQuestions([blankQ()]); setEditing(null);
    setModOpen(false); setTopOpen(false);
  }

  // ── Insert math at active field ───────────────────────────
  function insertMath(latex: string) {
    const s = `$${latex}$`; if (!activeF) return;
    if (activeF.type === 'passage')  { setPassage(p => p + s); return; }
    if (activeF.type === 'question') setQuestions(qs => qs.map(q => q.id === activeF.qId ? { ...q, text: q.text + s } : q));
    if (activeF.type === 'tita')     setQuestions(qs => qs.map(q => q.id === activeF.qId ? { ...q, correct: q.correct + s } : q));
    if (activeF.type === 'option')   setQuestions(qs => qs.map(q => q.id === activeF.qId ? { ...q, options: q.options.map(o => o.id === activeF.optId ? { ...o, t: o.t + s } : o) } : q));
    if (activeF.type === 'solution') setQuestions(qs => qs.map(q => q.id === activeF.qId ? { ...q, solution: { ...q.solution, text: q.solution.text + s } } : q));
  }

  // ── Save / Update ─────────────────────────────────────────
  async function handleSave() {
    if (!title || !module || !topic) { say('Complete Title, Module and Topic!', 'error'); return; }
    setSaving(true);
    try {
      const finalPassImg = passImg?.startsWith('data:') ? await uploadImg(passImg, 'passage') : passImg ?? null;
      const payload = {
        title, mock_type: mockType, duration_mins: duration,
        subject_section: section, module, topic,
        passage_text: section === 'qa' ? '' : passage,
        image_url: finalPassImg,
      };

      let setId: string;
      if (editing) {
        const { error } = await supabase.from('catquestion_sets').update(payload).eq('id', editing.id);
        if (error) throw error;
        setId = editing.id;
        await supabase.from('catquestions').delete().eq('set_id', setId);
      } else {
        const { data, error } = await supabase.from('catquestion_sets').insert([payload]).select().single();
        if (error) throw error;
        setId = data.id;
      }

      const toInsert = await Promise.all(questions.map(async (q, i) => {
        // Upload question image
        const qImgUrl = q.questionImage?.startsWith('data:')
          ? await uploadImg(q.questionImage, `q-${i}`)
          : q.questionImage ?? null;

        // Upload solution image (new file takes priority, else keep existing URL)
        const solImgUrl = q.solution.imageBase64?.startsWith('data:')
          ? await uploadImg(q.solution.imageBase64, `sol-img-${i}`)
          : q.solution.imageUrl ?? null;

        // Upload solution video file (if a new file was selected)
        let solVidUrl: string | null = q.solution.videoUrl || null;
        if (q.solution.videoFile?.startsWith('data:')) {
          solVidUrl = await uploadVideo(q.solution.videoFile, q.solution.videoFileName || 'solution.mp4');
        }

        return {
          set_id:              setId,
          question_text:       q.text,
          difficulty:          q.difficulty,
          question_type:       q.type,
          options:             q.type === 'mcq' ? q.options : null,
          correct_option:      q.correct,
          order_index:         i,
          question_image_url:  qImgUrl,
          solution_text:       q.solution.text || null,
          solution_image_url:  solImgUrl,
          solution_video_url:  solVidUrl,
        };
      }));

      const { error: qErr } = await supabase.from('catquestions').insert(toInsert);
      if (qErr) throw qErr;

      say(editing ? 'Set updated!' : 'Set published!');
      resetForm(); await fetchSets(); setView('list');
    } catch (e: any) {
      say(e.message ?? 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  const filtered = sets.filter(s =>
    (filterType === 'all' || s.mock_type === filterType) &&
    (!search || s.title?.toLowerCase().includes(search.toLowerCase()) ||
      s.subject_section?.includes(search.toLowerCase()))
  );

  if (!authed) return (
    <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // LIST VIEW
  // ══════════════════════════════════════════════════════════
  if (view === 'list') return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6">
      <Toast t={toast} />
      {delTarget && <DelModal title={delTarget.title} onOk={doDelete} onCancel={() => setDelTarget(null)} busy={delBusy} />}

      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button onClick={() => router.push('/admin/adminpanel')}
              className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition">
              <ArrowLeft size={18} />
            </button>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <ShieldCheck size={13} className="text-orange-500" />
                <span className="text-orange-500 text-[10px] font-black uppercase tracking-widest">Admin Portal</span>
              </div>
              <h1 className="text-2xl font-black tracking-tight">CAT Mock Studio</h1>
              <p className="text-gray-600 text-xs mt-0.5">Questions · Solutions · Media</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchSets} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-500 hover:text-white transition">
              <RefreshCw size={16} className={loadingList ? 'animate-spin' : ''} />
            </button>
            <button onClick={() => { resetForm(); setView('form'); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl transition shadow-[0_0_15px_rgba(99,102,241,0.3)]">
              <Plus size={16} />New Set
            </button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            { l: 'Total Sets',  v: sets.length,                                     c: 'text-white'    },
            { l: 'Topic',       v: sets.filter(s => s.mock_type === 'topic').length,     c: 'text-orange-400' },
            { l: 'Sectional',   v: sets.filter(s => s.mock_type === 'sectional').length, c: 'text-blue-400'   },
            { l: 'Full Length', v: sets.filter(s => s.mock_type === 'full').length,      c: 'text-purple-400' },
          ].map(s => (
            <div key={s.l} className="bg-[#111221] border border-white/5 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or section…"
              className="w-full pl-9 pr-4 py-2.5 bg-[#111221] border border-white/5 rounded-xl text-sm text-white placeholder-gray-700 outline-none focus:border-indigo-500/50 transition" />
          </div>
          <div className="flex gap-1.5">
            {(['all', 'topic', 'sectional', 'full'] as const).map(t => (
              <button key={t} onClick={() => setFilterType(t)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${filterType === t ? 'bg-indigo-600 text-white' : 'bg-[#111221] border border-white/5 text-gray-500 hover:text-gray-300'}`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        {loadingList ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <LayoutGrid size={40} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm font-bold">{search || filterType !== 'all' ? 'No sets match your filters.' : 'No sets yet — create your first one.'}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(set => {
              const { Icon, color } = SD[set.subject_section] ?? { Icon: BookOpen, color: 'bg-gray-600' };
              return (
                <div key={set.id} className="bg-[#111221] border border-white/5 hover:border-white/10 rounded-2xl p-5 flex items-center gap-4 group transition">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
                    <Icon size={18} className="text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-white font-black text-sm truncate">{set.title}</h3>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${TYPE_COLORS[set.mock_type] ?? TYPE_COLORS.topic}`}>
                        {set.mock_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-600 flex-wrap">
                      <span className="uppercase font-bold">{set.subject_section}</span>
                      <span>•</span><span>{set.module}</span>
                      {set.topic && <><span>›</span><span>{set.topic}</span></>}
                      <span>•</span>
                      <span className="flex items-center gap-1"><Clock size={10} />{set.duration_mins}m</span>
                      <span>•</span>
                      <span className="flex items-center gap-1"><FileEdit size={10} />{set.question_count} Q</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(set)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-xs font-black rounded-xl hover:bg-indigo-500/25 transition">
                      <Edit3 size={13} />Edit
                    </button>
                    <button onClick={() => setDelTarget(set)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black rounded-xl hover:bg-red-500/20 transition">
                      <Trash2 size={13} />Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ══════════════════════════════════════════════════════════
  // FORM VIEW (Create / Edit)
  // ══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6">
      <Toast t={toast} />

      {/* Math toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1a1b2e]/95 backdrop-blur-md border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center gap-1">
        <div className="flex items-center px-4 border-r border-white/10 mr-1 gap-2">
          <Sigma size={16} className="text-indigo-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-500">Math</span>
        </div>
        {MATH_SYMS.map((s, i) => (
          <button key={i} onClick={() => insertMath(s.v)}
            className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-indigo-600 rounded-xl transition">
            <InlineMath math={s.l} />
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4 bg-[#111221] p-6 rounded-[2.5rem] border border-white/5">
          <div className="flex items-center gap-5">
            <button onClick={() => { resetForm(); setView('list'); }}
              className="p-3 bg-[#1a1b2e] rounded-2xl text-gray-400 hover:text-white transition">
              <ArrowLeft size={20} />
            </button>
            <div>
              <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest mb-0.5">
                {editing ? `Editing: ${editing.title}` : 'New Mock Set'}
              </p>
              <h1 className="text-xl font-black">{editing ? 'Edit Set' : 'Create Set'}</h1>
            </div>
          </div>
          {/* Subject tabs */}
          <div className="flex bg-[#0a0b14] p-1.5 rounded-2xl border border-white/5">
            {Object.entries(SD).map(([key, d]) => (
              <button key={key} onClick={() => { setSection(key); setModule(''); setTopic(''); }}
                className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${section === key ? `${d.color} shadow-lg text-white` : 'text-gray-500 hover:text-gray-300'}`}>
                <d.Icon size={14} />{key}
              </button>
            ))}
          </div>
        </header>

        {/* Metadata */}
        <div className="bg-[#111221] p-8 rounded-[2.5rem] border border-white/5 mb-8 grid grid-cols-1 md:grid-cols-3 gap-6 shadow-xl">
          <div>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3"><Type size={12} />Set Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Algebra Sectional 01"
              className="w-full bg-[#0a0b14] border border-white/5 p-4 rounded-2xl text-sm outline-none focus:border-indigo-500 transition-all" />
          </div>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3"><Layers size={12} />Mock Type</label>
            <div className="flex bg-[#0a0b14] p-1.5 rounded-2xl border border-white/5">
              {(['topic', 'sectional', 'full'] as const).map(t => (
                <button key={t} onClick={() => { setMockType(t); setDuration(t === 'topic' ? 15 : t === 'sectional' ? 40 : 120); }}
                  className={`flex-1 py-2.5 rounded-xl text-[9px] font-black uppercase transition-all ${mockType === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-500 mb-3"><Clock size={12} />Duration (min)</label>
            <input type="number" value={duration} onChange={e => setDuration(parseInt(e.target.value) || 0)}
              className="w-full bg-[#0a0b14] border border-white/5 p-4 rounded-2xl text-sm outline-none focus:border-indigo-500 font-mono" />
          </div>
        </div>

        <div className={`grid grid-cols-1 ${section !== 'qa' ? 'lg:grid-cols-12' : ''} gap-8`}>

          {/* Passage panel (DILR/VARC) */}
          {section !== 'qa' && (
            <div className="lg:col-span-5">
              <div className="bg-[#111221] rounded-[2.5rem] border border-white/5 p-8 sticky top-6 shadow-2xl flex flex-col" style={{ minHeight: 500 }}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-indigo-500/10 text-indigo-400 rounded-xl"><AlignLeft size={20} /></div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-gray-400">Passage</h2>
                  </div>
                  <button onClick={() => passImgRef.current?.click()} className="p-2 bg-white/5 hover:bg-indigo-500/20 rounded-lg text-indigo-400 transition">
                    <ImageIcon size={18} />
                  </button>
                  <input type="file" ref={passImgRef} className="hidden" onChange={e => {
                    const f = e.target.files?.[0]; if (!f) return;
                    const r = new FileReader(); r.onloadend = () => setPassImg(r.result as string); r.readAsDataURL(f);
                  }} />
                </div>
                {passImg && (
                  <div className="relative mb-4">
                    <img src={passImg} className="w-full h-40 object-cover rounded-2xl" alt="passage" />
                    <button onClick={() => setPassImg(null)} className="absolute top-2 right-2 p-1.5 bg-red-500 rounded-full"><X size={14} /></button>
                  </div>
                )}
                <textarea value={passage} onFocus={() => setActiveF({ type: 'passage' })} onChange={e => setPassage(e.target.value)}
                  placeholder="Type passage here… use $ for LaTeX"
                  className="flex-1 bg-[#0a0b14] border border-white/5 rounded-3xl p-6 text-gray-300 outline-none resize-none font-serif text-lg leading-relaxed focus:border-indigo-500/30 transition-all" />
                <MathPrev text={passage} />
              </div>
            </div>
          )}

          {/* Questions column */}
          <div className={`${section !== 'qa' ? 'lg:col-span-7' : ''} space-y-6 pb-32`}>

            {/* Module / Topic */}
            <div className="bg-[#111221] p-8 rounded-[2.5rem] border border-white/5 grid grid-cols-1 md:grid-cols-2 gap-6 shadow-xl">
              <div className="relative">
                <button onClick={() => setModOpen(o => !o)}
                  className="w-full flex items-center justify-between bg-[#0a0b14] border border-white/5 p-4 rounded-2xl text-sm hover:border-indigo-500/50 transition-all">
                  <span className="flex items-center gap-3 text-gray-300"><Layers size={16} className="text-indigo-400" />{module || 'Select Module *'}</span>
                  <ChevronDown size={18} className={`transition-transform ${modOpen ? 'rotate-180' : ''}`} />
                </button>
                {modOpen && (
                  <div className="absolute z-50 w-full mt-2 bg-[#1a1b2e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    {SD[section].modules.map(m => (
                      <button key={m} onClick={() => { setModule(m); setModOpen(false); setTopic(''); }}
                        className="w-full text-left p-4 hover:bg-indigo-600/20 text-[10px] font-black uppercase text-gray-400 hover:text-white border-b border-white/5 last:border-0">{m}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative">
                <button onClick={() => setTopOpen(o => !o)} disabled={!module}
                  className="w-full flex items-center justify-between bg-[#0a0b14] border border-white/5 p-4 rounded-2xl text-sm disabled:opacity-30 hover:border-emerald-500/50 transition-all">
                  <span className="flex items-center gap-3 text-gray-300"><Tag size={16} className="text-emerald-400" />{topic || 'Select Topic *'}</span>
                  <ChevronDown size={18} className={`transition-transform ${topOpen ? 'rotate-180' : ''}`} />
                </button>
                {topOpen && module && (
                  <div className="absolute z-50 w-full mt-2 bg-[#1a1b2e] border border-white/10 rounded-2xl max-h-64 overflow-y-auto shadow-2xl">
                    {SD[section].subTopics[module]?.map(t => (
                      <button key={t} onClick={() => { setTopic(t); setTopOpen(false); }}
                        className="w-full text-left p-4 hover:bg-emerald-600/20 text-[10px] font-black uppercase text-gray-400 hover:text-white border-b border-white/5 last:border-0">{t}</button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Question cards */}
            {questions.map((q, idx) => (
              <div key={q.id} className="bg-[#111221] p-8 rounded-[3rem] border border-white/5 shadow-2xl hover:border-white/10 transition-all">

                {/* Q header row */}
                <div className="flex flex-wrap justify-between items-center gap-4 mb-8">
                  <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-[10px] font-black text-indigo-400 bg-indigo-400/10 px-4 py-1.5 rounded-full">Q {idx + 1}</span>
                    {/* type */}
                    <div className="flex bg-[#0a0b14] p-1 rounded-xl border border-white/5">
                      {(['mcq', 'tita'] as const).map(t => (
                        <button key={t}
                          onClick={() => setQuestions(qs => qs.map((qx, i) => i === idx ? { ...qx, type: t, correct: t === 'tita' ? '' : qx.correct } : qx))}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all ${q.type === t ? 'bg-indigo-500 text-white shadow-lg' : 'text-gray-600 hover:text-gray-400'}`}>
                          {t.toUpperCase()}
                        </button>
                      ))}
                    </div>
                    {/* difficulty */}
                    <div className="flex bg-[#0a0b14] p-1 rounded-xl border border-white/5">
                      {DIFF.map(lv => (
                        <button key={lv.id}
                          onClick={() => setQuestions(qs => qs.map((qx, i) => i === idx ? { ...qx, difficulty: lv.id } : qx))}
                          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-1.5 ${q.difficulty === lv.id ? `${lv.bg} ${lv.color}` : 'text-gray-600 hover:text-gray-400'}`}>
                          <div className={`w-1 h-1 rounded-full ${q.difficulty === lv.id ? 'bg-current' : 'bg-gray-800'}`} />
                          {lv.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="cursor-pointer p-2.5 bg-white/5 hover:bg-indigo-500/20 text-indigo-400 rounded-xl transition-all">
                      <ImageIcon size={18} />
                      <input type="file" className="hidden" accept="image/*" onChange={e => {
                        const f = e.target.files?.[0]; if (!f) return;
                        const r = new FileReader();
                        r.onloadend = () => setQuestions(qs => qs.map(qx => qx.id === q.id ? { ...qx, questionImage: r.result as string } : qx));
                        r.readAsDataURL(f);
                      }} />
                    </label>
                    <button onClick={() => setQuestions(qs => qs.filter((_, i) => i !== idx))} disabled={questions.length === 1}
                      className="p-2.5 text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-xl transition disabled:opacity-30">
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>

                {/* Question image */}
                {q.questionImage && (
                  <div className="relative mb-6 w-fit">
                    <img src={q.questionImage} className="max-h-52 rounded-2xl border border-white/10" alt="q" />
                    <button onClick={() => setQuestions(qs => qs.map((qx, i) => i === idx ? { ...qx, questionImage: null } : qx))}
                      className="absolute -top-3 -right-3 p-2 bg-red-500 rounded-full shadow-xl hover:scale-110 transition"><X size={12} /></button>
                  </div>
                )}

                {/* Question text */}
                <textarea value={q.text} onFocus={() => setActiveF({ type: 'question', qId: q.id })}
                  onChange={e => setQuestions(qs => qs.map((qx, i) => i === idx ? { ...qx, text: e.target.value } : qx))}
                  className="w-full bg-transparent border-b border-white/5 mb-4 py-4 text-lg outline-none focus:border-indigo-500 transition-all h-24 resize-none leading-relaxed"
                  placeholder="Ask your question here…" />
                <MathPrev text={q.text} />

                {/* Answer area */}
                {q.type === 'mcq' ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                    {q.options.map(opt => (
                      <div key={opt.id} className="flex flex-col">
                        <div className={`flex items-center gap-3 bg-[#0a0b14] p-2.5 rounded-2xl border transition-all ${q.correct === opt.id ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-white/5 hover:border-white/10'}`}>
                          <button onClick={() => setQuestions(qs => qs.map((qx, i) => i === idx ? { ...qx, correct: opt.id } : qx))}
                            className={`w-10 h-10 rounded-xl font-black text-xs transition-all ${q.correct === opt.id ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/40' : 'bg-[#1a1b2e] text-gray-600 hover:text-gray-400'}`}>
                            {opt.id}
                          </button>
                          <input value={opt.t} onFocus={() => setActiveF({ type: 'option', qId: q.id, optId: opt.id })}
                            onChange={e => setQuestions(qs => qs.map((qx, i) => i === idx ? { ...qx, options: qx.options.map(o => o.id === opt.id ? { ...o, t: e.target.value } : o) } : qx))}
                            className="bg-transparent border-none outline-none text-sm text-gray-300 flex-1 px-2"
                            placeholder={`Option ${opt.id}…`} />
                        </div>
                        <MathPrev text={opt.t} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-8 p-6 bg-indigo-500/5 border border-indigo-500/20 rounded-[2.5rem]">
                    <div className="flex items-center gap-3 mb-4 text-indigo-400">
                      <Edit3 size={18} /><span className="text-[10px] font-black uppercase tracking-widest">TITA Answer</span>
                    </div>
                    <input value={q.correct} onFocus={() => setActiveF({ type: 'tita', qId: q.id })}
                      onChange={e => setQuestions(qs => qs.map((qx, i) => i === idx ? { ...qx, correct: e.target.value } : qx))}
                      className="w-full bg-[#0a0b14] border border-white/10 rounded-2xl p-5 text-gray-200 outline-none focus:border-indigo-500 transition-all font-mono text-lg"
                      placeholder="Enter the correct answer…" />
                    <MathPrev text={q.correct} />
                  </div>
                )}

                {/* ── SOLUTION PANEL ── */}
                <SolutionPanel
                  q={q} idx={idx}
                  activeF={activeF} setActiveF={setActiveF}
                  setQuestions={setQuestions}
                  uploadImg={uploadImg}
                  say={say}
                />

              </div>
            ))}

            {/* Action buttons */}
            <div className="flex flex-col md:flex-row gap-5">
              <button onClick={() => setQuestions(qs => [...qs, blankQ()])}
                className="flex-1 bg-[#111221] border border-white/5 py-6 rounded-[2.5rem] font-black uppercase text-[10px] tracking-widest hover:bg-[#1a1b2e] transition-all flex items-center justify-center gap-3 group shadow-xl">
                <Plus size={18} className="group-hover:rotate-90 transition-transform duration-300" />Add Question
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex-[1.5] bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-6 rounded-[2.5rem] font-black uppercase text-[11px] tracking-[0.3em] transition-all flex items-center justify-center gap-3 shadow-2xl shadow-indigo-600/30 active:scale-95">
                {saving
                  ? <div className="animate-spin h-5 w-5 border-2 border-white border-t-transparent rounded-full" />
                  : <><Check size={20} strokeWidth={3} />{editing ? 'Update Set' : 'Publish Set'}</>}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
