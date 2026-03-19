'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../../utils/supabase/client';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import {
  ArrowLeft, Plus, Trash2, Edit3, Eye, EyeOff, Search,
  FileText, Video, HelpCircle, ShieldCheck, RefreshCw,
  ChevronDown, X, Check, ImageIcon, Lightbulb, Sigma,
  BookOpen, Calculator, Network, AlertTriangle, ExternalLink,
  LayoutGrid
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────
interface StudyTopic {
  id: string; subject_section: string; module: string; topic: string;
  description: string | null; difficulty: string;
  pdf_url: string | null; video_url: string | null; video_type: string;
  estimated_mins: number; is_published: boolean; created_at: string;
  question_count?: number;
}

interface FormQuestion {
  uid: number; dbId?: string;
  type: 'mcq' | 'tita';
  text: string; image: string | null;
  options: { id: string; t: string }[];
  correct: string; difficulty: string;
  solution_text: string; solution_image: string | null;
  solOpen: boolean;
}

// ─── Subject config (mirrors uploadQuestion) ───────────────────
const SD: Record<string, { modules: string[]; topics: Record<string, string[]>; color: string; icon: any }> = {
  qa: {
    modules: ['Arithmetic','Algebra','Geometry','Number Systems','Modern Math'],
    topics: {
      Arithmetic:['Percentages','Profit & Loss','SI & CI','Averages','Time & Work','TDS'],
      Algebra:['Linear Equations','Quadratic Equations','Logarithms','Functions','Progressions'],
      Geometry:['Triangles','Circles','Polygons','Coordinate Geometry','Mensuration'],
      'Number Systems':['Remainders','Factors','LCM & HCF'],
      'Modern Math':['P&C','Probability','Set Theory'],
    },
    color:'bg-orange-500', icon: Calculator,
  },
  dilr: {
    modules:['Logical Reasoning','Data Interpretation','Puzzles'],
    topics:{
      'Logical Reasoning':['Blood Relations','Seating Arrangement','Syllogisms','Clocks & Calendars'],
      'Data Interpretation':['Tables','Bar Charts','Pie Charts','Caselets'],
      Puzzles:['Matrix Match','Grid Puzzles','Ranking'],
    },
    color:'bg-blue-500', icon: Network,
  },
  varc: {
    modules:['Verbal Ability','Reading Comprehension'],
    topics:{
      'Verbal Ability':['Para Jumbles','Odd One Out','Para Summary','Sentence Completion'],
      'Reading Comprehension':['Philosophy','Social Science','Business & Economics','Science & Tech'],
    },
    color:'bg-emerald-500', icon: BookOpen,
  },
};

const MATH_SYMS = [
  {l:'√',v:'\\sqrt{x}'},{l:'xⁿ',v:'x^{n}'},{l:'Σ',v:'\\sum'},
  {l:'π',v:'\\pi'},{l:'≠',v:'\\neq'},{l:'log',v:'\\log_{b}x'},
];

const DIFF_OPTS = ['easy','moderate','hard'];

const blankQ = (): FormQuestion => ({
  uid: Date.now() + Math.random(), type: 'mcq', text: '', image: null,
  options: [{id:'A',t:''},{id:'B',t:''},{id:'C',t:''},{id:'D',t:''}],
  correct: 'A', difficulty: 'moderate', solution_text: '', solution_image: null, solOpen: false,
});

function MathPrev({ text }: { text: string }) {
  if (!text?.includes('$')) return null;
  return (
    <div className="mt-2 p-3 bg-indigo-500/5 border border-indigo-500/10 rounded-xl text-sm text-gray-200 overflow-x-auto">
      {text.split(/(\$.*?\$)/g).map((p,i) =>
        p.startsWith('$')&&p.endsWith('$') ? <InlineMath key={i} math={p.slice(1,-1)}/> : <span key={i}>{p}</span>)}
    </div>
  );
}

function Toast({ msg, type }: { msg: string; type: 'success'|'error' }) {
  return (
    <div className={`fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-5 py-3 rounded-2xl text-sm font-bold shadow-2xl ${
      type==='success'?'bg-emerald-900 border border-emerald-500/40 text-emerald-300':'bg-red-900 border border-red-500/40 text-red-300'
    }`}>
      {type==='success'?'✅ ':'❌ '}{msg}
    </div>
  );
}

function DelModal({ name, onOk, onCancel, busy }: { name:string; onOk:()=>void; onCancel:()=>void; busy:boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#111221] border border-red-500/20 rounded-3xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="w-12 h-12 rounded-2xl bg-red-500/15 flex items-center justify-center mx-auto mb-4"><AlertTriangle size={22} className="text-red-400"/></div>
        <h3 className="text-white font-black text-lg mb-2">Delete Topic?</h3>
        <p className="text-gray-500 text-sm mb-6">Deletes <span className="text-white font-bold">"{name}"</span> and all its questions.</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 rounded-2xl border border-white/10 text-gray-400 font-bold text-sm hover:bg-white/5 transition">Cancel</button>
          <button onClick={onOk} disabled={busy} className="flex-1 py-3 rounded-2xl bg-red-600 text-white font-bold text-sm hover:bg-red-700 disabled:opacity-50 transition">{busy?'Deleting…':'Delete'}</button>
        </div>
      </div>
    </div>
  );
}

// ─── MAIN ──────────────────────────────────────────────────────
export default function StudyAdminPage() {
  const supabase = useMemo(() => createClient(), []);
  const router   = useRouter();
  const [authed, setAuthed] = useState(false);
  const [view,   setView]   = useState<'list'|'form'>('list');
  const [editing,setEditing]= useState<StudyTopic|null>(null);

  // List state
  const [topics,      setTopics]      = useState<StudyTopic[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [search,      setSearch]      = useState('');
  const [filterSec,   setFilterSec]   = useState('all');
  const [delTarget,   setDelTarget]   = useState<StudyTopic|null>(null);
  const [delBusy,     setDelBusy]     = useState(false);
  const [toast,       setToast]       = useState<{msg:string;type:'success'|'error'}|null>(null);

  // Form — topic metadata
  const [fSec,        setFSec]        = useState('qa');
  const [fModule,     setFModule]     = useState('');
  const [fTopic,      setFTopic]      = useState('');
  const [fDesc,       setFDesc]       = useState('');
  const [fDiff,       setFDiff]       = useState('moderate');
  const [fMins,       setFMins]       = useState(20);
  const [fPdfUrl,     setFPdfUrl]     = useState('');
  const [fPdfFile,    setFPdfFile]    = useState<string|null>(null);
  const [fVideoUrl,   setFVideoUrl]   = useState('');
  const [fVideoFile,  setFVideoFile]  = useState<string|null>(null);
  const [fVideoFileName, setFVideoFileName] = useState('');
  const [fVideoType,  setFVideoType]  = useState<'youtube'|'upload'>('youtube');
  const [fPublished,  setFPublished]  = useState(false);
  const [fModOpen,    setFModOpen]    = useState(false);
  const [fTopOpen,    setFTopOpen]    = useState(false);
  const [saving,      setSaving]      = useState(false);

  // Questions
  const [questions,   setQuestions]   = useState<FormQuestion[]>([blankQ()]);
  const [activeField, setActiveField] = useState<{type:string;uid?:number;opt?:string}|null>(null);

  const pdfRef   = useRef<HTMLInputElement>(null);
  const vidRef   = useRef<HTMLInputElement>(null);

  const say = (msg:string, type:'success'|'error'='success') => {
    setToast({msg,type}); setTimeout(()=>setToast(null),3500);
  };

  // Auth guard
  useEffect(() => {
    (async () => {
      const {data:{user}} = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      const {data:p} = await supabase.from('admin_profiles').select('id').eq('id',user.id).single();
      if (!p) { router.replace('/dashboard'); return; }
      setAuthed(true);
    })();
  },[supabase,router]);

  const fetchTopics = useCallback(async () => {
    setLoadingList(true);
    const {data} = await supabase.from('study_topics').select('*').order('subject_section').order('module').order('created_at',{ascending:false});
    const withCounts = await Promise.all((data??[]).map(async (t:StudyTopic) => {
      const {count} = await supabase.from('study_questions').select('id',{count:'exact',head:true}).eq('topic_id',t.id);
      return {...t, question_count: count??0};
    }));
    setTopics(withCounts);
    setLoadingList(false);
  },[supabase]);

  useEffect(()=>{ if(authed) fetchTopics(); },[authed,fetchTopics]);

  // Upload helpers
  async function uploadFile(base64:string, name:string, bucket:string): Promise<string> {
    const [meta,b64] = base64.split(',');
    const mime = meta.match(/data:([^;]+);/)?.[1] ?? 'application/octet-stream';
    const ext  = name.split('.').pop() ?? 'bin';
    const blob = await fetch(`${meta},${b64}`).then(r=>r.blob());
    const path = `${Date.now()}-${name.replace(/\s/g,'_')}`;
    const {data,error} = await supabase.storage.from(bucket).upload(path, blob, {contentType:mime});
    if (error) throw error;
    return supabase.storage.from(bucket).getPublicUrl(data.path).data.publicUrl;
  }

  async function uploadImgBase64(base64:string, name:string): Promise<string> {
    return uploadFile(base64, name+'.png', 'catImage');
  }

  // Open edit
  async function openEdit(t:StudyTopic) {
    setFSec(t.subject_section); setFModule(t.module); setFTopic(t.topic);
    setFDesc(t.description??''); setFDiff(t.difficulty); setFMins(t.estimated_mins);
    setFPdfUrl(t.pdf_url??''); setFPdfFile(null);
    setFVideoUrl(t.video_url??''); setFVideoFile(null); setFVideoFileName('');
    setFVideoType((t.video_type??'youtube') as 'youtube'|'upload');
    setFPublished(t.is_published);
    const {data:qs} = await supabase.from('study_questions').select('*').eq('topic_id',t.id).order('order_index',{ascending:true});
    const fqs:FormQuestion[] = (qs??[]).map((q:any,i:number)=>({
      uid:i+Date.now(), dbId:q.id, type:q.question_type as 'mcq'|'tita',
      text:q.question_text, image:q.question_image_url??null,
      options:q.options??[{id:'A',t:''},{id:'B',t:''},{id:'C',t:''},{id:'D',t:''}],
      correct:q.correct_option, difficulty:q.difficulty,
      solution_text:q.solution_text??'', solution_image:q.solution_image_url??null, solOpen:false,
    }));
    setQuestions(fqs.length>0?fqs:[blankQ()]);
    setEditing(t); setView('form');
  }

  function resetForm() {
    setFSec('qa'); setFModule(''); setFTopic(''); setFDesc(''); setFDiff('moderate'); setFMins(20);
    setFPdfUrl(''); setFPdfFile(null); setFVideoUrl(''); setFVideoFile(null); setFVideoFileName('');
    setFVideoType('youtube'); setFPublished(false);
    setQuestions([blankQ()]); setEditing(null); setFModOpen(false); setFTopOpen(false);
  }

  // Math toolbar insert
  function insertMath(latex:string) {
    const s=`$${latex}$`; if(!activeField) return;
    if (activeField.type==='qtext') setQuestions(qs=>qs.map(q=>q.uid===activeField.uid?{...q,text:q.text+s}:q));
    if (activeField.type==='opt')   setQuestions(qs=>qs.map(q=>q.uid===activeField.uid?{...q,options:q.options.map(o=>o.id===activeField.opt?{...o,t:o.t+s}:o)}:q));
    if (activeField.type==='sol')   setQuestions(qs=>qs.map(q=>q.uid===activeField.uid?{...q,solution_text:q.solution_text+s}:q));
    if (activeField.type==='tita')  setQuestions(qs=>qs.map(q=>q.uid===activeField.uid?{...q,correct:q.correct+s}:q));
  }

  // Save topic
  async function handleSave() {
    if (!fModule||!fTopic) { say('Fill Module and Topic!','error'); return; }
    setSaving(true);
    try {
      // Upload PDF if file selected
      let finalPdf = fPdfUrl;
      if (fPdfFile) finalPdf = await uploadFile(fPdfFile, `study-${fTopic}.pdf`, 'catImage');

      // Upload video if file selected
      let finalVideo = fVideoUrl;
      if (fVideoFile) finalVideo = await uploadFile(fVideoFile, fVideoFileName||'video.mp4', 'catImage');

      const payload = {
        subject_section: fSec, module: fModule, topic: fTopic,
        description: fDesc||null, difficulty: fDiff, estimated_mins: fMins,
        pdf_url: finalPdf||null, video_url: finalVideo||null,
        video_type: fVideoFile ? 'upload' : fVideoType,
        is_published: fPublished,
      };

      let topicId:string;
      if (editing) {
        const {error} = await supabase.from('study_topics').update(payload).eq('id',editing.id);
        if (error) throw error;
        topicId = editing.id;
        await supabase.from('study_questions').delete().eq('topic_id',topicId);
      } else {
        const {data,error} = await supabase.from('study_topics').insert([payload]).select().single();
        if (error) throw error;
        topicId = data.id;
      }

      // Insert questions
      const toInsert = await Promise.all(questions.map(async (q,i) => {
        const qImg = q.image?.startsWith('data:') ? await uploadImgBase64(q.image,`q-${i}`) : q.image??null;
        const sImg = q.solution_image?.startsWith('data:') ? await uploadImgBase64(q.solution_image,`sol-${i}`) : q.solution_image??null;
        return {
          topic_id: topicId, question_text: q.text, question_image_url: qImg,
          question_type: q.type, options: q.type==='mcq'?q.options:null,
          correct_option: q.correct, difficulty: q.difficulty,
          solution_text: q.solution_text||null, solution_image_url: sImg,
          order_index: i,
        };
      }));
      const {error:qErr} = await supabase.from('study_questions').insert(toInsert);
      if (qErr) throw qErr;

      say(editing?'Topic updated!':'Topic published!');
      resetForm(); await fetchTopics(); setView('list');
    } catch(e:any) { say(e.message??'Save failed','error'); }
    finally { setSaving(false); }
  }

  // Delete
  async function doDelete() {
    if (!delTarget) return;
    setDelBusy(true);
    await supabase.from('study_questions').delete().eq('topic_id',delTarget.id);
    const {error} = await supabase.from('study_topics').delete().eq('id',delTarget.id);
    if (error) say(error.message,'error');
    else { say(`"${delTarget.topic}" deleted`); await fetchTopics(); }
    setDelTarget(null); setDelBusy(false);
  }

  // Toggle publish
  async function togglePublish(t:StudyTopic) {
    await supabase.from('study_topics').update({is_published:!t.is_published}).eq('id',t.id);
    await fetchTopics();
  }

  const filtered = topics.filter(t =>
    (filterSec==='all'||t.subject_section===filterSec) &&
    (!search||t.topic.toLowerCase().includes(search.toLowerCase())||t.module.toLowerCase().includes(search.toLowerCase()))
  );

  if (!authed) return <div className="min-h-screen bg-[#0a0b14] flex items-center justify-center"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"/></div>;

  // ══ LIST ══════════════════════════════════════════════════════
  if (view==='list') return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6">
      {toast && <Toast msg={toast.msg} type={toast.type}/>}
      {delTarget && <DelModal name={delTarget.topic} onOk={doDelete} onCancel={()=>setDelTarget(null)} busy={delBusy}/>}
      <div className="max-w-6xl mx-auto">

        {/* Header */}
        <header className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <button onClick={()=>router.push('/admin/adminpanel')} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition"><ArrowLeft size={18}/></button>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5"><ShieldCheck size={12} className="text-orange-500"/><span className="text-orange-500 text-[10px] font-black uppercase tracking-widest">Admin Portal</span></div>
              <h1 className="text-2xl font-black">Study Room Manager</h1>
              <p className="text-gray-600 text-xs mt-0.5">PDF · Video · Practice Questions</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={fetchTopics} className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-500 hover:text-white transition"><RefreshCw size={16} className={loadingList?'animate-spin':''}/></button>
            <button onClick={()=>{resetForm();setView('form');}} className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-black text-sm rounded-xl transition shadow-[0_0_15px_rgba(99,102,241,0.3)]"><Plus size={16}/>New Topic</button>
          </div>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          {[
            {l:'Total',     v:topics.length,                              c:'text-white'},
            {l:'Quants',    v:topics.filter(t=>t.subject_section==='qa').length,   c:'text-orange-400'},
            {l:'DILR',      v:topics.filter(t=>t.subject_section==='dilr').length, c:'text-blue-400'},
            {l:'Verbal',    v:topics.filter(t=>t.subject_section==='varc').length, c:'text-emerald-400'},
          ].map(s=>(
            <div key={s.l} className="bg-[#111221] border border-white/5 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-black ${s.c}`}>{s.v}</p>
              <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mt-0.5">{s.l}</p>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3 mb-5">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600"/>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search topics…"
              className="w-full pl-9 pr-4 py-2.5 bg-[#111221] border border-white/5 rounded-xl text-sm text-white placeholder-gray-700 outline-none focus:border-indigo-500/50 transition"/>
          </div>
          <div className="flex gap-1.5">
            {['all','qa','dilr','varc'].map(s=>(
              <button key={s} onClick={()=>setFilterSec(s)}
                className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition ${filterSec===s?'bg-indigo-600 text-white':'bg-[#111221] border border-white/5 text-gray-500 hover:text-gray-300'}`}>
                {s==='all'?'All':s.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Topic list */}
        {loadingList ? (
          <div className="flex items-center justify-center py-20"><div className="w-8 h-8 border-2 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"/></div>
        ) : filtered.length===0 ? (
          <div className="text-center py-20 text-gray-600"><LayoutGrid size={40} className="mx-auto mb-4 opacity-30"/><p className="text-sm font-bold">{search||filterSec!=='all'?'No topics match your filters.':'No topics yet — create your first one.'}</p></div>
        ) : (
          <div className="space-y-2.5">
            {filtered.map(t => {
              const sec = SD[t.subject_section];
              return (
                <div key={t.id} className="bg-[#111221] border border-white/5 hover:border-white/10 rounded-2xl p-5 flex items-center gap-4 group transition">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${sec?.color??'bg-gray-600'}`}>
                    {sec && <sec.icon size={18} className="text-white"/>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="text-white font-black text-sm truncate">{t.topic}</h3>
                      <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        t.is_published?'bg-emerald-500/15 text-emerald-400 border-emerald-500/25':'bg-gray-500/15 text-gray-500 border-gray-500/25'
                      }`}>{t.is_published?'Published':'Draft'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-gray-600 flex-wrap">
                      <span className="uppercase font-bold">{t.subject_section}</span>
                      <span>·</span><span>{t.module}</span>
                      {t.pdf_url&&<span className="flex items-center gap-1"><FileText size={10}/>PDF</span>}
                      {t.video_url&&<span className="flex items-center gap-1"><Video size={10}/>Video</span>}
                      <span className="flex items-center gap-1"><HelpCircle size={10}/>{t.question_count} Q</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={()=>togglePublish(t)} title={t.is_published?'Unpublish':'Publish'}
                      className={`p-2 rounded-lg border text-xs transition ${t.is_published?'bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20':'bg-white/5 border-white/10 text-gray-500 hover:text-emerald-400'}`}>
                      {t.is_published?<EyeOff size={14}/>:<Eye size={14}/>}
                    </button>
                    <a href={`/study/${t.id}`} target="_blank" rel="noreferrer"
                      className="p-2 rounded-lg bg-white/5 border border-white/10 text-gray-500 hover:text-white transition">
                      <ExternalLink size={14}/>
                    </a>
                    <button onClick={()=>openEdit(t)} className="flex items-center gap-1.5 px-3 py-2 bg-indigo-500/15 border border-indigo-500/25 text-indigo-400 text-xs font-black rounded-xl hover:bg-indigo-500/25 transition"><Edit3 size={13}/>Edit</button>
                    <button onClick={()=>setDelTarget(t)} className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-black rounded-xl hover:bg-red-500/20 transition"><Trash2 size={13}/>Delete</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  // ══ FORM ══════════════════════════════════════════════════════
  return (
    <div className="min-h-screen bg-[#0a0b14] text-white p-6 pb-40">
      {toast && <Toast msg={toast.msg} type={toast.type}/>}

      {/* Math toolbar */}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#1a1b2e]/95 backdrop-blur-md border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center gap-1">
        <div className="flex items-center px-3 border-r border-white/10 mr-1 gap-1.5">
          <Sigma size={15} className="text-indigo-400"/><span className="text-[9px] font-black uppercase tracking-widest text-gray-500">Math</span>
        </div>
        {MATH_SYMS.map((s,i)=>(
          <button key={i} onClick={()=>insertMath(s.v)} className="w-9 h-9 flex items-center justify-center bg-white/5 hover:bg-indigo-600 rounded-xl transition text-sm">
            <InlineMath math={s.l}/>
          </button>
        ))}
      </div>

      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <header className="flex items-center gap-5 mb-8 bg-[#111221] p-6 rounded-3xl border border-white/5">
          <button onClick={()=>{resetForm();setView('list');}} className="p-3 bg-[#1a1b2e] rounded-2xl text-gray-400 hover:text-white transition"><ArrowLeft size={20}/></button>
          <div>
            <p className="text-gray-600 text-[10px] font-black uppercase tracking-widest mb-0.5">{editing?`Editing: ${editing.topic}`:'New Study Topic'}</p>
            <h1 className="text-xl font-black">{editing?'Edit Topic':'Create Topic'}</h1>
          </div>
          {/* Section tabs */}
          <div className="ml-auto flex bg-[#0a0b14] p-1.5 rounded-2xl border border-white/5">
            {Object.entries(SD).map(([key,d])=>(
              <button key={key} onClick={()=>{setFSec(key);setFModule('');setFTopic('');}}
                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all ${fSec===key?`${d.color} text-white`:'text-gray-500 hover:text-gray-300'}`}>
                <d.icon size={13}/>{key}
              </button>
            ))}
          </div>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* ── LEFT: Topic metadata ── */}
          <div className="space-y-4">

            {/* Module + Topic */}
            <div className="bg-[#111221] p-6 rounded-3xl border border-white/5 space-y-4">
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Topic Details</p>

              {/* Module dropdown */}
              <div className="relative">
                <button onClick={()=>setFModOpen(o=>!o)}
                  className="w-full flex items-center justify-between bg-[#0a0b14] border border-white/5 p-4 rounded-2xl text-sm hover:border-indigo-500/50 transition">
                  <span className="text-gray-300">{fModule||'Select Module *'}</span>
                  <ChevronDown size={16} className={fModOpen?'rotate-180 transition-transform':'transition-transform'}/>
                </button>
                {fModOpen&&(
                  <div className="absolute z-50 w-full mt-2 bg-[#1a1b2e] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
                    {SD[fSec].modules.map(m=>(
                      <button key={m} onClick={()=>{setFModule(m);setFTopic('');setFModOpen(false);setFTopOpen(false);}}
                        className="w-full text-left p-4 hover:bg-indigo-600/20 text-[10px] font-black uppercase text-gray-400 hover:text-white border-b border-white/5 last:border-0">{m}</button>
                    ))}
                  </div>
                )}
              </div>

              {/* Topic dropdown */}
              <div className="relative">
                <button onClick={()=>setFTopOpen(o=>!o)} disabled={!fModule}
                  className="w-full flex items-center justify-between bg-[#0a0b14] border border-white/5 p-4 rounded-2xl text-sm disabled:opacity-40 hover:border-emerald-500/50 transition">
                  <span className="text-gray-300">{fTopic||'Select Topic *'}</span>
                  <ChevronDown size={16} className={fTopOpen?'rotate-180 transition-transform':'transition-transform'}/>
                </button>
                {fTopOpen&&fModule&&(
                  <div className="absolute z-50 w-full mt-2 bg-[#1a1b2e] border border-white/10 rounded-2xl max-h-56 overflow-y-auto shadow-2xl">
                    {SD[fSec].topics[fModule]?.map(t=>(
                      <button key={t} onClick={()=>{setFTopic(t);setFTopOpen(false);}}
                        className="w-full text-left p-4 hover:bg-emerald-600/20 text-[10px] font-black uppercase text-gray-400 hover:text-white border-b border-white/5 last:border-0">{t}</button>
                    ))}
                    {/* Custom topic input */}
                    <div className="p-3 border-t border-white/10">
                      <input
                        placeholder="Or type a custom topic…"
                        onKeyDown={e=>{if(e.key==='Enter'&&e.currentTarget.value){setFTopic(e.currentTarget.value);setFTopOpen(false);}}}
                        className="w-full bg-[#0a0b14] border border-white/10 rounded-xl px-3 py-2 text-xs text-white outline-none placeholder-gray-700"/>
                    </div>
                  </div>
                )}
              </div>

              {/* Description */}
              <textarea value={fDesc} onChange={e=>setFDesc(e.target.value)} placeholder="Short description shown on the card…" rows={2}
                className="w-full bg-[#0a0b14] border border-white/5 rounded-2xl p-4 text-sm text-gray-200 outline-none resize-none focus:border-indigo-500/40 transition placeholder-gray-700"/>

              {/* Difficulty + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mb-2">Difficulty</p>
                  <div className="flex gap-1">
                    {DIFF_OPTS.map(d=>(
                      <button key={d} onClick={()=>setFDiff(d)}
                        className={`flex-1 py-2 rounded-xl text-[9px] font-black uppercase transition-all ${fDiff===d?d==='easy'?'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40':d==='hard'?'bg-rose-500/20 text-rose-400 border border-rose-500/40':'bg-amber-500/20 text-amber-400 border border-amber-500/40':'bg-white/5 text-gray-600 border border-white/5'}`}>
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mb-2">Est. Time (min)</p>
                  <input type="number" value={fMins} onChange={e=>setFMins(parseInt(e.target.value)||0)} min={1} max={180}
                    className="w-full bg-[#0a0b14] border border-white/5 rounded-xl p-2 text-sm text-white outline-none focus:border-indigo-500/40 font-mono transition"/>
                </div>
              </div>

              {/* Published toggle */}
              <button onClick={()=>setFPublished(p=>!p)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border transition-all ${fPublished?'bg-emerald-500/10 border-emerald-500/25 text-emerald-400':'bg-white/5 border-white/10 text-gray-500 hover:text-gray-300'}`}>
                <span className="text-sm font-bold">{fPublished?'✅ Published — visible to students':'🔒 Draft — hidden from students'}</span>
                {fPublished?<Eye size={16}/>:<EyeOff size={16}/>}
              </button>
            </div>

            {/* ── PDF section ── */}
            <div className="bg-[#111221] p-6 rounded-3xl border border-white/5 space-y-4">
              <div className="flex items-center gap-2">
                <FileText size={14} className="text-red-400"/><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">PDF Material</p>
              </div>
              <input value={fPdfUrl} onChange={e=>setFPdfUrl(e.target.value)} placeholder="Paste PDF URL (Google Drive, Supabase, etc.)…"
                className="w-full bg-[#0a0b14] border border-white/5 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-red-500/40 transition placeholder-gray-700 font-mono"/>
              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-white/5"/><span className="text-gray-700 text-[10px] font-bold">OR UPLOAD</span><div className="flex-1 h-px bg-white/5"/>
              </div>
              <button onClick={()=>pdfRef.current?.click()}
                className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed text-sm font-bold transition ${fPdfFile?'border-red-500/40 text-red-400 bg-red-500/5':'border-white/10 text-gray-600 hover:border-red-500/30 hover:text-red-400'}`}>
                <FileText size={16}/>{fPdfFile?'PDF selected — click to replace':'Upload PDF file'}
              </button>
              <input type="file" ref={pdfRef} className="hidden" accept=".pdf" onChange={e=>{
                const f=e.target.files?.[0]; if(!f) return;
                const r=new FileReader(); r.onloadend=()=>setFPdfFile(r.result as string); r.readAsDataURL(f);
              }}/>
              {(fPdfUrl||fPdfFile)&&(
                <button onClick={()=>{setFPdfUrl('');setFPdfFile(null);}} className="text-[10px] text-gray-600 hover:text-red-400 transition font-bold flex items-center gap-1"><X size={10}/>Remove PDF</button>
              )}
            </div>

            {/* ── Video section ── */}
            <div className="bg-[#111221] p-6 rounded-3xl border border-white/5 space-y-4">
              <div className="flex items-center gap-2">
                <Video size={14} className="text-blue-400"/><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Video Lecture</p>
              </div>
              <div className="flex gap-1.5 bg-[#0a0b14] p-1 rounded-xl border border-white/5 w-fit">
                <button onClick={()=>setFVideoType('youtube')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition ${fVideoType==='youtube'?'bg-blue-600 text-white':'text-gray-600 hover:text-gray-400'}`}>YouTube</button>
                <button onClick={()=>setFVideoType('upload')} className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase transition ${fVideoType==='upload'?'bg-blue-600 text-white':'text-gray-600 hover:text-gray-400'}`}>Upload</button>
              </div>
              {fVideoType==='youtube'?(
                <input value={fVideoUrl} onChange={e=>setFVideoUrl(e.target.value)} placeholder="https://youtube.com/watch?v=…"
                  className="w-full bg-[#0a0b14] border border-white/5 rounded-2xl px-4 py-3 text-sm text-white outline-none focus:border-blue-500/40 transition placeholder-gray-700 font-mono"/>
              ):(
                <div>
                  <button onClick={()=>vidRef.current?.click()}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-dashed text-sm font-bold transition ${fVideoFile?'border-blue-500/40 text-blue-400 bg-blue-500/5':'border-white/10 text-gray-600 hover:border-blue-500/30 hover:text-blue-400'}`}>
                    <Video size={16}/>{fVideoFile?`${fVideoFileName} — click to replace`:'Upload MP4 / WebM file'}
                  </button>
                  <input type="file" ref={vidRef} className="hidden" accept="video/*" onChange={e=>{
                    const f=e.target.files?.[0]; if(!f) return;
                    setFVideoFileName(f.name);
                    const r=new FileReader(); r.onloadend=()=>setFVideoFile(r.result as string); r.readAsDataURL(f);
                  }}/>
                </div>
              )}
              {(fVideoUrl||fVideoFile)&&(
                <button onClick={()=>{setFVideoUrl('');setFVideoFile(null);setFVideoFileName('');}} className="text-[10px] text-gray-600 hover:text-blue-400 transition font-bold flex items-center gap-1"><X size={10}/>Remove Video</button>
              )}
            </div>
          </div>

          {/* ── RIGHT: Practice Questions ── */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><HelpCircle size={14} className="text-indigo-400"/><p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Practice Questions</p></div>
              <span className="text-gray-700 text-[10px]">No negative marking</span>
            </div>

            {questions.map((q,idx)=>(
              <div key={q.uid} className="bg-[#111221] p-5 rounded-3xl border border-white/5 space-y-4">

                {/* Q header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-indigo-400 bg-indigo-400/10 px-3 py-1 rounded-full">Q {idx+1}</span>
                    <div className="flex bg-[#0a0b14] p-0.5 rounded-lg border border-white/5">
                      {(['mcq','tita'] as const).map(t=>(
                        <button key={t} onClick={()=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,type:t,correct:t==='tita'?'':qx.correct}:qx))}
                          className={`px-2.5 py-1 rounded-md text-[9px] font-black uppercase transition ${q.type===t?'bg-indigo-500 text-white':'text-gray-600 hover:text-gray-400'}`}>{t}</button>
                      ))}
                    </div>
                    <div className="flex bg-[#0a0b14] p-0.5 rounded-lg border border-white/5">
                      {DIFF_OPTS.map(d=>(
                        <button key={d} onClick={()=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,difficulty:d}:qx))}
                          className={`px-2 py-1 rounded-md text-[9px] font-black uppercase transition ${q.difficulty===d?(d==='easy'?'bg-emerald-500/20 text-emerald-400':d==='hard'?'bg-rose-500/20 text-rose-400':'bg-amber-500/20 text-amber-400'):'text-gray-600 hover:text-gray-400'}`}>{d[0]}</button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="p-1.5 bg-white/5 hover:bg-indigo-500/20 text-indigo-400 rounded-lg cursor-pointer transition">
                      <ImageIcon size={14}/>
                      <input type="file" className="hidden" accept="image/*" onChange={e=>{
                        const f=e.target.files?.[0]; if(!f) return;
                        const r=new FileReader(); r.onloadend=()=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,image:r.result as string}:qx)); r.readAsDataURL(f);
                      }}/>
                    </label>
                    <button onClick={()=>setQuestions(qs=>qs.filter((_,i)=>i!==idx))} disabled={questions.length===1}
                      className="p-1.5 text-gray-700 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition disabled:opacity-30"><Trash2 size={14}/></button>
                  </div>
                </div>

                {/* Question image preview */}
                {q.image&&(
                  <div className="relative w-fit">
                    <img src={q.image} className="max-h-32 rounded-xl border border-white/10" alt="q"/>
                    <button onClick={()=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,image:null}:qx))} className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full"><X size={10}/></button>
                  </div>
                )}

                {/* Question text */}
                <textarea value={q.text} onFocus={()=>setActiveField({type:'qtext',uid:q.uid})}
                  onChange={e=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,text:e.target.value}:qx))}
                  placeholder="Question text… use $LaTeX$ for math" rows={3}
                  className="w-full bg-[#0a0b14] border border-white/5 rounded-2xl p-3 text-sm text-gray-200 outline-none resize-none focus:border-indigo-500/40 transition placeholder-gray-700"/>
                <MathPrev text={q.text}/>

                {/* MCQ options */}
                {q.type==='mcq'&&(
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map(opt=>(
                      <div key={opt.id}>
                        <div className={`flex items-center gap-2 bg-[#0a0b14] p-2 rounded-xl border transition ${q.correct===opt.id?'border-indigo-500 ring-1 ring-indigo-500/20':'border-white/5'}`}>
                          <button onClick={()=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,correct:opt.id}:qx))}
                            className={`w-7 h-7 rounded-lg text-[10px] font-black transition-all flex-shrink-0 ${q.correct===opt.id?'bg-indigo-600 text-white':'bg-white/5 text-gray-600 hover:text-gray-400'}`}>{opt.id}</button>
                          <input value={opt.t} onFocus={()=>setActiveField({type:'opt',uid:q.uid,opt:opt.id})}
                            onChange={e=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,options:qx.options.map(o=>o.id===opt.id?{...o,t:e.target.value}:o)}:qx))}
                            className="bg-transparent border-none outline-none text-xs text-gray-300 flex-1" placeholder={`Option ${opt.id}…`}/>
                        </div>
                        <MathPrev text={opt.t}/>
                      </div>
                    ))}
                  </div>
                )}

                {/* TITA answer */}
                {q.type==='tita'&&(
                  <input value={q.correct} onFocus={()=>setActiveField({type:'tita',uid:q.uid})}
                    onChange={e=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,correct:e.target.value}:qx))}
                    placeholder="Correct numerical answer…"
                    className="w-full bg-[#0a0b14] border border-indigo-500/20 rounded-2xl px-4 py-3 text-indigo-200 text-sm font-mono outline-none focus:border-indigo-500/50 transition"/>
                )}

                {/* Solution (collapsible) */}
                <button onClick={()=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,solOpen:!qx.solOpen}:qx))}
                  className="w-full flex items-center gap-2 text-[10px] font-black uppercase text-emerald-400 bg-emerald-500/5 border border-emerald-500/15 px-3 py-2 rounded-xl hover:bg-emerald-500/10 transition">
                  <Lightbulb size={11}/> {q.solOpen?'Hide':'Show'} Solution
                  {(q.solution_text||q.solution_image)&&<span className="ml-auto text-[9px] bg-emerald-500/20 px-1.5 py-0.5 rounded-full">Added</span>}
                </button>
                {q.solOpen&&(
                  <div className="bg-[#0d1a12] p-4 rounded-2xl border border-emerald-500/10 space-y-3">
                    <textarea value={q.solution_text} onFocus={()=>setActiveField({type:'sol',uid:q.uid})}
                      onChange={e=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,solution_text:e.target.value}:qx))}
                      placeholder="Solution explanation… $LaTeX$ supported" rows={3}
                      className="w-full bg-[#0a0b14] border border-white/5 rounded-xl p-3 text-sm text-gray-200 outline-none resize-none focus:border-emerald-500/30 transition placeholder-gray-700"/>
                    <MathPrev text={q.solution_text}/>
                    <label className="flex items-center gap-2 text-xs text-gray-500 hover:text-emerald-400 cursor-pointer transition font-bold">
                      <ImageIcon size={12}/> {q.solution_image?'Change solution image':'Add solution image'}
                      <input type="file" className="hidden" accept="image/*" onChange={e=>{
                        const f=e.target.files?.[0]; if(!f) return;
                        const r=new FileReader(); r.onloadend=()=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,solution_image:r.result as string}:qx)); r.readAsDataURL(f);
                      }}/>
                    </label>
                    {q.solution_image&&(
                      <div className="relative w-fit">
                        <img src={q.solution_image} className="max-h-28 rounded-xl border border-white/10" alt="sol"/>
                        <button onClick={()=>setQuestions(qs=>qs.map((qx,i)=>i===idx?{...qx,solution_image:null}:qx))} className="absolute -top-2 -right-2 p-1 bg-red-500 rounded-full"><X size={10}/></button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}

            {/* Add question + Save */}
            <button onClick={()=>setQuestions(qs=>[...qs,blankQ()])}
              className="w-full bg-[#111221] border border-white/5 py-4 rounded-3xl font-black uppercase text-[10px] tracking-widest hover:bg-[#1a1b2e] transition flex items-center justify-center gap-3 group">
              <Plus size={16} className="group-hover:rotate-90 transition-transform duration-300"/>Add Question
            </button>
            <button onClick={handleSave} disabled={saving}
              className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 py-5 rounded-3xl font-black uppercase text-[11px] tracking-[0.3em] transition flex items-center justify-center gap-3 shadow-2xl shadow-indigo-600/30 active:scale-95">
              {saving?<div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"/>:<><Check size={18}/>{editing?'Update Topic':'Publish Topic'}</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
