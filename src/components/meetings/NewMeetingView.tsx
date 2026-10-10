import React, { useState } from 'react';
import {
  Sparkles,
  Calendar,
  Users,
  FileText,
  AlertCircle,
  CheckCircle2,
  Loader2,
  BookmarkPlus,
  X,
  HelpCircle,
} from 'lucide-react';
import { api } from '../../lib/api.ts';

interface NewMeetingViewProps {
  onExtractionSuccess: (meetingId: string) => void;
  onCancel: () => void;
}

const PRESET_TEMPLATES = [
  {
    name: 'Cloud Infrastructure & SRE Review',
    title: 'Cloud Infrastructure & SRE Capacity Review',
    date: new Date().toISOString().split('T')[0],
    participants: ['Alex Turner (SRE)', 'Priya Patel (Staff Architect)', 'Tom Davies (VP Eng)'],
    transcript: `Tom: Let's review our Redis caching cluster bottlenecks. Last week latency peaked at 180ms during our European marketing campaign.
Priya: Based on memory profiling, we should migrate the session store to Google Cloud Memorystore with read replicas.
Tom: Approved. Let's standardize on Memorystore with high-availability replication.
Priya: I will write the Terraform module for Memorystore by this Thursday.
Alex: I will configure Datadog latency anomaly alerts on the caching cluster by tomorrow at noon.
Tom: We also need someone to audit the database connection pool limits before our end-of-month release.
Alex: And don't forget to prepare the performance benchmarking slide deck for the executive review.`,
  },
  {
    name: 'Enterprise Customer Escalation',
    title: 'FinTech Corp Webhook Latency Escalation Triage',
    date: new Date().toISOString().split('T')[0],
    participants: ['Maya Lin (VP Customer Success)', 'Devon Vance (Tech Lead)', 'Carlos Gomez (Account Exec)'],
    transcript: `Maya: FinTech Corp reported that 4.2% of their webhooks timed out during market open yesterday.
Devon: The root cause was synchronous database writes on ingest. We should refactor the webhook receiver to push immediately to Google Cloud Pub/Sub.
Maya: Let's make that our top sprint priority. Devon, can you lead that refactor?
Devon: Yes, I will push the Pub/Sub buffer pull request by Friday afternoon.
Carlos: I will send a formal root cause analysis letter and SLA remediation plan to their CTO by Wednesday 10 AM.
Maya: Someone should verify whether their dedicated IP allocation is properly warmed up.`,
  },
  {
    name: 'Security & Compliance Review',
    title: 'Quarterly SOC 2 Readiness & Access Control Review',
    date: new Date().toISOString().split('T')[0],
    participants: ['Amara Patel (Head of Infosec)', 'Dave Kim (DevOps)', 'Sarah Lin (Tech Lead)'],
    transcript: `Amara: The SOC 2 audit begins in three weeks. We must close our open access review items.
Decision: We will mandate hardware security keys (WebAuthn/YubiKey) for all AWS production console access.
Amara: I will publish the updated access control policy to the compliance repository by tomorrow.
Dave: I will revoke all legacy IAM long-lived access keys and replace them with temporary STS roles by Thursday.
Sarah: I will run automated Trivy vulnerability scans on all production container images before next Monday.
Amara: Could someone investigate whether third-party contractor laptops need additional mobile device management profiles?`,
  },
];

