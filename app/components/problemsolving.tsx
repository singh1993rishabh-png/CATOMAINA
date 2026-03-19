import React from 'react';

interface StatItem {
  label: string;
  current: number;
  total: number;
  colorClass: string;
}

const ProblemSolvingStats: React.FC = () => {
  const stats: StatItem[] = [
    { label: 'Easy', current: 120, total: 250, colorClass: 'bg-emerald-500' },
    { label: 'Medium', current: 85, total: 180, colorClass: 'bg-yellow-500' },
    { label: 'Hard', current: 34, total: 80, colorClass: 'bg-red-500' },
  ];

  return (
    <div className="w-full max-w-70 rounded-3xl bg-[#161725] p-6 border border-white/5 shadow-xl mt-4">
      {/* Section Header */}
      <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-6">
        Problem Solving
      </h3>

      {/* Progress Bars List */}
      <div className="space-y-6">
        {stats.map((stat) => {
          const percentage = (stat.current / stat.total) * 100;

          return (
            <div key={stat.label} className="group">
              {/* Label and Count */}
              <div className="flex justify-between items-end mb-2">
                <span className={`text-[11px] font-bold ${stat.colorClass.replace('bg-', 'text-')}`}>
                  {stat.label}
                </span>
                <span className="text-[11px] font-bold text-gray-500">
                  <span className="text-gray-300">{stat.current}</span> / {stat.total}
                </span>
              </div>

              {/* Progress Bar Track */}
              <div className="h-1.5 w-full bg-[#1c1d2e] rounded-full overflow-hidden">
                <div 
                  className={`h-full ${stat.colorClass} rounded-full transition-all duration-500 ease-out`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProblemSolvingStats;