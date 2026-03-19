'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '../utils/supabase/client';
import {
  Calculator, Network, BookOpen, Clock, ChevronRight,
  FileText, Video, HelpCircle, Search, Layers
} from 'lucide-react';

interface StudyTopic {
  id: string;
  subject_section: string;
  module: string;
  topic: string;
  description: string | null;
  difficulty: string;
  pdf_url: string | null;
  video_url: string | null;
  estimated_mins: number;
  question_count?: number;
}

const SECTIONS: Record<string, { label: string; color: string; bg: string; border: string; icon: any; accent: string }> = {
  qa:   { label: 'Quantitative Aptitude', color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20', icon: Calculator, accent: '#f97316' },
  dilr: { label: 'Data Interpretation & LR', color: 'text-blue-400',   bg: 'bg-blue-500/10',   border: 'border-blue-500/20',   icon: Network,    accent: '#60a5fa' },
  varc: { label: 'Verbal & Reading',        color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: BookOpen,   accent: '#34d399' },
};

const DIFF: Record<string, { label: string; color: string; dot: string }> = {
  easy:     { label: 'Easy',     color: 'text-emerald-400', dot: 'bg-emerald-400' },
  moderate: { label: 'Moderate', color: 'text-amber-400',   dot: 'bg-amber-400'   },
  hard:     { label: 'Hard',     color: 'text-rose-400',    dot: 'bg-rose-400'    },
};

export default function StudyPage() {
  const supabase = useMemo(() => createClient(), []);
  const router   = useRouter();

  const [topics,      setTopics]      = useState<StudyTopic[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [activeSection, setActiveSection] = useState<'all' | 'qa' | 'dilr' | 'varc'>('all');
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.replace('/login'); return; }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase, router]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('study_topics')
        .select('*')
        .eq('is_published', true)
        .order('subject_section')
        .order('module')
        .order('created_at', { ascending: true });  // order_index used when available via admin

      if (!data) { setLoading(false); return; }

      // Fetch question counts
      const withCounts = await Promise.all(data.map(async (t: StudyTopic) => {
        const { count } = await supabase
          .from('study_questions')
          .select('id', { count: 'exact', head: true })
          .eq('topic_id', t.id);
        return { ...t, question_count: count ?? 0 };
      }));
      setTopics(withCounts);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  const filtered = topics.filter(t =>
    (activeSection === 'all' || t.subject_section === activeSection) &&
    (!search || t.topic.toLowerCase().includes(search.toLowerCase()) ||
     t.module.toLowerCase().includes(search.toLowerCase()))
  );

  // Group by module within section
  const grouped: Record<string, StudyTopic[]> = {};
  filtered.forEach(t => {
    const key = `${t.subject_section}::${t.module}`;
    if (!grouped[key]) grouped[key] = [];
    grouped[key].push(t);
  });

  return (
    <div className="min-h-screen bg-[#060608] text-white">
      <div className="fixed inset-0 z-0 opacity-[0.022]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,0.5) 1px,transparent 1px)', backgroundSize: '44px 44px' }} />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(ellipse_70%_40%_at_50%_0%,rgba(99,102,241,0.07),transparent)]" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 md:px-8 py-10">

        {/* Header */}
        <div className="mb-8">
          <p className="text-indigo-400 font-mono text-[10px] tracking-[0.4em] uppercase mb-2">📖 Learn</p>
          <h1 className="text-4xl font-black tracking-tighter">Study Room</h1>
          <p className="text-gray-600 text-sm mt-2">Read, watch, and practice topic by topic — at your own pace.</p>
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          {/* Search */}
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-600" />
            <input
              value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search topics or modules…"
              className="w-full pl-9 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.07] rounded-2xl text-sm text-white placeholder-gray-700 outline-none focus:border-indigo-500/40 transition"
            />
          </div>
          {/* Section filter */}
          <div className="flex gap-1.5 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-1.5">
            {(['all', 'qa', 'dilr', 'varc'] as const).map(s => {
              const meta = s === 'all' ? null : SECTIONS[s];
              return (
                <button key={s} onClick={() => setActiveSection(s)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                    activeSection === s
                      ? s === 'all' ? 'bg-indigo-600 text-white' : `${meta!.bg} ${meta!.color} border ${meta!.border}`
                      : 'text-gray-600 hover:text-gray-300'
                  }`}>
                  {meta && <meta.icon size={12} />}
                  {s === 'all' ? 'All' : s.toUpperCase()}
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="h-48 bg-white/[0.03] rounded-3xl animate-pulse border border-white/[0.05]" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24">
            <Layers size={40} className="mx-auto mb-4 text-gray-700" />
            <p className="text-gray-500 font-bold">{search ? 'No topics match your search.' : 'No study topics published yet.'}</p>
          </div>
        ) : (
          <div className="space-y-10">
            {Object.entries(grouped).map(([key, topicsInGroup]) => {
              const [sec, mod] = key.split('::');
              const secMeta = SECTIONS[sec] ?? SECTIONS.qa;
              return (
                <div key={key}>
                  {/* Module header */}
                  <div className="flex items-center gap-3 mb-4">
                    <div className={`w-8 h-8 rounded-xl ${secMeta.bg} border ${secMeta.border} flex items-center justify-center`}>
                      <secMeta.icon size={15} className={secMeta.color} />
                    </div>
                    <div>
                      <p className={`text-[10px] font-black uppercase tracking-widest ${secMeta.color}`}>{secMeta.label}</p>
                      <h2 className="text-white font-black text-base">{mod}</h2>
                    </div>
                    <div className="flex-1 h-px bg-white/[0.05] ml-2" />
                    <span className="text-gray-700 text-xs font-bold">{topicsInGroup.length} topic{topicsInGroup.length !== 1 ? 's' : ''}</span>
                  </div>

                  {/* Topic cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {topicsInGroup.map(t => {
                      const diff = DIFF[t.difficulty] ?? DIFF.moderate;
                      return (
                        <button key={t.id} onClick={() => router.push(`/study/${t.id}`)}
                          className="text-left bg-white/3 border border-white/[0.07] rounded-3xl p-5 hover:border-indigo-500/30 hover:bg-indigo-500/5 transition-all group">

                          {/* Difficulty + time */}
                          <div className="flex items-center justify-between mb-3">
                            <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase ${diff.color}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${diff.dot}`} />{diff.label}
                            </span>
                            {/* <span className="flex items-center gap-1 text-gray-600 text-[10px] font-bold">
                              <Clock size={10} />{t.estimated_mins}m
                            </span> */}
                          </div>

                          <h3 className="text-white font-black text-base mb-2 group-hover:text-indigo-300 transition-colors">
                            {t.topic}
                          </h3>
                          {t.description && (
                            <p className="text-gray-600 text-xs leading-relaxed mb-4 line-clamp-2">{t.description}</p>
                          )}

                          {/* Content pills */}
                          <div className="flex gap-2 flex-wrap mb-4">
                            {t.pdf_url && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full">
                                <FileText size={9} />PDF
                              </span>
                            )}
                            {t.video_url && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-blue-400 bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full">
                                <Video size={9} />Video
                              </span>
                            )}
                            {(t.question_count ?? 0) > 0 && (
                              <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 rounded-full">
                                <HelpCircle size={9} />{t.question_count} Q
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between pt-3 border-t border-white/[0.05]">
                            <span className="text-indigo-400/60 text-[10px] font-bold group-hover:text-indigo-400 transition-colors">
                              Start learning →
                            </span>
                            <ChevronRight size={14} className="text-gray-700 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
