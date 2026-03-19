'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import {
  TrendingUp, TrendingDown, Minus, Brain, Calculator, Network,
  BookOpen, Target, Zap, Clock, BarChart2, AlertCircle,
  ChevronDown, ChevronUp, Award, Flame
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────
interface TestResult {
  id: string;
  contest_id: string;
  score: number;
  total_marks: number;
  time_taken: number;
  created_at?: string | null;  // may not exist on older DBs
  // answers JSONB — two shapes:
  // NEW: { [qId]: { answer, status, visited, _difficulty, _section, _module, _correct, ... } }
  // OLD: { [qId]: { answer, status, visited } }  ← no metadata embedded
  answers: Record<string, any> | null;
}

interface SectionStat {
  section: string; label: string; color: string; icon: any; accent: string;
  tests: number; avgScore: number; avgAccuracy: number;
  trend: 'up'|'down'|'flat'; recentScore: number; scores: number[];
}
interface DiffStat {
  difficulty: string; correct: number; wrong: number; skipped: number; accuracy: number;
}
interface ModuleStat {
  module: string; section: string; accuracy: number; attempts: number; color: string;
}

// ─── Constants ────────────────────────────────────────────────
const SECTION_META: Record<string,{label:string;color:string;bg:string;icon:any;accent:string}> = {
  qa:    {label:'Quants', color:'text-orange-400',  bg:'bg-orange-500/10',  icon:Calculator, accent:'#f97316'},
  dilr:  {label:'DILR',   color:'text-blue-400',    bg:'bg-blue-500/10',    icon:Network,    accent:'#60a5fa'},
  varc:  {label:'Verbal', color:'text-emerald-400', bg:'bg-emerald-500/10', icon:BookOpen,   accent:'#34d399'},
  mixed: {label:'Mixed',  color:'text-purple-400',  bg:'bg-purple-500/10',  icon:Brain,      accent:'#a78bfa'},
};

const DIFF_META: Record<string,{color:string;bg:string}> = {
  easy:     {color:'text-emerald-400', bg:'bg-emerald-500/10'},
  moderate: {color:'text-amber-400',   bg:'bg-amber-500/10'  },
  medium:   {color:'text-amber-400',   bg:'bg-amber-500/10'  },
  hard:     {color:'text-rose-400',    bg:'bg-rose-500/10'   },
};

// Derive CAT section from subject/chapter/module text
function textToSection(s: string): string {
  const t = (s || '').toLowerCase();
  if (t.includes('varc') || t.includes('verbal') || t.includes('reading') ||
      t.includes('para')  || t.includes('grammar') || t.includes('rc'))   return 'varc';
  if (t.includes('dilr') || t.includes('logical')  || t.includes('data') ||
      t.includes('puzzle')|| t.includes('reasoning')|| t.includes('arrangement')) return 'dilr';
  return 'qa';
}

function pct(n:number, d:number){ return d===0 ? 0 : Math.round((n/d)*100); }

// ─── Mini components ──────────────────────────────────────────
function RadialBar({value, size=56, color}:{value:number;size?:number;color:string}) {
  const v = Math.max(0, Math.min(100, value));
  const r = (size-6)/2, circ = 2*Math.PI*r;
  const [off, setOff] = useState(circ);
  useEffect(()=>{
    const t = setTimeout(()=>setOff(circ-(v/100)*circ), 200);
    return ()=>clearTimeout(t);
  },[v, circ]);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="5"/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth="5"
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        style={{transition:'stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)'}}/>
    </svg>
  );
}

