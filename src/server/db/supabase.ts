import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  Meeting,
  Decision,
  ActionItem,
  AuditLog,
  SystemSettings,
} from '../../types/index.ts';

const DEFAULT_SUPABASE_URL =
  process.env.SUPABASE_URL || 'https://wkwxbnpwhpfsqltotpsz.supabase.co';
const DEFAULT_SUPABASE_KEY =
  process.env.SUPABASE_KEY || 'sb_publishable_hEe2KbvSSg2WO-U8e_dp_w_d_5fURfA';
const DEFAULT_PROJECT_ID =
  process.env.SUPABASE_PROJECT_ID || 'wkwxbnpwhpfsqltotpsz';

export const SUPABASE_SQL_SCRIPT = `-- ========================================================
-- Meeting Action Item Tracker - Supabase Database Migration
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/${DEFAULT_PROJECT_ID}/sql
-- ========================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Meetings Table
CREATE TABLE IF NOT EXISTS public.meetings (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    meeting_date DATE NOT NULL,
    participants TEXT[] NOT NULL DEFAULT '{}',
    transcript TEXT NOT NULL,
    status TEXT DEFAULT 'draft',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Decisions Table
CREATE TABLE IF NOT EXISTS public.decisions (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    decision TEXT NOT NULL,
    confidence NUMERIC(4, 2) NOT NULL,
    evidence TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Action Items Table
CREATE TABLE IF NOT EXISTS public.action_items (
    id TEXT PRIMARY KEY,
    meeting_id TEXT NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    owner TEXT,
    due_date DATE,
    confidence NUMERIC(4, 2) NOT NULL,
    evidence TEXT,
    status TEXT DEFAULT 'pending',
    needs_review BOOLEAN DEFAULT FALSE,
    review_reason TEXT,
    is_duplicate BOOLEAN DEFAULT FALSE,
    duplicate_of_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Audit Logs Table
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    meeting_id TEXT,
    action_item_id TEXT,
    event TEXT NOT NULL,
    old_value JSONB,
    new_value JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. System Settings Table
CREATE TABLE IF NOT EXISTS public.system_settings (
    id TEXT PRIMARY KEY DEFAULT 'singleton',
    manual_minutes_per_meeting NUMERIC(5, 2) DEFAULT 10,
    automated_minutes_per_meeting NUMERIC(5, 2) DEFAULT 2,
    confidence_threshold NUMERIC(4, 2) DEFAULT 0.70,
    ai_model TEXT DEFAULT 'gemini-3.8-flash',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.decisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

-- Create Open Public Access Policies (for anon/publishable key)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meetings' AND policyname = 'Allow public all on meetings') THEN
    CREATE POLICY "Allow public all on meetings" ON public.meetings FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'decisions' AND policyname = 'Allow public all on decisions') THEN
    CREATE POLICY "Allow public all on decisions" ON public.decisions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'action_items' AND policyname = 'Allow public all on action_items') THEN
    CREATE POLICY "Allow public all on action_items" ON public.action_items FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'audit_logs' AND policyname = 'Allow public all on audit_logs') THEN
    CREATE POLICY "Allow public all on audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'system_settings' AND policyname = 'Allow public all on system_settings') THEN
    CREATE POLICY "Allow public all on system_settings" ON public.system_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
`;

export class SupabaseAdapter {
  private client: SupabaseClient | null = null;
  public readonly url: string;
  public readonly projectId: string;
  public readonly key: string;

  constructor() {
    this.url = DEFAULT_SUPABASE_URL;
    this.key = DEFAULT_SUPABASE_KEY;
    this.projectId = DEFAULT_PROJECT_ID;

    if (this.url && this.key) {
      try {
        this.client = createClient(this.url, this.key, {
          auth: { persistSession: false },
        });
      } catch (err) {
        console.error('[Supabase] Failed to initialize client:', err);
      }
    }
  }

  public isConfigured(): boolean {
    return !!this.client && !!this.url && !!this.key;
  }

  public getClient(): SupabaseClient | null {
    return this.client;
  }

