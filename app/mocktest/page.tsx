"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { createClient } from '../utils/supabase/client';
import ExamEngine from '../components/ExamEngine';
import { normalizeQuestions, normalizeSetInfo } from '../utils/normalizeQuestion';
import { motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Layers, Layout, Play, Clock, ChevronRight, Target, Trophy, Zap } from 'lucide-react';

interface CatQuestion {
  id: string;
  question_text: string;
  question_type: 'mcq' | 'tita';
  options: any;
  question_image_url?: string;
  set_id: string;
}

interface CatSet {
  id: string;
  title: string;
  subject_section: string;
  passage_text?: string;
  mock_type: 'topic' | 'sectional' | 'full';
  duration_mins: number;
  catquestions?: CatQuestion[];
}

export default function MockSystem() {
  const supabase = useMemo(() => createClient(), []);
  const [view, setView] = useState<'dashboard' | 'exam'>('dashboard');
  const [activeTab, setActiveTab] = useState<'topic' | 'sectional' | 'full'>('topic');
  const [sets, setSets] = useState<CatSet[]>([]);
  const [selectedSet, setSelectedSet] = useState<CatSet | null>(null);
  const [loading, setLoading] = useState(true);
  // Drill mode state
  const [isDrillMode, setIsDrillMode] = useState(false);
  const [drillQuestions, setDrillQuestions] = useState<any[]>([]);
  const [drillSetInfo, setDrillSetInfo] = useState<any>(null);

  useEffect(() => {
    // Check if launched from StudentDrill (drill=1 query param)
    const params = new URLSearchParams(window.location.search);
    if (params.get('drill') === '1') {
      const raw = sessionStorage.getItem('drill_session');
      if (raw) {
        try {
          const session = JSON.parse(raw);
          setDrillQuestions(session.questions ?? []);
          setDrillSetInfo({
            title: `Custom Drill — ${session.config?.mode ?? 'Practice'}`,
            duration_mins: session.config?.time_minutes ?? 0,
            id: 'drill-' + Date.now(),
          });
          setIsDrillMode(true);
          setView('exam');
          // Remove after 5s — gives exam time to fully mount before clearing
          setTimeout(() => sessionStorage.removeItem('drill_session'), 5000);
        } catch (e) {
          console.error('Failed to parse drill session', e);
        }
      }
    }

    // Always fetch sets for the normal dashboard
    async function fetchSets() {
      setLoading(true);
      const { data } = await supabase.from('catquestion_sets').select('*');
      if (data) setSets(data);
      setLoading(false);
    }
    fetchSets();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const [startError, setStartError] = useState('');
  const [startLoading, setStartLoading] = useState(false);

  const startExam = async (set: CatSet) => {
    setStartLoading(true); setStartError('');
    const { data, error } = await supabase.from('catquestions').select('*').eq('set_id', set.id);
    setStartLoading(false);
    if (error) { setStartError('Failed to load test: ' + error.message); return; }
    if (!data || data.length === 0) { setStartError('This set has no questions yet.'); return; }
    setSelectedSet({ ...set, catquestions: data });
    setIsDrillMode(false);
    setView('exam');
  };

  // Drill mode — normalize and pass drill questions
  if (view === 'exam' && isDrillMode && drillSetInfo) {
    const normalized = normalizeQuestions(drillQuestions);
    const normSetInfo = normalizeSetInfo(drillSetInfo);
    return <ExamEngine key={drillSetInfo.id} questions={normalized} setInfo={normSetInfo} />;
  }

  // Normal mode — catquestion_sets
  if (view === 'exam' && selectedSet) {
    const normalized = normalizeQuestions(selectedSet.catquestions || []);
    const normSetInfo = normalizeSetInfo({
      id: selectedSet.id,
      title: selectedSet.title,
      duration_mins: selectedSet.duration_mins,
      passage_text: selectedSet.passage_text,
      subject_section: selectedSet.subject_section,
      module: (selectedSet as any).module,
    });
    return <ExamEngine key={selectedSet.id} questions={normalized} setInfo={normSetInfo} />;
  }

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      {/* Background */}
      <div className="fixed inset-0 z-0 opacity-[0.025]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.6) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.6) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(249,115,22,0.07),transparent)]" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-10">
        {/* Header */}
        <div className="mb-10">
          <p className="text-orange-500/70 font-mono text-[10px] tracking-[0.4em] uppercase mb-2">📚 Practice Mode</p>
          <h1 className="text-4xl font-black tracking-tighter text-white">CAT Mock Tests</h1>
          <p className="text-gray-600 text-sm mt-2">Choose a set to begin. All tests follow official CAT 2026 pattern.</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 mb-8 bg-white/[0.03] border border-white/8 rounded-2xl p-1.5 w-fit">
          {[
            { id: 'topic', label: 'Topic-wise', icon: <BookOpen size={14} /> },
            { id: 'sectional', label: 'Sectional', icon: <Layers size={14} /> },
            { id: 'full', label: 'Full Length', icon: <Layout size={14} /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${activeTab === tab.id ? 'bg-orange-500 text-white shadow-[0_0_12px_rgba(249,115,22,0.3)]' : 'text-gray-500 hover:text-gray-300'}`}>
              {tab.icon}{tab.label}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => <div key={i} className="h-56 bg-white/3 rounded-3xl animate-pulse border border-white/5" />)}
          </div>
        ) : sets.filter(s => s.mock_type === activeTab).length === 0 ? (
          <div className="text-center py-20 text-gray-600">
            <Trophy size={40} className="mx-auto mb-4 opacity-30" />
            <p className="text-sm">No {activeTab} sets yet. Add them via the Admin Panel.</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {sets.filter(s => s.mock_type === activeTab).map(set => (
                <motion.div key={set.id} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                  className="group bg-white/[0.03] border border-white/8 rounded-3xl p-6 hover:border-orange-500/30 transition-all cursor-pointer flex flex-col"
                  onClick={() => startExam(set)}>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-[10px] font-black uppercase tracking-widest text-orange-500/80 bg-orange-500/10 border border-orange-500/20 px-2.5 py-1 rounded-full">
                      {set.subject_section}
                    </span>
                    <span className="flex items-center gap-1 text-gray-600 text-[11px] font-bold">
                      <Clock size={11} />{set.duration_mins || 40}m
                    </span>
                  </div>
                  <h3 className="text-white font-black text-lg leading-tight mb-2 group-hover:text-orange-300 transition-colors">{set.title}</h3>
                  <p className="text-gray-600 text-xs leading-relaxed flex-1 mb-5">
                    Full-pattern simulation covering key {set.subject_section} question types.
                  </p>
                  <button className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-white/5 border border-white/10 text-white text-xs font-black hover:bg-orange-500 hover:border-orange-500 transition-all group-hover:shadow-[0_0_15px_rgba(249,115,22,0.2)]">
                    <Play size={13} className="fill-white" />Launch Test<ChevronRight size={13} className="opacity-40" />
                  </button>
                </motion.div>
              ))}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
