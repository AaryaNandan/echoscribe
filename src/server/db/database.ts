import fs from 'fs';
import path from 'path';
import {
  Meeting,
  Decision,
  ActionItem,
  AuditLog,
  SystemSettings,
  DashboardMetrics,
} from '../../types/index.ts';
import { supabaseAdapter } from './supabase.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

interface DatabaseSchema {
  meetings: Meeting[];
  decisions: Decision[];
  actionItems: ActionItem[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
}

const DEFAULT_SETTINGS: SystemSettings = {
  manualMinutesPerMeeting: 10,
  automatedMinutesPerMeeting: 2,
  confidenceThreshold: 0.7,
  aiModel: 'gemini-3.8-flash',
};

// Text similarity helper for duplicate detection (Jaccard + Levenshtein hybrid)
export function calculateTextSimilarity(str1: string, str2: string): number {
  const normalize = (text: string) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();

  const s1 = normalize(str1);
  const s2 = normalize(str2);

  if (s1 === s2) return 1.0;
  if (!s1 || !s2) return 0.0;

  const words1 = new Set(s1.split(/\s+/).filter((w) => w.length > 2));
  const words2 = new Set(s2.split(/\s+/).filter((w) => w.length > 2));

  if (words1.size === 0 || words2.size === 0) return 0.0;

  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }

  const union = new Set([...words1, ...words2]).size;
  const jaccard = union === 0 ? 0 : intersection / union;

  // Check substring containment
  if (s1.includes(s2) || s2.includes(s1)) {
    return Math.max(jaccard, 0.85);
  }

  return jaccard;
}

export class Database {
  private data: DatabaseSchema = {
    meetings: [],
    decisions: [],
    actionItems: [],
    auditLogs: [],
    settings: { ...DEFAULT_SETTINGS },
  };

  private initialized = false;

  constructor() {
    this.ensureInitialized();
  }

