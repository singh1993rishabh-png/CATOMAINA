'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import {
  ArrowLeft, Settings2, BookOpen, Layers, Trophy, Clock,
  ChevronRight, Star, Brain, RotateCcw, Play, Plus, Minus, Zap
} from 'lucide-react';

interface Exam { id:string; name:string; icon:string; display_name:string; }
interface DrillConfig {
  exam_id:string; mode:'topic'|'sectional'|'full_length'|'pyq'|'custom';
  subjects:string[]; chapters:string[]; topics:string[];
  difficulty:('easy'|'medium'|'hard')[]; question_type:('mcq'|'numerical'|'multiple_correct')[];
  source_filter:'all'|'pyq'|'new'; question_count:number;
  time_mode:'timed'|'untimed'|'custom'; custom_minutes:number;
  order:'sequential'|'random'|'difficulty_asc'|'difficulty_desc';
  show_solution:'after_each'|'at_end'|'never'; negative_marking:boolean;
}

const MODES = [
  {id:'topic',       icon:<BookOpen size={18}/>,  label:'Topic',     desc:'Focused topic practice'},
  {id:'sectional',   icon:<Layers size={18}/>,    label:'Sectional', desc:'Full section simulation'},
  {id:'full_length', icon:<Trophy size={18}/>,    label:'Full Mock', desc:'3-hour CAT simulation'},
  {id:'pyq',         icon:<Star size={18}/>,      label:'PYQ',       desc:'Previous year questions'},
  {id:'custom',      icon:<Settings2 size={18}/>, label:'Custom',    desc:'Build your own test'},
] as const;

const DEFAULT:DrillConfig = {
  exam_id:'', mode:'topic', subjects:[], chapters:[], topics:[],
  difficulty:['easy','medium','hard'], question_type:['mcq'],
  source_filter:'all', question_count:20, time_mode:'timed',
  custom_minutes:30, order:'random', show_solution:'at_end', negative_marking:true,
};

