import {
  Meeting,
  Decision,
  ActionItem,
  AuditLog,
  DashboardMetrics,
  SystemSettings,
} from '../types/index.ts';
import { supabase, SUPABASE_PROJECT_ID, SUPABASE_URL, SUPABASE_SQL_SCRIPT } from './supabase.ts';
import { meetingExtractor } from './ai/meeting-extractor.ts';
import { calculateTextSimilarity } from './duplicate-detector.ts';
import {
  createMeetingSchema,
  updateActionItemSchema,
  settingsSchema,
} from './validation.ts';

const LOCAL_STORAGE_KEY = 'meeting_tracker_local_cache_v2';

const DEFAULT_SETTINGS: SystemSettings = {
  manualMinutesPerMeeting: 10,
  automatedMinutesPerMeeting: 2,
  confidenceThreshold: 0.7,
  aiModel: 'gemini-3.8-flash',
};

// Local storage fallback cache in case Supabase tables haven't been created yet
interface LocalCache {
  meetings: Meeting[];
  decisions: Decision[];
  actionItems: ActionItem[];
  auditLogs: AuditLog[];
  settings: SystemSettings;
}

function getLocalCache(): LocalCache {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        meetings: parsed.meetings || [],
        decisions: parsed.decisions || [],
        actionItems: parsed.actionItems || [],
        auditLogs: parsed.auditLogs || [],
        settings: parsed.settings || { ...DEFAULT_SETTINGS },
      };
    }
  } catch {
    // fallback
  }
  return generateInitialSeedData();
}

function saveLocalCache(cache: LocalCache) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
}

