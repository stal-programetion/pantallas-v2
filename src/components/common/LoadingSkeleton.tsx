import React from 'react';

interface LoadingSkeletonProps {
  type?: 'card' | 'table' | 'chart' | 'text';
  count?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  type = 'card',
  count = 1,
  className = '',
}) => {
  const items = Array.from({ length: count });

  if (type === 'table') {
    return (
      <div className={`w-full bg-white rounded-xl border border-slate-200 p-4 space-y-3 ${className}`}>
        <div className="h-6 bg-slate-200 rounded-md animate-pulse w-1/4" />
        <div className="space-y-2 pt-2">
          {items.map((_, i) => (
            <div key={i} className="h-10 bg-slate-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className={`w-full h-72 bg-white rounded-xl border border-slate-200 p-6 flex flex-col justify-between ${className}`}>
        <div className="h-5 bg-slate-200 rounded-md animate-pulse w-1/3" />
        <div className="flex items-end gap-3 h-44 pt-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={i}
              className="flex-1 bg-slate-100 rounded-t-md animate-pulse"
              style={{ height: `${20 + (i * 7) % 80}%` }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
      {items.map((_, i) => (
        <div key={i} className="bg-white rounded-xl border border-slate-200 p-5 space-y-3">
          <div className="h-4 bg-slate-200 rounded-md animate-pulse w-2/3" />
          <div className="h-8 bg-slate-100 rounded-lg animate-pulse w-1/2" />
          <div className="h-3 bg-slate-100 rounded-md animate-pulse w-4/5 pt-2" />
        </div>
      ))}
    </div>
  );
};
