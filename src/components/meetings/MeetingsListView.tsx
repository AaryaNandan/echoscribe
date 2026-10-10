import React, { useState } from 'react';
import {
  Calendar,
  Search,
  Filter,
  Plus,
  ArrowRight,
  Users,
  CheckCircle2,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { Meeting } from '../../types/index.ts';
import { StatusBadge } from '../common/Badge.tsx';

interface MeetingsListViewProps {
  meetings: (Meeting & {
    actionItemCount?: number;
    completedActionCount?: number;
    decisionCount?: number;
    needsReviewCount?: number;
  })[];
  onSelectMeeting: (id: string) => void;
  onNewMeeting: () => void;
  onDeleteMeeting: (id: string) => Promise<void>;
}

export const MeetingsListView: React.FC<MeetingsListViewProps> = ({
  meetings,
  onSelectMeeting,
  onNewMeeting,
  onDeleteMeeting,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const filtered = meetings.filter((m) => {
    const matchesSearch =
      m.title.toLowerCase().includes(search.toLowerCase()) ||
      m.participants.some((p) => p.toLowerCase().includes(search.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all' || m.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Meeting Intelligence Directory
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Search, filter, and inspect processed transcripts and extracted deliverables.
          </p>
        </div>

        <button
          onClick={onNewMeeting}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 transition shadow-2xs self-start"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Meeting</span>
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
            placeholder="Search meetings by title or participant..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-xs text-slate-500 font-medium">Status:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-700 focus:ring-2 focus:ring-indigo-500 outline-hidden"
          >
            <option value="all">All Statuses</option>
            <option value="processed">Processed</option>
            <option value="draft">Draft</option>
            <option value="reviewed">Reviewed</option>
          </select>
        </div>
      </div>

      {/* Meetings Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Meeting Title</th>
                <th className="py-3 px-4">Meeting Date</th>
                <th className="py-3 px-4">Participants</th>
                <th className="py-3 px-4">Decisions</th>
                <th className="py-3 px-4">Action Items</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No matching meetings found.
                  </td>
                </tr>
              ) : (
                filtered.map((m) => (
                  <tr
                    key={m.id}
                    onClick={() => onSelectMeeting(m.id)}
                    className="hover:bg-slate-50/80 cursor-pointer transition group"
                  >
                    <td className="py-3.5 px-4 font-semibold text-slate-900 group-hover:text-indigo-600 transition">
                      <div className="max-w-xs truncate">{m.title}</div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-600 font-mono">
                      {m.meetingDate}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <div className="flex items-center gap-1.5 max-w-xs truncate">
                        <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{m.participants.join(', ')}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <span className="font-semibold">{m.decisionCount ?? 0}</span> decisions
                    </td>
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{m.actionItemCount ?? 0} items</span>
                        {(m.needsReviewCount ?? 0) > 0 && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.2 rounded">
                            {m.needsReviewCount} review
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      <StatusBadge status={m.status || 'processed'} />
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => onSelectMeeting(m.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded transition"
                        >
                          Review
                        </button>
                        <button
                          onClick={async () => {
                            if (confirm(`Delete meeting "${m.title}"?`)) {
                              await onDeleteMeeting(m.id);
                            }
                          }}
                          className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                          title="Delete meeting"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
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
