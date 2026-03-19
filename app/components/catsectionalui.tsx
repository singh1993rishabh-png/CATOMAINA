"use client";

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { 
  CheckCircle2, Trophy, User, Info, 
  Target, Zap, BarChart3, RotateCcw, 
  ArrowRight, XCircle, Eye, ChevronDown, Clock 
} from 'lucide-react';
import { createClient } from '../utils/supabase/client';
import CATResultAnalysis from './resultsection';

// --- SUB-COMPONENT: FANCY RESULT ANALYSIS ---
// function CATResultAnalysis({ summary, questions, setInfo, responses, timeSpentMap }: any) {
//   const [showReview, setShowReview] = useState(false);
//   const totalPossibleScore = questions.length * 3;
//   const scorePercentage = Math.round((summary.score / totalPossibleScore) * 100);
//   const accuracy = summary.attempted > 0 ? Math.round((summary.correct / summary.attempted) * 100) : 0;
  
//   const radius = 70;
//   const circumference = 2 * Math.PI * radius;
//   const offset = circumference - (Math.max(0, scorePercentage) / 100) * circumference;

//   const renderText = (text: string) => text?.split(/(\$.*?\$)/g).map((p, i) => p.startsWith('$') ? <InlineMath key={i} math={p.slice(1, -1)} /> : <span key={i}>{p}</span>);

//   return (
//     <div className="min-h-screen bg-[#F4F7FA] p-4 md:p-8 animate-in fade-in duration-700 font-sans">
//       <div className="max-w-5xl mx-auto">
        
//         {/* SCORE DASHBOARD */}
//         {/* <div className="bg-white rounded-[2.5rem] shadow-2xl shadow-blue-900/5 overflow-hidden border border-white mb-8">
//           <div className="grid grid-cols-1 md:grid-cols-3">
//             <div className="p-10 flex flex-col items-center justify-center bg-gradient-to-b from-slate-50 to-white border-r border-slate-100">
//               <div className="relative flex items-center justify-center">
//                 <svg className="w-44 h-44 transform -rotate-90">
//                   <circle cx="88" cy="88" r={radius} stroke="#E2E8F0" strokeWidth="12" fill="transparent" />
//                   <circle cx="88" cy="88" r={radius} stroke="#003366" strokeWidth="12" fill="transparent" 
//                     strokeDasharray={circumference} 
//                     strokeDashoffset={offset} 
//                     strokeLinecap="round" 
//                     className="transition-all duration-1000 ease-out"
//                   />
//                 </svg>
//                 <div className="absolute text-center">
//                   <span className="text-5xl font-black text-[#003366] block">{summary.score}</span>
//                   <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Points</span>
//                 </div>
//               </div>
//               <div className="mt-6 text-center">
//                 <p className="text-sm font-bold text-slate-500 uppercase">Est. Percentile</p>
//                 <p className="text-2xl font-black text-emerald-500">{scorePercentage > 85 ? '99.8' : scorePercentage > 60 ? '96.2' : '89.5'}%ile</p>
//               </div>
//             </div>

//             <div className="col-span-2 p-10">
//               <div className="flex justify-between items-start mb-8">
//                 <div>
//                   <h2 className="text-2xl font-black text-slate-800 uppercase tracking-tight">{setInfo?.title}</h2>
//                   <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mt-1">Sectional Performance Report</p>
//                 </div>
//               </div>

//               <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
//                 <div className="p-4 rounded-2xl bg-blue-50 border border-blue-100 text-center">
//                    <Target className="mx-auto mb-2 text-blue-500" size={20} />
//                    <span className="text-xl font-black text-blue-700">{accuracy}%</span>
//                 </div>
//                 <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100 text-center">
//                    <CheckCircle2 className="mx-auto mb-2 text-emerald-500" size={20} />
//                    <span className="text-xl font-black text-emerald-700">{summary.correct}</span>
//                 </div>
//                 <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100 text-center">
//                    <XCircle className="mx-auto mb-2 text-rose-500" size={20} />
//                    <span className="text-xl font-black text-rose-700">{summary.wrong}</span>
//                 </div>
//                 <div className="p-4 rounded-2xl bg-amber-50 border border-amber-100 text-center">
//                    <Zap className="mx-auto mb-2 text-amber-500" size={20} />
//                    <span className="text-xl font-black text-amber-700">{summary.attempted}</span>
//                 </div>
//               </div>

