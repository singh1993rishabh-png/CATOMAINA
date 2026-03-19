'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { InlineMath } from 'react-katex';
import 'katex/dist/katex.min.css';
import { createClient } from '@/app/utils/supabase/client';
import {
  User, Info, Clock, CheckCircle2, XCircle,
  ChevronLeft, ChevronRight, Send, Flag, RotateCcw
} from 'lucide-react';
import CATResultAnalysis from './resultsection';
import type { NormalizedQuestion, NormalizedSetInfo } from '@/app/utils/normalizeQuestion';

// ─── Types ────────────────────────────────────────────────────
interface Response {
  answer: string;
  status: 'answered' | 'marked' | 'visited';
  visited: boolean;
}

interface Props {
  questions: NormalizedQuestion[];
  setInfo: NormalizedSetInfo;
}

// ─── Text renderer (supports $LaTeX$) ────────────────────────
function RenderText({ text }: { text: string }) {
  if (!text) return null;
  const parts = text.split(/(\$.*?\$)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('$') && p.endsWith('$')
          ? <InlineMath key={i} math={p.slice(1, -1)} />
          : <span key={i}>{p}</span>
      )}
    </>
  );
}

// ─── Question palette status colors ──────────────────────────
function getPaletteClass(qId: string, idx: number, currentIdx: number, responses: Record<string, Response>) {
  const res = responses[qId];
  if (currentIdx === idx) return 'border-2 border-orange-500 ring-2 ring-orange-200 bg-orange-50';
  if (res?.status === 'answered') return 'bg-[#28a745] text-white border-[#28a745]';
  if (res?.status === 'marked') return 'bg-[#6f42c1] text-white rounded-full border-[#6f42c1]';
  if (res?.visited) return 'bg-[#dc3545] text-white border-[#dc3545]';
  return 'bg-white border-gray-300 text-gray-600 hover:border-gray-400';
}

