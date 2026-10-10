import React, { useState, useEffect } from 'react';
import {
  Database,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  RefreshCw,
  UploadCloud,
  Check,
  ShieldCheck,
} from 'lucide-react';
import { Modal } from '../common/Modal.tsx';
import { api } from '../../lib/api.ts';

interface SupabaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSynced?: () => void;
}

export const SupabaseModal: React.FC<SupabaseModalProps> = ({
  isOpen,
  onClose,
  onSynced,
}) => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);
  const [status, setStatus] = useState<{
    connected: boolean;
    projectId: string;
    url: string;
    tables: {
      meetings: boolean;
      decisions: boolean;
      action_items: boolean;
      audit_logs: boolean;
      system_settings: boolean;
    };
    allReady: boolean;
    error?: string;
  } | null>(null);
  const [sqlScript, setSqlScript] = useState<string>('');
  const [syncMessage, setSyncMessage] = useState<string | null>(null);

  const fetchStatus = async () => {
    setLoading(true);
    try {
      const [resStatus, resSql] = await Promise.all([
        api.getSupabaseStatus(),
        api.getSupabaseSql(),
      ]);
      setStatus(resStatus);
      setSqlScript(resSql.sql);
    } catch (err: any) {
      console.error('Failed to get Supabase status:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStatus();
      setSyncMessage(null);
    }
  }, [isOpen]);

  const handleCopySql = () => {
    navigator.clipboard.writeText(sqlScript);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2500);
  };

  const handleSyncData = async () => {
    setSyncing(true);
    setSyncMessage(null);
    try {
      const res = await api.syncToSupabase();
      if (res.success) {
        setSyncMessage(
          `Successfully synced ${res.synced.meetings} meetings, ${res.synced.decisions} decisions, and ${res.synced.actionItems} action items directly to Supabase!`
        );
        if (onSynced) onSynced();
        await fetchStatus();
      } else {
        setSyncMessage(`Sync failed: ${res.error || 'Please run the SQL script first to create tables.'}`);
      }
    } catch (err: any) {
      setSyncMessage(`Sync error: ${err.message}`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Supabase Cloud Database Integration"
      maxWidth="xl"
    >
      <div className="space-y-5 text-xs">
        {/* Connection Header Banner */}
        <div className="p-4 rounded-xl bg-slate-900 text-white flex items-center justify-between border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">Supabase Cloud</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-950 text-emerald-400 border border-emerald-800">
                  Project: {status?.projectId || 'wkwxbnpwhpfsqltotpsz'}
                </span>
              </div>
              <p className="text-slate-400 text-[11px] font-mono mt-0.5">
                {status?.url || 'https://wkwxbnpwhpfsqltotpsz.supabase.co'}
              </p>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            disabled={loading}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
            title="Refresh connection status"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Live Table Readiness Grid */}
        <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
          <div className="flex items-center justify-between font-semibold text-slate-700">
            <span>Remote PostgreSQL Tables Status</span>
            {status?.allReady ? (
              <span className="text-emerald-600 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                All 5 Tables Ready & Connected
              </span>
            ) : (
              <span className="text-amber-600 font-bold flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                Table Migration Required
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 font-mono text-[11px]">
            {status?.tables &&
              Object.entries(status.tables).map(([tbl, isReady]) => (
                <div
                  key={tbl}
                  className={`p-2 rounded-lg border flex items-center justify-between ${
                    isReady
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-white border-slate-200 text-slate-600'
                  }`}
                >
                  <span className="truncate">public.{tbl}</span>
                  {isReady ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  ) : (
                    <span className="text-[10px] text-amber-600 font-sans font-medium">Pending</span>
                  )}
                </div>
              ))}
          </div>
        </div>

        {/* Notification message */}
        {syncMessage && (
          <div className="p-3 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{syncMessage}</span>
          </div>
        )}

        {/* If tables ready -> Sync CTA */}
        {status?.allReady ? (
          <div className="p-4 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3">
            <div className="flex items-center gap-2 text-emerald-900 font-bold">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>Your Supabase database is active and ready for automatic persistence!</span>
            </div>
            <p className="text-emerald-800 text-[11px] leading-relaxed">
              Every meeting created, AI extraction executed, item approval, and edit will be saved directly into your Supabase account. You can also upload all current local meetings right now:
            </p>
            <button
              onClick={handleSyncData}
              disabled={syncing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-sm transition"
            >
              <UploadCloud className={`w-4 h-4 ${syncing ? 'animate-bounce' : ''}`} />
              <span>{syncing ? 'Syncing to Supabase...' : 'Sync All Current Data to Supabase'}</span>
            </button>
          </div>
        ) : (
          /* If tables not ready -> Step-by-step setup guide */
          <div className="space-y-3">
            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
              <span>Setup Instructions (1 Minute Setup)</span>
            </div>

            <ol className="list-decimal list-inside space-y-2 text-slate-600 pl-1">
              <li>
                Click the button below to copy the <strong>PostgreSQL DDL Migration Script</strong>.
              </li>
              <li>
                Open your Supabase project's SQL Editor:{' '}
                <a
                  href={`https://supabase.com/dashboard/project/${status?.projectId || 'wkwxbnpwhpfsqltotpsz'}/sql`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-indigo-600 hover:underline font-semibold inline-flex items-center gap-1"
                >
                  <span>Open Supabase SQL Editor</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>Paste the script and click <strong>"Run"</strong> in Supabase.</li>
              <li>Return here and click <strong>"Test & Sync Data"</strong>.</li>
            </ol>

            {/* SQL Snippet box */}
            <div className="relative rounded-lg border border-slate-300 bg-slate-900 text-slate-200 overflow-hidden">
              <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/90 border-b border-slate-700 text-[11px]">
                <span className="font-mono text-slate-400">supabase_migration.sql</span>
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1 px-2 py-0.5 rounded bg-indigo-600 hover:bg-indigo-500 text-white font-medium transition"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedSql ? 'Copied to Clipboard!' : 'Copy SQL Script'}</span>
                </button>
              </div>
              <pre className="p-3 text-[10px] font-mono max-h-36 overflow-y-auto whitespace-pre leading-relaxed text-slate-300">
                {sqlScript}
              </pre>
            </div>

            <div className="flex items-center justify-between pt-2">
              <button
                onClick={handleCopySql}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold transition"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{copiedSql ? 'Copied!' : 'Copy SQL Script'}</span>
              </button>

              <button
                onClick={handleSyncData}
                disabled={syncing}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold transition shadow-xs"
              >
                <UploadCloud className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
                <span>{syncing ? 'Checking & Syncing...' : 'Test & Sync Data to Supabase'}</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};