//               <div className="mt-10 flex gap-4">
//                 <button onClick={() => setShowReview(!showReview)} className="flex-1 flex items-center justify-center gap-2 bg-[#003366] text-white font-bold py-4 rounded-2xl hover:bg-blue-900 transition-all shadow-lg shadow-blue-900/20">
//                   <Eye size={18} /> {showReview ? "Hide Solutions" : "Review Solutions"}
//                 </button>
//                 <button onClick={() => window.location.href = '/dashboard'} className="px-6 flex items-center justify-center bg-slate-100 text-slate-600 font-bold rounded-2xl hover:bg-slate-200 transition-all border border-slate-200">
//                   <RotateCcw size={18} />
//                 </button>
//               </div>
//             </div>
//           </div>
//         </div> */}

//         {/* REVIEW SECTION */}
//         {/* {showReview && (
//           <div className="space-y-4 animate-in slide-in-from-bottom-4 duration-500 mb-10">
//             <h3 className="text-lg font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
//               <ChevronDown className="text-blue-600" /> Detailed Question Analysis
//             </h3>
//             {questions.map((q: any, i: number) => {
//               const userAns = responses[q.id]?.answer;
//               const isCorrect = userAns === q.correct_option;
//               const timeSpent = timeSpentMap[q.id] || 0;
//               return (
//                 <div key={q.id} className={`p-6 rounded-3xl border-2 bg-white ${isCorrect ? 'border-emerald-100' : userAns ? 'border-rose-100' : 'border-slate-100 opacity-80'}`}>
//                   <div className="flex items-center justify-between mb-4">
//                     <span className="bg-slate-100 px-3 py-1 rounded-full text-xs font-bold text-slate-500">Q. {i + 1}</span>
//                     <div className="flex gap-4 items-center">
//                       <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1"><Clock size={12}/> {Math.floor(timeSpent/60)}m {timeSpent%60}s</span>
//                       {userAns ? (
//                         isCorrect ? <span className="text-emerald-600 font-bold text-xs uppercase flex items-center gap-1"><CheckCircle2 size={14}/> Correct (+3)</span>
//                         : <span className="text-rose-600 font-bold text-xs uppercase flex items-center gap-1"><XCircle size={14}/> Incorrect (-1)</span>
//                       ) : <span className="text-slate-400 font-bold text-xs uppercase">Unattempted (0)</span>}
//                     </div>
//                   </div>
//                   <p className="text-slate-800 font-medium mb-4">{renderText(q.question_text)}</p>
//                   <div className="bg-slate-50 p-4 rounded-2xl text-sm border border-slate-100">
//                     <p><span className="font-bold text-blue-900">Correct Answer:</span> {q.correct_option}</p>
//                     {userAns && !isCorrect && <p className="mt-1 text-rose-500"><span className="font-bold">Your Answer:</span> {userAns}</p>}
//                   </div>
//                 </div>
//               );
//             })}
//           </div>
//         )} */}

//         <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
//           <div className="lg:col-span-1">
//              <CATLeaderboard setId={setInfo.id} />
//           </div>
//           <div className="lg:col-span-2 bg-[#003366] p-8 rounded-[2.5rem] text-white relative overflow-hidden flex items-center">
//              <div className="relative z-10">
//                 <h3 className="text-xl font-black mb-2 uppercase italic tracking-tighter">Strategic Insight</h3>
//                 <p className="text-blue-100 leading-relaxed text-sm max-w-md">
//                   {accuracy > 75 
//                     ? "Exceptional accuracy. To improve, focus on identifying 'anchor' questions faster to increase your total attempts."
//                     : "Focus on accuracy first. In CAT LRDI, getting 2 sets 100% correct is better than attempting 4 sets with low accuracy."}
//                 </p>
//              </div>
//              <BarChart3 size={140} className="absolute right-[-20px] bottom-[-20px] text-white/10" />
//           </div>
//         </div>
//       </div>
//     </div>
//   );
// }

