import React from 'react';

interface ActivityBar {
  day: string;
  height: string; // Percentage height for the bar
}

const ActivityChart: React.FC = () => {
  // Data matching the bar heights in your image
  const activityData: ActivityBar[] = [
    { day: 'Mon', height: '45%' },
    { day: 'Tue', height: '65%' },
    { day: 'Wed', height: '35%' },
    { day: 'Thu', height: '85%' },
    { day: 'Fri', height: '40%' },
    { day: 'Sat', height: '95%' },
    { day: 'Sun', height: '60%' },
  ];

  return (
    <div className="w-full max-w-70 rounded-3xl bg-[#161725] p-6 border border-white/5 shadow-xl mt-4">
      {/* Section Header */}
      <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-gray-400 mb-8">
        Activity
      </h3>

      {/* Bar Chart Container */}
      <div className="flex items-end justify-between h-24 gap-2 px-1">
        {activityData.map((bar, index) => (
          <div 
            key={index} 
            className="group relative flex flex-col items-center flex-1"
          >
            {/* The Bar */}
            <div 
              className="w-full bg-[#4F39E3]/40 rounded-t-sm rounded-b-xs transition-all duration-300 group-hover:bg-[#4F39E3] cursor-pointer"
              style={{ height: bar.height }}
            >
              {/* Tooltip on Hover */}
              <div className="absolute -top-8 left-1/2 -translate-x-1/2 scale-0 group-hover:scale-100 transition-transform bg-white text-[#161725] text-[10px] font-bold py-1 px-2 rounded pointer-events-none z-20">
                {bar.height}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ActivityChart;