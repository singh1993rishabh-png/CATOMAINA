'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { Star, ChevronRight, Clock, BookOpen, Zap, BarChart2 } from 'lucide-react';
import Link from 'next/link';

interface Contest {
  id: string; title: string; contest_number: number; contest_type: string;
  description: string; start_time: string; end_time: string;
  duration_minutes: number; total_questions: number; total_marks: number;
  exams?: { name: string; icon: string; display_name: string };
}

function Card3D({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(900px) rotateY(${x * 12}deg) rotateX(${-y * 12}deg) translateZ(10px)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = 'perspective(900px) rotateY(0) rotateX(0) translateZ(0)'; };
  return <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={className} style={{ transition: 'transform 0.2s ease-out', willChange: 'transform' }}>{children}</div>;
}

const GRADIENT_MAP: Record<string, string> = {
  standard: 'from-[#4F39E3] via-[#3d2fbd] to-[#2E1B9E]',
  sudden_death: 'from-[#991b1b] via-[#7f1d1d] to-[#450a0a]',
  flag_mode: 'from-[#6b21a8] via-[#581c87] to-[#3b0764]',
  practice: 'from-[#065f46] via-[#064e3b] to-[#022c22]',
};

const TYPE_LABELS: Record<string, string> = {
  standard: '⚡ Standard', sudden_death: '💀 Sudden Death',
  flag_mode: '🚩 Flag Challenge', practice: '📖 Practice',
};

export default function DailyContestCard() {
  // useMemo ensures one stable Supabase client per component mount
  const supabase = useMemo(() => createClient(), []);
  const [contests, setContests] = useState<Contest[]>([]);
  const [idx, setIdx] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.from('contests')
      .select('*, exams(name,icon,display_name)')
      .eq('is_active', true)
      .gte('end_time', new Date().toISOString())
      .order('start_time', { ascending: true })
      .limit(5)
      .then(({ data }) => {
        if (data && data.length > 0) setContests(data);
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  // Auto-rotate every 5s
  useEffect(() => {
    if (contests.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % contests.length), 5000);
    return () => clearInterval(t);
  }, [contests.length]);

  if (loading) return (
    <div className="w-full rounded-3xl bg-white/5 border border-white/10 p-8 animate-pulse h-48 flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-white/20 border-t-white/60 rounded-full animate-spin"/>
    </div>
  );

  if (contests.length === 0) return (
    <div className="w-full rounded-3xl bg-white/5 border border-white/10 p-8 text-center">
      <p className="text-gray-500 text-sm">No upcoming contests. Check back soon!</p>
    </div>
  );

  const c = contests[idx];
  const grad = GRADIENT_MAP[c.contest_type] ?? GRADIENT_MAP.standard;
  const isLive = new Date() >= new Date(c.start_time) && new Date() <= new Date(c.end_time);

  return (
    <div className="space-y-3">
      <Card3D>
        <div className={`w-full overflow-hidden rounded-3xl bg-gradient-to-br ${grad} p-7 text-white shadow-2xl relative`}>
          {/* Ambient orb */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none"/>
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/20 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2 pointer-events-none"/>

          <div className="relative z-10">
            {/* Badge row */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm border border-white/10">
                <Star size={12} className="fill-white/80 text-white/80"/>
                <span className="text-[10px] font-black uppercase tracking-widest">{TYPE_LABELS[c.contest_type] ?? 'Standard'}</span>
              </div>
              {isLive && (
                <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/40 px-3 py-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                  <span className="text-[10px] font-black uppercase tracking-widest text-emerald-300">Live Now</span>
                </div>
              )}
              <span className="text-lg">{c.exams?.icon}</span>
            </div>

            {/* Title */}
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mb-2">{c.title}</h1>
            {c.description && <p className="text-sm text-white/60 mb-5 max-w-md leading-relaxed">{c.description}</p>}

            {/* Stats row */}
            <div className="flex items-center gap-4 mb-6 text-xs text-white/50 flex-wrap">
              <span className="flex items-center gap-1"><Clock size={12}/>{c.duration_minutes}m</span>
              <span className="flex items-center gap-1"><BookOpen size={12}/>{c.total_questions}Q</span>
              <span className="flex items-center gap-1"><BarChart2 size={12}/>{c.total_marks}pts</span>
              <span className="flex items-center gap-1"><Zap size={12}/>{c.exams?.display_name ?? c.exams?.name}</span>
            </div>

            {/* CTA */}
            <Link href={`/test/${c.id}`}
              className="group inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 font-black text-sm transition-all hover:bg-yellow-400 hover:scale-105 active:scale-95"
              style={{ color: 'inherit' }}
            >
              <span className="text-[#2E1B9E]">{isLive ? 'Enter Now' : 'View Contest'}</span>
              <ChevronRight size={16} className="text-[#2E1B9E] group-hover:translate-x-1 transition-transform"/>
            </Link>
          </div>
        </div>
      </Card3D>

      {/* Dot indicators */}
      {contests.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {contests.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)}
              className={`rounded-full transition-all ${i === idx ? 'w-5 h-1.5 bg-white' : 'w-1.5 h-1.5 bg-white/20 hover:bg-white/40'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