// ─── MAIN COMPONENT ───────────────────────────────────────────
export default function ExamEngine({ questions, setInfo }: Props) {
  const supabase = useMemo(() => createClient(), []);

  const [currentIdx,     setCurrentIdx]     = useState(0);
  const [responses,      setResponses]      = useState<Record<string, Response>>({});
  const [timeSpentMap,   setTimeSpentMap]   = useState<Record<string, number>>({});
  const [timeLeft,       setTimeLeft]       = useState(
    setInfo.duration_mins > 0 ? setInfo.duration_mins * 60 : 0
  );
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [showResult,     setShowResult]     = useState(false);
  const [summary,        setSummary]        = useState({ score: 0, correct: 0, wrong: 0, attempted: 0 });
  const [userProfile,    setUserProfile]    = useState<{ name: string; avatar_url: string | null }>({
    name: 'Aspirant', avatar_url: null,
  });
  const [showPalette,    setShowPalette]    = useState(true);
  const [showSubmitModal,setShowSubmitModal] = useState(false);
  const [saveStatus,     setSaveStatus]     = useState<'idle'|'saving'|'saved'|'error'>('idle');

  const submitRef = useRef<() => void>(() => {});

  // ── Fetch user profile ────────────────────────────────────
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from('profiles').select('name, avatar_url').eq('id', user.id).single()
        .then(({ data }) => {
          if (data) setUserProfile({ name: data.name ?? 'Aspirant', avatar_url: data.avatar_url ?? null });
        });
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // ── Timer ─────────────────────────────────────────────────
  useEffect(() => {
    if (showResult || setInfo.duration_mins === 0) return;
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timer); submitRef.current(); return 0; }
        return prev - 1;
      });
      const qId = questions[currentIdx]?.id;
      if (qId) setTimeSpentMap(prev => ({ ...prev, [qId]: (prev[qId] ?? 0) + 1 }));
    }, 1000);
    return () => clearInterval(timer);
  }, [showResult, currentIdx, questions, setInfo.duration_mins]);

  // ── Score a single question ───────────────────────────────
  function scoreQuestion(q: NormalizedQuestion, userAns: string): 'correct' | 'wrong' | 'skip' {
    if (!userAns) return 'skip';
    const isNum = q.question_type === 'numerical' || q.question_type === 'tita';
    const hit = isNum
      ? !isNaN(parseFloat(userAns)) && !isNaN(parseFloat(q.correct_option)) &&
        Math.abs(parseFloat(userAns) - parseFloat(q.correct_option)) <= 0.01
      : userAns === q.correct_option;
    return hit ? 'correct' : 'wrong';
  }

  // ── Submit ────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Compute score from current responses
    let score = 0, correct = 0, wrong = 0, attempted = 0;
    questions.forEach(q => {
      const userAns = responses[q.id]?.answer ?? '';
      if (userAns) {
        attempted++;
        const result = scoreQuestion(q, userAns);
        if (result === 'correct') { score += q.positive_marks; correct++; }
        else if (result === 'wrong' && q.question_type !== 'numerical' && q.question_type !== 'tita') {
          score -= q.negative_marks; wrong++;
        } else if (result === 'wrong') { wrong++; }
      }
    });

    setSummary({ score, correct, wrong, attempted });
    setIsSubmitting(true);
    setSaveStatus('saving');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      // Save for ALL non-drill tests — both practice sets and contests
      if (user && setInfo.id && !setInfo.id.startsWith('drill-')) {
        const totalMarks = questions.reduce((s, q) => s + q.positive_marks, 0);
        const timeTaken  = setInfo.duration_mins > 0 ? Math.max(0, setInfo.duration_mins * 60 - timeLeft) : 0;

        // Build enriched answers: include question metadata so insights work
        // even when questions can't be looked up separately
        const enrichedAnswers: Record<string, any> = {};
        questions.forEach(q => {
          enrichedAnswers[q.id] = {
            answer:        responses[q.id]?.answer ?? '',
            status:        responses[q.id]?.status ?? 'not_visited',
            visited:       responses[q.id]?.visited ?? false,
            // Embed question metadata for reliable insight computation
            _difficulty:   q.difficulty ?? 'moderate',
            _question_type: q.question_type ?? 'mcq',
            _correct:      q.correct_option,
            _subject:      q.subject ?? '',
            _chapter:      q.chapter ?? '',
            _topic:        q.topic ?? '',
            _section:      setInfo.subject_section ?? '',
            _module:       setInfo.module ?? q.subject ?? '',
            _pos_marks:    q.positive_marks,
            _neg_marks:    q.negative_marks,
          };
        });

        const payload = {
          user_id:     user.id,
          contest_id:  setInfo.id,
          score,
          total_marks: totalMarks,
          time_taken:  timeTaken,
          answers:     enrichedAnswers,
        };

        // Try upsert first, fall back to insert if upsert fails (handles missing UNIQUE constraint)
        let saveErr: any = null;

        const { error: uErr } = await supabase
          .from('contest_results')
          .upsert([payload], { onConflict: 'user_id,contest_id', ignoreDuplicates: false });

        saveErr = uErr;

        if (uErr) {
          // Upsert failed — try plain insert (handles case where UNIQUE constraint is named differently)
          console.warn('Upsert failed, trying insert:', uErr.message);
          const { error: iErr } = await supabase
            .from('contest_results')
            .insert([payload]);
          saveErr = iErr;
        }

        if (saveErr) {
          console.error('Result save failed:', saveErr.code, '|', saveErr.message);
          setSaveStatus('error');
        } else {
          console.log('✅ Result saved — contest:', setInfo.id.slice(0, 8), '| score:', score, '/', totalMarks);
          setSaveStatus('saved');
        }
      }

      setShowResult(true);
    } catch (e) {
      console.error('Submit error:', e);
      setSaveStatus('error');
      setShowResult(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  submitRef.current = handleSubmit;

  // ── Answer helpers ────────────────────────────────────────
  const setAnswer = (qId: string, answer: string) =>
    setResponses(prev => ({ ...prev, [qId]: { answer, status: 'answered', visited: true } }));

  const markForReview = (qId: string) =>
    setResponses(prev => ({
      ...prev,
      [qId]: { ...prev[qId], answer: prev[qId]?.answer ?? '', status: 'marked', visited: true },
    }));

  const clearResponse = (qId: string) =>
    setResponses(prev => {
      const next = { ...prev };
      if (next[qId]) next[qId] = { answer: '', status: 'visited', visited: true };
      return next;
    });

  const goTo = (idx: number) => {
    const qId = questions[currentIdx]?.id;
    if (qId && !responses[qId])
      setResponses(prev => ({ ...prev, [qId]: { answer: '', status: 'visited', visited: true } }));
    setCurrentIdx(Math.max(0, Math.min(idx, questions.length - 1)));
  };

  // ── Result view ───────────────────────────────────────────
  if (showResult) {
    const totalMarks = questions.reduce((s, q) => s + q.positive_marks, 0);
    const timeTaken  = setInfo.duration_mins > 0 ? setInfo.duration_mins * 60 - timeLeft : 0;

    // Recompute live from responses
    let liveScore = 0, liveCorrect = 0, liveWrong = 0, liveAttempted = 0;
    questions.forEach(q => {
      const ans = responses[q.id]?.answer ?? '';
      if (ans) {
        liveAttempted++;
        const r = scoreQuestion(q, ans);
        if (r === 'correct') { liveScore += q.positive_marks; liveCorrect++; }
        else if (r === 'wrong' && q.question_type !== 'numerical' && q.question_type !== 'tita') {
          liveScore -= q.negative_marks; liveWrong++;
        } else if (r === 'wrong') liveWrong++;
      }
    });

    const liveSummary = {
      score: liveScore, correct: liveCorrect, wrong: liveWrong, attempted: liveAttempted,
      totalQuestions: questions.length, totalMarks,
      timeTaken: timeTaken > 0 ? timeTaken : undefined,
    };

    const analysisQuestions = questions.map(q => ({
      id: q.id,
      question_text:      q.question_text,
      question_image_url: q.question_image_url,
      question_type:      q.question_type,
      subject:            q.subject,
      chapter:            q.chapter,
      topic:              q.topic,
      difficulty:         q.difficulty,
      options: q.options.map(o => ({
        id: o.id, option_label: o.id, option_text: o.text, is_correct: o.is_correct, t: o.text,
      })),
      correct_option:     q.correct_option,
      userAnswer:         responses[q.id]?.answer ?? '',
      isCorrect:          (() => {
        const ans = responses[q.id]?.answer ?? '';
        if (!ans) return false;
        const isNum = q.question_type === 'numerical' || q.question_type === 'tita';
        return isNum
          ? Math.abs(parseFloat(ans) - parseFloat(q.correct_option)) <= 0.01
          : ans === q.correct_option;
      })(),
      isAttempted:        !!(responses[q.id]?.answer),
      solution_text:      q.solution_text,
      solution_image_url: q.solution_image_url,
      explanation:        q.explanation,
      positive_marks:     q.positive_marks,
      negative_marks:     q.negative_marks,
    }));

    return (
      <CATResultAnalysis
        summary={liveSummary}
        questions={analysisQuestions}
        setInfo={{ id: setInfo.id, title: setInfo.title }}
        responses={responses}
        timeSpentMap={timeSpentMap}
        onReset={() => window.location.reload()}
      />
    );
  }

  // ── Loading ───────────────────────────────────────────────
  if (questions.length === 0) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-[#f1f3f4] gap-4">
        <div className="w-10 h-10 border-4 border-[#003366] border-t-transparent rounded-full animate-spin" />
        <p className="text-[#003366] font-bold text-sm uppercase tracking-widest">Loading Test...</p>
      </div>
    );
  }

  const currentQ = questions[currentIdx];
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const isTimeCritical = timeLeft > 0 && timeLeft < 300;
  const answered   = Object.values(responses).filter(r => r.status === 'answered').length;
  const marked     = Object.values(responses).filter(r => r.status === 'marked').length;
  const visited    = Object.values(responses).filter(r => r.visited && r.status !== 'answered' && r.status !== 'marked').length;
  const notVisited = questions.length - Object.keys(responses).length;

  return (
    <div className="flex flex-col h-screen bg-[#f1f3f4] text-black font-sans overflow-hidden select-none">

      {/* ── Header ─────────────────────────────────────────── */}
      <header className="bg-white border-b-2 border-[#003366] px-4 py-2 flex justify-between items-center h-14 shrink-0 z-10">
        <div className="flex items-center gap-4">
          <div className="bg-[#003366] text-white px-3 py-1 font-bold text-sm tracking-wide">
            {setInfo.exam_name ?? 'CAT 2026'}
          </div>
          <div className="text-[#003366] font-bold text-xs uppercase hidden md:block tracking-widest">
            {setInfo.title}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Save status indicator */}
          {saveStatus === 'saving' && (
            <span className="text-[10px] text-blue-500 font-bold flex items-center gap-1">
              <div className="w-2 h-2 border border-blue-500 border-t-transparent rounded-full animate-spin"/>Saving…
            </span>
          )}
          {saveStatus === 'saved' && (
            <span className="text-[10px] text-emerald-600 font-bold">✓ Saved</span>
          )}
          {saveStatus === 'error' && (
            <span className="text-[10px] text-red-500 font-bold">⚠ Save failed</span>
          )}
          {/* Timer */}
          <div className={`border px-5 py-1 text-center min-w-[120px] transition-colors ${isTimeCritical ? 'bg-red-50 border-red-400' : 'bg-[#fff9c4] border-[#fbc02d]'}`}>
            {setInfo.duration_mins > 0 ? (
              <>
                <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Time Left</p>
                <p className={`text-xl font-mono font-black ${isTimeCritical ? 'text-red-600 animate-pulse' : 'text-red-600'}`}>
                  {fmtTime(timeLeft)}
                </p>
              </>
            ) : (
              <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Untimed</p>
            )}
          </div>
        </div>
        <button className="md:hidden p-2 bg-[#003366] text-white rounded text-xs font-bold"
          onClick={() => setShowPalette(s => !s)}>
          {showPalette ? '✕' : '☰'}
        </button>
      </header>

      <div className="flex flex-1 overflow-hidden">

        {/* ── Left panel (passage) ───────────────────────── */}
        {(setInfo.passage_text || setInfo.image_url) && (
          <div className="w-1/2 bg-white m-1 border border-gray-300 overflow-y-auto p-6 shadow-inner"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e0 transparent' }}>
            <div className="flex items-center gap-2 mb-4 border-b pb-2">
              <Info size={14} className="text-[#003366]" />
              <h4 className="text-[#003366] font-bold text-[11px] uppercase tracking-widest">Set Information</h4>
            </div>
            {setInfo.image_url && (
              <div className="mb-5 p-2 rounded bg-white border border-gray-100 shadow-sm">
                <img src={setInfo.image_url} className="w-full h-auto object-contain max-h-[500px]" alt="Reference" />
              </div>
            )}
            {setInfo.passage_text && (
              <div className="text-[15px] leading-relaxed text-gray-800 font-serif">
                <RenderText text={setInfo.passage_text} />
              </div>
            )}
          </div>
        )}

        {/* ── Right panel (question) ─────────────────────── */}
        <div className="flex-1 flex flex-col bg-white m-1 border border-gray-300 overflow-hidden">
          <div className="flex-1 p-6 md:p-8 overflow-y-auto"
            style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e0 transparent' }}>

            {currentQ.question_image_url && (
              <div className="mb-5 border p-3 rounded bg-[#fcfcfc] shadow-sm">
                <img src={currentQ.question_image_url} className="max-h-72 w-auto mx-auto object-contain" alt="Question" />
              </div>
            )}

            <div className="text-[17px] font-medium mb-8 text-gray-900 leading-relaxed">
              <span className="bg-gray-100 px-2 py-0.5 rounded text-sm font-bold mr-3 border border-gray-200">
                Q.{currentIdx + 1}
              </span>
              <RenderText text={currentQ.question_text} />
            </div>

            <div className="flex gap-4 mb-6 text-[11px] font-bold">
              <span className="bg-green-50 text-green-700 border border-green-200 px-2.5 py-1 rounded-full">
                +{currentQ.positive_marks} Correct
              </span>
              <span className="bg-red-50 text-red-600 border border-red-200 px-2.5 py-1 rounded-full">
                -{currentQ.negative_marks} Wrong
              </span>
              {currentQ.difficulty && (
                <span className={`px-2.5 py-1 rounded-full border capitalize ${
                  currentQ.difficulty === 'easy' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : currentQ.difficulty === 'hard' ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-yellow-50 text-yellow-700 border-yellow-200'
                }`}>{currentQ.difficulty}</span>
              )}
            </div>

            <div className="space-y-3 max-w-2xl">
              {currentQ.question_type === 'numerical' || currentQ.question_type === 'tita' ? (
                <div className="bg-blue-50 p-6 rounded-xl border-2 border-dashed border-blue-200">
                  <p className="text-[11px] font-black text-[#003366] mb-3 uppercase tracking-wider">
                    Type your answer (TITA):
                  </p>
                  <input
                    type="text" inputMode="decimal"
                    className="w-full border-2 border-gray-300 p-4 text-2xl font-mono outline-none focus:border-[#003366] rounded-lg shadow-inner bg-white transition"
                    placeholder="Enter numerical value..."
                    value={responses[currentQ.id]?.answer ?? ''}
                    onChange={e => setAnswer(currentQ.id, e.target.value)}
                  />
                </div>
              ) : (
                currentQ.options.map(opt => {
                  const isSelected = responses[currentQ.id]?.answer === opt.id;
                  return (
                    <label key={opt.id}
                      className={`flex items-start gap-4 p-4 border rounded-xl cursor-pointer transition-all ${
                        isSelected ? 'bg-blue-50 border-blue-500 ring-1 ring-blue-400'
                        : 'border-gray-200 hover:bg-gray-50 hover:border-gray-300'
                      }`}>
                      <input type="radio" className="w-4 h-4 accent-[#003366] mt-0.5 flex-shrink-0"
                        checked={isSelected} onChange={() => setAnswer(currentQ.id, opt.id)} />
                      <span className={`text-sm font-black w-5 flex-shrink-0 mt-0.5 ${isSelected ? 'text-blue-700' : 'text-gray-400'}`}>
                        {opt.id}.
                      </span>
                      <span className="text-[15px] leading-relaxed flex-1">
                        {opt.image_url && (
                          <img src={opt.image_url} alt={`Option ${opt.id}`} className="max-h-20 mb-2 object-contain rounded" />
                        )}
                        <RenderText text={opt.text} />
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </div>

          {/* Footer */}
          <footer className="bg-gray-100 border-t border-gray-300 p-3 flex items-center justify-between gap-2 shrink-0 flex-wrap">
            <div className="flex gap-2">
              <button onClick={() => clearResponse(currentQ.id)}
                className="flex items-center gap-1.5 px-4 py-2 bg-white border border-gray-400 text-xs font-bold uppercase hover:bg-gray-50 transition rounded">
                <RotateCcw size={12}/>Clear
              </button>
              <button onClick={() => markForReview(currentQ.id)}
                className={`flex items-center gap-1.5 px-4 py-2 border text-xs font-bold uppercase transition rounded ${
                  responses[currentQ.id]?.status === 'marked'
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white border-gray-400 text-gray-600 hover:bg-gray-50'
                }`}>
                <Flag size={12}/>Mark & Review
              </button>
            </div>
            <div className="flex gap-2">
              <button onClick={() => goTo(currentIdx - 1)} disabled={currentIdx === 0}
                className="flex items-center gap-1 px-4 py-2 bg-white border border-gray-400 text-xs font-bold uppercase hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition rounded">
                <ChevronLeft size={14}/>Prev
              </button>
              {currentIdx < questions.length - 1 ? (
                <button onClick={() => goTo(currentIdx + 1)}
                  className="flex items-center gap-1 px-10 py-2 bg-[#28a745] text-white text-xs font-bold uppercase shadow hover:bg-green-700 transition rounded active:scale-95">
                  Save & Next<ChevronRight size={14}/>
                </button>
              ) : (
                <button onClick={() => setShowSubmitModal(true)} disabled={isSubmitting}
                  className="flex items-center gap-1.5 px-8 py-2 bg-[#003366] text-white text-xs font-bold uppercase shadow hover:bg-blue-900 disabled:opacity-50 transition rounded active:scale-95">
                  {isSubmitting
                    ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Submitting...</>
                    : <><Send size={12}/>Submit Test</>}
                </button>
              )}
            </div>
          </footer>
        </div>

        {/* ── Sidebar (palette) ──────────────────────────── */}
        <aside className={`w-64 bg-[#e5f1fa] border-l border-gray-300 flex flex-col shrink-0 transition-all ${showPalette ? '' : 'hidden md:flex'}`}>
          <div className="p-3 flex gap-3 items-center border-b border-gray-300 bg-white">
            <div className="w-12 h-14 bg-gray-50 border border-gray-200 flex items-center justify-center overflow-hidden rounded flex-shrink-0">
              {userProfile.avatar_url
                ? <img src={userProfile.avatar_url} className="w-full h-full object-cover" alt="User"/>
                : <User className="text-gray-300" size={28}/>}
            </div>
            <div className="overflow-hidden">
              <span className="text-[9px] text-gray-400 font-bold uppercase leading-none">Aspirant</span>
              <p className="text-xs font-black text-[#003366] uppercase truncate mt-0.5">{userProfile.name}</p>
            </div>
          </div>

          {/* Legend */}
          <div className="px-3 py-2 border-b border-gray-200 bg-white">
            <div className="grid grid-cols-2 gap-1 text-[9px] font-bold">
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#28a745]"/>Answered ({answered})</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-[#6f42c1]"/>Marked ({marked})</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-[#dc3545]"/>Visited ({visited})</div>
              <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-sm bg-white border border-gray-300"/>Not Visited ({notVisited})</div>
            </div>
          </div>

          {/* Palette */}
          <div className="flex-1 p-3 flex flex-col overflow-hidden">
            <h3 className="text-[10px] font-bold bg-[#4183c4] text-white p-2 mb-3 uppercase text-center rounded tracking-widest">
              Question Palette
            </h3>
            <div className="grid grid-cols-5 gap-1.5 overflow-y-auto flex-1 content-start"
              style={{ scrollbarWidth: 'thin', scrollbarColor: '#9ca3af transparent' }}>
              {questions.map((q, i) => (
                <button key={q.id} onClick={() => goTo(i)}
                  className={`w-10 h-10 text-xs font-bold border-2 transition-all flex items-center justify-center shadow-sm ${getPaletteClass(q.id, i, currentIdx, responses)}`}>
                  {i + 1}
                </button>
              ))}
            </div>
          </div>

          {/* Submit */}
          <div className="p-3 border-t border-gray-300 bg-white space-y-2">
            <div className="text-[10px] text-gray-500 text-center font-medium">
              {answered}/{questions.length} answered · {marked} marked
            </div>
            <button onClick={() => setShowSubmitModal(true)} disabled={isSubmitting}
              className="w-full bg-[#003366] text-white font-bold py-3.5 text-xs uppercase shadow-lg hover:bg-blue-900 disabled:opacity-50 tracking-widest transition-all rounded">
              {isSubmitting
                ? <span className="flex items-center justify-center gap-2"><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Submitting...</span>
                : 'Submit Test'}
            </button>
          </div>
        </aside>
      </div>

      {/* ── Submit modal ───────────────────────────────────── */}
      {showSubmitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-sm w-full mx-4 shadow-2xl text-center">
            <div className="w-14 h-14 rounded-2xl bg-[#003366] flex items-center justify-center mx-auto mb-4">
              <Send size={22} className="text-white"/>
            </div>
            <h3 className="text-xl font-black text-gray-900 mb-2">Submit Test?</h3>
            <p className="text-gray-500 text-sm mb-2">
              You have answered <span className="font-black text-[#003366]">{answered}</span> of <span className="font-black">{questions.length}</span> questions.
            </p>
            {answered < questions.length && (
              <p className="text-orange-600 text-xs font-bold bg-orange-50 rounded-xl px-3 py-2 mb-4">
                ⚠️ {questions.length - answered} question{questions.length - answered !== 1 ? 's' : ''} unattempted
              </p>
            )}
            <div className="flex gap-3 mt-5">
              <button onClick={() => setShowSubmitModal(false)}
                className="flex-1 py-3 rounded-2xl border-2 border-gray-200 text-gray-600 font-bold text-sm hover:bg-gray-50 transition">
                Cancel
              </button>
              <button onClick={() => { setShowSubmitModal(false); handleSubmit(); }} disabled={isSubmitting}
                className="flex-1 py-3 rounded-2xl bg-[#003366] text-white font-bold text-sm hover:bg-blue-900 transition disabled:opacity-50">
                {isSubmitting ? 'Submitting...' : 'Submit Now'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