  /**
   * Tests connection and checks table presence in Supabase
   */
  public async checkStatus(): Promise<{
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
  }> {
    const defaultTables = {
      meetings: false,
      decisions: false,
      action_items: false,
      audit_logs: false,
      system_settings: false,
    };

    if (!this.client) {
      return {
        connected: false,
        projectId: this.projectId,
        url: this.url,
        tables: defaultTables,
        allReady: false,
        error: 'Supabase client not initialized',
      };
    }

    try {
      const results = await Promise.all([
        this.client.from('meetings').select('id').limit(1),
        this.client.from('decisions').select('id').limit(1),
        this.client.from('action_items').select('id').limit(1),
        this.client.from('audit_logs').select('id').limit(1),
        this.client.from('system_settings').select('id').limit(1),
      ]);

      const meetingsOk = !results[0].error || results[0].error.code !== 'PGRST205';
      const decisionsOk = !results[1].error || results[1].error.code !== 'PGRST205';
      const actionItemsOk = !results[2].error || results[2].error.code !== 'PGRST205';
      const auditLogsOk = !results[3].error || results[3].error.code !== 'PGRST205';
      const settingsOk = !results[4].error || results[4].error.code !== 'PGRST205';

      const tables = {
        meetings: meetingsOk,
        decisions: decisionsOk,
        action_items: actionItemsOk,
        audit_logs: auditLogsOk,
        system_settings: settingsOk,
      };

      const allReady =
        meetingsOk && decisionsOk && actionItemsOk && auditLogsOk && settingsOk;

      return {
        connected: true,
        projectId: this.projectId,
        url: this.url,
        tables,
        allReady,
      };
    } catch (err: any) {
      return {
        connected: false,
        projectId: this.projectId,
        url: this.url,
        tables: defaultTables,
        allReady: false,
        error: err.message,
      };
    }
  }

  // --- CRUD Sync Methods ---

