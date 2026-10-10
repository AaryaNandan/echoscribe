import React, { useState } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  Zap,
  Info,
  ShieldCheck,
  CheckCircle2,
  Sliders,
  Sparkles,
} from 'lucide-react';
import { DashboardMetrics, SystemSettings } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface AnalyticsViewProps {
  metrics: DashboardMetrics | null;
  onRefreshMetrics: () => Promise<void>;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  metrics,
  onRefreshMetrics,
}) => {
  const [manualMins, setManualMins] = useState(
    metrics?.settings.manualMinutesPerMeeting ?? 10
  );
  const [autoMins, setAutoMins] = useState(
    metrics?.settings.automatedMinutesPerMeeting ?? 2
  );
  const [savingSettings, setSavingSettings] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleUpdateAssumptions = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSettings(true);
    try {
      await api.updateSettings({
        manualMinutesPerMeeting: Number(manualMins),
        automatedMinutesPerMeeting: Number(autoMins),
      });
      setSavedSuccess(true);
      await onRefreshMetrics();
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      alert(`Error updating settings: ${err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  const totalActions = metrics?.totalActionItems || 1;
  const status = metrics?.statusBreakdown || {
    pending: 0,
    approved: 0,
    rejected: 0,
    completed: 0,
  };
  const buckets = metrics?.confidenceBuckets || { high: 0, medium: 0, low: 0 };

  const timeSavedPerMtg = Math.max(0, manualMins - autoMins);
  const totalMinsSaved = (metrics?.totalMeetings || 0) * timeSavedPerMtg;
  const hoursSaved = (totalMinsSaved / 60).toFixed(1);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-12">
      {/* Header with Portfolio Label */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              Operational Analytics & Pipeline Metrics
            </h2>
            <span className="text-[11px] font-mono px-2.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200 font-semibold">
              Simulated Portfolio Metrics
            </span>
          </div>
          <p className="text-xs text-slate-500 font-medium">
            Measurement framework evaluating AI extraction accuracy, human-in-the-loop review overhead, and organizational time savings.
          </p>
        </div>

        {/* Disclaimer Pill */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
          <Info className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
          <span>FDE Benchmark Telemetry Model</span>
        </div>
      </div>

      {/* KPI Cards Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Completion Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Deliverable Completion Rate
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {metrics ? `${metrics.completionRate}%` : '0%'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics?.completedActions} of {metrics?.totalActionItems} completed
          </div>
        </div>

        {/* Human Review Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Human Review Required
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {metrics ? `${metrics.reviewRate}%` : '0%'}
          </div>
          <div className="text-xs text-slate-500 mt-1">
            {metrics?.itemsRequiringReview} items flagged for review
          </div>
        </div>

        {/* User Override Rate */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            User Override Rate
          </div>
          <div className="text-2xl font-bold text-indigo-600">
            {metrics ? `${metrics.overrideRate}%` : '0%'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Manual edits after extraction</div>
        </div>

        {/* Avg Latency */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Mean Processing Latency
          </div>
          <div className="text-2xl font-bold text-cyan-600">
            {metrics ? `${metrics.averageProcessingTimeMs} ms` : '1,420 ms'}
          </div>
          <div className="text-xs text-slate-500 mt-1">Gemini 3.8 Flash inference</div>
        </div>
      </div>

      {/* Analytics Visuals Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Chart 1: Action Items by Status */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Deliverables by Status
            </h3>
            <span className="text-xs text-slate-400 font-mono">
              Total: {metrics?.totalActionItems}
            </span>
          </div>

          <div className="space-y-3 pt-2">
            {/* Completed */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  Completed
                </span>
                <span className="text-slate-900 font-mono">
                  {status.completed} ({Math.round((status.completed / totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(status.completed / totalActions) * 100}%` }}
                />
              </div>
            </div>

            {/* Approved */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
                  Approved (Active)
                </span>
                <span className="text-slate-900 font-mono">
                  {status.approved} ({Math.round((status.approved / totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-blue-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(status.approved / totalActions) * 100}%` }}
                />
              </div>
            </div>

            {/* Pending */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  Pending Review
                </span>
                <span className="text-slate-900 font-mono">
                  {status.pending} ({Math.round((status.pending / totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(status.pending / totalActions) * 100}%` }}
                />
              </div>
            </div>

            {/* Rejected */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  Rejected
                </span>
                <span className="text-slate-900 font-mono">
                  {status.rejected} ({Math.round((status.rejected / totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(status.rejected / totalActions) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Chart 2: AI Confidence Distribution */}
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              AI Confidence Score Distribution
            </h3>
            <span className="text-xs text-indigo-600 font-bold">
              Mean: {metrics ? `${Math.round(metrics.averageConfidence * 100)}%` : '88%'}
            </span>
          </div>

          <div className="space-y-4 pt-2">
            {/* High confidence */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  High Confidence (≥ 85%)
                </span>
                <span className="text-slate-900 font-mono">
                  {buckets.high} items ({Math.round((buckets.high / totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-emerald-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(buckets.high / totalActions) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Clear owner, concrete deadline, unambiguous explicit commitment.
              </p>
            </div>

            {/* Medium confidence */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  Medium Confidence (70% - 84%)
                </span>
                <span className="text-slate-900 font-mono">
                  {buckets.medium} items ({Math.round((buckets.medium / totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(buckets.medium / totalActions) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Relative deadlines normalized, inferred owner, or standard tasks.
              </p>
            </div>

            {/* Low confidence */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span className="text-slate-700 flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                  Low Confidence (&lt; 70%)
                </span>
                <span className="text-slate-900 font-mono">
                  {buckets.low} items ({Math.round((buckets.low / totalActions) * 100)}%)
                </span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-rose-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${(buckets.low / totalActions) * 100}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 mt-0.5">
                Missing owner, missing deadline, ambiguous language, or duplicate flagged.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Section 10: Configurable Time Saved Assumptions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-slate-900">
                Time Saved Business Calculation Model
              </h3>
            </div>
            <p className="text-xs text-slate-500">
              Configure baseline assumptions to dynamically estimate engineering hours saved across meetings.
            </p>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 text-emerald-900 text-center shrink-0">
            <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
              Total Estimated Savings
            </div>
            <div className="text-2xl font-bold text-emerald-800">
              {totalMinsSaved} minutes ({hoursSaved} hrs)
            </div>
          </div>
        </div>

        <form onSubmit={handleUpdateAssumptions} className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase">
              Manual Review Baseline (min / meeting)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              step="1"
              value={manualMins}
              onChange={(e) => setManualMins(Number(e.target.value))}
              className="w-full p-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
            <p className="text-[11px] text-slate-500">
              Estimated manual transcript reading, note-taking, and manual Jira creation.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase">
              Automated Review Time (min / meeting)
            </label>
            <input
              type="number"
              min="0.5"
              max="60"
              step="0.5"
              value={autoMins}
              onChange={(e) => setAutoMins(Number(e.target.value))}
              className="w-full p-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
            />
            <p className="text-[11px] text-slate-500">
              Time for human-in-the-loop review and approval of extracted items.
            </p>
          </div>

          <div className="flex flex-col justify-end">
            <button
              type="submit"
              disabled={savingSettings}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition"
            >
              <Sliders className="w-3.5 h-3.5" />
              <span>{savingSettings ? 'Saving...' : 'Update Assumptions'}</span>
            </button>
            {savedSuccess && (
              <span className="text-[11px] text-emerald-600 font-semibold text-center mt-1">
                Assumptions updated!
              </span>
            )}
          </div>
        </form>

        <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 text-xs text-slate-600 flex items-center gap-3">
          <Info className="w-4 h-4 text-slate-400 shrink-0" />
          <span>
            <strong>Calculation Formula:</strong> ({manualMins}m manual - {autoMins}m automated) = <strong>{timeSavedPerMtg} minutes net saved per meeting</strong> × {metrics?.totalMeetings} processed meetings = <strong>{totalMinsSaved} total minutes</strong>.
          </span>
        </div>
      </div>
    </div>
  );
};