function Toggle({active, onClick, children}:{active:boolean;onClick:()=>void;children:React.ReactNode}) {
  return (
    <button onClick={onClick} className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${active?'bg-yellow-500/15 border-yellow-500/40 text-yellow-400':'bg-white/3 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'}`}>
      {children}
    </button>
  );
}

export default function DrillPage() {
  const supabase  = useMemo(()=>createClient(),[]);
  const router    = useRouter();
  const [exams,      setExams]      = useState<Exam[]>([]);
  const [subjects,   setSubjects]   = useState<string[]>([]);
  const [chapters,   setChapters]   = useState<string[]>([]);
  const [topics,     setTopics]     = useState<string[]>([]);
  const [qCount,     setQCount]     = useState(0);
  const [config,     setConfig]     = useState<DrillConfig>(DEFAULT);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState('');

  // Auth
  useEffect(()=>{
    supabase.auth.getUser().then(({data:{user}})=>{ if(!user) router.replace('/login'); });
  },[supabase,router]);

  // Fetch exams
  useEffect(()=>{
    supabase.from('exams').select('id,name,icon,display_name').eq('is_active',true)
      .then(({data})=>{ if(data) setExams(data); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[supabase]);

  // Cascade: exam → subjects
  useEffect(()=>{
    if(!config.exam_id){setSubjects([]);return;}
    supabase.from('questions').select('subject').eq('exam_id',config.exam_id)
      .then(({data})=>{ if(data) setSubjects([...new Set(data.map((d:any)=>d.subject).filter(Boolean))].sort()); });
  },[config.exam_id, supabase]);

  // Cascade: subjects → chapters
  useEffect(()=>{
    if(!config.exam_id||config.subjects.length===0){setChapters([]);return;}
    supabase.from('questions').select('chapter').eq('exam_id',config.exam_id).in('subject',config.subjects)
      .then(({data})=>{ if(data) setChapters([...new Set(data.map((d:any)=>d.chapter).filter(Boolean))].sort()); });
  },[config.subjects, config.exam_id, supabase]);

  // Cascade: chapters → topics
  useEffect(()=>{
    if(config.chapters.length===0){setTopics([]);return;}
    supabase.from('questions').select('topic').in('chapter',config.chapters)
      .then(({data})=>{ if(data) setTopics([...new Set(data.map((d:any)=>d.topic).filter(Boolean))].sort()); });
  },[config.chapters, supabase]);

  // Live count
  useEffect(()=>{
    if(!config.exam_id){setQCount(0);return;}
    let q=supabase.from('questions').select('id',{count:'exact',head:true}).eq('exam_id',config.exam_id);
    if(config.subjects.length)   q=q.in('subject',config.subjects);
    if(config.chapters.length)   q=q.in('chapter',config.chapters);
    if(config.topics.length)     q=q.in('topic',config.topics);
    if(config.difficulty.length<3) q=q.in('difficulty',config.difficulty);
    if(config.question_type.length) q=q.in('question_type',config.question_type);
    if(config.source_filter==='pyq') q=q.not('source','is',null);
    if(config.source_filter==='new') q=q.is('source',null);
    q.then(({count})=>setQCount(count??0));
  },[config.exam_id,config.subjects,config.chapters,config.topics,config.difficulty,config.question_type,config.source_filter, supabase]);

  function set<K extends keyof DrillConfig>(key:K, val:DrillConfig[K]){setConfig(prev=>({...prev,[key]:val}));}
  function toggle<T>(arr:T[],val:T):T[]{return arr.includes(val)?arr.filter(v=>v!==val):[...arr,val];}
  const timePreset=()=>({topic:20,sectional:60,full_length:180,pyq:30,custom:config.custom_minutes}[config.mode]??30);
  const effectiveTime=config.time_mode==='custom'?config.custom_minutes:config.time_mode==='timed'?timePreset():0;

  async function startDrill() {
    if(!config.exam_id) return;
    setLoading(true); setError('');
    try {
      let q=supabase.from('questions')
        .select('id,question_text,question_image_url,question_type,difficulty,positive_marks,negative_marks,numerical_answer,subject,chapter,topic,source,question_options(id,option_label,option_text,option_image_url,is_correct,option_order)')
        .eq('exam_id',config.exam_id);
      if(config.subjects.length)   q=q.in('subject',config.subjects);
      if(config.chapters.length)   q=q.in('chapter',config.chapters);
      if(config.topics.length)     q=q.in('topic',config.topics);
      if(config.difficulty.length<3) q=q.in('difficulty',config.difficulty);
      if(config.question_type.length) q=q.in('question_type',config.question_type);
      if(config.source_filter==='pyq') q=q.not('source','is',null);
      if(config.source_filter==='new') q=q.is('source',null);
      if(config.order==='difficulty_asc')  q=q.order('difficulty',{ascending:true});
      else if(config.order==='difficulty_desc') q=q.order('difficulty',{ascending:false});
      else q=q.order('id');
      q=q.limit(config.question_count*3);
      const {data,error:fetchErr}=await q;
      if(fetchErr) throw fetchErr;
      if(!data||data.length===0){setError('No questions found. Try broadening your filters.');setLoading(false);return;}
      let questions=[...data];
      if(config.order==='random'){
        for(let i=questions.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[questions[i],questions[j]]=[questions[j],questions[i]];}
      }
      questions=questions.slice(0,config.question_count);
      sessionStorage.setItem('drill_session',JSON.stringify({questions,config:{...config,time_minutes:effectiveTime},mode:'drill',total:questions.length}));
      router.push('/mocktest?drill=1');
    } catch(e:any) {
      setError(e?.message??'Failed to load questions.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      <div className="fixed inset-0 z-0 opacity-[0.022]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',backgroundSize:'44px 44px'}}/>
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(139,92,246,0.08),transparent)]"/>

      <div className="relative z-10 max-w-3xl mx-auto px-4 md:px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={()=>router.push('/dashboard')}
            className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition">
            <ArrowLeft size={18}/>
          </button>
          <div>
            <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest mb-0.5">Dashboard → Drill</p>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Brain size={22} className="text-purple-400"/>Student Drill
            </h1>
          </div>
          {config.exam_id && (
            <button onClick={()=>{setConfig(DEFAULT);setError('');}} className="ml-auto flex items-center gap-1.5 text-sm text-gray-600 hover:text-white transition font-bold">
              <RotateCcw size={14}/>Reset
            </button>
          )}
        </div>

        <div className="space-y-4">

          {/* ── Mode selector ── */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Test Mode</p>
            <div className="grid grid-cols-5 gap-3">
              {MODES.map(m=>(
                <button key={m.id} onClick={()=>set('mode',m.id)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-2xl border text-center transition-all ${config.mode===m.id?'bg-purple-500/15 border-purple-500/40 text-purple-300':'bg-white/3 border-white/8 text-gray-600 hover:border-white/15 hover:text-gray-400'}`}>
                  {m.icon}
                  <span className="text-[10px] font-black uppercase">{m.label}</span>
                  <span className="text-[9px] text-gray-600 leading-tight">{m.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* ── Exam ── */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Exam</p>
            {exams.length===0 ? (
              <p className="text-gray-700 text-sm">No exams found. Add exams via Admin Panel.</p>
            ) : (
              <div className="flex gap-3 flex-wrap">
                {exams.map(e=>(
                  <button key={e.id} onClick={()=>{set('exam_id',e.id);set('subjects',[]);set('chapters',[]);set('topics',[]);}}
                    className={`flex items-center gap-2 px-5 py-3 rounded-2xl border text-sm font-bold transition-all ${config.exam_id===e.id?'bg-yellow-500/15 border-yellow-500/40 text-yellow-400':'bg-white/3 border-white/10 text-gray-500 hover:border-white/20 hover:text-gray-300'}`}>
                    <span>{e.icon}</span>{e.display_name||e.name}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Filters: Subject / Chapter / Topic ── */}
          {(subjects.length>0||chapters.length>0||topics.length>0) && (
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6 space-y-5">
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Filters <span className="text-gray-700 normal-case font-normal">(all optional)</span></p>

              {subjects.length>0 && (
                <div>
                  <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-2">Subject</p>
                  <div className="flex gap-2 flex-wrap">
                    {subjects.map(s=><Toggle key={s} active={config.subjects.includes(s)} onClick={()=>set('subjects',toggle(config.subjects,s))}>{s}</Toggle>)}
                  </div>
                </div>
              )}
              {chapters.length>0 && (
                <div>
                  <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-2">Chapter</p>
                  <div className="flex gap-2 flex-wrap max-h-28 overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'#333 transparent'}}>
                    {chapters.map(c=><Toggle key={c} active={config.chapters.includes(c)} onClick={()=>set('chapters',toggle(config.chapters,c))}>{c}</Toggle>)}
                  </div>
                </div>
              )}
              {topics.length>0 && (
                <div>
                  <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-2">Topic</p>
                  <div className="flex gap-2 flex-wrap max-h-20 overflow-y-auto" style={{scrollbarWidth:'thin',scrollbarColor:'#333 transparent'}}>
                    {topics.map(t=><Toggle key={t} active={config.topics.includes(t)} onClick={()=>set('topics',toggle(config.topics,t))}>{t}</Toggle>)}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Difficulty + Type + Source ── */}
          <div className="grid md:grid-cols-3 gap-4">
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-5">
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Difficulty</p>
              <div className="flex flex-col gap-2">
                {(['easy','medium','hard'] as const).map(d=>(
                  <Toggle key={d} active={config.difficulty.includes(d)} onClick={()=>set('difficulty',toggle(config.difficulty,d))}>
                    {d==='easy'?'🟢 Easy':d==='medium'?'🟡 Medium':'🔴 Hard'}
                  </Toggle>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-5">
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Type</p>
              <div className="flex flex-col gap-2">
                {(['mcq','numerical','multiple_correct'] as const).map(t=>(
                  <Toggle key={t} active={config.question_type.includes(t)} onClick={()=>set('question_type',toggle(config.question_type,t))}>
                    {t==='mcq'?'MCQ':t==='numerical'?'Numerical':'Multi-Correct'}
                  </Toggle>
                ))}
              </div>
            </div>
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-5">
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-3">Source</p>
              <div className="flex flex-col gap-2">
                {(['all','pyq','new'] as const).map(s=>(
                  <Toggle key={s} active={config.source_filter===s} onClick={()=>set('source_filter',s)}>
                    {s==='all'?'All Questions':s==='pyq'?'⭐ PYQ Only':'New Only'}
                  </Toggle>
                ))}
              </div>
            </div>
          </div>

          {/* ── Count + Timing ── */}
          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">
                Questions: <span className="text-white">{config.question_count}</span>
                {config.exam_id && <span className="text-gray-700 font-normal ml-1">({qCount} available)</span>}
              </p>
              <div className="flex items-center gap-3 mb-4">
                <button onClick={()=>set('question_count',Math.max(5,config.question_count-5))}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition flex-shrink-0"><Minus size={14}/></button>
                <div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-purple-500 to-indigo-500 rounded-full transition-all"
                    style={{width:`${Math.min(100,qCount>0?(config.question_count/qCount)*100:(config.question_count/100)*100)}%`}}/>
                </div>
                <button onClick={()=>set('question_count',Math.min(qCount||200,config.question_count+5))}
                  className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition flex-shrink-0"><Plus size={14}/></button>
              </div>
              <div className="flex gap-2">
                {[10,20,30,50].map(n=>(
                  <button key={n} onClick={()=>set('question_count',n)}
                    className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all ${config.question_count===n?'bg-purple-500/20 text-purple-400 border border-purple-500/40':'text-gray-600 hover:text-gray-400 border border-white/5'}`}>{n}</button>
                ))}
              </div>
            </div>

            <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Timing</p>
              <div className="flex gap-2 flex-wrap mb-4">
                {(['timed','untimed','custom'] as const).map(t=>(
                  <Toggle key={t} active={config.time_mode===t} onClick={()=>set('time_mode',t)}>
                    {t==='timed'?`⏱ Auto (${timePreset()}m)`:t==='untimed'?'∞ No limit':'✎ Custom'}
                  </Toggle>
                ))}
              </div>
              {config.time_mode==='custom' && (
                <div className="flex items-center gap-3">
                  <Clock size={14} className="text-gray-600 flex-shrink-0"/>
                  <input type="range" min={5} max={180} step={5} value={config.custom_minutes}
                    onChange={e=>set('custom_minutes',parseInt(e.target.value))} className="flex-1 accent-purple-500"/>
                  <span className="text-white text-sm font-black w-10 text-right">{config.custom_minutes}m</span>
                </div>
              )}
              <div className="mt-4">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">Order</p>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['random','sequential','difficulty_asc','difficulty_desc'] as const).map(o=>(
                    <button key={o} onClick={()=>set('order',o)}
                      className={`py-1.5 px-2 rounded-lg text-[10px] font-bold transition-all text-left ${config.order===o?'bg-indigo-500/15 text-indigo-400 border border-indigo-500/30':'text-gray-600 hover:text-gray-400 border border-white/5'}`}>
                      {o==='random'?'🎲 Random':o==='sequential'?'📋 Sequential':o==='difficulty_asc'?'↑ Easy→Hard':'↓ Hard→Easy'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ── Advanced: Solutions + Negative ── */}
          <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
            <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-4">Advanced Options</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-2">Solutions</p>
                <div className="flex gap-2 flex-wrap">
                  {(['after_each','at_end','never'] as const).map(s=>(
                    <Toggle key={s} active={config.show_solution===s} onClick={()=>set('show_solution',s)}>
                      {s==='after_each'?'✅ After each':s==='at_end'?'📊 At end':'🙈 Never'}
                    </Toggle>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-gray-600 text-[10px] font-bold uppercase tracking-widest mb-2">Marking</p>
                <button onClick={()=>set('negative_marking',!config.negative_marking)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold border transition-all ${config.negative_marking?'bg-red-500/10 border-red-500/20 text-red-400':'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
                  {config.negative_marking?'⚠️ Negative Marking ON':'✅ No Negative Marking'}
                </button>
              </div>
            </div>
          </div>

          {/* ── Error ── */}
          {error && (
            <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">{error}</div>
          )}

          {/* ── Launch ── */}
          <button onClick={startDrill}
            disabled={loading||!config.exam_id||config.question_type.length===0||config.difficulty.length===0}
            className="w-full flex items-center justify-center gap-3 py-5 rounded-3xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-base transition-all hover:scale-[1.01] active:scale-[0.99] disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_30px_rgba(139,92,246,0.3)]">
            {loading
              ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"/>
              : <><Play size={18} className="fill-white"/>Start Drill — {config.question_count}Q · {effectiveTime>0?`${effectiveTime}m`:'Untimed'}</>}
          </button>
          {!config.exam_id && <p className="text-center text-gray-700 text-sm">Select an exam above to enable the drill</p>}

        </div>
      </div>
    </div>
  );
}