  public async fetchMeetings(): Promise<Meeting[] | null> {
    if (!this.client) return null;
    try {
      const { data, error } = await this.client
        .from('meetings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error || !data) return null;

      return data.map((m: any) => ({
        id: m.id,
        title: m.title,
        meetingDate: m.meeting_date,
        participants: m.participants || [],
        transcript: m.transcript,
        status: m.status || 'draft',
        createdAt: m.created_at,
        updatedAt: m.updated_at,
      }));
    } catch {
      return null;
    }
  }

  public async upsertMeeting(meeting: Meeting): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client.from('meetings').upsert({
        id: meeting.id,
        title: meeting.title,
        meeting_date: meeting.meetingDate,
        participants: meeting.participants,
        transcript: meeting.transcript,
        status: meeting.status || 'draft',
        created_at: meeting.createdAt,
        updated_at: meeting.updatedAt,
      });
      if (error) {
        console.warn('[Supabase] Error upserting meeting:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.warn('[Supabase] Exception upserting meeting:', err.message);
      return false;
    }
  }

  public async deleteMeeting(id: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client.from('meetings').delete().eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  public async upsertDecisions(decisions: Decision[]): Promise<boolean> {
    if (!this.client || decisions.length === 0) return true;
    try {
      const rows = decisions.map((d) => ({
        id: d.id,
        meeting_id: d.meetingId,
        decision: d.decision,
        confidence: d.confidence,
        evidence: d.evidence || '',
        created_at: d.createdAt,
      }));
      const { error } = await this.client.from('decisions').upsert(rows);
      return !error;
    } catch {
      return false;
    }
  }

  public async upsertActionItems(items: ActionItem[]): Promise<boolean> {
    if (!this.client || items.length === 0) return true;
    try {
      const rows = items.map((a) => ({
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
      const { error } = await this.client.from('action_items').upsert(rows);
      return !error;
    } catch {
      return false;
    }
  }

  public async updateActionItem(
    id: string,
    updates: Partial<ActionItem>
  ): Promise<boolean> {
    if (!this.client) return false;
    try {
      const patch: any = { updated_at: new Date().toISOString() };
      if (updates.action !== undefined) patch.action = updates.action;
      if (updates.owner !== undefined) patch.owner = updates.owner;
      if (updates.dueDate !== undefined) patch.due_date = updates.dueDate;
      if (updates.status !== undefined) patch.status = updates.status;
      if (updates.needsReview !== undefined) patch.needs_review = updates.needsReview;
      if (updates.confidence !== undefined) patch.confidence = updates.confidence;
      if (updates.evidence !== undefined) patch.evidence = updates.evidence;

      const { error } = await this.client
        .from('action_items')
        .update(patch)
        .eq('id', id);

      return !error;
    } catch {
      return false;
    }
  }

  public async deleteActionItem(id: string): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client
        .from('action_items')
        .delete()
        .eq('id', id);
      return !error;
    } catch {
      return false;
    }
  }

  public async saveAuditLog(log: AuditLog): Promise<boolean> {
    if (!this.client) return false;
    try {
      const { error } = await this.client.from('audit_logs').insert({
        id: log.id,
        meeting_id: log.meetingId || null,
        action_item_id: log.actionItemId || null,
        event: log.event,
        old_value: log.oldValue || null,
        new_value: log.newValue || null,
        created_at: log.createdAt,
      });
      return !error;
    } catch {
      return false;
    }
  }

  /**
   * Pushes all local meetings, decisions, action items, and logs into Supabase
   */
  public async syncAllData(data: {
    meetings: Meeting[];
    decisions: Decision[];
    actionItems: ActionItem[];
    auditLogs: AuditLog[];
    settings?: SystemSettings;
  }): Promise<{
    success: boolean;
    synced: {
      meetings: number;
      decisions: number;
      actionItems: number;
      auditLogs: number;
    };
    error?: string;
  }> {
    if (!this.client) {
      return {
        success: false,
        synced: { meetings: 0, decisions: 0, actionItems: 0, auditLogs: 0 },
        error: 'Supabase client not initialized',
      };
    }

    try {
      let mCount = 0;
      let dCount = 0;
      let aCount = 0;
      let lCount = 0;

      // 1. Sync meetings
      if (data.meetings.length > 0) {
        const mRows = data.meetings.map((m) => ({
          id: m.id,
          title: m.title,
          meeting_date: m.meetingDate,
          participants: m.participants,
          transcript: m.transcript,
          status: m.status || 'draft',
          created_at: m.createdAt,
          updated_at: m.updatedAt,
        }));
        const { error: mErr } = await this.client.from('meetings').upsert(mRows);
        if (mErr) throw new Error(`Meetings sync error: ${mErr.message}`);
        mCount = mRows.length;
      }

      // 2. Sync decisions
      if (data.decisions.length > 0) {
        const dRows = data.decisions.map((d) => ({
          id: d.id,
          meeting_id: d.meetingId,
          decision: d.decision,
          confidence: d.confidence,
          evidence: d.evidence || '',
          created_at: d.createdAt,
        }));
        const { error: dErr } = await this.client.from('decisions').upsert(dRows);
        if (dErr) throw new Error(`Decisions sync error: ${dErr.message}`);
        dCount = dRows.length;
      }

      // 3. Sync action items
      if (data.actionItems.length > 0) {
        const aRows = data.actionItems.map((a) => ({
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
        const { error: aErr } = await this.client.from('action_items').upsert(aRows);
        if (aErr) throw new Error(`Action items sync error: ${aErr.message}`);
        aCount = aRows.length;
      }

      // 4. Sync audit logs
      if (data.auditLogs.length > 0) {
        const lRows = data.auditLogs.slice(0, 100).map((l) => ({
          id: l.id,
          meeting_id: l.meetingId || null,
          action_item_id: l.actionItemId || null,
          event: l.event,
          old_value: l.oldValue || null,
          new_value: l.newValue || null,
          created_at: l.createdAt,
        }));
        const { error: lErr } = await this.client.from('audit_logs').upsert(lRows);
        if (!lErr) lCount = lRows.length;
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
  }
}

export const supabaseAdapter = new SupabaseAdapter();
