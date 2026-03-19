'use client';

import { useEffect, useState, useRef, useMemo } from 'react';
import { createClient } from '@/app/utils/supabase/client';
import { Activity, Clock, Zap, ChevronRight } from 'lucide-react';
import Link from 'next/link';

interface Contest {
  id: string; title: string; contest_number: number; contest_type: string;
  start_time: string; end_time: string; duration_minutes: number;
  total_questions: number; total_marks: number; is_active: boolean;
  exams?: { name: string; icon: string };
}

function Card3D({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    el.style.transform = `perspective(800px) rotateY(${x * 8}deg) rotateX(${-y * 8}deg) translateZ(6px)`;
  };
  const onLeave = () => { if (ref.current) ref.current.style.transform = 'perspective(800px) rotateY(0) rotateX(0) translateZ(0)'; };
  return <div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} className={className} style={{ transition: 'transform 0.2s ease-out', willChange: 'transform' }}>{children}</div>;
}

function getStatus(contest: Contest) {
  const now = new Date(), start = new Date(contest.start_time), end = new Date(contest.end_time);
  if (now >= start && now <= end) {
    const rem = Math.floor((end.getTime() - now.getTime()) / 1000);
    const h = Math.floor(rem / 3600), m = Math.floor((rem % 3600) / 60);
    return { label: 'Live Now', color: 'emerald', isLive: true, countdown: `${h}h ${m}m left` };
  }
  if (now < start) {
    const diff = Math.floor((start.getTime() - now.getTime()) / 1000);
    const d = Math.floor(diff / 86400), h = Math.floor((diff % 86400) / 3600), m = Math.floor((diff % 3600) / 60);
    const label = d > 0 ? `In ${d}d ${h}h` : h > 0 ? `In ${h}h ${m}m` : `In ${m}m`;
    return { label, color: 'blue', isLive: false, countdown: null };
  }
  return { label: 'Ended', color: 'gray', isLive: false, countdown: null };
}

const TYPE_COLORS: Record<string, string> = {
  standard: 'text-blue-400 bg-blue-500/10 border-blue-500/20',
  sudden_death: 'text-red-400 bg-red-500/10 border-red-500/20',
  flag_mode: 'text-purple-400 bg-purple-500/10 border-purple-500/20',
  practice: 'text-green-400 bg-green-500/10 border-green-500/20',
};

export default function ActiveContestsSection() {
  // useMemo ensures one stable Supabase client per component mount
  const supabase = useMemo(() => createClient(), []);
  const [contests, setContests] = useState<Contest[]>([]);
  const [loading, setLoading] = useState(true);
  const [, tick] = useState(0);

  useEffect(() => {
    setLoading(true);
    supabase
      .from('contests')
      .select('*, exams(name, icon)')
      .eq('is_active', true)
      .order('start_time', { ascending: true })
      .limit(6)
      .then(({ data }) => {
        setContests(data ?? []);
        setLoading(false);
      });

    // Countdown refresh every 30s
    const t = setInterval(() => tick(n => n + 1), 30000);
    return () => clearInterval(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-8 h-8 rounded-xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
          <Activity size={15} className="text-indigo-400" />
        </div>
        <div>
          <h3 className="text-white font-black text-sm">Active Contests</h3>
          <p className="text-gray-600 text-[10px] uppercase tracking-widest">Live from Supabase</p>
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-10">
          <div className="w-6 h-6 border-2 border-white/10 border-t-indigo-400 rounded-full animate-spin" />
        </div>
      )}

      {!loading && contests.length === 0 && (
        <div className="text-center py-10 text-gray-600 text-sm">
          No active contests right now.<br />
          <span className="text-xs text-gray-700">Add contests via the Admin Panel.</span>
        </div>
      )}

      {!loading && contests.map(contest => {
        const status = getStatus(contest);
        return (
          <Card3D key={contest.id}>
            <div className={`relative overflow-hidden rounded-2xl border p-4 transition-colors ${status.isLive ? 'bg-emerald-950/30 border-emerald-500/20' : 'bg-white/3 border-white/8 hover:border-white/15'}`}>
              {status.isLive && <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 to-transparent pointer-events-none" />}
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <span className="text-lg">{contest.exams?.icon ?? '📝'}</span>
                    {status.isLive && (
                      <span className="flex items-center gap-1 text-[10px] font-black text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE
                      </span>
                    )}
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${TYPE_COLORS[contest.contest_type] ?? TYPE_COLORS.standard}`}>
                      {(contest.contest_type ?? 'standard').replace('_', ' ').toUpperCase()}
                    </span>
                  </div>
                  <h4 className="text-white font-bold text-sm mb-1 truncate">{contest.title}</h4>
                  <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                    <span className="flex items-center gap-1"><Clock size={10} />{status.label}</span>
                    {status.countdown && <span className="text-emerald-500 font-bold">{status.countdown}</span>}
                    <span>⏱ {contest.duration_minutes}m</span>
                    {contest.total_questions > 0 && <span>📝 {contest.total_questions}Q</span>}
                    <span>🏆 {contest.total_marks}pts</span>
                  </div>
                </div>
                <Link href={`/test/${contest.id}`}
                  className={`flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-black transition-all flex-shrink-0 ${
                    status.isLive ? 'bg-emerald-500 text-white hover:bg-emerald-400 shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                    : status.label === 'Ended' ? 'bg-white/5 text-gray-500 cursor-not-allowed pointer-events-none'
                    : 'bg-white/8 text-white border border-white/10 hover:bg-white/15'}`}
                >
                  {status.isLive ? <><Zap size={12} />Enter</> : status.label === 'Ended' ? 'Ended' : <><ChevronRight size={12} />Register</>}
                </Link>
              </div>
            </div>
          </Card3D>
        );
      })}
    </div>
  );
}
