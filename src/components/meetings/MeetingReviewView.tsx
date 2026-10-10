import React, { useState } from 'react';
import {
  Calendar,
  Users,
  CheckCircle2,
  XCircle,
  Trash2,
  Edit3,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  Quote,
  ShieldAlert,
  Save,
  Clock,
  Send,
  HelpCircle,
} from 'lucide-react';
import { Meeting, Decision, ActionItem, AuditLog } from '../../types/index.ts';
import { StatusBadge, ConfidencePill } from '../common/Badge.tsx';
import { Modal } from '../common/Modal.tsx';
import { api } from '../../lib/api.ts';

interface MeetingReviewViewProps {
  meeting: Meeting;
  decisions: Decision[];
  actionItems: ActionItem[];
  auditLogs?: AuditLog[];
  onBack: () => void;
  onRefresh: () => Promise<void>;
}

export const MeetingReviewView: React.FC<MeetingReviewViewProps> = ({
  meeting,
  decisions,
  actionItems,
  auditLogs = [],
  onBack,
  onRefresh,
}) => {
  const [activeTab, setActiveTab] = useState<'action-items' | 'decisions' | 'transcript' | 'audit'>('action-items');
  const [editingItem, setEditingItem] = useState<ActionItem | null>(null);
  const [editForm, setEditForm] = useState<{
    action: string;
    owner: string;
    dueDate: string;
    status: ActionItem['status'];
    needsReview: boolean;
  }>({
    action: '',
    owner: '',
    dueDate: '',
    status: 'pending',
    needsReview: false,
  });

  const [savingEdit, setSavingEdit] = useState(false);
  const [reExtracting, setReExtracting] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [actionSuccessMsg, setActionSuccessMsg] = useState<string | null>(null);

  const showBannerMessage = (msg: string) => {
    setActionSuccessMsg(msg);
    setTimeout(() => setActionSuccessMsg(null), 3000);
  };

  const handleApprove = async (id: string) => {
    try {
      await api.approveActionItem(id);
      showBannerMessage('Action item approved');
      await onRefresh();
    } catch (err: any) {
      alert(`Error approving item: ${err.message}`);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await api.rejectActionItem(id);
      showBannerMessage('Action item marked as rejected');
      await onRefresh();
    } catch (err: any) {
      alert(`Error rejecting item: ${err.message}`);
    }
  };

  const handleComplete = async (id: string) => {
    try {
      await api.completeActionItem(id);
      showBannerMessage('Action item marked completed');
      await onRefresh();
    } catch (err: any) {
      alert(`Error updating item: ${err.message}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this action item?')) {
      try {
        await api.deleteActionItem(id);
        showBannerMessage('Action item deleted');
        await onRefresh();
      } catch (err: any) {
        alert(`Error deleting item: ${err.message}`);
      }
    }
  };

  const handleBulkApprove = async () => {
    try {
      const res = await api.bulkApproveMeeting(meeting.id);
      showBannerMessage(`Approved ${res.count} pending items`);
      await onRefresh();
    } catch (err: any) {
      alert(`Error bulk approving: ${err.message}`);
    }
  };

  const handleReExtract = async () => {
    if (confirm('Re-run Gemini 3.8 Flash extraction on this transcript? Existing results will be updated.')) {
      setReExtracting(true);
      try {
        await api.extractMeeting(meeting.id);
        showBannerMessage('Extraction completed successfully');
        await onRefresh();
      } catch (err: any) {
        alert(`Extraction failed: ${err.message}`);
      } finally {
        setReExtracting(false);
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
      showBannerMessage('Action item updated successfully');
      await onRefresh();
    } catch (err: any) {
      alert(`Error updating item: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  };

  const copyTranscript = () => {
    navigator.clipboard.writeText(meeting.transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 2000);
  };

  const reviewItemsCount = actionItems.filter((a) => a.needsReview).length;
  const pendingCount = actionItems.filter((a) => a.status === 'pending').length;

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-12">
      {/* Back button and Meta */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div className="space-y-1">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-slate-800 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Meetings</span>
          </button>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            {meeting.title}
          </h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {meeting.meetingDate}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              {meeting.participants.join(', ')}
            </span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleReExtract}
            disabled={reExtracting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 transition"
          >
            <RotateCcw className={`w-3.5 h-3.5 ${reExtracting ? 'animate-spin' : ''}`} />
            <span>Re-extract with Gemini</span>
          </button>

          {pendingCount > 0 && (
            <button
              onClick={handleBulkApprove}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-2xs transition"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Approve All Pending ({pendingCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Action Notification Toast */}
      {actionSuccessMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2 animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          <span>{actionSuccessMsg}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('action-items')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'action-items'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Action Items ({actionItems.length})</span>
          {reviewItemsCount > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-amber-100 text-amber-800 font-bold">
              {reviewItemsCount} Need Review
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('decisions')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition flex items-center gap-2 ${
            activeTab === 'decisions'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Strategic Decisions ({decisions.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('transcript')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
            activeTab === 'transcript'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Source Transcript</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`px-4 py-2 text-xs font-semibold border-b-2 transition ${
            activeTab === 'audit'
              ? 'border-indigo-600 text-indigo-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>Meeting Audit Trail ({auditLogs.length})</span>
        </button>
      </div>

      {/* TAB 1: ACTION ITEMS */}
      {activeTab === 'action-items' && (
        <div className="space-y-4">
          {actionItems.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
              No action items extracted. Try re-extracting with Gemini.
            </div>
          ) : (
            <div className="space-y-3">
              {actionItems.map((item) => {
                const isLowConfidence = item.confidence < 0.7;
                const isMissingOwner = !item.owner;
                const isMissingDate = !item.dueDate;

                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl border transition shadow-xs overflow-hidden ${
                      item.needsReview
                        ? 'border-amber-300 ring-1 ring-amber-100 bg-amber-50/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="p-5 flex flex-col md:flex-row md:items-start justify-between gap-4">
                      {/* Left: Content & Badges */}
                      <div className="space-y-2.5 flex-1 min-w-0">
                        {/* Badges line */}
                        <div className="flex flex-wrap items-center gap-2">
                          <StatusBadge status={item.status} />
                          <ConfidencePill confidence={item.confidence} showBar />

                          {/* Specific Missing Info Badges */}
                          {isMissingOwner && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-200">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              <span>Owner Missing</span>
                            </span>
                          )}

                          {isMissingDate && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-100 text-amber-800 border border-amber-200">
                              <Clock className="w-3 h-3 text-amber-600" />
                              <span>Due Date Missing</span>
                            </span>
                          )}

                          {isLowConfidence && !isMissingOwner && !isMissingDate && (
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-orange-100 text-orange-800 border border-orange-200">
                              <ShieldAlert className="w-3 h-3 text-orange-600" />
                              <span>Low Confidence</span>
                            </span>
                          )}

                          {/* Duplicate Flag */}
                          {item.isDuplicate && (
                            <span
                              className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded bg-purple-100 text-purple-800 border border-purple-200"
                              title="Flagged by similarity analysis as a potential duplicate action item."
                            >
                              <Copy className="w-3 h-3 text-purple-600" />
                              <span>Possible Duplicate</span>
                            </span>
                          )}

                          {item.needsReview && (
                            <span className="text-[11px] font-bold text-amber-700">
                              • Requires Human Review
                            </span>
                          )}
                        </div>

                        {/* Action Text */}
                        <div className="text-base font-semibold text-slate-900 leading-snug">
                          {item.action}
                        </div>

                        {/* Owner & Due Date meta */}
                        <div className="flex flex-wrap items-center gap-4 text-xs text-slate-600">
                          <div>
                            <span className="text-slate-400 mr-1.5 font-medium">Assignee:</span>
                            {item.owner ? (
                              <span className="font-semibold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                {item.owner}
                              </span>
                            ) : (
                              <span className="text-rose-600 font-semibold italic">
                                Unassigned
                              </span>
                            )}
                          </div>

                          <div>
                            <span className="text-slate-400 mr-1.5 font-medium">Target Deadline:</span>
                            {item.dueDate ? (
                              <span className="font-semibold text-slate-800">
                                {item.dueDate}
                              </span>
                            ) : (
                              <span className="text-amber-700 italic">No deadline set</span>
                            )}
                          </div>
                        </div>

                        {/* Evidence quote */}
                        {item.evidence && (
                          <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 flex items-start gap-2">
                            <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                            <span className="italic font-mono text-[11px] leading-relaxed">
                              "{item.evidence}"
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Right: Actions Buttons */}
                      <div className="flex items-center md:flex-col gap-1.5 shrink-0 border-t md:border-t-0 md:border-l border-slate-100 pt-3 md:pt-0 md:pl-4">
                        {item.status !== 'approved' && (
                          <button
                            onClick={() => handleApprove(item.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 transition"
                            title="Approve item"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Approve</span>
                          </button>
                        )}

                        {item.status !== 'completed' && (
                          <button
                            onClick={() => handleComplete(item.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition"
                            title="Mark completed"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Complete</span>
                          </button>
                        )}

                        {item.status !== 'rejected' && (
                          <button
                            onClick={() => handleReject(item.id)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-700 hover:bg-rose-50 transition"
                            title="Reject item"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        )}

                        <button
                          onClick={() => openEditModal(item)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-100 transition"
                          title="Edit details"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>

                        <button
                          onClick={() => handleDelete(item.id)}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                          title="Delete item"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Delete</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: STRATEGIC DECISIONS */}
      {activeTab === 'decisions' && (
        <div className="space-y-4">
          {decisions.length === 0 ? (
            <div className="p-12 text-center bg-white rounded-xl border border-slate-200 text-slate-400">
              No formal decisions extracted for this meeting.
            </div>
          ) : (
            <div className="space-y-3">
              {decisions.map((dec) => (
                <div
                  key={dec.id}
                  className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded">
                      Architectural / Business Decision
                    </span>
                    <ConfidencePill confidence={dec.confidence} />
                  </div>
                  <div className="text-sm font-semibold text-slate-900 leading-snug">
                    {dec.decision}
                  </div>
                  {dec.evidence && (
                    <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100 text-xs text-slate-600 flex items-start gap-2">
                      <Quote className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span className="italic font-mono text-[11px] leading-relaxed">
                        "{dec.evidence}"
                      </span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SOURCE TRANSCRIPT */}
      {activeTab === 'transcript' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900">
              Full Conversation Notes & Transcript
            </h3>
            <button
              onClick={copyTranscript}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedTranscript ? 'Copied!' : 'Copy Transcript'}</span>
            </button>
          </div>
          <pre className="p-4 bg-slate-900 text-slate-200 rounded-lg text-xs font-mono whitespace-pre-wrap leading-relaxed max-h-[500px] overflow-y-auto">
            {meeting.transcript}
          </pre>
        </div>
      )}

      {/* TAB 4: AUDIT TRAIL */}
      {activeTab === 'audit' && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs divide-y divide-slate-100">
          <div className="p-4 bg-slate-50/60 font-semibold text-xs text-slate-700">
            Lifecycle & Review Event Log
          </div>
          {auditLogs.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs">
              No audit records logged yet for this meeting.
            </div>
          ) : (
            auditLogs.map((log) => (
              <div key={log.id} className="p-4 text-xs flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="font-semibold text-slate-800 font-mono">
                    {log.event}
                  </div>
                  {log.newValue && (
                    <pre className="text-[10px] bg-slate-50 p-2 rounded border border-slate-200 text-slate-600 font-mono max-w-xl overflow-x-auto">
                      {JSON.stringify(log.newValue, null, 2)}
                    </pre>
                  )}
                </div>
                <div className="text-[11px] text-slate-400 font-mono shrink-0">
                  {new Date(log.createdAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Edit Action Item Modal */}
      <Modal
        isOpen={!!editingItem}
        onClose={() => setEditingItem(null)}
        title="Edit Extracted Action Item"
      >
        <form onSubmit={handleSaveEdit} className="space-y-4">
          <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-700 uppercase">
              Action Description <span className="text-rose-500">*</span>
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
                Owner / Assignee
              </label>
              <input
                type="text"
                value={editForm.owner}
                onChange={(e) => setEditForm({ ...editForm, owner: e.target.value })}
                placeholder="Assignee name"
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
                <span>Flag for human review</span>
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
