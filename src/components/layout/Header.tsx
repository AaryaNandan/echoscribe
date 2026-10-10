import React, { useState } from 'react';
import {
  Download,
  FileSpreadsheet,
  FileCode,
  RotateCcw,
  Sparkles,
  Info,
  Database,
} from 'lucide-react';

import { api } from '../../lib/api.ts';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onSeedData: () => Promise<void>;
  onNewMeetingClick: () => void;
  onOpenSupabase?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  onSeedData,
  onNewMeetingClick,
  onOpenSupabase,
}) => {
  const [seeding, setSeeding] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const handleSeed = async () => {
    if (confirm('Reset and seed 5 synthetic realistic enterprise meetings?')) {
      setSeeding(true);
      try {
        await onSeedData();
      } finally {
        setSeeding(false);
      }
    }
  };

  const downloadCsv = async () => {
    await api.downloadCsv();
    setExportOpen(false);
  };

  const downloadJson = async () => {
    await api.downloadJson();
    setExportOpen(false);
  };

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between sticky top-0 z-20">
      <div>
        <h2 className="text-lg font-bold text-slate-900 tracking-tight">{title}</h2>
        {subtitle && <p className="text-xs text-slate-500 font-medium">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-2.5">
        {/* Supabase Status Button */}
        {onOpenSupabase && (
          <button
            onClick={onOpenSupabase}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition shadow-2xs"
            title="Open Supabase Cloud Database Manager"
          >
            <Database className="w-3.5 h-3.5 text-emerald-600" />
            <span className="font-mono">Supabase: wkwxbnpw...</span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 ml-0.5 animate-pulse" />
          </button>
        )}

        {/* Synthetic Portfolio Pill */}
        <div
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 border border-slate-200 text-xs text-slate-600 font-mono"
          title="FDE Portfolio demonstration environment with simulated benchmark telemetry."
        >
          <Info className="w-3.5 h-3.5 text-slate-400" />
          <span>FDE Edition</span>
        </div>

        {/* Reseed Data Button */}
        <button
          onClick={handleSeed}
          disabled={seeding}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300/80 transition disabled:opacity-50"
          title="Reset database to 5 realistic enterprise benchmark meetings"
        >
          <RotateCcw className={`w-3.5 h-3.5 ${seeding ? 'animate-spin' : ''}`} />
          <span>Reset Sample Data</span>
        </button>

        {/* Export Dropdown */}
        <div className="relative">
          <button
            onClick={() => setExportOpen(!exportOpen)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition shadow-2xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export Data</span>
          </button>

          {exportOpen && (
            <>
              <div
                className="fixed inset-0 z-30"
                onClick={() => setExportOpen(false)}
              />
              <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-xl border border-slate-200 py-1.5 z-40 text-xs">
                <button
                  onClick={downloadCsv}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-100 text-left"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <div>
                    <div className="font-medium">Export CSV</div>
                    <div className="text-[10px] text-slate-400">All action items & owners</div>
                  </div>
                </button>
                <button
                  onClick={downloadJson}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-slate-700 hover:bg-slate-100 text-left border-t border-slate-100"
                >
                  <FileCode className="w-4 h-4 text-indigo-600" />
                  <div>
                    <div className="font-medium">Export JSON</div>
                    <div className="text-[10px] text-slate-400">Full meetings & audit logs</div>
                  </div>
                </button>
              </div>
            </>
          )}
        </div>

        {/* Primary CTA */}
        <button
          onClick={onNewMeetingClick}
          className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm shadow-indigo-600/20 transition active:scale-98"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>+ New Meeting</span>
        </button>
      </div>
    </header>
  );
};
