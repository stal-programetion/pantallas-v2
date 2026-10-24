import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TooltipWhy } from './TooltipWhy';

interface KpiCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: LucideIcon;
  iconBgColor?: string;
  iconColor?: string;
  trend?: 'subiendo' | 'bajando' | 'estable';
  trendText?: string;
  isPositive?: boolean; // si subiendo es bueno o malo
  whyExplanation?: string;
  whyRule?: string;
  className?: string;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconBgColor = 'bg-blue-50',
  iconColor = 'text-blue-700',
  trend,
  trendText,
  isPositive = true,
  whyExplanation,
  whyRule,
  className = '',
}) => {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs hover:shadow-md transition-all duration-200 flex flex-col justify-between relative overflow-hidden group ${className}`}
    >
      {/* Top row: Title and Icon */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {title}
            </span>
            {whyExplanation && (
              <TooltipWhy
                explanation={whyExplanation}
                rule={whyRule}
                align="left"
              />
            )}
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
              {value}
            </span>
          </div>
        </div>

        <div
          className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${iconBgColor} ${iconColor} transition-transform group-hover:scale-105 duration-200 shadow-2xs`}
        >
          <Icon size={22} />
        </div>
      </div>

      {/* Bottom row: Subtitle or Trend indicator */}
      {(subtitle || trend) && (
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          {trend && (
            <div className="flex items-center gap-1 font-medium">
              {trend === 'subiendo' && (
                <span
                  className={`inline-flex items-center gap-0.5 ${
                    isPositive ? 'text-emerald-600' : 'text-rose-600'
                  }`}
                >
                  <TrendingUp size={13} /> {trendText || 'En aumento'}
                </span>
              )}
              {trend === 'bajando' && (
                <span
                  className={`inline-flex items-center gap-0.5 ${
                    isPositive ? 'text-rose-600' : 'text-emerald-600'
                  }`}
                >
                  <TrendingDown size={13} /> {trendText || 'En descenso'}
                </span>
              )}
              {trend === 'estable' && (
                <span className="inline-flex items-center gap-0.5 text-slate-500">
                  <Minus size={13} /> {trendText || 'Estable'}
                </span>
              )}
            </div>
          )}
          {subtitle && <span className="text-slate-400 truncate">{subtitle}</span>}
        </div>
      )}
    </div>
  );
};