export const NewMeetingView: React.FC<NewMeetingViewProps> = ({
  onExtractionSuccess,
  onCancel,
}) => {
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [participants, setParticipants] = useState<string[]>([
    'Alex Turner',
    'Priya Patel',
  ]);
  const [participantInput, setParticipantInput] = useState('');
  const [transcript, setTranscript] = useState('');

  // Extraction Progress State
  const [extracting, setExtracting] = useState(false);
  const [progressStage, setProgressStage] = useState<number>(0);
  const [progressMessage, setProgressMessage] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const addParticipant = () => {
    const val = participantInput.trim();
    if (val && !participants.includes(val)) {
      setParticipants([...participants, val]);
      setParticipantInput('');
    }
  };

  const removeParticipant = (name: string) => {
    setParticipants(participants.filter((p) => p !== name));
  };

  const loadTemplate = (template: typeof PRESET_TEMPLATES[0]) => {
    setTitle(template.title);
    setMeetingDate(template.date);
    setParticipants(template.participants);
    setTranscript(template.transcript);
    setError(null);
  };

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!title.trim() || title.trim().length < 3) {
      setError('Meeting title must be at least 3 characters.');
      return;
    }
    if (!meetingDate) {
      setError('Meeting date is required.');
      return;
    }
    if (participants.length === 0) {
      setError('Please add at least one meeting participant.');
      return;
    }
    if (!transcript.trim() || transcript.trim().length < 10) {
      setError(
        'Please enter meeting notes or a transcript with at least 10 characters.'
      );
      return;
    }

    setExtracting(true);
    setProgressStage(1);
    setProgressMessage('1/4: Validating meeting payload & schemas...');

    try {
      // 1. Create meeting in database
      const meeting = await api.createMeeting({
        title: title.trim(),
        meetingDate,
        participants,
        transcript: transcript.trim(),
      });

      // 2. AI Extraction stage
      setProgressStage(2);
      setProgressMessage('2/4: Gemini 3.8 Flash analyzing transcript for decisions & action items...');

      await new Promise((r) => setTimeout(r, 400)); // Smooth UX transition

      setProgressStage(3);
      setProgressMessage('3/4: Normalizing relative dates & calculating confidence scores...');

      // 3. Run extraction API
      const result = await api.extractMeeting(meeting.id);

      setProgressStage(4);
      setProgressMessage(
        `4/4: Complete! Extracted ${result.decisions.length} decisions & ${result.actionItems.length} action items.`
      );

      await new Promise((r) => setTimeout(r, 600));

      // Transition to review page
      onExtractionSuccess(meeting.id);
    } catch (err: any) {
      console.error('Extraction failed:', err);
      setError(err.message || 'Failed to extract meeting action items.');
      setExtracting(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-5">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">
            New Meeting & Action Item Extraction
          </h2>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Input notes or raw conversation transcript to generate structured tasks, decisions, and deadlines.
          </p>
        </div>
        <button
          type="button"
          onClick={onCancel}
          disabled={extracting}
          className="text-xs text-slate-500 hover:text-slate-800 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50"
        >
          Cancel
        </button>
      </div>

      {/* Quick Template Presets for Instant Demo */}
      <div className="bg-indigo-50/60 border border-indigo-100 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-indigo-900">
            <BookmarkPlus className="w-4 h-4 text-indigo-600" />
            <span>Load Enterprise Benchmark Presets (1-Click Evaluation):</span>
          </div>
          <span className="text-[11px] text-indigo-600 font-mono">Instant Test Data</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {PRESET_TEMPLATES.map((tmpl, idx) => (
            <button
              key={idx}
              type="button"
              disabled={extracting}
              onClick={() => loadTemplate(tmpl)}
              className="text-xs font-medium px-3 py-1.5 rounded-lg bg-white hover:bg-indigo-600 hover:text-white text-indigo-700 border border-indigo-200 shadow-2xs transition"
            >
              {tmpl.name}
            </button>
          ))}
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="font-semibold text-rose-900">Extraction Error</div>
            <div className="text-xs">{error}</div>
          </div>
        </div>
      )}

      {/* Main Form */}
      <form onSubmit={handleExtract} className="space-y-6">
        <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs space-y-5">
          {/* Title & Date */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="md:col-span-2 space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Meeting Title <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={extracting}
                placeholder="e.g. Q3 Architecture & Semantic Search Migration"
                className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Meeting Date <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  value={meetingDate}
                  onChange={(e) => setMeetingDate(e.target.value)}
                  disabled={extracting}
                  className="w-full px-3.5 py-2 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition"
                  required
                />
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
              Participants <span className="text-rose-500">*</span>
            </label>
            <div className="flex flex-wrap items-center gap-2 p-2 border border-slate-300 rounded-lg bg-slate-50/50 min-h-[42px]">
              {participants.map((p) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-white border border-slate-200 text-slate-800 shadow-2xs"
                >
                  <Users className="w-3 h-3 text-slate-400" />
                  <span>{p}</span>
                  {!extracting && (
                    <button
                      type="button"
                      onClick={() => removeParticipant(p)}
                      className="text-slate-400 hover:text-rose-600 ml-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </span>
              ))}
              {!extracting && (
                <div className="flex items-center gap-1 flex-1 min-w-[140px]">
                  <input
                    type="text"
                    value={participantInput}
                    onChange={(e) => setParticipantInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addParticipant();
                      }
                    }}
                    placeholder="Type name & press Enter..."
                    className="w-full text-xs bg-transparent border-none outline-hidden px-1 py-0.5 text-slate-700 placeholder:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={addParticipant}
                    className="text-xs px-2 py-0.5 bg-slate-200 text-slate-700 hover:bg-slate-300 rounded"
                  >
                    Add
                  </button>
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-500">
              Provide participant names to allow the AI to accurately associate speakers with task owners.
            </p>
          </div>

          {/* Transcript / Notes */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider">
                Meeting Notes / Transcript <span className="text-rose-500">*</span>
              </label>
              <span className="text-xs text-slate-400 font-mono">
                {transcript.length.toLocaleString()} characters
              </span>
            </div>
            <textarea
              rows={11}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              disabled={extracting}
              placeholder="Paste your meeting notes or transcript here... Include dialogue, commitments, deadlines, and strategic conclusions."
              className="w-full p-3.5 text-sm font-mono border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-hidden transition leading-relaxed"
              required
            />
          </div>
        </div>

        {/* Extraction Progress Overlay / Stages */}
        {extracting && (
          <div className="p-5 rounded-xl bg-slate-900 text-white shadow-xl space-y-3 animate-fade-in border border-slate-800">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-cyan-400 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                <span>AI Processing In Progress</span>
              </span>
              <span className="text-slate-400 font-mono">Stage {progressStage} of 4</span>
            </div>

            {/* Progress bar */}
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className="bg-gradient-to-r from-cyan-400 to-indigo-500 h-full transition-all duration-300"
                style={{ width: `${progressStage * 25}%` }}
              />
            </div>

            <p className="text-xs text-slate-300 font-mono">{progressMessage}</p>
          </div>
        )}

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={extracting}
            className="px-4 py-2.5 rounded-lg text-xs font-semibold text-slate-600 hover:text-slate-900 border border-slate-300 hover:bg-slate-50 transition"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={extracting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md shadow-indigo-600/20 transition disabled:opacity-50 active:scale-98"
          >
            {extracting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Extracting Action Items...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4" />
                <span>Extract Action Items</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
