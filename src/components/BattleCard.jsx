import React from 'react';
import { Zap, Check } from 'lucide-react';

const BattleCard = ({ battle, onClick }) => {
  const { entry_A, entry_B, votes_A, votes_B, status, category } = battle;
  const totalVotes = votes_A + votes_B || 1;
  const percentageA = Math.round((votes_A / totalVotes) * 100);
  const percentageB = Math.round((votes_B / totalVotes) * 100);
  const isLive = status === 'live';
  const winnerA = votes_A > votes_B;

  return (
    <div 
      onClick={onClick}
      className="relative bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg overflow-hidden hover:scale-105 transition-transform cursor-pointer border border-slate-700 shadow-xl"
    >
      {/* Battle Images with VS Badge */}
      <div className="relative flex overflow-hidden" style={{ height: '180px', backgroundColor: '#1a2235', position: 'relative' }}>
        {/* Entry A */}
        <div className="relative" style={{ width: '50%' }}>
          <img 
            src={entry_A.image} 
            alt={entry_A.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-transparent to-black/30"></div>
        </div>

        {/* VS Badge */}
        <div className="absolute left-1/2 top-1/2 z-10" style={{ transform: 'translate(-50%, -50%)' }}>
          <div className="bg-gradient-to-r from-purple-600 to-blue-600 rounded-full w-16 h-16 flex items-center justify-center border-4 border-slate-900">
            <span className="text-white font-bold text-lg">VS</span>
          </div>
        </div>

        {/* Entry B */}
        <div className="relative" style={{ width: '50%' }}>
          <img 
            src={entry_B.image} 
            alt={entry_B.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-l from-transparent to-black/30"></div>
        </div>
      </div>

      {/* Status Badge */}
      <div className="absolute z-20" style={{ top: '10px', right: '10px' }}>
        {isLive ? (
          <div className="flex items-center gap-2 bg-blue-500 px-[10px] py-1 rounded-[12px]" style={{ fontSize: '12px' }}>
            <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <span className="text-white font-semibold">Live</span>
          </div>
        ) : (
          <div className="flex items-center gap-2 bg-gray-500 px-[10px] py-1 rounded-[12px]" style={{ fontSize: '12px' }}>
            <Check size={12} className="text-white" />
            <span className="text-white font-semibold">Ended</span>
          </div>
        )}
      </div>

      {/* Category Tag */}
      <div className="absolute top-3 left-3 z-20">
        <span className="bg-black/60 text-white text-xs px-3 py-1 rounded-full font-semibold">
          {category}
        </span>
      </div>

      {/* Battle Info */}
      <div className="p-4">
        <h3 className="text-white font-bold text-sm line-clamp-2 mb-3">
          {battle.title}
        </h3>

        {/* Vote Progress */}
        <div className="space-y-2 mb-3">
          {/* Entry A Progress */}
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-bold" style={{ minWidth: '40px', textAlign: 'right' }}>{percentageA}%</span>
            <div className="flex-1 bg-slate-700 rounded-[3px]" style={{ height: '6px', overflow: 'hidden' }}>
              <div 
                className={`h-full ${winnerA && status === 'ended' ? 'bg-yellow-400' : 'bg-blue-500'} transition-all`}
                style={{ width: `${percentageA}%` }}
              ></div>
            </div>
          </div>

          {/* Entry B Progress */}
          <div className="flex items-center gap-2">
            <span className="text-white text-xs font-bold" style={{ minWidth: '40px', textAlign: 'right' }}>{percentageB}%</span>
            <div className="flex-1 bg-slate-700 rounded-[3px]" style={{ height: '6px', overflow: 'hidden' }}>
              <div 
                className={`h-full ${!winnerA && status === 'ended' && votes_B > 0 ? 'bg-yellow-400' : 'bg-purple-500'} transition-all`}
                style={{ width: `${percentageB}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* Vote Count */}
        <div className="flex items-center gap-2 text-slate-400 text-xs">
          <Zap size={14} />
          <span>{totalVotes} votes</span>
        </div>
      </div>
    </div>
  );
};

export default BattleCard;