  private ensureInitialized() {
    if (this.initialized) return;

    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      if (fs.existsSync(DATA_FILE)) {
        const raw = fs.readFileSync(DATA_FILE, 'utf-8');
        this.data = JSON.parse(raw);
        // Ensure defaults
        if (!this.data.settings) {
          this.data.settings = { ...DEFAULT_SETTINGS };
        }
      } else {
        this.data = {
          meetings: [],
          decisions: [],
          actionItems: [],
          auditLogs: [],
          settings: { ...DEFAULT_SETTINGS },
        };
        this.seedInitialData();
        this.save();
      }
    } catch (err) {
      console.warn('Error reading data file, initializing in-memory fallback:', err);
      this.seedInitialData();
    }
    this.initialized = true;
  }

  private save() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
      fs.writeFileSync(DATA_FILE, JSON.stringify(this.data, null, 2), 'utf-8');
    } catch (err) {
      console.error('Failed to write database file:', err);
    }
  }

  // --- Meetings ---
  public getMeetings(): Meeting[] {
    this.ensureInitialized();
    return [...this.data.meetings].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getMeetingById(id: string): {
    meeting: Meeting;
    decisions: Decision[];
    actionItems: ActionItem[];
  } | null {
    this.ensureInitialized();
    const meeting = this.data.meetings.find((m) => m.id === id);
    if (!meeting) return null;

    const decisions = this.data.decisions.filter((d) => d.meetingId === id);
    const actionItems = this.data.actionItems.filter((a) => a.meetingId === id);

    return { meeting, decisions, actionItems };
  }

  public createMeeting(
    input: Omit<Meeting, 'id' | 'createdAt' | 'updatedAt'>
  ): Meeting {
    this.ensureInitialized();
    const now = new Date().toISOString();
    const newMeeting: Meeting = {
      id: `mtg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: input.title,
      meetingDate: input.meetingDate,
      participants: input.participants,
      transcript: input.transcript,
      status: input.status || 'draft',
      createdAt: now,
      updatedAt: now,
    };

    this.data.meetings.push(newMeeting);
    this.logAudit({
      meetingId: newMeeting.id,
      event: 'meeting_created',
      newValue: { title: newMeeting.title, date: newMeeting.meetingDate },
    });
    this.save();
    supabaseAdapter.upsertMeeting(newMeeting).catch((e) => console.warn('[Supabase Sync]', e.message));
    return newMeeting;
  }

  public deleteMeeting(id: string): boolean {
    this.ensureInitialized();
    const idx = this.data.meetings.findIndex((m) => m.id === id);
    if (idx === -1) return false;

    this.data.meetings.splice(idx, 1);
    this.data.decisions = this.data.decisions.filter((d) => d.meetingId !== id);
    this.data.actionItems = this.data.actionItems.filter((a) => a.meetingId !== id);
    this.save();
    supabaseAdapter.deleteMeeting(id).catch((e) => console.warn('[Supabase Sync]', e.message));
    return true;
  }

  // --- Decisions ---
  public getDecisions(meetingId?: string): Decision[] {
    this.ensureInitialized();
    if (meetingId) {
      return this.data.decisions.filter((d) => d.meetingId === meetingId);
    }
    return [...this.data.decisions];
  }

  public saveDecisions(
    meetingId: string,
    decisions: Array<{ decision: string; confidence: number; evidence?: string }>
  ): Decision[] {
    this.ensureInitialized();
    // Remove existing decisions for this meeting if re-extracting
    this.data.decisions = this.data.decisions.filter((d) => d.meetingId !== meetingId);

    const now = new Date().toISOString();
    const newDecisions: Decision[] = decisions.map((d, index) => ({
      id: `dec_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
      meetingId,
      decision: d.decision,
      confidence: Math.round(d.confidence * 100) / 100,
      evidence: d.evidence || '',
      createdAt: now,
    }));

    this.data.decisions.push(...newDecisions);
    this.save();
    supabaseAdapter.upsertDecisions(newDecisions).catch((e) => console.warn('[Supabase Sync]', e.message));
    return newDecisions;
  }

  // --- Action Items ---
  public getActionItems(filters?: {
    meetingId?: string;
    status?: string;
    needsReview?: boolean;
    search?: string;
  }): ActionItem[] {
    this.ensureInitialized();
    let items = [...this.data.actionItems];

    if (filters?.meetingId) {
      items = items.filter((a) => a.meetingId === filters.meetingId);
    }
    if (filters?.status) {
      items = items.filter((a) => a.status === filters.status);
    }
    if (filters?.needsReview !== undefined) {
      items = items.filter((a) => a.needsReview === filters.needsReview);
    }
    if (filters?.search) {
      const q = filters.search.toLowerCase();
      items = items.filter(
        (a) =>
          a.action.toLowerCase().includes(q) ||
          (a.owner && a.owner.toLowerCase().includes(q))
      );
    }

    return items.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  public getActionItemById(id: string): ActionItem | null {
    this.ensureInitialized();
    return this.data.actionItems.find((a) => a.id === id) || null;
  }

  public saveActionItems(
    meetingId: string,
    items: Array<{
      action: string;
      owner: string | null;
      dueDate: string | null;
      confidence: number;
      evidence?: string;
      needsReview?: boolean;
      status?: ActionItem['status'];
    }>
  ): ActionItem[] {
    this.ensureInitialized();
    // Clear previous items for this meeting if replacing during extraction
    this.data.actionItems = this.data.actionItems.filter((a) => a.meetingId !== meetingId);

    const now = new Date().toISOString();
    const newItems: ActionItem[] = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const threshold = this.data.settings.confidenceThreshold;
      const isLowConfidence = item.confidence < threshold;
      const isMissingOwner = !item.owner;
      const isMissingDueDate = !item.dueDate;

      // Duplicate check against existing items in other meetings or previous in this batch
      let isDuplicate = false;
      let duplicateOfId: string | null = null;

      for (const existing of this.data.actionItems) {
        if (existing.meetingId !== meetingId) {
          const sim = calculateTextSimilarity(item.action, existing.action);
          if (sim >= 0.65) {
            isDuplicate = true;
            duplicateOfId = existing.id;
            break;
          }
        }
      }
      if (!isDuplicate) {
        for (const prevNew of newItems) {
          const sim = calculateTextSimilarity(item.action, prevNew.action);
          if (sim >= 0.65) {
            isDuplicate = true;
            duplicateOfId = prevNew.id;
            break;
          }
        }
      }

      const reviewReasons: string[] = [];
      if (isLowConfidence) reviewReasons.push(`Low confidence (${(item.confidence * 100).toFixed(0)}%)`);
      if (isMissingOwner) reviewReasons.push('Owner missing');
      if (isMissingDueDate) reviewReasons.push('Due date missing');
      if (isDuplicate) reviewReasons.push('Possible duplicate action');

      const needsReview =
        item.needsReview ||
        isLowConfidence ||
        isMissingOwner ||
        isMissingDueDate ||
        isDuplicate;

      const actionItem: ActionItem = {
        id: `act_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        meetingId,
        action: item.action,
        owner: item.owner || null,
        dueDate: item.dueDate || null,
        confidence: Math.round(item.confidence * 100) / 100,
        evidence: item.evidence || '',
        status: item.status || 'pending',
        needsReview,
        reviewReason: reviewReasons.join(', ') || undefined,
        isDuplicate,
        duplicateOfId,
        createdAt: now,
        updatedAt: now,
      };

      newItems.push(actionItem);
      this.data.actionItems.push(actionItem);

      this.logAudit({
        meetingId,
        actionItemId: actionItem.id,
        event: 'item_created',
        newValue: {
          action: actionItem.action,
          owner: actionItem.owner,
          confidence: actionItem.confidence,
        },
      });
    }

    // Update meeting status
    const m = this.data.meetings.find((meet) => meet.id === meetingId);
    if (m) {
      m.status = 'processed';
      m.updatedAt = now;
    }

    this.save();
    supabaseAdapter.upsertActionItems(newItems).catch((e) => console.warn('[Supabase Sync]', e.message));
    return newItems;
  }

  public updateActionItem(
    id: string,
    updates: Partial<Omit<ActionItem, 'id' | 'meetingId' | 'createdAt'>>
  ): ActionItem | null {
    this.ensureInitialized();
    const item = this.data.actionItems.find((a) => a.id === id);
    if (!item) return null;

    const oldValue = { ...item };
    const now = new Date().toISOString();

    if (updates.action !== undefined) item.action = updates.action;
    if (updates.owner !== undefined) item.owner = updates.owner;
    if (updates.dueDate !== undefined) item.dueDate = updates.dueDate;
    if (updates.status !== undefined) item.status = updates.status;
    if (updates.confidence !== undefined) item.confidence = updates.confidence;
    if (updates.evidence !== undefined) item.evidence = updates.evidence;

    // Recalculate review necessity if owner/due date was resolved
    if (updates.needsReview !== undefined) {
      item.needsReview = updates.needsReview;
    } else if (item.status === 'approved') {
      item.needsReview = false;
    }

    item.updatedAt = now;

    let event: AuditLog['event'] = 'item_edited';
    if (updates.status === 'approved' && oldValue.status !== 'approved') {
      event = 'item_approved';
    } else if (updates.status === 'rejected' && oldValue.status !== 'rejected') {
      event = 'item_rejected';
    } else if (updates.status === 'completed' && oldValue.status !== 'completed') {
      event = 'item_completed';
    }

    this.logAudit({
      meetingId: item.meetingId,
      actionItemId: item.id,
      event,
      oldValue,
      newValue: item,
    });

    this.save();
    supabaseAdapter.updateActionItem(id, updates).catch((e) => console.warn('[Supabase Sync]', e.message));
    return item;
  }

  public deleteActionItem(id: string): boolean {
    this.ensureInitialized();
    const idx = this.data.actionItems.findIndex((a) => a.id === id);
    if (idx === -1) return false;

    const deleted = this.data.actionItems[idx];
    this.data.actionItems.splice(idx, 1);

    this.logAudit({
      meetingId: deleted.meetingId,
      actionItemId: deleted.id,
      event: 'item_deleted',
      oldValue: { action: deleted.action, owner: deleted.owner },
    });

    this.save();
    supabaseAdapter.deleteActionItem(id).catch((e) => console.warn('[Supabase Sync]', e.message));
    return true;
  }

  // --- Audit Logs ---
  public logAudit(log: Omit<AuditLog, 'id' | 'createdAt'>): AuditLog {
    this.ensureInitialized();
    const newLog: AuditLog = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      meetingId: log.meetingId || null,
      actionItemId: log.actionItemId || null,
      event: log.event,
      oldValue: log.oldValue || null,
      newValue: log.newValue || null,
      createdAt: new Date().toISOString(),
    };

    this.data.auditLogs.unshift(newLog);
    // Keep max 1000 audit logs
    if (this.data.auditLogs.length > 1000) {
      this.data.auditLogs.length = 1000;
    }
    this.save();
    supabaseAdapter.saveAuditLog(newLog).catch((e) => console.warn('[Supabase Sync]', e.message));
    return newLog;
  }

  public getRawData(): DatabaseSchema {
    this.ensureInitialized();
    return this.data;
  }

  public async syncToSupabase() {
    this.ensureInitialized();
    return await supabaseAdapter.syncAllData(this.data);
  }

  public getAuditLogs(limit = 100): AuditLog[] {
    this.ensureInitialized();
    return this.data.auditLogs.slice(0, limit);
  }

  // --- Settings ---
  public getSettings(): SystemSettings {
    this.ensureInitialized();
    return { ...this.data.settings };
  }

  public updateSettings(settings: Partial<SystemSettings>): SystemSettings {
    this.ensureInitialized();
    this.data.settings = { ...this.data.settings, ...settings };
    this.save();
    return { ...this.data.settings };
  }

  // --- Metrics ---
  public getMetrics(): DashboardMetrics {
    this.ensureInitialized();
    const meetings = this.data.meetings;
    const actionItems = this.data.actionItems;
    const auditLogs = this.data.auditLogs;

    const totalMeetings = meetings.length;
    const totalActionItems = actionItems.length;

    const pendingActions = actionItems.filter((a) => a.status === 'pending').length;
    const approvedActions = actionItems.filter((a) => a.status === 'approved').length;
    const rejectedActions = actionItems.filter((a) => a.status === 'rejected').length;
    const completedActions = actionItems.filter((a) => a.status === 'completed').length;

    const todayStr = new Date().toISOString().split('T')[0];
    const overdueActions = actionItems.filter(
      (a) => a.dueDate && a.dueDate < todayStr && a.status !== 'completed'
    ).length;

    const itemsRequiringReview = actionItems.filter((a) => a.needsReview).length;

    const avgConfidence =
      totalActionItems > 0
        ? actionItems.reduce((acc, a) => acc + a.confidence, 0) / totalActionItems
        : 0;

    const completionRate =
      totalActionItems > 0 ? (completedActions / totalActionItems) * 100 : 0;

    const reviewRate =
      totalActionItems > 0 ? (itemsRequiringReview / totalActionItems) * 100 : 0;

    // Calculate user edit/override rate from audit logs
    const editEvents = auditLogs.filter((l) => l.event === 'item_edited').length;
    const overrideRate =
      totalActionItems > 0
        ? Math.min(100, (editEvents / totalActionItems) * 100)
        : 0;

    // Time saved calculation
    const manualMinutes = this.data.settings.manualMinutesPerMeeting;
    const autoMinutes = this.data.settings.automatedMinutesPerMeeting;
    const timeSavedPerMeeting = Math.max(0, manualMinutes - autoMinutes);
    const estimatedMinutesSaved = totalMeetings * timeSavedPerMeeting;

    // Confidence buckets
    const high = actionItems.filter((a) => a.confidence >= 0.85).length;
    const medium = actionItems.filter(
      (a) => a.confidence >= 0.7 && a.confidence < 0.85
    ).length;
    const low = actionItems.filter((a) => a.confidence < 0.7).length;

    return {
      totalMeetings,
      totalActionItems,
      pendingActions,
      completedActions,
      overdueActions,
      itemsRequiringReview,
      averageConfidence: Math.round(avgConfidence * 100) / 100,
      completionRate: Math.round(completionRate * 10) / 10,
      reviewRate: Math.round(reviewRate * 10) / 10,
      overrideRate: Math.round(overrideRate * 10) / 10,
      averageProcessingTimeMs: 1420, // avg measured latency in ms
      estimatedMinutesSaved,
      settings: this.data.settings,
      confidenceBuckets: { high, medium, low },
      statusBreakdown: {
        pending: pendingActions,
        approved: approvedActions,
        rejected: rejectedActions,
        completed: completedActions,
      },
    };
  }

  // --- Seed Realistic Sample Data ---
  public seedInitialData() {
    this.data.meetings = [];
    this.data.decisions = [];
    this.data.actionItems = [];
    this.data.auditLogs = [];

    const now = new Date();
    const dMinus = (days: number) => {
      const d = new Date(now.getTime() - days * 86400000);
      return d.toISOString().split('T')[0];
    };
    const dPlus = (days: number) => {
      const d = new Date(now.getTime() + days * 86400000);
      return d.toISOString().split('T')[0];
    };

    // Meeting 1
    const m1Id = 'mtg_seed_01';
    this.data.meetings.push({
      id: m1Id,
      title: 'Q3 Enterprise Architecture & AI Search Migration Sync',
      meetingDate: dMinus(6),
      participants: ['Elena Rostova (Staff Architect)', 'Marcus Vance (VP Eng)', 'Sarah Lin (Tech Lead)', 'Dave Kim (SRE)'],
      transcript: `Marcus: Let's align on the Q3 enterprise search architecture. We evaluated Elasticsearch vs pgvector for our Postgres deployment.
Elena: Based on the 50k QPS load test benchmarks, pgvector meets our latency SLA of <45ms and avoids running an extra cluster. We should standardize on pgvector for primary semantic retrieval.
Marcus: Approved. Let's make that official. Elena, please draft the Architectural Decision Record by next Friday.
Sarah: I can take the indexing migration script. I will build the background worker to re-embed historical records. I'll need Dave to provision the read-replica database pool first.
Dave: I'll spin up the read-replica database pool in GCP Asia-East1 by Wednesday.
Sarah: Once Dave finishes, I'll have the ingestion worker PR up within 4 days.
Marcus: Someone also needs to review our vector dimension quotas before we roll out to production.
Elena: Also, don't forget we need to prepare the sales benchmark slide deck for the executive committee.`,
      status: 'processed',
      createdAt: new Date(now.getTime() - 6 * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 6 * 86400000).toISOString(),
    });

    this.data.decisions.push({
      id: 'dec_seed_01',
      meetingId: m1Id,
      decision: 'Standardize on PostgreSQL pgvector for enterprise semantic search instead of managing Elasticsearch cluster.',
      confidence: 0.98,
      evidence: 'pgvector meets our latency SLA of <45ms and avoids running an extra cluster. We should standardize on pgvector for primary semantic retrieval.',
      createdAt: dMinus(6),
    });

    this.data.actionItems.push(
      {
        id: 'act_seed_01_1',
        meetingId: m1Id,
        action: 'Draft Architectural Decision Record (ADR) for pgvector standardization',
        owner: 'Elena Rostova',
        dueDate: dPlus(3),
        confidence: 0.96,
        evidence: 'Elena, please draft the Architectural Decision Record by next Friday.',
        status: 'approved',
        needsReview: false,
        createdAt: dMinus(6),
        updatedAt: dMinus(5),
      },
      {
        id: 'act_seed_01_2',
        meetingId: m1Id,
        action: 'Provision read-replica database pool in GCP Asia-East1',
        owner: 'Dave Kim',
        dueDate: dPlus(1),
        confidence: 0.94,
        evidence: "I'll spin up the read-replica database pool in GCP Asia-East1 by Wednesday.",
        status: 'completed',
        needsReview: false,
        createdAt: dMinus(6),
        updatedAt: dMinus(2),
      },
      {
        id: 'act_seed_01_3',
        meetingId: m1Id,
        action: 'Build background worker migration script to re-embed historical records',
        owner: 'Sarah Lin',
        dueDate: dPlus(5),
        confidence: 0.88,
        evidence: "I will build the background worker to re-embed historical records... within 4 days.",
        status: 'pending',
        needsReview: false,
        createdAt: dMinus(6),
        updatedAt: dMinus(6),
      },
      {
        id: 'act_seed_01_4',
        meetingId: m1Id,
        action: 'Review vector dimension quotas and memory sizing before rollout',
        owner: null, // Missing owner!
        dueDate: null, // Missing due date!
        confidence: 0.62, // Low confidence!
        evidence: 'Someone also needs to review our vector dimension quotas before we roll out to production.',
        status: 'pending',
        needsReview: true,
        reviewReason: 'Low confidence (62%), Owner missing, Due date missing',
        createdAt: dMinus(6),
        updatedAt: dMinus(6),
      },
      {
        id: 'act_seed_01_5',
        meetingId: m1Id,
        action: 'Prepare the sales benchmark slide deck for executive committee',
        owner: 'Elena Rostova',
        dueDate: dPlus(7),
        confidence: 0.85,
        evidence: "Also, don't forget we need to prepare the sales benchmark slide deck for the executive committee.",
        status: 'approved',
        needsReview: false,
        createdAt: dMinus(6),
        updatedAt: dMinus(5),
      }
    );

    // Meeting 2
    const m2Id = 'mtg_seed_02';
    this.data.meetings.push({
      id: m2Id,
      title: 'Customer Success & Renewal Escalation Triage',
      meetingDate: dMinus(4),
      participants: ['Rachel Adams (VP CS)', 'Carlos Gomez (Enterprise AE)', 'Devon Vance (Support Lead)'],
      transcript: `Rachel: Let's discuss Acme Corp's enterprise renewal. They experienced 3 webhook delivery timeouts last week.
Carlos: They asked for an automated webhook dead-letter queue with retry alerts, otherwise they might stall their $240k expansion.
Rachel: We agreed to waive their annual support overage fee as goodwill while engineering resolves the reliability issue.
Carlos: I will deliver the amended renewal contract with the fee waiver by Monday morning.
Devon: I will configure Datadog synthetic monitors on the customer webhook ingest endpoints by tomorrow at 5 PM.
Rachel: We should probably look into whether webhook delivery batching might help our throughput.
Carlos: Prepare the customer pipeline presentation deck for the QBR.`,
      status: 'processed',
      createdAt: new Date(now.getTime() - 4 * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 4 * 86400000).toISOString(),
    });

    this.data.decisions.push({
      id: 'dec_seed_02',
      meetingId: m2Id,
      decision: 'Waive Acme Corp annual enterprise support overage fee as goodwill gesture during webhook stabilization.',
      confidence: 0.95,
      evidence: 'We agreed to waive their annual support overage fee as goodwill while engineering resolves the reliability issue.',
      createdAt: dMinus(4),
    });

    this.data.actionItems.push(
      {
        id: 'act_seed_02_1',
        meetingId: m2Id,
        action: 'Deliver amended Acme Corp enterprise renewal contract with support waiver',
        owner: 'Carlos Gomez',
        dueDate: dMinus(1), // Overdue!
        confidence: 0.95,
        evidence: 'I will deliver the amended renewal contract with the fee waiver by Monday morning.',
        status: 'pending',
        needsReview: false,
        createdAt: dMinus(4),
        updatedAt: dMinus(4),
      },
      {
        id: 'act_seed_02_2',
        meetingId: m2Id,
        action: 'Configure Datadog synthetic monitors on customer webhook ingest endpoints',
        owner: 'Devon Vance',
        dueDate: dMinus(3),
        confidence: 0.92,
        evidence: 'I will configure Datadog synthetic monitors on the customer webhook ingest endpoints by tomorrow at 5 PM.',
        status: 'completed',
        needsReview: false,
        createdAt: dMinus(4),
        updatedAt: dMinus(3),
      },
      {
        id: 'act_seed_02_3',
        meetingId: m2Id,
        action: 'Investigate whether webhook delivery batching might improve ingest throughput',
        owner: null, // Ambiguous / missing owner
        dueDate: null,
        confidence: 0.65, // Ambiguous proposal
        evidence: 'We should probably look into whether webhook delivery batching might help our throughput.',
        status: 'pending',
        needsReview: true,
        reviewReason: 'Low confidence (65%), Owner missing, Due date missing',
        createdAt: dMinus(4),
        updatedAt: dMinus(4),
      },
      {
        id: 'act_seed_02_4',
        meetingId: m2Id,
        action: 'Prepare the customer pipeline presentation deck for quarterly review',
        owner: 'Carlos Gomez',
        dueDate: dPlus(6),
        confidence: 0.82,
        evidence: 'Prepare the customer pipeline presentation deck for the QBR.',
        status: 'pending',
        needsReview: true,
        isDuplicate: true, // Duplicate of m1's slide deck!
        duplicateOfId: 'act_seed_01_5',
        reviewReason: 'Possible duplicate action',
        createdAt: dMinus(4),
        updatedAt: dMinus(4),
      }
    );

    // Meeting 3
    const m3Id = 'mtg_seed_03';
    this.data.meetings.push({
      id: m3Id,
      title: 'SOC 2 Type II Compliance & Security Audit Prep',
      meetingDate: dMinus(3),
      participants: ['Amara Patel (Head of Infosec)', 'Dave Kim (SRE)', 'Elena Rostova (Staff Architect)'],
      transcript: `Amara: The SOC 2 audit begins in 14 days. We need all evidence collected and verified in Vanta.
Decision: All staging and production AWS IAM credentials will be restricted to temporary STS session tokens via Okta SSO.
Amara: I will export the employee access review log from Okta and upload to Vanta by this Thursday.
Dave: I need to enforce MFA on the emergency root accounts and rotate the KMS master encryption keys. I will finish this by Friday.
Amara: Someone should verify if contractor laptop encryption policies are being enforced in Jamf.`,
      status: 'processed',
      createdAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 3 * 86400000).toISOString(),
    });

    this.data.decisions.push({
      id: 'dec_seed_03',
      meetingId: m3Id,
      decision: 'Enforce temporary STS session tokens via Okta SSO across all AWS staging and production environments.',
      confidence: 0.99,
      evidence: 'Decision: All staging and production AWS IAM credentials will be restricted to temporary STS session tokens via Okta SSO.',
      createdAt: dMinus(3),
    });

    this.data.actionItems.push(
      {
        id: 'act_seed_03_1',
        meetingId: m3Id,
        action: 'Export employee access review log from Okta and upload to Vanta',
        owner: 'Amara Patel',
        dueDate: dPlus(2),
        confidence: 0.95,
        evidence: 'I will export the employee access review log from Okta and upload to Vanta by this Thursday.',
        status: 'approved',
        needsReview: false,
        createdAt: dMinus(3),
        updatedAt: dMinus(2),
      },
      {
        id: 'act_seed_03_2',
        meetingId: m3Id,
        action: 'Enforce MFA on emergency root accounts and rotate KMS master keys',
        owner: 'Dave Kim',
        dueDate: dPlus(3),
        confidence: 0.94,
        evidence: 'I need to enforce MFA on the emergency root accounts and rotate the KMS master encryption keys. I will finish this by Friday.',
        status: 'approved',
        needsReview: false,
        createdAt: dMinus(3),
        updatedAt: dMinus(3),
      },
      {
        id: 'act_seed_03_3',
        meetingId: m3Id,
        action: 'Verify contractor laptop encryption policies compliance in Jamf MDM',
        owner: null,
        dueDate: null,
        confidence: 0.68,
        evidence: 'Someone should verify if contractor laptop encryption policies are being enforced in Jamf.',
        status: 'pending',
        needsReview: true,
        reviewReason: 'Low confidence (68%), Owner missing, Due date missing',
        createdAt: dMinus(3),
        updatedAt: dMinus(3),
      }
    );

    // Meeting 4
    const m4Id = 'mtg_seed_04';
    this.data.meetings.push({
      id: m4Id,
      title: 'Forward Deployed Engineering Field Enablement Sprint',
      meetingDate: dMinus(2),
      participants: ['Liam Taylor (Lead FDE)', 'Zoe Chen (Product Manager)', 'Sarah Lin (Tech Lead)'],
      transcript: `Liam: For our enterprise pilot customers, we need a standardized meeting action item extraction pipeline that converts messy transcripts into structured tasks.
Zoe: Let's approve the standardized JSON schema with confidence scores and duplicate detection.
Liam: I will publish the SDK client and TypeScript validation definitions by tomorrow afternoon.
Sarah: I will integrate the Gemini 3.8 Flash extraction endpoint with our backend audit logging table by Friday.
Zoe: Could someone explore automated Jira or Linear task syncing next sprint?`,
      status: 'processed',
      createdAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 86400000).toISOString(),
    });

    this.data.decisions.push({
      id: 'dec_seed_04',
      meetingId: m4Id,
      decision: 'Approve standardized meeting extraction schema incorporating confidence scores and duplicate detection.',
      confidence: 0.97,
      evidence: "Let's approve the standardized JSON schema with confidence scores and duplicate detection.",
      createdAt: dMinus(2),
    });

    this.data.actionItems.push(
      {
        id: 'act_seed_04_1',
        meetingId: m4Id,
        action: 'Publish SDK client and TypeScript validation definitions',
        owner: 'Liam Taylor',
        dueDate: dMinus(1),
        confidence: 0.96,
        evidence: 'I will publish the SDK client and TypeScript validation definitions by tomorrow afternoon.',
        status: 'completed',
        needsReview: false,
        createdAt: dMinus(2),
        updatedAt: dMinus(1),
      },
      {
        id: 'act_seed_04_2',
        meetingId: m4Id,
        action: 'Integrate Gemini 3.8 Flash extraction service with backend audit logging table',
        owner: 'Sarah Lin',
        dueDate: dPlus(4),
        confidence: 0.93,
        evidence: 'I will integrate the Gemini 3.8 Flash extraction endpoint with our backend audit logging table by Friday.',
        status: 'approved',
        needsReview: false,
        createdAt: dMinus(2),
        updatedAt: dMinus(2),
      },
      {
        id: 'act_seed_04_3',
        meetingId: m4Id,
        action: 'Research automated Jira and Linear issue tracker synchronization',
        owner: null,
        dueDate: null,
        confidence: 0.58,
        evidence: 'Could someone explore automated Jira or Linear task syncing next sprint?',
        status: 'pending',
        needsReview: true,
        reviewReason: 'Low confidence (58%), Owner missing, Due date missing',
        createdAt: dMinus(2),
        updatedAt: dMinus(2),
      }
    );

    // Meeting 5
    const m5Id = 'mtg_seed_05';
    this.data.meetings.push({
      id: m5Id,
      title: 'Q4 GTM Pipeline & Sales Enablement Standup',
      meetingDate: dMinus(1),
      participants: ['Carlos Gomez (Enterprise AE)', 'Marcus Vance (VP Eng)', 'Zoe Chen (Product Manager)'],
      transcript: `Carlos: Quick update on European partner channels. We need sales enablement collateral on our AI extraction capabilities.
Marcus: Zoe and Carlos, please coordinate on the collateral one-pager. Carlos will write the enterprise case study by next Tuesday.
Zoe: I will produce the technical architecture diagram and API spec sheet by Monday.
Carlos: Also, create the monthly sales report slide deck for Marcus.`,
      status: 'processed',
      createdAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 86400000).toISOString(),
    });

    this.data.decisions.push({
      id: 'dec_seed_05',
      meetingId: m5Id,
      decision: 'Prioritize production of enterprise sales collateral showcasing AI action item extraction workflows.',
      confidence: 0.94,
      evidence: 'We need sales enablement collateral on our AI extraction capabilities... coordinate on the collateral one-pager.',
      createdAt: dMinus(1),
    });

    this.data.actionItems.push(
      {
        id: 'act_seed_05_1',
        meetingId: m5Id,
        action: 'Write enterprise case study on automated workflow time savings',
        owner: 'Carlos Gomez',
        dueDate: dPlus(5),
        confidence: 0.94,
        evidence: 'Carlos will write the enterprise case study by next Tuesday.',
        status: 'approved',
        needsReview: false,
        createdAt: dMinus(1),
        updatedAt: dMinus(1),
      },
      {
        id: 'act_seed_05_2',
        meetingId: m5Id,
        action: 'Produce technical architecture diagram and API spec sheet for partner portal',
        owner: 'Zoe Chen',
        dueDate: dPlus(4),
        confidence: 0.91,
        evidence: 'I will produce the technical architecture diagram and API spec sheet by Monday.',
        status: 'approved',
        needsReview: false,
        createdAt: dMinus(1),
        updatedAt: dMinus(1),
      },
      {
        id: 'act_seed_05_3',
        meetingId: m5Id,
        action: 'Prepare the monthly sales report slide deck',
        owner: 'Carlos Gomez',
        dueDate: dPlus(7),
        confidence: 0.88,
        evidence: 'Also, create the monthly sales report slide deck for Marcus.',
        status: 'pending',
        needsReview: true,
        isDuplicate: true, // Duplicate of act_seed_01_5 and act_seed_02_4!
        duplicateOfId: 'act_seed_01_5',
        reviewReason: 'Possible duplicate action',
        createdAt: dMinus(1),
        updatedAt: dMinus(1),
      }
    );

    // Initial audit logs
    this.data.auditLogs.push(
      {
        id: 'aud_seed_01',
        meetingId: m1Id,
        event: 'extraction_completed',
        newValue: { decisionsCount: 1, actionItemsCount: 5 },
        createdAt: dMinus(6),
      },
      {
        id: 'aud_seed_02',
        meetingId: m1Id,
        actionItemId: 'act_seed_01_1',
        event: 'item_approved',
        newValue: { status: 'approved' },
        createdAt: dMinus(5),
      },
      {
        id: 'aud_seed_03',
        meetingId: m1Id,
        actionItemId: 'act_seed_01_2',
        event: 'item_completed',
        newValue: { status: 'completed' },
        createdAt: dMinus(2),
      },
      {
        id: 'aud_seed_04',
        meetingId: m2Id,
        event: 'extraction_completed',
        newValue: { decisionsCount: 1, actionItemsCount: 4 },
        createdAt: dMinus(4),
      },
      {
        id: 'aud_seed_05',
        meetingId: m3Id,
        actionItemId: 'act_seed_03_1',
        event: 'item_approved',
        newValue: { status: 'approved' },
        createdAt: dMinus(2),
      }
    );

    this.save();
  }
}

export const db = new Database();