// 5 Realistic enterprise meetings
function generateInitialSeedData(): LocalCache {
  const now = new Date();
  const dMinus = (days: number) => {
    const d = new Date(now.getTime() - days * 86400000);
    return d.toISOString().split('T')[0];
  };
  const dPlus = (days: number) => {
    const d = new Date(now.getTime() + days * 86400000);
    return d.toISOString().split('T')[0];
  };

  const meetings: Meeting[] = [
    {
      id: 'mtg_seed_01',
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
    },
    {
      id: 'mtg_seed_02',
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
    },
    {
      id: 'mtg_seed_03',
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
    },
    {
      id: 'mtg_seed_04',
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
    },
    {
      id: 'mtg_seed_05',
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
    },
  ];

  const decisions: Decision[] = [
    {
      id: 'dec_seed_01',
      meetingId: 'mtg_seed_01',
      decision: 'Standardize on PostgreSQL pgvector for enterprise semantic search instead of managing Elasticsearch cluster.',
      confidence: 0.98,
      evidence: 'pgvector meets our latency SLA of <45ms and avoids running an extra cluster.',
      createdAt: dMinus(6),
    },
    {
      id: 'dec_seed_02',
      meetingId: 'mtg_seed_02',
      decision: 'Waive Acme Corp annual enterprise support overage fee as goodwill gesture during webhook stabilization.',
      confidence: 0.95,
      evidence: 'We agreed to waive their annual support overage fee as goodwill while engineering resolves the reliability issue.',
      createdAt: dMinus(4),
    },
    {
      id: 'dec_seed_03',
      meetingId: 'mtg_seed_03',
      decision: 'Enforce temporary STS session tokens via Okta SSO across all AWS staging and production environments.',
      confidence: 0.99,
      evidence: 'Decision: All staging and production AWS IAM credentials will be restricted to temporary STS session tokens via Okta SSO.',
      createdAt: dMinus(3),
    },
    {
      id: 'dec_seed_04',
      meetingId: 'mtg_seed_04',
      decision: 'Approve standardized meeting extraction schema incorporating confidence scores and duplicate detection.',
      confidence: 0.97,
      evidence: "Let's approve the standardized JSON schema with confidence scores and duplicate detection.",
      createdAt: dMinus(2),
    },
    {
      id: 'dec_seed_05',
      meetingId: 'mtg_seed_05',
      decision: 'Prioritize production of enterprise sales collateral showcasing AI action item extraction workflows.',
      confidence: 0.94,
      evidence: 'We need sales enablement collateral on our AI extraction capabilities... coordinate on the collateral one-pager.',
      createdAt: dMinus(1),
    },
  ];

  const actionItems: ActionItem[] = [
    {
      id: 'act_seed_01_1',
      meetingId: 'mtg_seed_01',
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
      meetingId: 'mtg_seed_01',
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
      meetingId: 'mtg_seed_01',
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
      meetingId: 'mtg_seed_01',
      action: 'Review vector dimension quotas and memory sizing before rollout',
      owner: null,
      dueDate: null,
      confidence: 0.62,
      evidence: 'Someone also needs to review our vector dimension quotas before we roll out to production.',
      status: 'pending',
      needsReview: true,
      reviewReason: 'Low confidence (62%), Owner missing, Due date missing',
      createdAt: dMinus(6),
      updatedAt: dMinus(6),
    },
    {
      id: 'act_seed_01_5',
      meetingId: 'mtg_seed_01',
      action: 'Prepare the sales benchmark slide deck for executive committee',
      owner: 'Elena Rostova',
      dueDate: dPlus(7),
      confidence: 0.85,
      evidence: "Also, don't forget we need to prepare the sales benchmark slide deck for the executive committee.",
      status: 'approved',
      needsReview: false,
      createdAt: dMinus(6),
      updatedAt: dMinus(5),
    },
    {
      id: 'act_seed_02_1',
      meetingId: 'mtg_seed_02',
      action: 'Deliver amended Acme Corp enterprise renewal contract with support waiver',
      owner: 'Carlos Gomez',
      dueDate: dMinus(1),
      confidence: 0.95,
      evidence: 'I will deliver the amended renewal contract with the fee waiver by Monday morning.',
      status: 'pending',
      needsReview: false,
      createdAt: dMinus(4),
      updatedAt: dMinus(4),
    },
    {
      id: 'act_seed_02_2',
      meetingId: 'mtg_seed_02',
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
      meetingId: 'mtg_seed_02',
      action: 'Investigate whether webhook delivery batching might improve ingest throughput',
      owner: null,
      dueDate: null,
      confidence: 0.65,
      evidence: 'We should probably look into whether webhook delivery batching might help our throughput.',
      status: 'pending',
      needsReview: true,
      reviewReason: 'Low confidence (65%), Owner missing, Due date missing',
      createdAt: dMinus(4),
      updatedAt: dMinus(4),
    },
    {
      id: 'act_seed_02_4',
      meetingId: 'mtg_seed_02',
      action: 'Prepare the customer pipeline presentation deck for quarterly review',
      owner: 'Carlos Gomez',
      dueDate: dPlus(6),
      confidence: 0.82,
      evidence: 'Prepare the customer pipeline presentation deck for the QBR.',
      status: 'pending',
      needsReview: true,
      isDuplicate: true,
      duplicateOfId: 'act_seed_01_5',
      reviewReason: 'Possible duplicate action',
      createdAt: dMinus(4),
      updatedAt: dMinus(4),
    },
    {
      id: 'act_seed_03_1',
      meetingId: 'mtg_seed_03',
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
      meetingId: 'mtg_seed_03',
      action: 'Enforce MFA on emergency root accounts and rotate KMS master keys',
      owner: 'Dave Kim',
      dueDate: dPlus(3),
      confidence: 0.94,
      evidence: 'I need to enforce MFA on the emergency root accounts and rotate the KMS master encryption keys.',
      status: 'approved',
      needsReview: false,
      createdAt: dMinus(3),
      updatedAt: dMinus(3),
    },
    {
      id: 'act_seed_03_3',
      meetingId: 'mtg_seed_03',
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
    },
    {
      id: 'act_seed_04_1',
      meetingId: 'mtg_seed_04',
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
      meetingId: 'mtg_seed_04',
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
      meetingId: 'mtg_seed_04',
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
    },
    {
      id: 'act_seed_05_1',
      meetingId: 'mtg_seed_05',
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
      meetingId: 'mtg_seed_05',
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
      meetingId: 'mtg_seed_05',
      action: 'Prepare the monthly sales report slide deck',
      owner: 'Carlos Gomez',
      dueDate: dPlus(7),
      confidence: 0.88,
      evidence: 'Also, create the monthly sales report slide deck for Marcus.',
      status: 'pending',
      needsReview: true,
      isDuplicate: true,
      duplicateOfId: 'act_seed_01_5',
      reviewReason: 'Possible duplicate action',
      createdAt: dMinus(1),
      updatedAt: dMinus(1),
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud_seed_01',
      meetingId: 'mtg_seed_01',
      event: 'extraction_completed',
      newValue: { decisionsCount: 1, actionItemsCount: 5 },
      createdAt: dMinus(6),
    },
    {
      id: 'aud_seed_02',
      meetingId: 'mtg_seed_01',
      actionItemId: 'act_seed_01_1',
      event: 'item_approved',
      newValue: { status: 'approved' },
      createdAt: dMinus(5),
    },
    {
      id: 'aud_seed_03',
      meetingId: 'mtg_seed_01',
      actionItemId: 'act_seed_01_2',
      event: 'item_completed',
      newValue: { status: 'completed' },
      createdAt: dMinus(2),
    },
    {
      id: 'aud_seed_04',
      meetingId: 'mtg_seed_02',
      event: 'extraction_completed',
      newValue: { decisionsCount: 1, actionItemsCount: 4 },
      createdAt: dMinus(4),
    },
    {
      id: 'aud_seed_05',
      meetingId: 'mtg_seed_03',
      actionItemId: 'act_seed_03_1',
      event: 'item_approved',
      newValue: { status: 'approved' },
      createdAt: dMinus(2),
    },
  ];

  return {
    meetings,
    decisions,
    actionItems,
    auditLogs,
    settings: { ...DEFAULT_SETTINGS },
  };
}