function Sparkline({points, color}:{points:number[];color:string}) {
  if (points.length < 2) return null;
  const mn=Math.min(...points), mx=Math.max(...points), range=mx-mn||1;
  const W=80, H=28;
  const xs = points.map((_,i)=>(i/(points.length-1))*W);
  const ys = points.map(v=>H-((v-mn)/range)*(H-4)-2);
  const d  = xs.map((x,i)=>`${i===0?'M':'L'}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(' ');
  const gid = `sp${color.replace(/[^a-z0-9]/gi,'')}`;
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3"/>
          <stop offset="100%" stopColor={color} stopOpacity="0"/>
        </linearGradient>
      </defs>
      <path d={`${d} L${xs[xs.length-1].toFixed(1)},${H} L0,${H} Z`} fill={`url(#${gid})`}/>
      <path d={d} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx={xs[xs.length-1]} cy={ys[ys.length-1]} r="2.5" fill={color}/>
    </svg>
  );
}

function TrendBadge({trend}:{trend:'up'|'down'|'flat'}) {
  if (trend==='up')   return <span className="flex items-center gap-0.5 text-[9px] font-black text-emerald-400"><TrendingUp size={9}/>UP</span>;
  if (trend==='down') return <span className="flex items-center gap-0.5 text-[9px] font-black text-red-400"><TrendingDown size={9}/>DOWN</span>;
  return <span className="flex items-center gap-0.5 text-[9px] font-black text-gray-600"><Minus size={9}/>FLAT</span>;
}

// ─── MAIN ─────────────────────────────────────────────────────
export default function StudentInsight({ userId }: { userId: string }) {
  const supabase = useMemo(()=>createClient(),[]);

  const [results,  setResults]  = useState<TestResult[]>([]);
  const [setMetas, setSetMetas] = useState<Record<string,{section:string;module:string}>>({});
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [expanded, setExpanded] = useState(false);

  useEffect(()=>{
    if (!userId) return;
    (async()=>{
      setLoading(true); setError('');

      // Fetch user's results (up to 30)
      // Select without created_at first — that column may not exist yet on older DBs
      // We order by id which is monotonically increasing (UUID v4 in Supabase = time-ordered)
      const {data:raw, error:rErr} = await supabase
        .from('contest_results')
        .select('id, contest_id, score, total_marks, time_taken, answers')
        .eq('user_id', userId)
        .order('id', {ascending:true})
        .limit(30);

      if (rErr) {
        setError(`Could not load results: ${rErr.message}`);
        setLoading(false); return;
      }
      if (!raw || raw.length===0) { setLoading(false); return; }
      setResults(raw as TestResult[]);

      // Fetch set metadata (catquestion_sets) for section/module info
      const ids = [...new Set(raw.map((r:any)=>r.contest_id as string))];
      const {data:sets} = await supabase
        .from('catquestion_sets')
        .select('id, subject_section, module')
        .in('id', ids);

      const sm: Record<string,{section:string;module:string}> = {};
      (sets??[]).forEach((s:any)=>{
        sm[s.id] = {section: s.subject_section??'qa', module: s.module??''};
      });

      // For contest IDs not in catquestion_sets, try contests table
      const unmapped = ids.filter(id=>!sm[id]);
      if (unmapped.length>0) {
        const {data:cs} = await supabase
          .from('contests')
          .select('id, title')
          .in('id', unmapped);
        (cs??[]).forEach((c:any)=>{ sm[c.id]={section:'mixed', module:c.title??''}; });
      }

      setSetMetas(sm);
      setLoading(false);
    })();
  },[userId, supabase]);

  // ── Compute all stats from embedded metadata in answers ────
  const stats = useMemo(()=>{
    if (results.length===0) return null;

    // Score trend
    const scoreTrend = results.map((r,i)=>({
      label: `Test ${i+1}`,   // created_at may not exist — use ordinal label
      score: pct(r.score, r.total_marks),
    }));
    const sp = scoreTrend.map(p=>p.score);
    const overallAvg = Math.round(sp.reduce((s,v)=>s+v,0)/sp.length);
    const recentAvg  = sp.length>=3 ? Math.round(sp.slice(-3).reduce((s,v)=>s+v,0)/3) : sp[sp.length-1]??0;
    const prevAvg    = sp.length>=4 ? Math.round(sp.slice(0,-3).reduce((s,v)=>s+v,0)/(sp.length-3)) : sp[0]??recentAvg;
    const overallTrend: 'up'|'down'|'flat' = recentAvg-prevAvg>5?'up':recentAvg-prevAvg<-5?'down':'flat';

    // Streak
    let streak=0;
    for (let i=sp.length-1;i>=0;i--){ if(sp[i]>=50) streak++; else break; }

    // Buckets
    type SecB = {scores:number[];correct:number;attempted:number};
    const secB: Record<string,SecB> = {
      qa:{scores:[],correct:0,attempted:0},
      dilr:{scores:[],correct:0,attempted:0},
      varc:{scores:[],correct:0,attempted:0},
    };
    type DiffB = {correct:number;wrong:number;skipped:number};
    const diffB: Record<string,DiffB> = {
      easy:{correct:0,wrong:0,skipped:0},
      moderate:{correct:0,wrong:0,skipped:0},
      hard:{correct:0,wrong:0,skipped:0},
    };
    const modB: Record<string,{section:string;correct:number;total:number}> = {};

    let totalAttempted=0, totalQs=0, totalTimeSecs=0, testCount=0;

    results.forEach(result=>{
      const sm = setMetas[result.contest_id];
      const testSection = sm?.section ?? 'qa';
      const testModule  = sm?.module ?? '';
      const answers = result.answers ?? {};

      if (result.time_taken>0){ totalTimeSecs+=result.time_taken; testCount++; }

      // Section score per test (use set-level section for the score)
      if (testSection!=='mixed' && secB[testSection] && result.total_marks>0) {
        secB[testSection].scores.push(pct(result.score, result.total_marks));
      }

      Object.entries(answers).forEach(([, resp])=>{
        // ── Read embedded metadata (new format) ────────────
        const embSection   = resp._section || testSection;
        const embModule    = resp._module  || testModule || 'General';
        const embDiff      = (resp._difficulty || 'moderate').toLowerCase();
        const embQType     = resp._question_type || 'mcq';
        const embCorrect   = resp._correct ?? '';
        const userAns      = resp.answer ?? '';
        const isAnswered   = resp.status === 'answered' && userAns !== '';
        const isSkipped    = !isAnswered && resp.status !== 'marked';

        totalQs++;
        if (isAnswered) totalAttempted++;

        // Correctness
        let correct = false;
        if (isAnswered && embCorrect !== '') {
          const isNum = embQType==='tita' || embQType==='numerical';
          correct = isNum
            ? !isNaN(parseFloat(userAns)) && !isNaN(parseFloat(embCorrect)) &&
              Math.abs(parseFloat(userAns)-parseFloat(embCorrect))<=0.01
            : userAns===embCorrect;
        }

        // Section (prefer question-level section from embedded data)
        const qSection = (embSection && embSection!=='') ? embSection : testSection;
        const normSection = textToSection(qSection);
        if (secB[normSection]) {
          if (isAnswered) secB[normSection].attempted++;
          if (correct)    secB[normSection].correct++;
        }

        // Difficulty
        const normDiff = embDiff==='medium'?'moderate': embDiff in diffB ? embDiff : 'moderate';
        if (diffB[normDiff]) {
          if (correct)          diffB[normDiff].correct++;
          else if (isAnswered)  diffB[normDiff].wrong++;
          else                  diffB[normDiff].skipped++;
        }

        // Module
        const mod = embModule || 'General';
        if (!modB[mod]) modB[mod]={section:normSection, correct:0, total:0};
        if (isAnswered) modB[mod].total++;
        if (correct)    modB[mod].correct++;
      });
    });

    // Section stats
    const sectionStats: SectionStat[] = Object.entries(secB)
      .filter(([,b])=>b.scores.length>0)
      .map(([sec,b])=>{
        const meta=SECTION_META[sec];
        const avg    = Math.round(b.scores.reduce((s,v)=>s+v,0)/b.scores.length);
        const recent = b.scores[b.scores.length-1]??avg;
        const prev2  = b.scores[b.scores.length-2]??avg;
        return {
          section:sec, label:meta.label, color:meta.color, icon:meta.icon, accent:meta.accent,
          tests:b.scores.length, avgScore:avg,
          avgAccuracy:pct(b.correct, b.attempted),
          trend: recent-prev2>5?'up':recent-prev2<-5?'down':'flat',
          recentScore:recent, scores:b.scores,
        };
      });

    // Diff stats
    const diffStats: DiffStat[] = ['easy','moderate','hard'].map(d=>{
      const b=diffB[d];
      return {difficulty:d, ...b, accuracy:pct(b.correct, b.correct+b.wrong)};
    });

    // Module stats
    const moduleStats: ModuleStat[] = Object.entries(modB)
      .filter(([,b])=>b.total>0)
      .map(([mod,b])=>({
        module:mod, section:b.section,
        accuracy:pct(b.correct,b.total), attempts:b.total,
        color: SECTION_META[b.section]?.accent ?? '#888',
      }))
      .sort((a,b)=>b.attempts-a.attempts)
      .slice(0,7);

    const attemptRate = pct(totalAttempted, totalQs);
    const avgTimeMins = testCount>0 ? Math.round(totalTimeSecs/testCount/60) : 0;
    const sortedMods  = [...moduleStats].sort((a,b)=>b.accuracy-a.accuracy);
    const bestModules  = sortedMods.slice(0,2);
    const worstModules = sortedMods.slice(-2).reverse();
    const weakSections   = sectionStats.filter(s=>s.avgScore<overallAvg-10);
    const strongSections = sectionStats.filter(s=>s.avgScore>=overallAvg+5);

    return {
      scoreTrend, scorePoints:sp, overallAvg, recentAvg, overallTrend,
      sectionStats, diffStats, moduleStats, totalTests:results.length,
      avgTimeMins, attemptRate, streak, weakSections, strongSections,
      bestModules, worstModules, totalAttempted, totalQs,
    };
  },[results, setMetas]);

  // ── Render ─────────────────────────────────────────────────
  if (!userId) return null;

  if (loading) return (
    <div className="rounded-3xl bg-white/[0.03] border border-white/[0.07] p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
          <Brain size={13} className="text-purple-400"/>
        </div>
        <span className="text-white font-black text-sm">Student Insight</span>
      </div>
      <div className="space-y-2">
        {[1,2,3].map(i=><div key={i} className="h-12 bg-white/5 rounded-2xl animate-pulse" style={{opacity:1-i*0.2}}/>)}
      </div>
    </div>
  );

  if (error) return (
    <div className="rounded-3xl bg-white/[0.03] border border-red-500/20 p-5">
      <div className="flex items-center gap-2 mb-3">
        <Brain size={13} className="text-purple-400"/>
        <span className="text-white font-black text-sm">Student Insight</span>
      </div>
      <p className="text-red-400 text-xs">{error}</p>
    </div>
  );

  if (!stats) return (
    <div className="rounded-3xl bg-white/[0.03] border border-white/[0.07] p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
          <Brain size={13} className="text-purple-400"/>
        </div>
        <span className="text-white font-black text-sm">Student Insight</span>
      </div>
      <div className="py-6 text-center">
        <BarChart2 size={28} className="mx-auto mb-2 text-gray-700"/>
        <p className="text-gray-600 text-xs">No test data yet.</p>
        <p className="text-gray-700 text-[10px] mt-0.5">Complete a mock test to unlock your insights.</p>
      </div>
    </div>
  );

  const latestScore = stats.scorePoints[stats.scorePoints.length-1] ?? 0;

  return (
    <div className="rounded-3xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">

      {/* Header */}
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <Brain size={13} className="text-purple-400"/>
          </div>
          <div>
            <h3 className="text-white font-black text-sm">Student Insight</h3>
            <p className="text-gray-600 text-[10px] uppercase tracking-widest">{stats.totalTests} test{stats.totalTests!==1?'s':''} analysed</p>
          </div>
        </div>
        <button onClick={()=>setExpanded(e=>!e)}
          className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition text-gray-500 hover:text-white">
          {expanded ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}
        </button>
      </div>

      <div className="p-5 space-y-5">

        {/* Hero Row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-1 bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 flex flex-col items-center justify-center">
            <div className="relative">
              <RadialBar value={latestScore} size={56} color="#a78bfa"/>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-white font-black text-sm leading-none">{latestScore}</span>
                <span className="text-gray-600 text-[8px]">%</span>
              </div>
            </div>
            <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mt-1">Latest</p>
            <div className="mt-0.5"><TrendBadge trend={stats.overallTrend}/></div>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1">
              <Flame size={11} className="text-orange-400"/>
              <span className="text-gray-600 text-[9px] font-bold uppercase tracking-widest">Streak</span>
            </div>
            <p className="text-orange-400 font-black text-xl tabular-nums leading-none">{stats.streak}</p>
            <p className="text-gray-700 text-[9px] mt-0.5">tests ≥50%</p>
          </div>
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-3 flex flex-col justify-between">
            <div className="flex items-center gap-1.5 mb-1">
              <Target size={11} className="text-yellow-400"/>
              <span className="text-gray-600 text-[9px] font-bold uppercase tracking-widest">Attempt</span>
            </div>
            <p className="text-yellow-400 font-black text-xl tabular-nums leading-none">{stats.attemptRate}%</p>
            <p className="text-gray-700 text-[9px] mt-0.5">{stats.totalAttempted}/{stats.totalQs} Qs</p>
          </div>
        </div>

        {/* Score trend bar chart */}
        {stats.scorePoints.length >= 2 && (
          <div className="bg-white/[0.03] border border-white/[0.06] rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-600 text-[9px] font-bold uppercase tracking-widest">Score Trend</span>
              <span className={`text-[10px] font-black ${
                stats.overallTrend==='up'?'text-emerald-400':stats.overallTrend==='down'?'text-red-400':'text-gray-500'}`}>
                Avg {stats.overallAvg}%
              </span>
            </div>
            <div className="flex items-end gap-1 h-9">
              {stats.scorePoints.map((v,i)=>(
                <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                  <div className="w-full rounded-sm transition-all"
                    style={{
                      height:`${Math.max(8,(v/100)*100)}%`,
                      background: v>=70?'#34d399':v>=50?'#f97316':'#f87171',
                      opacity: i===stats.scorePoints.length-1 ? 1 : 0.55,
                    }}/>
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:flex z-10">
                    <div className="bg-[#1a1b2e] text-white text-[9px] px-1.5 py-0.5 rounded-lg font-bold whitespace-nowrap border border-white/10">
                      {v}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-gray-700 text-[8px]">{stats.scoreTrend[0]?.label}</span>
              <span className="text-gray-700 text-[8px]">{stats.scoreTrend[stats.scoreTrend.length-1]?.label}</span>
            </div>
          </div>
        )}

        {/* Section breakdown */}
        <div>
          <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mb-2">Section Performance</p>
          {stats.sectionStats.length===0 ? (
            <p className="text-gray-700 text-xs text-center py-3">
              Take more tests to see per-section breakdown.
            </p>
          ) : (
            <div className="space-y-2">
              {stats.sectionStats.map(s=>{
                const meta=SECTION_META[s.section];
                return (
                  <div key={s.section} className="bg-white/[0.03] border border-white/[0.05] rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-5 h-5 rounded-lg ${meta.bg} flex items-center justify-center`}>
                          <s.icon size={11} className={meta.color}/>
                        </div>
                        <span className="text-white text-xs font-bold">{s.label}</span>
                        <TrendBadge trend={s.trend}/>
                      </div>
                      <div className="flex items-center gap-3">
                        {s.scores.length>=2 && <Sparkline points={s.scores} color={meta.accent}/>}
                        <span className={`text-sm font-black tabular-nums ${meta.color}`}>{s.recentScore}%</span>
                      </div>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000"
                        style={{width:`${s.avgScore}%`, background:meta.accent}}/>
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-gray-700 text-[9px]">{s.tests} test{s.tests!==1?'s':''}</span>
                      <span className="text-gray-600 text-[9px]">{s.avgAccuracy}% accuracy</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Difficulty breakdown */}
        <div>
          <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mb-2">Difficulty Breakdown</p>
          <div className="grid grid-cols-3 gap-2">
            {stats.diffStats.filter(d=>d.correct+d.wrong+d.skipped>0).map(d=>{
              const total=d.correct+d.wrong+d.skipped;
              const meta=DIFF_META[d.difficulty]??DIFF_META.moderate;
              return (
                <div key={d.difficulty} className={`rounded-xl p-3 border border-white/[0.05] ${meta.bg}`}>
                  <p className={`text-[9px] font-black uppercase tracking-widest mb-1 ${meta.color}`}>{d.difficulty}</p>
                  <p className={`text-xl font-black tabular-nums ${meta.color}`}>{d.accuracy}%</p>
                  <div className="mt-1.5 space-y-0.5">
                    <div className="flex justify-between text-[9px]">
                      <span className="text-gray-700">✓</span>
                      <span className="text-emerald-400 font-bold">{d.correct}</span>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-gray-700">✗</span>
                      <span className="text-red-400 font-bold">{d.wrong}</span>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-gray-700">—</span>
                      <span className="text-gray-600 font-bold">{d.skipped}</span>
                    </div>
                  </div>
                  <div className="mt-2 h-1 rounded-full overflow-hidden flex">
                    <div style={{width:`${pct(d.correct,total)}%`,background:'#34d399'}} className="h-full"/>
                    <div style={{width:`${pct(d.wrong,total)}%`,background:'#f87171'}} className="h-full"/>
                    <div style={{width:`${pct(d.skipped,total)}%`,background:'rgba(255,255,255,0.08)'}} className="h-full"/>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Expanded content */}
        {expanded && (
          <>
            {/* Module performance */}
            {stats.moduleStats.length>0 && (
              <div>
                <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mb-2">Module Performance</p>
                <div className="space-y-2">
                  {stats.moduleStats.map(m=>{
                    const sec=SECTION_META[m.section]??SECTION_META.qa;
                    return (
                      <div key={m.module} className="flex items-center gap-3">
                        <div className="w-1.5 h-8 rounded-full flex-shrink-0" style={{background:m.color}}/>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-white text-xs font-bold truncate">{m.module}</span>
                            <span className="text-xs font-black tabular-nums ml-2 flex-shrink-0" style={{color:m.color}}>{m.accuracy}%</span>
                          </div>
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-1000"
                              style={{width:`${m.accuracy}%`,background:m.color,opacity:0.8}}/>
                          </div>
                          <p className="text-gray-700 text-[9px] mt-0.5">{m.attempts} Qs · {sec.label}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Smart insights */}
            <div>
              <p className="text-gray-600 text-[9px] font-bold uppercase tracking-widest mb-2">Smart Insights</p>
              <div className="space-y-2">

                {stats.weakSections.map(s=>(
                  <div key={s.section} className="flex gap-2.5 px-3 py-2.5 bg-red-500/5 border border-red-500/15 rounded-xl">
                    <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5"/>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      <span className="text-white font-bold">{s.label}</span> is below your average at{' '}
                      <span className="text-red-400 font-bold">{s.avgScore}%</span>. Schedule focused drills here.
                    </p>
                  </div>
                ))}

                {stats.strongSections.map(s=>(
                  <div key={s.section} className="flex gap-2.5 px-3 py-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                    <Award size={13} className="text-emerald-400 flex-shrink-0 mt-0.5"/>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      <span className="text-white font-bold">{s.label}</span> is strong at{' '}
                      <span className="text-emerald-400 font-bold">{s.avgScore}%</span>. Maintain consistency!
                    </p>
                  </div>
                ))}

                {(()=>{
                  const hard=stats.diffStats.find(d=>d.difficulty==='hard');
                  if (!hard||hard.correct+hard.wrong===0) return null;
                  if (hard.accuracy<30) return (
                    <div className="flex gap-2.5 px-3 py-2.5 bg-rose-500/5 border border-rose-500/15 rounded-xl">
                      <Zap size={13} className="text-rose-400 flex-shrink-0 mt-0.5"/>
                      <p className="text-gray-400 text-[11px] leading-relaxed">
                        Only <span className="text-rose-400 font-bold">{hard.accuracy}%</span> on hard questions.
                        In CAT, skip hard questions first and return after moderate ones.
                      </p>
                    </div>
                  );
                  if (hard.accuracy>70) return (
                    <div className="flex gap-2.5 px-3 py-2.5 bg-purple-500/5 border border-purple-500/15 rounded-xl">
                      <Award size={13} className="text-purple-400 flex-shrink-0 mt-0.5"/>
                      <p className="text-gray-400 text-[11px] leading-relaxed">
                        <span className="text-purple-400 font-bold">{hard.accuracy}%</span> on hard questions — exceptional!
                        You're in 99 percentile territory.
                      </p>
                    </div>
                  );
                  return null;
                })()}

                {stats.attemptRate<60 && (
                  <div className="flex gap-2.5 px-3 py-2.5 bg-yellow-500/5 border border-yellow-500/15 rounded-xl">
                    <Target size={13} className="text-yellow-400 flex-shrink-0 mt-0.5"/>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      Attempt rate: <span className="text-yellow-400 font-bold">{stats.attemptRate}%</span>.
                      CAT rewards attempting — even educated guesses on MCQs improve your rank.
                    </p>
                  </div>
                )}

                {stats.bestModules[0]&&stats.bestModules[0].accuracy>=70 && (
                  <div className="flex gap-2.5 px-3 py-2.5 bg-indigo-500/5 border border-indigo-500/15 rounded-xl">
                    <TrendingUp size={13} className="text-indigo-400 flex-shrink-0 mt-0.5"/>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      Best module: <span className="text-white font-bold">{stats.bestModules[0].module}</span>{' '}
                      at <span className="text-indigo-400 font-bold">{stats.bestModules[0].accuracy}%</span> — your score booster!
                    </p>
                  </div>
                )}

                {stats.worstModules[0]&&stats.worstModules[0].accuracy<=40 && (
                  <div className="flex gap-2.5 px-3 py-2.5 bg-orange-500/5 border border-orange-500/15 rounded-xl">
                    <TrendingDown size={13} className="text-orange-400 flex-shrink-0 mt-0.5"/>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      Weakest module: <span className="text-white font-bold">{stats.worstModules[0].module}</span>{' '}
                      at <span className="text-orange-400 font-bold">{stats.worstModules[0].accuracy}%</span>. Target with drills.
                    </p>
                  </div>
                )}

                {stats.overallTrend==='up'&&stats.totalTests>=3 && (
                  <div className="flex gap-2.5 px-3 py-2.5 bg-emerald-500/5 border border-emerald-500/15 rounded-xl">
                    <TrendingUp size={13} className="text-emerald-400 flex-shrink-0 mt-0.5"/>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      Improving! From <span className="text-white font-bold">{stats.scoreTrend[0]?.score}%</span>{' '}
                      to <span className="text-emerald-400 font-bold">{stats.recentAvg}%</span> recently. Keep going!
                    </p>
                  </div>
                )}

                {stats.overallTrend==='down'&&stats.totalTests>=3 && (
                  <div className="flex gap-2.5 px-3 py-2.5 bg-red-500/5 border border-red-500/15 rounded-xl">
                    <AlertCircle size={13} className="text-red-400 flex-shrink-0 mt-0.5"/>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      Scores declining recently. Review your last 3 tests and identify the weak pattern.
                    </p>
                  </div>
                )}

                {stats.avgTimeMins>0 && (
                  <div className="flex gap-2.5 px-3 py-2.5 bg-white/[0.03] border border-white/[0.06] rounded-xl">
                    <Clock size={13} className="text-blue-400 flex-shrink-0 mt-0.5"/>
                    <p className="text-gray-400 text-[11px] leading-relaxed">
                      Avg completion: <span className="text-white font-bold">{stats.avgTimeMins} min</span>.{' '}
                      {stats.avgTimeMins<20
                        ? 'You finish fast — double-check answers before submitting.'
                        : stats.avgTimeMins>55
                        ? 'Work on speed: practice timed drills to reduce per-question time.'
                        : 'Good pacing — balanced speed and accuracy.'}
                    </p>
                  </div>
                )}

              </div>
            </div>
          </>
        )}

        {/* Expand toggle */}
        <button onClick={()=>setExpanded(e=>!e)}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl bg-white/[0.03] border border-white/[0.06] text-gray-500 hover:text-white hover:bg-white/[0.06] transition text-xs font-bold">
          {expanded
            ? <><ChevronUp size={13}/>Show Less</>
            : <><ChevronDown size={13}/>Modules & Smart Insights</>}
        </button>
      </div>
    </div>
  );
}
