import React, { useState } from 'react';
import {
  Settings,
  Sliders,
  Database,
  Cpu,
  Shield,
  RotateCcw,
  Check,
  AlertCircle,
  Server,
} from 'lucide-react';
import { SystemSettings } from '../../types/index.ts';
import { api } from '../../lib/api.ts';

interface SettingsViewProps {
  settings: SystemSettings | null;
  onRefreshSettings: () => Promise<void>;
  onSeedData: () => Promise<void>;
  onOpenSupabase?: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onRefreshSettings,
  onSeedData,
  onOpenSupabase,
}) => {
  const [manualMins, setManualMins] = useState(
    settings?.manualMinutesPerMeeting ?? 10
  );
  const [autoMins, setAutoMins] = useState(
    settings?.automatedMinutesPerMeeting ?? 2
  );
  const [confidenceThreshold, setConfidenceThreshold] = useState(
    settings?.confidenceThreshold ?? 0.7
  );

  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.updateSettings({
        manualMinutesPerMeeting: Number(manualMins),
        automatedMinutesPerMeeting: Number(autoMins),
        confidenceThreshold: Number(confidenceThreshold),
      });
      setSavedSuccess(true);
      await onRefreshSettings();
      setTimeout(() => setSavedSuccess(false), 2500);
    } catch (err: any) {
      alert(`Error saving settings: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleResetData = async () => {
    if (confirm('Reset the database and reseed with 5 synthetic realistic enterprise meetings?')) {
      setSeeding(true);
      try {
        await onSeedData();
        alert('Database reseeded with 5 realistic enterprise meetings successfully!');
      } finally {
        setSeeding(false);
      }
    }
  };

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-12">
      <div className="border-b border-slate-200 pb-5">
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">
          System & Pipeline Settings
        </h2>
        <p className="text-xs text-slate-500 font-medium mt-0.5">
          Configure AI extraction parameters, business time-saving assumptions, and database persistence.
        </p>
      </div>

      {/* Form: Algorithm and Assumptions */}
      <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-6">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Sliders className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Extraction & Threshold Tuning
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase">
              Manual Reading Baseline (min/meeting)
            </label>
            <input
              type="number"
              min="1"
              max="120"
              step="1"
              value={manualMins}
              onChange={(e) => setManualMins(Number(e.target.value))}
              className="w-full p-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
              required
            />
            <p className="text-[11px] text-slate-500">
              Standard time spent manually synthesizing notes without automation.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase">
              Automated Review Overhead (min/meeting)
            </label>
            <input
              type="number"
              min="0.5"
              max="60"
              step="0.5"
              value={autoMins}
              onChange={(e) => setAutoMins(Number(e.target.value))}
              className="w-full p-2.5 text-xs font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
              required
            />
            <p className="text-[11px] text-slate-500">
              Human-in-the-loop review and approval duration per meeting.
            </p>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <div className="flex justify-between items-center">
              <label className="block text-xs font-semibold text-slate-700 uppercase">
                Confidence Threshold for Human Review: {(confidenceThreshold * 100).toFixed(0)}%
              </label>
              <span className="text-xs font-mono text-indigo-600 font-semibold">
                &lt; {(confidenceThreshold * 100).toFixed(0)}% = Needs Review
              </span>
            </div>
            <input
              type="range"
              min="0.5"
              max="0.95"
              step="0.05"
              value={confidenceThreshold}
              onChange={(e) => setConfidenceThreshold(Number(e.target.value))}
              className="w-full accent-indigo-600"
            />
            <p className="text-[11px] text-slate-500">
              Deliverables with an AI extraction confidence score below this threshold are automatically flagged with the "Needs Review" status badge.
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div>
            {savedSuccess && (
              <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                <Check className="w-3.5 h-3.5" />
                Settings saved successfully
              </span>
            )}
          </div>
          <button
            type="submit"
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
          >
            {saving ? 'Saving...' : 'Save Configuration'}
          </button>
        </div>
      </form>

      {/* Architectural Stack Details */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
          <Server className="w-4 h-4 text-indigo-600" />
          <h3 className="text-sm font-bold text-slate-900">
            Forward Deployed Architectural Specification
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-cyan-600" />
              <span>AI Service Model</span>
            </div>
            <div className="text-slate-600 font-mono text-[11px]">
              gemini-3.8-flash (via @google/genai TypeScript SDK)
            </div>
            <div className="text-[10px] text-slate-400">
              Server-side execution with strict JSON schema response mode.
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-emerald-600" />
              <span>Persistence & ORM</span>
            </div>
            <div className="text-slate-600 font-mono text-[11px]">
              PostgreSQL Schema Compatible (Prisma Ready)
            </div>
            <div className="text-[10px] text-slate-400">
              ACID repository pattern with foreign key cascades and audit logging.
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-purple-600" />
              <span>Duplicate Detection Engine</span>
            </div>
            <div className="text-slate-600 font-mono text-[11px]">
              Jaccard N-Gram Similarity & Substring Matching
            </div>
            <div className="text-[10px] text-slate-400">
              Threshold &gt; 0.65 triggers warning without destructive auto-deletion.
            </div>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 space-y-1">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-indigo-600" />
              <span>Validation Engine</span>
            </div>
            <div className="text-slate-600 font-mono text-[11px]">
              Zod TypeScript Runtime Schemas
            </div>
            <div className="text-[10px] text-slate-400">
              Validates meeting inputs, update patches, and raw AI extraction JSON.
            </div>
          </div>
        </div>
      </div>

      {/* Supabase Cloud Storage Integration Card */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-emerald-100 text-emerald-700">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Supabase Cloud PostgreSQL Database
              </h3>
              <p className="text-[11px] text-slate-500 font-mono">
                Project ID: chzpmbnixvyppuocjjck • Region: Global Cloud
              </p>
            </div>
          </div>

          {onOpenSupabase && (
            <button
              type="button"
              onClick={onOpenSupabase}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition shadow-2xs self-start"
            >
              <Database className="w-3.5 h-3.5" />
              <span>Manage Supabase & Sync</span>
            </button>
          )}
        </div>

        <div className="text-xs text-slate-600 space-y-2 leading-relaxed">
          <p>
            The application is connected to your Supabase PostgreSQL database at <code className="bg-slate-100 px-1 py-0.5 rounded font-mono text-[11px]">https://chzpmbnixvyppuocjjck.supabase.co</code>.
          </p>
          <div className="p-3 rounded-lg bg-emerald-50/60 border border-emerald-100 flex items-center justify-between">
            <span className="font-semibold text-emerald-900">
              Continuous Cloud Storage: Automatic write-through on meetings, action items, decisions, and audit logs.
            </span>
            <span className="text-[10px] bg-emerald-600 text-white font-mono px-2 py-0.5 rounded-full font-bold">
              ACTIVE
            </span>
          </div>
        </div>
      </div>

      {/* Reset Benchmark Data */}
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">
            Reset to Synthetic Enterprise Benchmark Data
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Restores 5 realistic multi-participant enterprise meetings with decisions, action items, missing fields, duplicates, and audit logs.
          </p>
        </div>

        <button
          onClick={handleResetData}
          disabled={seeding}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition shrink-0 self-start"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
          <span>Reset Sample Database</span>
        </button>
      </div>
    </div>
  );
};
