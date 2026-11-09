import React from 'react';
import { MoveClassification } from '../../types/chess';
import { Check, Star, AlertCircle, AlertTriangle, XCircle, BookOpen } from 'lucide-react';

interface Props {
  classification?: MoveClassification;
  showIcon?: boolean;
}

export const MoveClassificationBadge: React.FC<Props> = ({ classification, showIcon = true }) => {
  if (!classification) return null;

  switch (classification) {
    case 'best':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
          {showIcon && <Check className="w-3 h-3" />} Best
        </span>
      );
    case 'excellent':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-sky-500/15 text-sky-400 border border-sky-500/30">
          {showIcon && <Star className="w-3 h-3" />} Excellent
        </span>
      );
    case 'good':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-teal-500/15 text-teal-300 border border-teal-500/30">
          Good
        </span>
      );
    case 'inaccuracy':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/15 text-amber-400 border border-amber-500/30">
          {showIcon && <AlertCircle className="w-3 h-3" />} Inaccuracy
        </span>
      );
    case 'mistake':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
          {showIcon && <AlertTriangle className="w-3 h-3" />} Mistake
        </span>
      );
    case 'blunder':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-rose-500/15 text-rose-400 border border-rose-500/30">
          {showIcon && <XCircle className="w-3 h-3" />} Blunder
        </span>
      );
    case 'book':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/15 text-purple-300 border border-purple-500/30">
          {showIcon && <BookOpen className="w-3 h-3" />} Book
        </span>
      );
    default:
      return null;
  }
};

