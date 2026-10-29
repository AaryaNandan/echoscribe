import React from 'react';
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Zap,
  TrendingUp,
  ArrowRight,
  Sparkles,
  FileText,
  User,
  Check,
  Database,
} from 'lucide-react';
import { DashboardMetrics, Meeting, ActionItem } from '../../types/index.ts';
import { StatusBadge, ConfidencePill } from '../common/Badge.tsx';

interface DashboardViewProps {
  metrics: DashboardMetrics | null;
  meetings: Meeting[];
  actionItems: ActionItem[];
  onSelectMeeting: (id: string) => void;
  onNewMeeting: () => void;
  onViewAllMeetings: () => void;
  onViewAllActionItems: () => void;
  onCompleteAction: (id: string) => Promise<void>;
  onOpenSupabase?: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  metrics,
  meetings,
  actionItems,
  onSelectMeeting,
  onNewMeeting,
  onViewAllMeetings,
  onViewAllActionItems,
  onCompleteAction,
  onOpenSupabase,
}) => {
  const recentMeetings = meetings.slice(0, 5);
  const pendingActions = actionItems
    .filter((a) => a.status === 'pending')
    .slice(0, 5);

  const formatMinutes = (mins: number) => {
    if (mins < 60) return `${mins} min`;
    const hrs = Math.floor(mins / 60);
    const remainder = mins % 60;
    return remainder > 0 ? `${hrs}h ${remainder}m` : `${hrs}h`;
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Hero Welcome / FDE Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1.5 max-w-2xl">
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-xs font-mono font-medium">
            <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
            <span>Forward Deployed Engineer Pipeline</span>
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            EchoScribe
          </h2>
          <p className="text-sm text-slate-300 leading-relaxed">
            Automated transcript intelligence powered by Gemini 3.8 Flash. Extracts strategic
            decisions, action items, assignees, normalized deadlines, and duplicate detection with full
            audit traceability.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onNewMeeting}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm bg-indigo-500 hover:bg-indigo-400 text-white shadow-lg shadow-indigo-500/25 transition active:scale-98"
          >
            <Sparkles className="w-4 h-4" />
            <span>Extract New Meeting</span>
          </button>
        </div>
      </div>

      {/* Supabase Connection Widget */}
      {onOpenSupabase && (
        <div className="bg-white rounded-xl border border-emerald-200 p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-xs">Supabase Cloud Database Connected</span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800 font-bold">
                  Project: chzpmbnixvyppuocjjck
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Targeting https://chzpmbnixvyppuocjjck.supabase.co with live table sync & data persistence.
              </p>
            </div>
          </div>

          <button
            onClick={onOpenSupabase}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition shrink-0 self-start sm:self-auto"
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span>Manage Supabase & Sync</span>
          </button>
        </div>
      )}

      {/* 8 Primary KPI Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Meetings */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Total Meetings
            </span>
            <div className="p-2 rounded-lg bg-indigo-50 text-indigo-600">
              <Calendar className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {metrics?.totalMeetings ?? meetings.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Processed meetings</div>
        </div>

        {/* Total Action Items */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Total Action Items
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {metrics?.totalActionItems ?? actionItems.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Extracted deliverables</div>
        </div>

        {/* Pending Actions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Pending Actions
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-600">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-amber-600">
            {metrics?.pendingActions ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Awaiting execution</div>
        </div>

        {/* Completed Actions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Completed Actions
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {metrics?.completedActions ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics ? `${metrics.completionRate}% completion rate` : 'Finished'}
          </div>
        </div>

        {/* Overdue Actions */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Overdue Actions
            </span>
            <div className="p-2 rounded-lg bg-rose-50 text-rose-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-rose-600">
            {metrics?.overdueActions ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Past target deadline</div>
        </div>

        {/* Requiring Human Review */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Requires Review
            </span>
            <div className="p-2 rounded-lg bg-orange-50 text-orange-600">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {metrics?.itemsRequiringReview ?? 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            Missing owner/due date or &lt;70%
          </div>
        </div>

        {/* Average AI Confidence */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Avg AI Confidence
            </span>
            <div className="p-2 rounded-lg bg-cyan-50 text-cyan-600">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-slate-900">
            {metrics ? `${Math.round(metrics.averageConfidence * 100)}%` : '--'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Extraction precision</div>
        </div>

        {/* Estimated Time Saved */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition relative overflow-hidden">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-slate-500">
              Time Saved
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-600">
              <Zap className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {metrics ? formatMinutes(metrics.estimatedMinutesSaved) : '0 min'}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {metrics?.settings
              ? `~${metrics.settings.manualMinutesPerMeeting - metrics.settings.automatedMinutesPerMeeting} min saved / meeting`
              : 'Configurable estimate'}
          </div>
        </div>
      </div>

      {/* Two Column Layout: Recent Meetings & Pending Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left: Recent Meetings */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-indigo-600" />
              <h3 className="font-semibold text-slate-900 text-sm">Recent Meetings</h3>
            </div>
            <button
              onClick={onViewAllMeetings}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {recentMeetings.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No meetings processed yet. Click "+ New Meeting" to begin.
              </div>
            ) : (
              recentMeetings.map((m) => (
                <div
                  key={m.id}
                  onClick={() => onSelectMeeting(m.id)}
                  className="p-4 hover:bg-slate-50 cursor-pointer transition flex items-center justify-between group"
                >
                  <div className="space-y-1 pr-4">
                    <div className="font-medium text-slate-900 text-sm group-hover:text-indigo-600 transition line-clamp-1">
                      {m.title}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{m.meetingDate}</span>
                      <span>•</span>
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {m.participants.length} participants
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusBadge status={m.status || 'processed'} />
                    <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition" />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right: Urgent Pending Action Items */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-600" />
              <h3 className="font-semibold text-slate-900 text-sm">Pending Action Items</h3>
            </div>
            <button
              onClick={onViewAllActionItems}
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
            >
              <span>View all ({actionItems.length})</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="divide-y divide-slate-100">
            {pendingActions.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-sm">
                No pending action items! All caught up.
              </div>
            ) : (
              pendingActions.map((item) => (
                <div
                  key={item.id}
                  className="p-4 hover:bg-slate-50 transition flex items-start justify-between gap-3"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="text-sm font-medium text-slate-900 line-clamp-2">
                      {item.action}
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-medium text-slate-700 bg-slate-100 px-2 py-0.5 rounded">
                        {item.owner || 'Unassigned'}
                      </span>
                      {item.dueDate ? (
                        <span className="text-slate-500">Due {item.dueDate}</span>
                      ) : (
                        <span className="text-rose-600 font-medium">No deadline</span>
                      )}
                      <ConfidencePill confidence={item.confidence} />
                      {item.needsReview && (
                        <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded font-semibold">
                          Needs Review
                        </span>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onCompleteAction(item.id);
                    }}
                    className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition border border-transparent hover:border-emerald-200 shrink-0"
                    title="Mark complete"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
