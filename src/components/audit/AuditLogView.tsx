import React, { useState } from 'react';
import {
  History,
  ShieldCheck,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  Edit,
  Trash,
  PlusCircle,
  FileCode,
} from 'lucide-react';
import { AuditLog } from '../../types/index.ts';

interface AuditLogViewProps {
  logs: AuditLog[];
  onRefresh: () => Promise<void>;
}

export const AuditLogView: React.FC<AuditLogViewProps> = ({ logs, onRefresh }) => {
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');

  const filtered = logs.filter((l) => {
    const matchesSearch =
      l.event.toLowerCase().includes(search.toLowerCase()) ||
      (l.meetingId && l.meetingId.toLowerCase().includes(search.toLowerCase())) ||
      (l.actionItemId && l.actionItemId.toLowerCase().includes(search.toLowerCase()));

    const matchesFilter = eventFilter === 'all' || l.event === eventFilter;
    return matchesSearch && matchesFilter;
  });

  const getEventBadge = (event: AuditLog['event']) => {
    switch (event) {
      case 'extraction_completed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800">Extraction Completed</span>;
      case 'extraction_started':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-800">Extraction Started</span>;
      case 'item_approved':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">Item Approved</span>;
      case 'item_completed':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Item Completed</span>;
      case 'item_edited':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-100 text-purple-800">Item Edited</span>;
      case 'item_deleted':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Item Deleted</span>;
      case 'item_rejected':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">Item Rejected</span>;
      case 'meeting_created':
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 text-indigo-800">Meeting Created</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">{event}</span>;
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Security & Compliance Audit Trail
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Immutable log of every AI extraction, human review override, approval, and task mutation.
          </p>
        </div>

        <button
          onClick={onRefresh}
          className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 transition"
        >
          Refresh Audit Trail
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by event, meeting ID, or item ID..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Event Type:</span>
          <select
            value={eventFilter}
            onChange={(e) => setEventFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-hidden"
          >
            <option value="all">All Events ({logs.length})</option>
            <option value="extraction_completed">Extraction Completed</option>
            <option value="item_approved">Item Approved</option>
            <option value="item_completed">Item Completed</option>
            <option value="item_edited">Item Edited</option>
            <option value="item_deleted">Item Deleted</option>
            <option value="meeting_created">Meeting Created</option>
          </select>
        </div>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Timestamp</th>
                <th className="py-3 px-4">Event Type</th>
                <th className="py-3 px-4">Meeting ID</th>
                <th className="py-3 px-4">Action Item ID</th>
                <th className="py-3 px-4">Diff / Value Snapshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400">
                    No matching audit logs found.
                  </td>
                </tr>
              ) : (
                filtered.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 px-4 font-mono text-slate-500 text-[11px] whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleString()}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {getEventBadge(log.event)}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                      {log.meetingId || '--'}
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 text-[11px]">
                      {log.actionItemId || '--'}
                    </td>
                    <td className="py-3 px-4">
                      {log.newValue ? (
                        <pre className="text-[10px] bg-slate-50 p-2 rounded border border-slate-100 text-slate-700 font-mono max-w-lg overflow-x-auto">
                          {typeof log.newValue === 'object'
                            ? JSON.stringify(log.newValue, null, 1)
                            : String(log.newValue)}
                        </pre>
                      ) : (
                        <span className="text-slate-400 italic">None</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
