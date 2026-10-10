import React from 'react';
import { ActionItemStatus } from '../../types/index.ts';

interface StatusBadgeProps {
  status: ActionItemStatus | 'draft' | 'processed' | 'reviewed';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  switch (status) {
    case 'completed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5"></span>
          Completed
        </span>
      );
    case 'approved':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-500 mr-1.5"></span>
          Approved
        </span>
      );
    case 'rejected':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 mr-1.5"></span>
          Rejected
        </span>
      );
    case 'processed':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-100 text-indigo-800 border border-indigo-200">
          Processed
        </span>
      );
    case 'draft':
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
          Draft
        </span>
      );
    case 'pending':
    default:
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500 mr-1.5"></span>
          Pending
        </span>
      );
  }
};

interface ConfidencePillProps {
  confidence: number;
  showBar?: boolean;
}

export const ConfidencePill: React.FC<ConfidencePillProps> = ({ confidence, showBar = false }) => {
  const percent = Math.round(confidence * 100);
  let colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200';
  let barColor = 'bg-emerald-500';

  if (confidence < 0.7) {
    colorClass = 'bg-rose-50 text-rose-700 border-rose-200';
    barColor = 'bg-rose-500';
  } else if (confidence < 0.85) {
    colorClass = 'bg-amber-50 text-amber-700 border-amber-200';
    barColor = 'bg-amber-500';
  }

  return (
    <div className="inline-flex items-center gap-1.5">
      <span
        className={`px-2 py-0.5 text-xs font-medium rounded border ${colorClass}`}
        title={`AI extraction confidence: ${percent}%`}
      >
        {percent}%
      </span>
      {showBar && (
        <div className="w-12 bg-slate-200 h-1.5 rounded-full overflow-hidden">
          <div className={`h-full ${barColor}`} style={{ width: `${percent}%` }} />
        </div>
      )}
    </div>
  );
};