// --- SUB-COMPONENT: LEADERBOARD ---
function CATLeaderboard({ setId }: { setId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [leaders, setLeaders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchLeaderboard() {
      const { data, error } = await supabase
        .from('cat_results')
        .select(`score, accuracy, profiles ( name, avatar_url )`)
        .eq('set_id', setId)
        .order('score', { ascending: false })
        .limit(5);
      if (!error) setLeaders(data || []);
      setLoading(false);
    }
    fetchLeaderboard();
  }, [setId, supabase]);

  if (loading) return <div className="p-4 text-xs animate-pulse text-gray-400">Loading Rankings...</div>;

  return (
    <div className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm">
      <div className="bg-gray-50 p-4 border-b border-gray-200 flex items-center gap-2">
        <Trophy size={16} className="text-amber-500" />
        <span className="text-xs font-black uppercase tracking-widest text-gray-600">Top Aspirants</span>
      </div>
      <div className="divide-y divide-gray-100">
        {leaders.map((entry, i) => (
          <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <span className={`text-xs font-bold w-4 ${i === 0 ? 'text-amber-500' : 'text-gray-400'}`}>{i + 1}.</span>
              <div className="w-8 h-8 rounded-full bg-blue-100 overflow-hidden border border-white">
                {entry.profiles?.avatar_url ? (
                  <img src={entry.profiles.avatar_url} className="w-full h-full object-cover" alt="User" />
                ) : <User size={14} className="m-auto mt-2 text-blue-600" />}
              </div>
              <span className="text-[12px] font-bold text-gray-700 truncate w-24">{entry.profiles?.name}</span>
            </div>
            <span className="text-sm font-black text-[#003366]">{entry.score}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// --- MAIN COMPONENT ---
export default function CATSectionalUI({ questions = [], setInfo }: any) {
  const supabase = useMemo(() => createClient(), []);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [timeSpentMap, setTimeSpentMap] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(setInfo?.duration_mins ? setInfo.duration_mins * 60 : 2400);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showResult, setShowResult] = useState(false);
  const [summary, setSummary] = useState({ score: 0, correct: 0, wrong: 0, attempted: 0 });
  const [userProfile, setUserProfile] = useState({ name: "Loading...", avatar_url: null });
  // Ref to always call latest handleFinalSubmit from stale timer closure
  const submitRef = useRef<() => void>(() => {});

  useEffect(() => {
    async function getProfile() {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single();
        if (data) setUserProfile({ name: data.name || "Aspirant", avatar_url: data.avatar_url });
      }
    }
    getProfile();
  }, [supabase]);

  useEffect(() => {
    if (showResult) return;
    const timer = setInterval(() => {
      // Global Countdown
      setTimeLeft((prev: number) => {
        if (prev <= 1) { clearInterval(timer); submitRef.current(); return 0; }
        return prev - 1;
      });

      // Background Time Tracker for current question
      if (questions[currentIdx]?.id) {
        setTimeSpentMap(prev => ({
          ...prev,
          [questions[currentIdx].id]: (prev[questions[currentIdx].id] || 0) + 1
        }));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [showResult, currentIdx, questions]);

  const handleFinalSubmit = async () => {
    let score = 0, correct = 0, wrong = 0, attempted = 0;
    questions.forEach((q: any) => {
      const userAns = responses[q.id]?.answer;
      if (userAns !== undefined && userAns !== "") {
        attempted++;
        if (userAns === q.correct_option) { score += 3; correct++; }
        else { q.question_type === 'mcq' ? (score -= 1, wrong++) : wrong++; }
      }
    });

    setSummary({ score, correct, wrong, attempted });
    setIsSubmitting(true);
    

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const totalMark = questions.reduce((s: number, q: any) => s + (q.positive_marks ?? 4), 0);
        const totalTime = setInfo?.duration_mins ? setInfo.duration_mins * 60 : 0;
        const timeTakenSec = totalTime > 0 ? totalTime - timeLeft : 0;

        // Save to cat_results (existing)
        await supabase.from('cat_results').insert([{
          user_id: user.id,
          set_id: setInfo.id,
          score,
          correct_count: correct,
          wrong_count: wrong,
          total_questions: questions.length,
          accuracy: attempted > 0 ? (correct / attempted) * 100 : 0
        }]).then(() => {});

        // Save to contest_results for leaderboard
        if (setInfo?.id) {
          await supabase.from('contest_results').upsert([{
            user_id: user.id,
            contest_id: setInfo.id,
            score,
            total_marks: totalMark,
            time_taken: timeTakenSec > 0 ? timeTakenSec : 0,
            answers: responses,
          }], { onConflict: 'user_id,contest_id' }).then(() => {});
        }
      }
      setShowResult(true);
    } catch (e) { 
        console.error(e); 
        setShowResult(true); 
    } finally { 
        setIsSubmitting(false); 
    }
  };
  // Keep ref current so the timer closure always calls the latest version
  submitRef.current = handleFinalSubmit;

  const currentQ = questions[currentIdx];
  const renderText = (text: string) => text?.split(/(\$.*?\$)/g).map((p, i) => p.startsWith('$') ? <InlineMath key={i} math={p.slice(1, -1)} /> : <span key={i}>{p}</span>);
  
  const getStatusColor = (id: string, index: number) => {
    const res = responses[id];
    if (currentIdx === index) return "border-2 border-orange-500 ring-2 ring-orange-200";
    if (res?.status === 'answered') return "bg-[#28a745] text-white nta-trapezoid";
    if (res?.status === 'marked') return "bg-[#6f42c1] text-white rounded-full";
    if (res?.visited) return "bg-[#dc3545] text-white nta-trapezoid";
    return "bg-white border-gray-400";
  };

  const mappedQuestions = questions.map((q: any) => {
  const userResponse = responses[q.id]?.answer; // What the student picked
  const isCorrect = userResponse === q.correct_option; // Match check

  const userOptionObj = q.options?.find((o: any) => o.id === userResponse);
  const correctOptionObj = q.options?.find((o: any) => o.id === q.correct_option);
  
  return {
    ...q,
    question: q.question_text,   // Display text
    // userAnswer: userResponse,    // Student's pick
    // correctAnswer: q.correct_option, // DB's correct answer
    // isCorrect: isCorrect,
    isAttempted: !!userResponse,
    explanation: q.explanation || "Detailed explanation coming soon...",
    id: q.id,
    // question: q.question_text,
    // We store the ID and the Text together for the UI
    userAnswer: userResponse ? `${userResponse}. ${userOptionObj?.t || userResponse}` : "Skipped",
    correctAnswer: `${q.correct_option}. ${correctOptionObj?.t || q.correct_option}`,
    // explanation: q.explanation || "No explanation provided.",
    isCorrect: userResponse !== undefined && userResponse !== '' && userResponse === q.correct_option,
    // isAttempted: !!userAnsId,
  };
});

if (showResult) {
  // Build a clean enriched question array for the analysis dashboard
  const analysisQuestions = questions.map((q: any) => {
    const userResponse = responses[q.id]?.answer;
    const isCorrect = userResponse !== undefined && userResponse !== '' && userResponse === q.correct_option;
    const isAttempted = userResponse !== undefined && userResponse !== '';
    return {
      id: q.id,
      question_text: q.question_text,
      question_image_url: q.question_image_url,
      question_type: q.question_type,
      subject: q.subject,
      chapter: q.chapter,
      topic: q.topic,
      difficulty: q.difficulty,
      options: q.options ?? [],
      correct_option: q.correct_option,
      userAnswer: userResponse ?? '',
      isCorrect,
      isAttempted,
      explanation: q.explanation,
      solution_text: q.solution_text,
      solution_image_url: q.solution_image_url,
      positive_marks: q.positive_marks,
      negative_marks: q.negative_marks,
    };
  });

  const totalMark = questions.reduce((s: number, q: any) => s + (q.positive_marks ?? 4), 0);
  const totalTime = setInfo?.duration_mins ? setInfo.duration_mins * 60 : 0;
  const timeTaken = totalTime > 0 ? totalTime - timeLeft : 0;

  return (
    <CATResultAnalysis
      summary={{
        ...summary,
        totalQuestions: questions.length,
        totalMarks: totalMark,
        timeTaken: timeTaken > 0 ? timeTaken : undefined,
      }}
      questions={analysisQuestions}
      setInfo={setInfo}
      responses={responses}
      timeSpentMap={timeSpentMap}
      onReset={() => window.location.reload()}
    />
  );
}

  if (!currentQ) return <div className="h-screen flex items-center justify-center font-bold">Loading Test...</div>;

  return (
    <div className="flex flex-col h-screen bg-[#f1f3f4] text-black font-sans overflow-hidden select-none">
      <header className="bg-white border-b-2 border-[#003366] px-4 py-2 flex justify-between items-center h-14 shrink-0">
        <div className="flex items-center gap-4">
          <div className="bg-[#003366] text-white px-3 py-1 font-bold text-sm">CAT 2026</div>
          <div className="text-[#003366] font-bold text-xs uppercase hidden md:block">{setInfo?.title}</div>
        </div>
        <div className="bg-[#fff9c4] border border-[#fbc02d] px-5 py-1 text-center min-w-30">
          <p className="text-xl font-mono font-black text-red-600">{Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}</p>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* LEFT PANEL */}
        {(setInfo?.passage_text || setInfo?.image_url) && (
          <div className="w-1/2 bg-white m-1 border border-gray-300 overflow-y-auto p-6 custom-scrollbar shadow-inner">
             <div className="flex items-center gap-2 mb-4 border-b pb-1">
               <Info size={14} className="text-[#003366]" />
               <h4 className="text-[#003366] font-bold text-[10px] uppercase">Set Information</h4>
             </div>
             {setInfo?.image_url && (
               <div className="mb-6 p-2 rounded bg-white border border-gray-100 shadow-sm">
                 <img src={setInfo.image_url} className="w-full h-auto object-contain max-h-125" alt="Reference Data" />
               </div>
             )}
             <div className="text-[15px] leading-relaxed text-gray-800 font-serif">
               {renderText(setInfo.passage_text)}
             </div>
          </div>
        )}

        {/* RIGHT PANEL */}
        <div className="flex-1 flex flex-col bg-white m-1 border border-gray-300 overflow-hidden relative">
           <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
             {currentQ?.image_url && (
                <div className="mb-6 border p-3 rounded bg-[#fcfcfc] shadow-sm">
                  <img src={currentQ.image_url} className="max-h-72 w-auto mx-auto object-contain" alt="Question" />
                </div>
             )}
             <div className="text-[17px] font-medium mb-10 text-gray-900 leading-relaxed">
               <span className="bg-gray-100 px-2 py-0.5 rounded text-sm font-bold mr-3 border border-gray-200">Q.{currentIdx + 1}</span>
               {renderText(currentQ.question_text)}
             </div>
             <div className="space-y-4 max-w-2xl">
               {currentQ.question_type === 'mcq' ? (
                 currentQ.options?.map((opt: any, i: number) => (
                   <label key={i} className={`flex items-center gap-4 p-4 border rounded-xl cursor-pointer transition-all ${responses[currentQ.id]?.answer === opt.id ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-500' : 'border-gray-200 hover:bg-gray-50'}`}>
                     <input type="radio" className="w-4 h-4 accent-[#003366]" checked={responses[currentQ.id]?.answer === opt.id} onChange={() => setResponses({...responses, [currentQ.id]: { answer: opt.id, status: 'answered', visited: true }})} />
                     <span className="text-sm font-black text-gray-400 w-4">{opt.id}.</span>
                     <span className="text-[15px]">{renderText(opt.t)}</span>
                   </label>
                 ))
               ) : (
                 <div className="bg-blue-50 p-6 rounded-xl border-2 border-dashed border-blue-200">
                   <p className="text-[11px] font-black text-[#003366] mb-3 uppercase tracking-wider">Type Answer (TITA):</p>
                   <input type="text" className="w-full border-2 border-gray-300 p-4 text-2xl font-mono outline-none focus:border-[#003366] rounded-lg shadow-inner bg-white" placeholder="Enter value..." value={responses[currentQ.id]?.answer || ""} onChange={(e) => setResponses({...responses, [currentQ.id]: { answer: e.target.value, status: 'answered', visited: true }})} />
                 </div>
               )}
             </div>
           </div>
           <footer className="bg-gray-100 border-t border-gray-300 p-3 flex justify-between shrink-0">
              <button onClick={() => setCurrentIdx(prev => Math.max(0, prev - 1))} className="px-6 py-2 bg-white border border-gray-400 text-xs font-bold uppercase hover:bg-gray-50 transition-colors">Previous</button>
              <button onClick={() => { if (!responses[currentQ.id]) setResponses({...responses, [currentQ.id]: { status: 'visited', visited: true }}); if (currentIdx < questions.length - 1) setCurrentIdx(prev => prev + 1); }} className="px-12 py-2 bg-[#28a745] text-white text-xs font-bold uppercase shadow-md hover:bg-green-700 transition-all active:scale-95">Save & Next</button>
           </footer>
        </div>

        {/* SIDEBAR */}
        <aside className="w-72 bg-[#e5f1fa] border-l border-gray-300 flex flex-col shrink-0">
          <div className="p-4 flex gap-3 items-center border-b border-gray-300 bg-white">
            <div className="w-14 h-16 bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden rounded">
              {userProfile.avatar_url ? <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="User" /> : <User className="text-gray-300" size={30} />}
            </div>
            <div className="flex flex-col overflow-hidden">
              <span className="text-[10px] text-gray-400 font-bold uppercase leading-none mb-1">Aspirant:</span>
              <span className="text-xs font-black text-[#003366] uppercase truncate">{userProfile.name}</span>
            </div>
          </div>
          <div className="flex-1 p-3 flex flex-col overflow-hidden">
            <h3 className="text-[11px] font-bold bg-[#4183c4] text-white p-2 mb-3 uppercase text-center rounded-sm tracking-widest">Question Palette</h3>
            <div className="grid grid-cols-4 gap-2 overflow-y-auto pr-1 flex-1 content-start custom-scrollbar">
              {questions.map((q: any, i: number) => (
                <button key={q.id} onClick={() => setCurrentIdx(i)} className={`w-12 h-12 text-xs font-bold border transition-all flex items-center justify-center shadow-sm ${getStatusColor(q.id, i)}`}>{i + 1}</button>
              ))}
            </div>
          </div>
          <div className="p-3 border-t border-gray-300 bg-white">
             <button onClick={() => handleFinalSubmit()} disabled={isSubmitting} className="w-full bg-[#003366] text-white font-bold py-4 text-xs uppercase shadow-lg hover:bg-blue-900 disabled:opacity-50 tracking-widest transition-all">Submit Test</button>
          </div>
        </aside>
      </div>
      
      <style jsx>{`
        .nta-trapezoid { clip-path: polygon(0% 0%, 100% 0%, 100% 70%, 50% 100%, 0% 70%); border-radius: 2px; }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e0; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
}