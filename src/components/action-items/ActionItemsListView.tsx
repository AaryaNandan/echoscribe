import React, { useState } from 'react';
import {
  Search,
  Filter,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Check,
  XCircle,
  Edit3,
  Trash2,
  Copy,
  Calendar,
  Save,
  Download,
} from 'lucide-react';
import { ActionItem } from '../../types/index.ts';
import { StatusBadge, ConfidencePill } from '../common/Badge.tsx';
import { Modal } from '../common/Modal.tsx';
import { api } from '../../lib/api.ts';

interface ActionItemsListViewProps {
  actionItems: (ActionItem & { meetingTitle?: string })[];
  onRefresh: () => Promise<void>;
  onSelectMeeting?: (meetingId: string) => void;
}

export const ActionItemsListView: React.FC<ActionItemsListViewProps> = ({
  actionItems,
  onRefresh,
  onSelectMeeting,
}) => {
  const [activeFilter, setActiveFilter] = useState<
    'all' | 'pending' | 'completed' | 'overdue' | 'needs-review'
  >('all');
  const [search, setSearch] = useState('');
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);
  const [editForm, setEditForm] = useState({
    action: '',
    owner: '',
    dueDate: '',
    status: 'pending' as ActionItem['status'],
    needsReview: false,
  });
  const [savingEdit, setSavingEdit] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const filteredItems = actionItems.filter((item) => {
    // Search
    const q = search.toLowerCase();
    const matchesSearch =
      item.action.toLowerCase().includes(q) ||
      (item.owner && item.owner.toLowerCase().includes(q)) ||
      (item.meetingTitle && item.meetingTitle.toLowerCase().includes(q));

    if (!matchesSearch) return false;

    // Status tabs
    if (activeFilter === 'pending') return item.status === 'pending';
    if (activeFilter === 'completed') return item.status === 'completed';
    if (activeFilter === 'overdue') {
      return item.dueDate && item.dueDate < todayStr && item.status !== 'completed';
    }
    if (activeFilter === 'needs-review') return item.needsReview;

    return true;
  });

  const handleComplete = async (id: string) => {
    try {
      await api.completeActionItem(id);
      await onRefresh();
    } catch (err: any) {
      alert(`Error completing item: ${err.message}`);
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.approveActionItem(id);
      await onRefresh();
    } catch (err: any) {
      alert(`Error approving item: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Delete this action item permanently?')) {
      try {
        await api.deleteActionItem(id);
        await onRefresh();
      } catch (err: any) {
        alert(`Error deleting item: ${err.message}`);
      }
    }
  };

  const openEditModal = (item: ActionItem) => {
    setEditingItem(item);
    setEditForm({
      action: item.action,
      owner: item.owner || '',
      dueDate: item.dueDate || '',
      status: item.status,
      needsReview: item.needsReview,
    });
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSavingEdit(true);
    try {
      await api.updateActionItem(editingItem.id, {
        action: editForm.action,
        owner: editForm.owner.trim() || null,
        dueDate: editForm.dueDate || null,
        status: editForm.status,
        needsReview: editForm.needsReview,
      });
      setEditingItem(null);
      await onRefresh();
    } catch (err: any) {
      alert(`Error updating item: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const pendingCount = actionItems.filter((a) => a.status === 'pending').length;
  const completedCount = actionItems.filter((a) => a.status === 'completed').length;
  const overdueCount = actionItems.filter(
    (a) => a.dueDate && a.dueDate < todayStr && a.status !== 'completed'
  ).length;
  const reviewCount = actionItems.filter((a) => a.needsReview).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            Universal Action Items Registry
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Cross-meeting task repository with confidence metrics, owner assignments, and review alerts.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => api.downloadCsv()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-lg shadow-2xs transition"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-4">
        {/* Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
          <button
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Items ({actionItems.length})
          </button>
          <button
            onClick={() => setActiveFilter('pending')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeFilter === 'pending'
                ? 'bg-amber-600 text-white'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            <span>Pending ({pendingCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('completed')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeFilter === 'completed'
                ? 'bg-emerald-600 text-white'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            <span>Completed ({completedCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('overdue')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeFilter === 'overdue'
                ? 'bg-rose-600 text-white'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            <span>Overdue ({overdueCount})</span>
          </button>
          <button
            onClick={() => setActiveFilter('needs-review')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
              activeFilter === 'needs-review'
                ? 'bg-orange-600 text-white'
                : 'bg-orange-50 text-orange-800 hover:bg-orange-100'
            }`}
          >
            <span>Needs Review ({reviewCount})</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search action items by keyword, assignee, or source meeting..."
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
          />
        </div>
      </div>

      {/* Action Items Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Action Deliverable</th>
                <th className="py-3 px-4">Assignee</th>
                <th className="py-3 px-4">Target Date</th>
                <th className="py-3 px-4">Source Meeting</th>
                <th className="py-3 px-4">Confidence</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    No matching action items found.
                  </td>
                </tr>
              ) : (
                filteredItems.map((item) => {
                  const isOverdue =
                    item.dueDate && item.dueDate < todayStr && item.status !== 'completed';

                  return (
                    <tr
                      key={item.id}
                      className={`hover:bg-slate-50/80 transition ${
                        item.needsReview ? 'bg-amber-50/30' : ''
                      }`}
                    >
                      {/* Action text & alerts */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1 max-w-md">
                          <div className="font-semibold text-slate-900 leading-snug">
                            {item.action}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {item.needsReview && (
                              <span className="text-[10px] bg-amber-100 text-amber-800 font-semibold px-1.5 py-0.2 rounded">
                                Needs Review
                              </span>
                            )}
                            {item.isDuplicate && (
                              <span className="text-[10px] bg-purple-100 text-purple-800 font-semibold px-1.5 py-0.2 rounded flex items-center gap-1">
                                <Copy className="w-2.5 h-2.5" />
                                Duplicate
                              </span>
                            )}
                            {!item.owner && (
                              <span className="text-[10px] text-rose-600 font-semibold">
                                Missing owner
                              </span>
                            )}
                            {!item.dueDate && (
                              <span className="text-[10px] text-amber-700 font-semibold">
                                Missing due date
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Owner */}
                      <td className="py-3.5 px-4 text-slate-700">
                        {item.owner ? (
                          <span className="font-medium bg-slate-100 text-slate-800 px-2 py-0.5 rounded">
                            {item.owner}
                          </span>
                        ) : (
                          <span className="text-rose-600 italic">Unassigned</span>
                        )}
                      </td>

                      {/* Due Date */}
                      <td className="py-3.5 px-4 font-mono">
                        {item.dueDate ? (
                          <span
                            className={
                              isOverdue ? 'text-rose-600 font-bold' : 'text-slate-700'
                            }
                          >
                            {item.dueDate}
                            {isOverdue && ' (Overdue)'}
                          </span>
                        ) : (
                          <span className="text-slate-400 italic">None</span>
                        )}
                      </td>

                      {/* Source Meeting */}
                      <td className="py-3.5 px-4">
                        {onSelectMeeting ? (
                          <button
                            onClick={() => onSelectMeeting(item.meetingId)}
                            className="text-indigo-600 hover:text-indigo-800 font-medium max-w-xs truncate block text-left"
                          >
                            {item.meetingTitle || 'View Meeting'}
                          </button>
                        ) : (
                          <span className="text-slate-600 max-w-xs truncate block">
                            {item.meetingTitle || item.meetingId}
                          </span>
                        )}
                      </td>

                      {/* Confidence */}
                      <td className="py-3.5 px-4">
                        <ConfidencePill confidence={item.confidence} />
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <StatusBadge status={item.status} />
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {item.status !== 'completed' && (
                            <button
                              onClick={() => handleComplete(item.id)}
                              className="p-1 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition"
                              title="Mark Complete"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                          {item.status === 'pending' && (
                            <button
                              onClick={() => handleApprove(item.id)}
                              className="p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                              title="Approve"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => openEditModal(item)}
                            className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition"
                            title="Edit"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(item.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            title="Delete"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Edit Action Item"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase">
              Action Description
            </label>
            <textarea
              rows={3}
              value={editForm.action}
              onChange={(e) => setEditForm({ ...editForm, action: e.target.value })}
              className="w-full p-2.5 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">
                Assignee
              </label>
              <input
                type="text"
                value={editForm.owner}
                onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>

            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">
                Target Due Date
              </label>
              <input
                type="date"
                value={editForm.dueDate}
                onChange={(e) => setEditForm({ ...editForm, dueDate: e.target.value })}
                className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="block text-xs font-semibold text-slate-700 uppercase">
                Status
              </label>
              <select
                value={editForm.status}
                onChange={(e) =>
                  setEditForm({ ...editForm, status: e.target.value as ActionItem['status'] })
                }
                className="w-full p-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-hidden"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            <div className="flex items-center pt-5">
              <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={editForm.needsReview}
                  onChange={(e) => setEditForm({ ...editForm, needsReview: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500"
                />
                <span>Requires review</span>
              </label>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEditingItem(null)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingEdit}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{savingEdit ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
