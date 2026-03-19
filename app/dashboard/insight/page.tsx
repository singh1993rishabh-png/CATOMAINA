'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/app/utils/supabase/client';
import {
  ArrowLeft, Brain, Calculator, Network, BookOpen, Target,
  Zap, Clock, BarChart2, AlertCircle, Award, Flame,
  TrendingUp, TrendingDown, Minus, Trophy
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface TestResult {
  id: string; contest_id: string; score: number;
  total_marks: number; time_taken: number;
  answers: Record<string, any> | null;
}
interface SectionStat {
  section: string; label: string; color: string; icon: any; accent: string;
  tests: number; avgScore: number; avgAccuracy: number;
  trend: 'up'|'down'|'flat'; recentScore: number; scores: number[];
}
interface DiffStat { difficulty: string; correct: number; wrong: number; skipped: number; accuracy: number; }
interface ModuleStat { module: string; section: string; accuracy: number; attempts: number; color: string; }

const SECTION_META: Record<string,{label:string;color:string;bg:string;border:string;icon:any;accent:string}> = {
  qa:   {label:'Quants',  color:'text-orange-400',  bg:'bg-orange-500/10',  border:'border-orange-500/20', icon:Calculator, accent:'#f97316'},
  dilr: {label:'DILR',    color:'text-blue-400',    bg:'bg-blue-500/10',    border:'border-blue-500/20',   icon:Network,    accent:'#60a5fa'},
  varc: {label:'Verbal',  color:'text-emerald-400', bg:'bg-emerald-500/10', border:'border-emerald-500/20',icon:BookOpen,   accent:'#34d399'},
  mixed:{label:'Mixed',   color:'text-purple-400',  bg:'bg-purple-500/10',  border:'border-purple-500/20', icon:Brain,      accent:'#a78bfa'},
};
const DIFF_COLORS = {
  easy:     {color:'text-emerald-400',bg:'bg-emerald-500/10',bar:'#34d399'},
  moderate: {color:'text-amber-400',  bg:'bg-amber-500/10',  bar:'#f59e0b'},
  hard:     {color:'text-rose-400',   bg:'bg-rose-500/10',   bar:'#f87171'},
};

function textToSection(s:string) {
  const t=(s||'').toLowerCase();
  if (t.includes('varc')||t.includes('verbal')||t.includes('reading')||t.includes('para')||t.includes('rc')) return 'varc';
  if (t.includes('dilr')||t.includes('logical')||t.includes('data')||t.includes('puzzle')||t.includes('reasoning')) return 'dilr';
  return 'qa';
}
function pct(n:number,d:number){return d===0?0:Math.round((n/d)*100);}
function fmtTime(s:number){
  if(!s||s<=0) return '—';
  const h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  return h>0?`${h}h ${m}m`:m>0?`${m}m ${sec}s`:`${sec}s`;
}

function TrendBadge({trend}:{trend:'up'|'down'|'flat'}) {
  if (trend==='up')   return <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full"><TrendingUp size={10}/>Improving</span>;
  if (trend==='down') return <span className="flex items-center gap-1 text-[10px] font-black text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full"><TrendingDown size={10}/>Declining</span>;
  return <span className="flex items-center gap-1 text-[10px] font-black text-gray-500 bg-white/5 px-2 py-0.5 rounded-full"><Minus size={10}/>Stable</span>;
}

function AnimatedBar({value, color, delay=0}:{value:number;color:string;delay?:number}) {
  const [w, setW] = useState(0);
  useEffect(()=>{ const t=setTimeout(()=>setW(value),100+delay); return()=>clearTimeout(t); },[value,delay]);
  return (
    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{width:`${w}%`,background:color}}/>
    </div>
  );
}

function RadialProgress({value,size=80,color,label}:{value:number;size:number;color:string;label:string}) {
  const r=(size-8)/2, circ=2*Math.PI*r;
  const [off,setOff]=useState(circ);
  useEffect(()=>{ const t=setTimeout(()=>setOff(circ-(Math.max(0,Math.min(100,value))/100)*circ),300); return()=>clearTimeout(t); },[value,circ]);
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7"/>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="7"
            strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
            style={{transition:'stroke-dashoffset 1s cubic-bezier(0.16,1,0.3,1)'}}/>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-white font-black text-base">{value}%</span>
        </div>
      </div>
      <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest text-center">{label}</p>
    </div>
  );
}