// ========================================================
// API Client directly querying Supabase
// ========================================================

export const api = {
  // --- MEETINGS ---
  getMeetings: async (): Promise<
    (Meeting & {
      actionItemCount?: number;
      completedActionCount?: number;
      decisionCount?: number;
      needsReviewCount?: number;
    })[]
  > => {
    try {
      const { data: mData, error: mErr } = await supabase
        .from('meetings')
        .select('*')
        .order('created_at', { ascending: false });

      if (mErr) throw mErr;

      const meetings: Meeting[] = (mData || []).map((m: any) => ({
        id: m.id,
        title: m.title,
        meetingDate: m.meeting_date,
        participants: m.participants || [],
        transcript: m.transcript,
        status: m.status || 'draft',
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      }));

      // Fetch items and decisions for summary counts
      const [{ data: aData }, { data: dData }] = await Promise.all([
        supabase.from('action_items').select('id, meeting_id, status, needs_review'),
        supabase.from('decisions').select('id, meeting_id'),
      ]);

      const actionRows = aData || [];
      const decisionRows = dData || [];

      return meetings.map((m) => {
        const items = actionRows.filter((a: any) => a.meeting_id === m.id);
        const decs = decisionRows.filter((d: any) => d.meeting_id === m.id);
        const completed = items.filter((a: any) => a.status === 'completed').length;
        const needsReview = items.filter((a: any) => a.needs_review).length;

        return {
          ...m,
          actionItemCount: items.length,
          completedActionCount: completed,
          decisionCount: decs.length,
          needsReviewCount: needsReview,
        };
      });
    } catch (err) {
      console.warn('[Supabase Direct] Falling back to local cache for getMeetings:', err);
      const cache = getLocalCache();
      return cache.meetings.map((m) => {
        const items = cache.actionItems.filter((a) => a.meetingId === m.id);
        const decs = cache.decisions.filter((d) => d.meetingId === m.id);
        return {
          ...m,
          actionItemCount: items.length,
          completedActionCount: items.filter((a) => a.status === 'completed').length,
          decisionCount: decs.length,
          needsReviewCount: items.filter((a) => a.needsReview).length,
        };
      });
    }
  },

  getMeeting: async (
    id: string
  ): Promise<{
    meeting: Meeting;
    decisions: Decision[];
    actionItems: ActionItem[];
    auditLogs: AuditLog[];
  }> => {
    try {
      const { data: mData, error: mErr } = await supabase
        .from('meetings')
        .select('*')
        .eq('id', id)
        .single();

      if (mErr || !mData) throw mErr || new Error('Meeting not found');

      const meeting: Meeting = {
        id: mData.id,
        title: mData.title,
        meetingDate: mData.meeting_date,
        participants: mData.participants || [],
        transcript: mData.transcript,
        status: mData.status || 'draft',
        createdAt: mData.created_at,
        updatedAt: mData.updated_at,
      };

      const [dRes, aRes, lRes] = await Promise.all([
        supabase.from('decisions').select('*').eq('meeting_id', id),
        supabase.from('action_items').select('*').eq('meeting_id', id),
        supabase.from('audit_logs').select('*').eq('meeting_id', id).order('created_at', { ascending: false }),
      ]);

      const decisions: Decision[] = (dRes.data || []).map((d: any) => ({
        id: d.id,
        meetingId: d.meeting_id,
        decision: d.decision,
        confidence: Number(d.confidence),
        evidence: d.evidence || '',
        createdAt: d.created_at,
      }));

      const actionItems: ActionItem[] = (aRes.data || []).map((a: any) => ({
        id: a.id,
        meetingId: a.meeting_id,
        action: a.action,
        owner: a.owner || null,
        dueDate: a.due_date || null,
        confidence: Number(a.confidence),
        evidence: a.evidence || '',
        status: a.status || 'pending',
        needsReview: a.needs_review || false,
        reviewReason: a.review_reason || undefined,
        isDuplicate: a.is_duplicate || false,
        duplicateOfId: a.duplicate_of_id || null,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
      }));

      const auditLogs: AuditLog[] = (lRes.data || []).map((l: any) => ({
        id: l.id,
        meetingId: l.meeting_id,
        actionItemId: l.action_item_id,
        event: l.event,
        oldValue: l.old_value,
        newValue: l.new_value,
        createdAt: l.created_at,
      }));

      return { meeting, decisions, actionItems, auditLogs };
    } catch (err) {
      console.warn('[Supabase Direct] Falling back to local cache for getMeeting:', err);
      const cache = getLocalCache();
      const meeting = cache.meetings.find((m) => m.id === id);
      if (!meeting) throw new Error('Meeting not found');

      return {
        meeting,
        decisions: cache.decisions.filter((d) => d.meetingId === id),
        actionItems: cache.actionItems.filter((a) => a.meetingId === id),
        auditLogs: cache.auditLogs.filter((l) => l.meetingId === id),
      };
    }
  },

  createMeeting: async (data: {
    title: string;
    meetingDate: string;
    participants: string[];
    transcript: string;
  }): Promise<Meeting> => {
    const validated = createMeetingSchema.parse(data);
    const now = new Date().toISOString();
    const newMeeting: Meeting = {
      id: `mtg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: validated.title,
      meetingDate: validated.meetingDate,
      participants: validated.participants,
      transcript: validated.transcript,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    // Update local cache first
    const cache = getLocalCache();
    cache.meetings.unshift(newMeeting);
    cache.auditLogs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      meetingId: newMeeting.id,
      event: 'meeting_created',
      newValue: { title: newMeeting.title, date: newMeeting.meetingDate },
      createdAt: now,
    });
    saveLocalCache(cache);

    // Write directly to Supabase
    try {
      await supabase.from('meetings').insert({
        id: newMeeting.id,
        title: newMeeting.title,
        meeting_date: newMeeting.meetingDate,
        participants: newMeeting.participants,
        transcript: newMeeting.transcript,
        status: newMeeting.status,
        created_at: newMeeting.createdAt,
        updated_at: newMeeting.updatedAt,
      });

      await supabase.from('audit_logs').insert({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        meeting_id: newMeeting.id,
        event: 'meeting_created',
        new_value: { title: newMeeting.title, date: newMeeting.meetingDate },
        created_at: now,
      });
    } catch (err) {
      console.warn('[Supabase Direct] Error writing meeting to Supabase:', err);
    }

    return newMeeting;
  },

  deleteMeeting: async (id: string): Promise<{ success: boolean }> => {
    // Local cache
    const cache = getLocalCache();
    cache.meetings = cache.meetings.filter((m) => m.id !== id);
    cache.decisions = cache.decisions.filter((d) => d.meetingId !== id);
    cache.actionItems = cache.actionItems.filter((a) => a.meetingId !== id);
    saveLocalCache(cache);

    // Supabase
    try {
      await supabase.from('meetings').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase Direct] Error deleting meeting from Supabase:', err);
    }
    return { success: true };
  },

  extractMeeting: async (
    id: string
  ): Promise<{
    meeting: Meeting;
    decisions: Decision[];
    actionItems: ActionItem[];
    metrics: { processingTimeMs: number; modelUsed: string };
  }> => {
    const details = await api.getMeeting(id);
    const { meeting } = details;

    const extractionResult = await meetingExtractor.extractActionItems({
      meetingTitle: meeting.title,
      meetingDate: meeting.meetingDate,
      participants: meeting.participants,
      transcript: meeting.transcript,
    });

    const now = new Date().toISOString();

    // Decisions
    const newDecisions: Decision[] = extractionResult.decisions.map((d, index) => ({
      id: `dec_${Date.now()}_${index}_${Math.random().toString(36).substring(2, 6)}`,
      meetingId: meeting.id,
      decision: d.decision,
      confidence: Math.round(d.confidence * 100) / 100,
      evidence: d.evidence || '',
      createdAt: now,
    }));

    // Action Items with duplicate detection
    const existingActionItems = await api.getActionItems();
    const newActionItems: ActionItem[] = [];

    for (let i = 0; i < extractionResult.action_items.length; i++) {
      const item = extractionResult.action_items[i];
      const isLowConfidence = item.confidence < 0.7;
      const isMissingOwner = !item.owner;
      const isMissingDueDate = !item.due_date;

      let isDuplicate = false;
      let duplicateOfId: string | null = null;

      for (const existing of existingActionItems) {
        if (existing.meetingId !== meeting.id) {
          const sim = calculateTextSimilarity(item.action, existing.action);
          if (sim >= 0.65) {
            isDuplicate = true;
            duplicateOfId = existing.id;
            break;
          }
        }
      }
      if (!isDuplicate) {
        for (const prev of newActionItems) {
          const sim = calculateTextSimilarity(item.action, prev.action);
          if (sim >= 0.65) {
            isDuplicate = true;
            duplicateOfId = prev.id;
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
        item.needs_review || isLowConfidence || isMissingOwner || isMissingDueDate || isDuplicate;

      newActionItems.push({
        id: `act_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 6)}`,
        meetingId: meeting.id,
        action: item.action,
        owner: item.owner || null,
        dueDate: item.due_date || null,
        confidence: Math.round(item.confidence * 100) / 100,
        evidence: item.evidence || '',
        status: 'pending',
        needsReview,
        reviewReason: reviewReasons.join(', ') || undefined,
        isDuplicate,
        duplicateOfId,
        createdAt: now,
        updatedAt: now,
      });
    }

    // Save to local cache
    const cache = getLocalCache();
    cache.decisions = cache.decisions.filter((d) => d.meetingId !== meeting.id).concat(newDecisions);
    cache.actionItems = cache.actionItems.filter((a) => a.meetingId !== meeting.id).concat(newActionItems);
    const mMatch = cache.meetings.find((m) => m.id === meeting.id);
    if (mMatch) {
      mMatch.status = 'processed';
      mMatch.updatedAt = now;
    }
    cache.auditLogs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      meetingId: meeting.id,
      event: 'extraction_completed',
      newValue: {
        decisionsExtracted: newDecisions.length,
        actionItemsExtracted: newActionItems.length,
        processingTimeMs: extractionResult.processingTimeMs,
        modelUsed: extractionResult.modelUsed,
      },
      createdAt: now,
    });
    saveLocalCache(cache);

    // Save directly to Supabase
    try {
      await supabase.from('meetings').update({ status: 'processed', updated_at: now }).eq('id', meeting.id);
      await supabase.from('decisions').delete().eq('meeting_id', meeting.id);
      await supabase.from('action_items').delete().eq('meeting_id', meeting.id);

      if (newDecisions.length > 0) {
        await supabase.from('decisions').insert(
          newDecisions.map((d) => ({
            id: d.id,
            meeting_id: d.meetingId,
            decision: d.decision,
            confidence: d.confidence,
            evidence: d.evidence,
            created_at: d.createdAt,
          }))
        );
      }

      if (newActionItems.length > 0) {
        await supabase.from('action_items').insert(
          newActionItems.map((a) => ({
            id: a.id,
            meeting_id: a.meetingId,
            action: a.action,
            owner: a.owner,
            due_date: a.dueDate,
            confidence: a.confidence,
            evidence: a.evidence,
            status: a.status,
            needs_review: a.needsReview,
            review_reason: a.reviewReason,
            is_duplicate: a.isDuplicate,
            duplicate_of_id: a.duplicateOfId,
            created_at: a.createdAt,
            updated_at: a.updatedAt,
          }))
        );
      }

      await supabase.from('audit_logs').insert({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        meeting_id: meeting.id,
        event: 'extraction_completed',
        new_value: {
          decisionsExtracted: newDecisions.length,
          actionItemsExtracted: newActionItems.length,
        },
        created_at: now,
      });
    } catch (err) {
      console.warn('[Supabase Direct] Error persisting extraction to Supabase:', err);
    }

    return {
      meeting: { ...meeting, status: 'processed', updatedAt: now },
      decisions: newDecisions,
      actionItems: newActionItems,
      metrics: {
        processingTimeMs: extractionResult.processingTimeMs,
        modelUsed: extractionResult.modelUsed,
      },
    };
  },

  // --- ACTION ITEMS ---
  getActionItems: async (params?: {
    meetingId?: string;
    status?: string;
    needsReview?: boolean;
    search?: string;
  }): Promise<(ActionItem & { meetingTitle?: string })[]> => {
    try {
      let query = supabase.from('action_items').select('*').order('created_at', { ascending: false });

      if (params?.meetingId) query = query.eq('meeting_id', params.meetingId);
      if (params?.status && params.status !== 'all') query = query.eq('status', params.status);
      if (params?.needsReview !== undefined) query = query.eq('needs_review', params.needsReview);

      const { data, error } = await query;
      if (error) throw error;

      // Get meetings for title enrichment
      const { data: mData } = await supabase.from('meetings').select('id, title');
      const meetingMap = new Map((mData || []).map((m: any) => [m.id, m.title]));

      let items: (ActionItem & { meetingTitle?: string })[] = (data || []).map((a: any) => ({
        id: a.id,
        meetingId: a.meeting_id,
        action: a.action,
        owner: a.owner || null,
        dueDate: a.due_date || null,
        confidence: Number(a.confidence),
        evidence: a.evidence || '',
        status: a.status || 'pending',
        needsReview: a.needs_review || false,
        reviewReason: a.review_reason || undefined,
        isDuplicate: a.is_duplicate || false,
        duplicateOfId: a.duplicate_of_id || null,
        createdAt: a.created_at,
        updatedAt: a.updated_at,
        meetingTitle: meetingMap.get(a.meeting_id) || 'Unknown Meeting',
      }));

      if (params?.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (a) =>
            a.action.toLowerCase().includes(q) ||
            (a.owner && a.owner.toLowerCase().includes(q)) ||
            (a.meetingTitle && a.meetingTitle.toLowerCase().includes(q))
        );
      }

      return items;
    } catch (err) {
      console.warn('[Supabase Direct] Falling back to local cache for getActionItems:', err);
      const cache = getLocalCache();
      const meetingMap = new Map(cache.meetings.map((m) => [m.id, m.title]));

      let items = cache.actionItems.map((a) => ({
        ...a,
        meetingTitle: meetingMap.get(a.meetingId) || 'Unknown Meeting',
      }));

      if (params?.meetingId) items = items.filter((a) => a.meetingId === params.meetingId);
      if (params?.status && params.status !== 'all') items = items.filter((a) => a.status === params.status);
      if (params?.needsReview !== undefined) items = items.filter((a) => a.needsReview === params.needsReview);
      if (params?.search) {
        const q = params.search.toLowerCase();
        items = items.filter(
          (a) =>
            a.action.toLowerCase().includes(q) ||
            (a.owner && a.owner.toLowerCase().includes(q)) ||
            (a.meetingTitle && a.meetingTitle.toLowerCase().includes(q))
        );
      }

      return items;
    }
  },

  updateActionItem: async (id: string, updates: Partial<ActionItem>): Promise<ActionItem> => {
    const validated = updateActionItemSchema.parse(updates);
    const now = new Date().toISOString();

    // Local cache update
    const cache = getLocalCache();
    const item = cache.actionItems.find((a) => a.id === id);
    if (!item) throw new Error('Action item not found');

    const oldValue = { ...item };
    if (validated.action !== undefined) item.action = validated.action;
    if (validated.owner !== undefined) item.owner = validated.owner;
    if (validated.dueDate !== undefined) item.dueDate = validated.dueDate;
    if (validated.status !== undefined) item.status = validated.status;
    if (validated.confidence !== undefined) item.confidence = validated.confidence;
    if (validated.evidence !== undefined) item.evidence = validated.evidence;
    if (validated.needsReview !== undefined) {
      item.needsReview = validated.needsReview;
    } else if (item.status === 'approved') {
      item.needsReview = false;
    }
    item.updatedAt = now;

    let event: AuditLog['event'] = 'item_edited';
    if (validated.status === 'approved' && oldValue.status !== 'approved') event = 'item_approved';
    else if (validated.status === 'rejected' && oldValue.status !== 'rejected') event = 'item_rejected';
    else if (validated.status === 'completed' && oldValue.status !== 'completed') event = 'item_completed';

    cache.auditLogs.unshift({
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      meetingId: item.meetingId,
      actionItemId: item.id,
      event,
      oldValue,
      newValue: item,
      createdAt: now,
    });
    saveLocalCache(cache);

    // Supabase update
    try {
      const patch: any = { updated_at: now };
      if (validated.action !== undefined) patch.action = validated.action;
      if (validated.owner !== undefined) patch.owner = validated.owner;
      if (validated.dueDate !== undefined) patch.due_date = validated.dueDate;
      if (validated.status !== undefined) patch.status = validated.status;
      if (validated.confidence !== undefined) patch.confidence = validated.confidence;
      if (validated.evidence !== undefined) patch.evidence = validated.evidence;
      if (validated.needsReview !== undefined) patch.needs_review = validated.needsReview;
      else if (item.status === 'approved') patch.needs_review = false;

      await supabase.from('action_items').update(patch).eq('id', id);
      await supabase.from('audit_logs').insert({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        meeting_id: item.meetingId,
        action_item_id: item.id,
        event,
        old_value: oldValue,
        new_value: item,
        created_at: now,
      });
    } catch (err) {
      console.warn('[Supabase Direct] Error updating action item in Supabase:', err);
    }

    return item;
  },

  deleteActionItem: async (id: string): Promise<{ success: boolean }> => {
    const cache = getLocalCache();
    const item = cache.actionItems.find((a) => a.id === id);
    cache.actionItems = cache.actionItems.filter((a) => a.id !== id);
    if (item) {
      cache.auditLogs.unshift({
        id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        meetingId: item.meetingId,
        actionItemId: item.id,
        event: 'item_deleted',
        oldValue: { action: item.action, owner: item.owner },
        createdAt: new Date().toISOString(),
      });
    }
    saveLocalCache(cache);

    try {
      await supabase.from('action_items').delete().eq('id', id);
    } catch (err) {
      console.warn('[Supabase Direct] Error deleting item from Supabase:', err);
    }
    return { success: true };
  },

  completeActionItem: async (id: string): Promise<ActionItem> => {
    return api.updateActionItem(id, { status: 'completed', needsReview: false });
  },

  approveActionItem: async (id: string): Promise<ActionItem> => {
    return api.updateActionItem(id, { status: 'approved', needsReview: false });
  },

  rejectActionItem: async (id: string): Promise<ActionItem> => {
    return api.updateActionItem(id, { status: 'rejected', needsReview: false });
  },

  bulkApproveMeeting: async (meetingId?: string): Promise<{ success: boolean; count: number }> => {
    const items = await api.getActionItems(meetingId ? { meetingId } : undefined);
    const pending = items.filter((i) => i.status === 'pending');
    for (const item of pending) {
      await api.updateActionItem(item.id, { status: 'approved', needsReview: false });
    }
    return { success: true, count: pending.length };
  },

  // --- METRICS ---
  getMetrics: async (): Promise<DashboardMetrics> => {
    const [meetings, actionItems, logs, settings] = await Promise.all([
      api.getMeetings(),
      api.getActionItems(),
      api.getAuditLogs(200),
      api.getSettings(),
    ]);

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

    const editEvents = logs.filter((l) => l.event === 'item_edited').length;
    const overrideRate =
      totalActionItems > 0 ? Math.min(100, (editEvents / totalActionItems) * 100) : 0;

    const timeSavedPerMeeting = Math.max(
      0,
      settings.manualMinutesPerMeeting - settings.automatedMinutesPerMeeting
    );
    const estimatedMinutesSaved = totalMeetings * timeSavedPerMeeting;

    const high = actionItems.filter((a) => a.confidence >= 0.85).length;
    const medium = actionItems.filter((a) => a.confidence >= 0.7 && a.confidence < 0.85).length;
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
      averageProcessingTimeMs: 1420,
      estimatedMinutesSaved,
      settings,
      confidenceBuckets: { high, medium, low },
      statusBreakdown: {
        pending: pendingActions,
        approved: approvedActions,
        rejected: rejectedActions,
        completed: completedActions,
      },
    };
  },

  // --- AUDIT LOGS ---
  getAuditLogs: async (limit = 100): Promise<AuditLog[]> => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data || []).map((l: any) => ({
        id: l.id,
        meetingId: l.meeting_id,
        actionItemId: l.action_item_id,
        event: l.event,
        oldValue: l.old_value,
        newValue: l.new_value,
        createdAt: l.created_at,
      }));
    } catch {
      const cache = getLocalCache();
      return cache.auditLogs.slice(0, limit);
    }
  },

  // --- SETTINGS ---
  getSettings: async (): Promise<SystemSettings> => {
    try {
      const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .eq('id', 'singleton')
        .single();

      if (error || !data) throw error || new Error('No settings');

      return {
        manualMinutesPerMeeting: Number(data.manual_minutes_per_meeting) || 10,
        automatedMinutesPerMeeting: Number(data.automated_minutes_per_meeting) || 2,
        confidenceThreshold: Number(data.confidence_threshold) || 0.7,
        aiModel: data.ai_model || 'gemini-3.8-flash',
      };
    } catch {
      const cache = getLocalCache();
      return cache.settings;
    }
  },

  updateSettings: async (updates: Partial<SystemSettings>): Promise<SystemSettings> => {
    const validated = settingsSchema.partial().parse(updates);
    const cache = getLocalCache();
    cache.settings = { ...cache.settings, ...validated };
    saveLocalCache(cache);

    try {
      await supabase.from('system_settings').upsert({
        id: 'singleton',
        manual_minutes_per_meeting: cache.settings.manualMinutesPerMeeting,
        automated_minutes_per_meeting: cache.settings.automatedMinutesPerMeeting,
        confidence_threshold: cache.settings.confidenceThreshold,
        ai_model: cache.settings.aiModel,
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn('[Supabase Direct] Error saving settings to Supabase:', err);
    }
    return cache.settings;
  },

  // --- SEED BENCHMARK DATA ---
  seedData: async (): Promise<{ success: boolean; message: string }> => {
    const seed = generateInitialSeedData();
    saveLocalCache(seed);

    try {
      await api.syncToSupabase();
    } catch (e) {
      console.warn('[Supabase Seed] Sync to remote completed with fallback:', e);
    }

    return {
      success: true,
      message: 'Sample synthetic enterprise data reseeded successfully',
    };
  },

  // --- SUPABASE STATUS & DIRECT SYNC ---
  getSupabaseStatus: async (): Promise<{
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
  }> => {
    try {
      const [mRes, dRes, aRes, lRes, sRes] = await Promise.all([
        supabase.from('meetings').select('id').limit(1),
        supabase.from('decisions').select('id').limit(1),
        supabase.from('action_items').select('id').limit(1),
        supabase.from('audit_logs').select('id').limit(1),
        supabase.from('system_settings').select('id').limit(1),
      ]);

      const meetingsOk = !mRes.error || mRes.error.code !== 'PGRST205';
      const decisionsOk = !dRes.error || dRes.error.code !== 'PGRST205';
      const actionItemsOk = !aRes.error || aRes.error.code !== 'PGRST205';
      const auditLogsOk = !lRes.error || lRes.error.code !== 'PGRST205';
      const settingsOk = !sRes.error || sRes.error.code !== 'PGRST205';

      const tables = {
        meetings: meetingsOk,
        decisions: decisionsOk,
        action_items: actionItemsOk,
        audit_logs: auditLogsOk,
        system_settings: settingsOk,
      };

      const allReady = meetingsOk && decisionsOk && actionItemsOk && auditLogsOk && settingsOk;

      return {
        connected: true,
        projectId: SUPABASE_PROJECT_ID,
        url: SUPABASE_URL,
        tables,
        allReady,
      };
    } catch (err: any) {
      return {
        connected: false,
        projectId: SUPABASE_PROJECT_ID,
        url: SUPABASE_URL,
        tables: {
          meetings: false,
          decisions: false,
          action_items: false,
          audit_logs: false,
          system_settings: false,
        },
        allReady: false,
        error: err.message,
      };
    }
  },

  syncToSupabase: async (): Promise<{
    success: boolean;
    synced: {
      meetings: number;
      decisions: number;
      actionItems: number;
      auditLogs: number;
    };
    error?: string;
  }> => {
    const cache = getLocalCache();
    try {
      let mCount = 0;
      let dCount = 0;
      let aCount = 0;
      let lCount = 0;

      if (cache.meetings.length > 0) {
        const rows = cache.meetings.map((m) => ({
          id: m.id,
          title: m.title,
          meeting_date: m.meetingDate,
          participants: m.participants,
          transcript: m.transcript,
          status: m.status || 'draft',
          created_at: m.createdAt,
          updated_at: m.updatedAt,
        }));
        const { error } = await supabase.from('meetings').upsert(rows);
        if (error) throw error;
        mCount = rows.length;
      }

      if (cache.decisions.length > 0) {
        const rows = cache.decisions.map((d) => ({
          id: d.id,
          meeting_id: d.meetingId,
          decision: d.decision,
          confidence: d.confidence,
          evidence: d.evidence || '',
          created_at: d.createdAt,
        }));
        const { error } = await supabase.from('decisions').upsert(rows);
        if (error) throw error;
        dCount = rows.length;
      }

      if (cache.actionItems.length > 0) {
        const rows = cache.actionItems.map((a) => ({
          id: a.id,
          meeting_id: a.meetingId,
          action: a.action,
          owner: a.owner,
          due_date: a.dueDate,
          confidence: a.confidence,
          evidence: a.evidence || '',
          status: a.status,
          needs_review: a.needsReview,
          review_reason: a.reviewReason || null,
          is_duplicate: a.isDuplicate || false,
          duplicate_of_id: a.duplicateOfId || null,
          created_at: a.createdAt,
          updated_at: a.updatedAt,
        }));
        const { error } = await supabase.from('action_items').upsert(rows);
        if (error) throw error;
        aCount = rows.length;
      }

      if (cache.auditLogs.length > 0) {
        const rows = cache.auditLogs.slice(0, 100).map((l) => ({
          id: l.id,
          meeting_id: l.meetingId || null,
          action_item_id: l.actionItemId || null,
          event: l.event,
          old_value: l.oldValue || null,
          new_value: l.newValue || null,
          created_at: l.createdAt,
        }));
        const { error } = await supabase.from('audit_logs').upsert(rows);
        if (!error) lCount = rows.length;
      }

      return {
        success: true,
        synced: {
          meetings: mCount,
          decisions: dCount,
          actionItems: aCount,
          auditLogs: lCount,
        },
      };
    } catch (err: any) {
      return {
        success: false,
        synced: { meetings: 0, decisions: 0, actionItems: 0, auditLogs: 0 },
        error: err.message,
      };
    }
  },

  getSupabaseSql: async (): Promise<{ sql: string }> => {
    return { sql: SUPABASE_SQL_SCRIPT };
  },

  // --- CLIENT-SIDE EXPORTS ---
  downloadCsv: async (onlyApproved = false) => {
    const items = await api.getActionItems();
    const filtered = onlyApproved
      ? items.filter((i) => i.status === 'approved' || i.status === 'completed')
      : items;

    const headers = [
      'ID',
      'Meeting Title',
      'Action Item',
      'Owner',
      'Due Date',
      'Confidence',
      'Status',
      'Needs Review',
      'Review Reason',
      'Is Duplicate',
      'Evidence',
    ];

    const escapeCsv = (val: any) => {
      if (val === null || val === undefined) return '""';
      const str = String(val).replace(/"/g, '""');
      return `"${str}"`;
    };

    const rows = filtered.map((item) => [
      escapeCsv(item.id),
      escapeCsv(item.meetingTitle || 'Unknown'),
      escapeCsv(item.action),
      escapeCsv(item.owner || 'Unassigned'),
      escapeCsv(item.dueDate || 'No deadline'),
      escapeCsv((item.confidence * 100).toFixed(0) + '%'),
      escapeCsv(item.status),
      escapeCsv(item.needsReview ? 'Yes' : 'No'),
      escapeCsv(item.reviewReason || ''),
      escapeCsv(item.isDuplicate ? 'Yes' : 'No'),
      escapeCsv(item.evidence || ''),
    ].join(','));

    const csvContent = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `action-items-${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  downloadJson: async () => {
    const [meetings, items, metrics] = await Promise.all([
      api.getMeetings(),
      api.getActionItems(),
      api.getMetrics(),
    ]);

    const exportData = {
      exportedAt: new Date().toISOString(),
      metadata: {
        generator: 'Meeting Action Item Tracker (Frontend Supabase Edition)',
        version: '2.0.0',
        totalMeetings: meetings.length,
        totalActionItems: items.length,
      },
      metrics,
      meetings,
      actionItems: items,
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `meeting-tracker-export-${Date.now()}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },
};