function ScoreBar({points}:{points:{label:string;score:number}[]}) {
  const [show, setShow] = useState(false);
  useEffect(()=>{ const t=setTimeout(()=>setShow(true),200); return()=>clearTimeout(t); },[]);
  if (points.length===0) return null;
  return (
    <div className="flex items-end gap-1.5 h-32">
      {points.map((p,i)=>(
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative gap-1">
          <div className="absolute bottom-full mb-1.5 left-1/2 -translate-x-1/2 hidden group-hover:block z-10">
            <div className="bg-[#1a1b2e] border border-white/10 text-white text-[10px] font-bold px-2 py-1 rounded-lg whitespace-nowrap">
              {p.label}: {p.score}%
            </div>
          </div>
          <div className="w-full rounded-t-lg transition-all duration-700 ease-out"
            style={{
              height: show ? `${Math.max(6,(p.score/100)*100)}%` : '4px',
              background: p.score>=70?'#34d399':p.score>=50?'#f97316':'#f87171',
              opacity: i===points.length-1?1:0.6,
              transitionDelay:`${i*40}ms`
            }}/>
          <span className="text-gray-700 text-[8px] font-bold truncate w-full text-center">{p.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function InsightPage() {
  const supabase = useMemo(()=>createClient(),[]);
  const router   = useRouter();
  const [userId,  setUserId]  = useState('');
  const [results, setResults] = useState<TestResult[]>([]);
  const [setMetas,setSetMetas]= useState<Record<string,{section:string;module:string}>>({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(()=>{
    (async()=>{
      const {data:{user}} = await supabase.auth.getUser();
      if (!user) { router.replace('/login'); return; }
      setUserId(user.id);

      const {data:raw, error:rErr} = await supabase
        .from('contest_results')
        .select('id, contest_id, score, total_marks, time_taken, answers')
        .eq('user_id', user.id)
        .order('id', {ascending:true})
        .limit(30);

      if (rErr) { setError(rErr.message); setLoading(false); return; }
      if (!raw||raw.length===0) { setLoading(false); return; }
      setResults(raw as TestResult[]);

      const ids=[...new Set(raw.map((r:any)=>r.contest_id as string))];
      const {data:sets}=await supabase.from('catquestion_sets').select('id,subject_section,module').in('id',ids);
      const sm:Record<string,{section:string;module:string}>={}; 
      (sets??[]).forEach((s:any)=>{ sm[s.id]={section:s.subject_section??'qa',module:s.module??''}; });
      const unmapped=ids.filter(id=>!sm[id]);
      if (unmapped.length>0){
        const {data:cs}=await supabase.from('contests').select('id,title').in('id',unmapped);
        (cs??[]).forEach((c:any)=>{sm[c.id]={section:'mixed',module:c.title??''};});
      }
      setSetMetas(sm); setLoading(false);
    })();
  },[supabase,router]);

  const stats = useMemo(()=>{
    if (results.length===0) return null;
    const sp = results.map((r,i)=>({label:`Test ${i+1}`, score:pct(r.score,r.total_marks)}));
    const scores = sp.map(p=>p.score);
    const overallAvg = Math.round(scores.reduce((s,v)=>s+v,0)/scores.length);
    const recentAvg  = scores.length>=3?Math.round(scores.slice(-3).reduce((s,v)=>s+v,0)/3):scores[scores.length-1]??0;
    const prevAvg    = scores.length>=4?Math.round(scores.slice(0,-3).reduce((s,v)=>s+v,0)/(scores.length-3)):scores[0]??recentAvg;
    const overallTrend:'up'|'down'|'flat' = recentAvg-prevAvg>5?'up':recentAvg-prevAvg<-5?'down':'flat';

    let streak=0;
    for(let i=scores.length-1;i>=0;i--){if(scores[i]>=50)streak++;else break;}

    type SecB={scores:number[];correct:number;attempted:number};
    const secB:Record<string,SecB>={qa:{scores:[],correct:0,attempted:0},dilr:{scores:[],correct:0,attempted:0},varc:{scores:[],correct:0,attempted:0}};
    type DiffB={correct:number;wrong:number;skipped:number};
    const diffB:Record<string,DiffB>={easy:{correct:0,wrong:0,skipped:0},moderate:{correct:0,wrong:0,skipped:0},hard:{correct:0,wrong:0,skipped:0}};
    const modB:Record<string,{section:string;correct:number;total:number}>={};
    let totalAttempted=0,totalQs=0,totalTimeSecs=0,testCount=0;

    results.forEach(result=>{
      const sm=setMetas[result.contest_id];
      const testSection=sm?.section??'qa', testModule=sm?.module??'';
      if(result.time_taken>0){totalTimeSecs+=result.time_taken;testCount++;}
      if(testSection!=='mixed'&&secB[testSection]&&result.total_marks>0)
        secB[testSection].scores.push(pct(result.score,result.total_marks));
      Object.entries(result.answers??{}).forEach(([,resp])=>{
        const embSection=resp._section||testSection, embModule=resp._module||testModule||'General';
        const embDiff=(resp._difficulty||'moderate').toLowerCase(), embQType=resp._question_type||'mcq';
        const embCorrect=resp._correct??'', userAns=resp.answer??'';
        const isAnswered=resp.status==='answered'&&userAns!=='';
        totalQs++; if(isAnswered)totalAttempted++;
        let correct=false;
        if(isAnswered&&embCorrect!==''){
          const isNum=embQType==='tita'||embQType==='numerical';
          correct=isNum?!isNaN(parseFloat(userAns))&&!isNaN(parseFloat(embCorrect))&&Math.abs(parseFloat(userAns)-parseFloat(embCorrect))<=0.01:userAns===embCorrect;
        }
        const qSection=textToSection(embSection&&embSection!==''?embSection:testSection);
        if(secB[qSection]){if(isAnswered)secB[qSection].attempted++;if(correct)secB[qSection].correct++;}
        const normDiff=embDiff==='medium'?'moderate':embDiff in diffB?embDiff:'moderate';
        if(diffB[normDiff]){if(correct)diffB[normDiff].correct++;else if(isAnswered)diffB[normDiff].wrong++;else diffB[normDiff].skipped++;}
        const mod=embModule||'General';
        if(!modB[mod])modB[mod]={section:qSection,correct:0,total:0};
        if(isAnswered)modB[mod].total++;if(correct)modB[mod].correct++;
      });
    });

    const sectionStats:SectionStat[]=Object.entries(secB).filter(([,b])=>b.scores.length>0).map(([sec,b])=>{
      const meta=SECTION_META[sec];
      const avg=Math.round(b.scores.reduce((s,v)=>s+v,0)/b.scores.length);
      const recent=b.scores[b.scores.length-1]??avg, prev2=b.scores[b.scores.length-2]??avg;
      return {section:sec,label:meta.label,color:meta.color,icon:meta.icon,accent:meta.accent,tests:b.scores.length,avgScore:avg,avgAccuracy:pct(b.correct,b.attempted),trend:recent-prev2>5?'up':recent-prev2<-5?'down':'flat',recentScore:recent,scores:b.scores};
    });

    const diffStats:DiffStat[]=['easy','moderate','hard'].map(d=>{const b=diffB[d];return{difficulty:d,...b,accuracy:pct(b.correct,b.correct+b.wrong)};});
    const moduleStats:ModuleStat[]=Object.entries(modB).filter(([,b])=>b.total>0).map(([mod,b])=>({module:mod,section:b.section,accuracy:pct(b.correct,b.total),attempts:b.total,color:SECTION_META[b.section]?.accent??'#888'})).sort((a,b)=>b.attempts-a.attempts).slice(0,8);
    const attemptRate=pct(totalAttempted,totalQs), avgTimeMins=testCount>0?Math.round(totalTimeSecs/testCount/60):0;
    const sortedMods=[...moduleStats].sort((a,b)=>b.accuracy-a.accuracy);
    const bestModules=sortedMods.slice(0,3), worstModules=sortedMods.slice(-3).reverse();
    const weakSections=sectionStats.filter(s=>s.avgScore<overallAvg-10), strongSections=sectionStats.filter(s=>s.avgScore>=overallAvg+5);
    return {sp,scores,overallAvg,recentAvg,overallTrend,sectionStats,diffStats,moduleStats,totalTests:results.length,avgTimeMins,attemptRate,streak,weakSections,strongSections,bestModules,worstModules,totalAttempted,totalQs};
  },[results,setMetas]);

  if (loading) return (
    <div className="min-h-screen bg-[#060608] flex items-center justify-center">
      <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"/>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      {/* Fixed bg */}
      <div className="fixed inset-0 z-0 opacity-[0.022]" style={{backgroundImage:'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)',backgroundSize:'44px 44px'}}/>
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(139,92,246,0.08),transparent)]"/>

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-8">

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button onClick={()=>router.push('/dashboard')}
            className="p-2.5 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white hover:bg-white/10 transition">
            <ArrowLeft size={18}/>
          </button>
          <div>
            <p className="text-purple-400 text-[10px] font-black uppercase tracking-widest mb-0.5">Dashboard → Insight</p>
            <h1 className="text-2xl font-black tracking-tight flex items-center gap-2">
              <Brain size={22} className="text-purple-400"/>Student Insight
            </h1>
          </div>
          {stats && <span className="ml-auto text-gray-600 text-sm font-bold">{stats.totalTests} tests analysed</span>}
        </div>

        {error && <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">{error}</div>}

        {!stats ? (
          <div className="text-center py-24">
            <BarChart2 size={48} className="mx-auto mb-4 text-gray-700"/>
            <p className="text-gray-500 text-lg font-bold">No test data yet</p>
            <p className="text-gray-700 text-sm mt-2">Complete a mock test to unlock your insights.</p>
            <button onClick={()=>router.push('/mocktest')} className="mt-6 px-6 py-3 bg-purple-600 hover:bg-purple-500 text-white font-black rounded-2xl transition text-sm">
              Take a Test →
            </button>
          </div>
        ) : (
          <div className="space-y-6">

            {/* ── Row 1: KPI cards ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                {label:'Latest Score', value:`${stats.scores[stats.scores.length-1]??0}%`, sub:`Avg ${stats.overallAvg}%`, color:'text-purple-400', icon:<TrendingUp size={16} className="text-purple-400"/>},
                {label:'Streak',       value:`${stats.streak}`,  sub:'tests ≥ 50%',       color:'text-orange-400', icon:<Flame size={16} className="text-orange-400"/>},
                {label:'Attempt Rate', value:`${stats.attemptRate}%`, sub:`${stats.totalAttempted}/${stats.totalQs} Qs`, color:'text-yellow-400', icon:<Target size={16} className="text-yellow-400"/>},
                {label:'Avg Duration', value:stats.avgTimeMins>0?`${stats.avgTimeMins}m`:'—', sub:'per test', color:'text-blue-400', icon:<Clock size={16} className="text-blue-400"/>},
              ].map(k=>(
                <div key={k.label} className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-5">
                  <div className="flex items-center justify-between mb-3">{k.icon}<TrendBadge trend={stats.overallTrend}/></div>
                  <p className={`text-3xl font-black tabular-nums ${k.color}`}>{k.value}</p>
                  <p className="text-gray-600 text-xs mt-1 font-bold uppercase tracking-widest">{k.label}</p>
                  <p className="text-gray-700 text-[10px] mt-0.5">{k.sub}</p>
                </div>
              ))}
            </div>

            {/* ── Row 2: Score trend + Section radials ── */}
            <div className="grid md:grid-cols-2 gap-4">

              {/* Score trend */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-5">Score Trend</p>
                <ScoreBar points={stats.sp}/>
              </div>

              {/* Section radials */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-5">Section Overview</p>
                {stats.sectionStats.length===0 ? (
                  <p className="text-gray-700 text-sm text-center py-8">Take section-specific tests to see breakdown.</p>
                ) : (
                  <div className="flex items-center justify-around h-32">
                    {stats.sectionStats.map(s=>(
                      <RadialProgress key={s.section} value={s.recentScore} size={88} color={s.accent} label={s.label}/>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Row 3: Section detail + Difficulty ── */}
            <div className="grid md:grid-cols-2 gap-4">

              {/* Section detail */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-5">Section Performance</p>
                {stats.sectionStats.length===0 ? (
                  <p className="text-gray-700 text-sm text-center py-8">No section data yet.</p>
                ) : (
                  <div className="space-y-5">
                    {stats.sectionStats.map((s,i)=>{
                      const meta=SECTION_META[s.section];
                      return (
                        <div key={s.section}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-8 h-8 rounded-xl ${meta.bg} border ${meta.border} flex items-center justify-center`}>
                                <s.icon size={14} className={meta.color}/>
                              </div>
                              <div>
                                <p className="text-white text-sm font-bold">{s.label}</p>
                                <p className="text-gray-600 text-[10px]">{s.tests} tests · {s.avgAccuracy}% accuracy</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className={`text-xl font-black ${meta.color}`}>{s.recentScore}%</p>
                              <TrendBadge trend={s.trend}/>
                            </div>
                          </div>
                          <AnimatedBar value={s.avgScore} color={meta.accent} delay={i*100}/>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Difficulty breakdown */}
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-5">Difficulty Breakdown</p>
                <div className="space-y-6">
                  {stats.diffStats.filter(d=>d.correct+d.wrong+d.skipped>0).map((d,i)=>{
                    const meta=DIFF_COLORS[d.difficulty as keyof typeof DIFF_COLORS]??DIFF_COLORS.moderate;
                    const total=d.correct+d.wrong+d.skipped;
                    return (
                      <div key={d.difficulty}>
                        <div className="flex items-center justify-between mb-2">
                          <span className={`text-sm font-black uppercase ${meta.color}`}>{d.difficulty}</span>
                          <span className={`text-xl font-black ${meta.color}`}>{d.accuracy}%</span>
                        </div>
                        <AnimatedBar value={d.accuracy} color={meta.bar} delay={i*80}/>
                        <div className="flex gap-4 mt-2 text-[10px] font-bold">
                          <span className="text-emerald-400">✓ {d.correct} correct</span>
                          <span className="text-red-400">✗ {d.wrong} wrong</span>
                          <span className="text-gray-600">— {d.skipped} skipped</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* ── Row 4: Module table ── */}
            {stats.moduleStats.length>0 && (
              <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
                <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-5">Module Performance</p>
                <div className="grid md:grid-cols-2 gap-x-8 gap-y-4">
                  {stats.moduleStats.map((m,i)=>{
                    const sec=SECTION_META[m.section]??SECTION_META.qa;
                    return (
                      <div key={m.module} className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-1.5 h-5 rounded-full flex-shrink-0" style={{background:m.color}}/>
                            <span className="text-white text-sm font-bold truncate">{m.module}</span>
                            <span className={`text-[9px] font-black uppercase px-1.5 py-0.5 rounded-full ${sec.bg} ${sec.color} flex-shrink-0`}>{sec.label}</span>
                          </div>
                          <span className="text-sm font-black flex-shrink-0 ml-2" style={{color:m.color}}>{m.accuracy}%</span>
                        </div>
                        <AnimatedBar value={m.accuracy} color={m.color} delay={i*50}/>
                        <p className="text-gray-700 text-[9px]">{m.attempts} questions attempted</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── Row 5: Smart insights ── */}
            <div className="bg-white/[0.03] border border-white/[0.07] rounded-3xl p-6">
              <p className="text-gray-500 text-[10px] font-black uppercase tracking-widest mb-5">Smart Insights</p>
              <div className="grid md:grid-cols-2 gap-3">
                {[
                  ...stats.weakSections.map(s=>({icon:<AlertCircle size={16} className="text-red-400 flex-shrink-0"/>, bg:'bg-red-500/5 border-red-500/15', text:<><span className="text-white font-bold">{s.label}</span> is below your average at <span className="text-red-400 font-bold">{s.avgScore}%</span>. Schedule focused drills here.</>})),
                  ...stats.strongSections.map(s=>({icon:<Award size={16} className="text-emerald-400 flex-shrink-0"/>, bg:'bg-emerald-500/5 border-emerald-500/15', text:<><span className="text-white font-bold">{s.label}</span> is your strongest at <span className="text-emerald-400 font-bold">{s.avgScore}%</span>. Maintain consistency!</>})),
                  ...(()=>{const h=stats.diffStats.find(d=>d.difficulty==='hard');if(!h||h.correct+h.wrong===0)return[];
                    if(h.accuracy<30) return [{icon:<Zap size={16} className="text-rose-400 flex-shrink-0"/>,bg:'bg-rose-500/5 border-rose-500/15',text:<>Only <span className="text-rose-400 font-bold">{h.accuracy}%</span> on hard questions. Skip hard Qs first, return after solving moderate ones.</>}];
                    if(h.accuracy>70) return [{icon:<Trophy size={16} className="text-purple-400 flex-shrink-0"/>,bg:'bg-purple-500/5 border-purple-500/15',text:<><span className="text-purple-400 font-bold">{h.accuracy}%</span> on hard questions — exceptional! You're in 99 percentile territory.</>}];
                    return [];})(),
                  ...(stats.attemptRate<60?[{icon:<Target size={16} className="text-yellow-400 flex-shrink-0"/>,bg:'bg-yellow-500/5 border-yellow-500/15',text:<>Attempt rate only <span className="text-yellow-400 font-bold">{stats.attemptRate}%</span>. In CAT, educated guesses on MCQs improve rank — attempt more.</>}]:[]),
                  ...(stats.bestModules[0]&&stats.bestModules[0].accuracy>=70?[{icon:<TrendingUp size={16} className="text-indigo-400 flex-shrink-0"/>,bg:'bg-indigo-500/5 border-indigo-500/15',text:<>Best module: <span className="text-white font-bold">{stats.bestModules[0].module}</span> at <span className="text-indigo-400 font-bold">{stats.bestModules[0].accuracy}%</span> — your score booster!</>}]:[]),
                  ...(stats.worstModules[0]&&stats.worstModules[0].accuracy<=40?[{icon:<TrendingDown size={16} className="text-orange-400 flex-shrink-0"/>,bg:'bg-orange-500/5 border-orange-500/15',text:<>Weakest module: <span className="text-white font-bold">{stats.worstModules[0].module}</span> at <span className="text-orange-400 font-bold">{stats.worstModules[0].accuracy}%</span>. Target with drills.</>}]:[]),
                  ...(stats.overallTrend==='up'&&stats.totalTests>=3?[{icon:<TrendingUp size={16} className="text-emerald-400 flex-shrink-0"/>,bg:'bg-emerald-500/5 border-emerald-500/15',text:<>Improving! From <span className="text-white font-bold">{stats.scores[0]}%</span> to <span className="text-emerald-400 font-bold">{stats.recentAvg}%</span> recently. Keep going!</>}]:[]),
                  ...(stats.overallTrend==='down'&&stats.totalTests>=3?[{icon:<AlertCircle size={16} className="text-red-400 flex-shrink-0"/>,bg:'bg-red-500/5 border-red-500/15',text:<>Scores declining recently. Review your last 3 tests and find the weak pattern.</>}]:[]),
                  ...(stats.avgTimeMins>0?[{icon:<Clock size={16} className="text-blue-400 flex-shrink-0"/>,bg:'bg-blue-500/5 border-blue-500/15',text:<>Avg completion: <span className="text-white font-bold">{stats.avgTimeMins} min</span>. {stats.avgTimeMins<20?'You finish fast — double-check answers.':stats.avgTimeMins>55?'Work on speed: timed drills reduce per-question time.':'Good pacing — balanced speed and accuracy.'}</>}]:[]),
                ].map((tip,i)=>(
                  <div key={i} className={`flex gap-3 p-4 rounded-2xl border ${tip.bg}`}>
                    <div className="mt-0.5">{tip.icon}</div>
                    <p className="text-gray-400 text-sm leading-relaxed">{tip.text}</p>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
