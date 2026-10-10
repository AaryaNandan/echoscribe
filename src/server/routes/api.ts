import { Router, Request, Response, NextFunction } from 'express';
import { db } from '../db/database.ts';
import { meetingExtractor } from '../ai/meeting-extractor.ts';
import { supabaseAdapter, SUPABASE_SQL_SCRIPT } from '../db/supabase.ts';
import {
  createMeetingSchema,
  updateActionItemSchema,
  settingsSchema,
} from '../../lib/validation.ts';
import { ZodError } from 'zod';

export const apiRouter = Router();

// Middleware: Request correlation ID & timing
apiRouter.use((req: Request, res: Response, next: NextFunction) => {
  const correlationId =
    (req.headers['x-correlation-id'] as string) ||
    `corr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  res.setHeader('X-Correlation-Id', correlationId);
  (req as any).correlationId = correlationId;
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    if (req.path.startsWith('/api')) {
      console.log(
        `[API] [${correlationId}] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${duration}ms)`
      );
    }
  });

  next();
});

// Helper for error formatting
function handleApiError(res: Response, err: any) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Validation failed',
      details: err.issues.map((e: any) => ({ path: e.path.join('.'), message: e.message })),
    });
  }
  console.error('[API Error]', err);
  return res.status(500).json({
    error: err.message || 'Internal Server Error',
  });
}

// ==========================================
// MEETINGS
// ==========================================

// POST /api/meetings - Create a meeting
apiRouter.post('/meetings', (req: Request, res: Response) => {
  try {
    const validated = createMeetingSchema.parse(req.body);
    const meeting = db.createMeeting(validated);
    return res.status(201).json(meeting);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// GET /api/meetings - List all meetings
apiRouter.get('/meetings', (_req: Request, res: Response) => {
  try {
    const meetings = db.getMeetings();
    const actionItems = db.getActionItems();
    const decisions = db.getDecisions();

    // Enrich with counts
    const enriched = meetings.map((m) => {
      const items = actionItems.filter((a) => a.meetingId === m.id);
      const decs = decisions.filter((d) => d.meetingId === m.id);
      const completed = items.filter((a) => a.status === 'completed').length;
      const needsReview = items.filter((a) => a.needsReview).length;

      return {
        ...m,
        actionItemCount: items.length,
        completedActionCount: completed,
        decisionCount: decs.length,
        needsReviewCount: needsReview,
      };
    });

    return res.json(enriched);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// GET /api/meetings/:id - Get one meeting with details
apiRouter.get('/meetings/:id', (req: Request, res: Response) => {
  try {
    const details = db.getMeetingById(req.params.id);
    if (!details) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    const auditLogs = db
      .getAuditLogs(50)
      .filter((l) => l.meetingId === req.params.id);

    return res.json({
      ...details,
      auditLogs,
    });
  } catch (err) {
    return handleApiError(res, err);
  }
});

// DELETE /api/meetings/:id - Delete a meeting
apiRouter.delete('/meetings/:id', (req: Request, res: Response) => {
  try {
    const success = db.deleteMeeting(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    return res.json({ success: true, message: 'Meeting deleted successfully' });
  } catch (err) {
    return handleApiError(res, err);
  }
});

// POST /api/meetings/:id/extract - Run AI extraction
apiRouter.post('/meetings/:id/extract', async (req: Request, res: Response) => {
  try {
    const meetingDetails = db.getMeetingById(req.params.id);
    if (!meetingDetails) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const { meeting } = meetingDetails;

    db.logAudit({
      meetingId: meeting.id,
      event: 'extraction_started',
      newValue: { title: meeting.title },
    });

    // Run extraction service
    const extractionResult = await meetingExtractor.extractActionItems({
      meetingTitle: meeting.title,
      meetingDate: meeting.meetingDate,
      participants: meeting.participants,
      transcript: meeting.transcript,
    });

    // Save decisions
    const savedDecisions = db.saveDecisions(
      meeting.id,
      extractionResult.decisions
    );

    // Save action items (includes duplicate detection)
    const savedActionItems = db.saveActionItems(
      meeting.id,
      extractionResult.action_items.map((item) => ({
        action: item.action,
        owner: item.owner,
        dueDate: item.due_date,
        confidence: item.confidence,
        evidence: item.evidence,
        needsReview: item.needs_review,
        status: 'pending',
      }))
    );

    db.logAudit({
      meetingId: meeting.id,
      event: 'extraction_completed',
      newValue: {
        decisionsExtracted: savedDecisions.length,
        actionItemsExtracted: savedActionItems.length,
        processingTimeMs: extractionResult.processingTimeMs,
        modelUsed: extractionResult.modelUsed,
      },
    });

    return res.json({
      meeting: db.getMeetingById(meeting.id)?.meeting,
      decisions: savedDecisions,
      actionItems: savedActionItems,
      metrics: {
        processingTimeMs: extractionResult.processingTimeMs,
        modelUsed: extractionResult.modelUsed,
      },
    });
  } catch (err: any) {
    db.logAudit({
      meetingId: req.params.id,
      event: 'extraction_failed',
      newValue: { error: err.message },
    });
    return handleApiError(res, err);
  }
});

// ==========================================
// ACTION ITEMS
// ==========================================

// GET /api/action-items - List action items with filters
apiRouter.get('/action-items', (req: Request, res: Response) => {
  try {
    const { meetingId, status, needsReview, search } = req.query;

    const items = db.getActionItems({
      meetingId: meetingId as string | undefined,
      status: status as string | undefined,
      needsReview:
        needsReview !== undefined ? needsReview === 'true' : undefined,
      search: search as string | undefined,
    });

    // Attach meeting title for convenience
    const meetings = db.getMeetings();
    const meetingMap = new Map(meetings.map((m) => [m.id, m.title]));

    const enriched = items.map((item) => ({
      ...item,
      meetingTitle: meetingMap.get(item.meetingId) || 'Unknown Meeting',
    }));

    return res.json(enriched);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// PATCH /api/action-items/:id - Update an action item
apiRouter.patch('/api/action-items/:id', (req: Request, res: Response) => {
  try {
    const validated = updateActionItemSchema.parse(req.body);
    const updated = db.updateActionItem(req.params.id, validated);
    if (!updated) {
      return res.status(404).json({ error: 'Action item not found' });
    }
    return res.json(updated);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// DELETE /api/action-items/:id - Delete an action item
apiRouter.delete('/api/action-items/:id', (req: Request, res: Response) => {
  try {
    const success = db.deleteActionItem(req.params.id);
    if (!success) {
      return res.status(404).json({ error: 'Action item not found' });
    }
    return res.json({ success: true, message: 'Action item deleted' });
  } catch (err) {
    return handleApiError(res, err);
  }
});

// POST /api/action-items/:id/complete - Mark completed
apiRouter.post('/api/action-items/:id/complete', (req: Request, res: Response) => {
  try {
    const updated = db.updateActionItem(req.params.id, {
      status: 'completed',
      needsReview: false,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Action item not found' });
    }
    return res.json(updated);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// POST /api/action-items/:id/approve - Mark approved
apiRouter.post('/api/action-items/:id/approve', (req: Request, res: Response) => {
  try {
    const updated = db.updateActionItem(req.params.id, {
      status: 'approved',
      needsReview: false,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Action item not found' });
    }
    return res.json(updated);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// POST /api/action-items/:id/reject - Mark rejected
apiRouter.post('/api/action-items/:id/reject', (req: Request, res: Response) => {
  try {
    const updated = db.updateActionItem(req.params.id, {
      status: 'rejected',
      needsReview: false,
    });
    if (!updated) {
      return res.status(404).json({ error: 'Action item not found' });
    }
    return res.json(updated);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// POST /api/action-items/bulk-approve - Bulk approve high-confidence or pending items
apiRouter.post('/api/action-items/bulk-approve', (req: Request, res: Response) => {
  try {
    const { meetingId } = req.body;
    const items = db.getActionItems(meetingId ? { meetingId } : undefined);
    const approvedCount = items
      .filter((i) => i.status === 'pending')
      .map((i) => {
        db.updateActionItem(i.id, { status: 'approved', needsReview: false });
        return i.id;
      }).length;

    db.logAudit({
      meetingId: meetingId || null,
      event: 'bulk_approved',
      newValue: { count: approvedCount },
    });

    return res.json({ success: true, count: approvedCount });
  } catch (err) {
    return handleApiError(res, err);
  }
});

// ==========================================
// METRICS & ANALYTICS
// ==========================================

// GET /api/metrics - Dashboard metrics
apiRouter.get('/metrics', (_req: Request, res: Response) => {
  try {
    const metrics = db.getMetrics();
    return res.json(metrics);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// ==========================================
// EXPORTS
// ==========================================

// GET /api/export/csv - Export approved / all action items as CSV
apiRouter.get('/export/csv', (req: Request, res: Response) => {
  try {
    const onlyApproved = req.query.approved === 'true';
    const items = db.getActionItems();
    const filtered = onlyApproved
      ? items.filter((i) => i.status === 'approved' || i.status === 'completed')
      : items;

    const meetings = db.getMeetings();
    const meetingMap = new Map(meetings.map((m) => [m.id, m]));

    // CSV Headers
    const headers = [
      'ID',
      'Meeting Title',
      'Meeting Date',
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

    const rows = filtered.map((item) => {
      const mtg = meetingMap.get(item.meetingId);
      return [
        escapeCsv(item.id),
        escapeCsv(mtg?.title || 'Unknown'),
        escapeCsv(mtg?.meetingDate || ''),
        escapeCsv(item.action),
        escapeCsv(item.owner || 'Unassigned'),
        escapeCsv(item.dueDate || 'No deadline'),
        escapeCsv((item.confidence * 100).toFixed(0) + '%'),
        escapeCsv(item.status),
        escapeCsv(item.needsReview ? 'Yes' : 'No'),
        escapeCsv(item.reviewReason || ''),
        escapeCsv(item.isDuplicate ? 'Yes' : 'No'),
        escapeCsv(item.evidence || ''),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="action-items-${Date.now()}.csv"`
    );
    return res.status(200).send(csvContent);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// GET /api/export/json - Export all structured data as JSON
apiRouter.get('/export/json', (req: Request, res: Response) => {
  try {
    const meetings = db.getMeetings();
    const decisions = db.getDecisions();
    const actionItems = db.getActionItems();
    const metrics = db.getMetrics();

    const exportData = {
      exportedAt: new Date().toISOString(),
      metadata: {
        generator: 'Meeting Action Item Tracker (FDE Portfolio Edition)',
        version: '1.0.0',
        totalMeetings: meetings.length,
        totalActionItems: actionItems.length,
      },
      metrics,
      meetings: meetings.map((m) => ({
        ...m,
        decisions: decisions.filter((d) => d.meetingId === m.id),
        actionItems: actionItems.filter((a) => a.meetingId === m.id),
      })),
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="meeting-action-items-export-${Date.now()}.json"`
    );
    return res.status(200).json(exportData);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// ==========================================
// AUDIT LOGS & SETTINGS
// ==========================================

// GET /api/audit-logs
apiRouter.get('/audit-logs', (req: Request, res: Response) => {
  try {
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const logs = db.getAuditLogs(limit);
    return res.json(logs);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// GET /api/settings
apiRouter.get('/settings', (_req: Request, res: Response) => {
  try {
    return res.json(db.getSettings());
  } catch (err) {
    return handleApiError(res, err);
  }
});

// PATCH /api/settings
apiRouter.patch('/settings', (req: Request, res: Response) => {
  try {
    const validated = settingsSchema.partial().parse(req.body);
    const updated = db.updateSettings(validated);
    return res.json(updated);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// POST /api/seed - Reset and seed sample synthetic data
apiRouter.post('/seed', (_req: Request, res: Response) => {
  try {
    db.seedInitialData();
    return res.json({
      success: true,
      message: 'Sample synthetic enterprise data reseeded successfully',
    });
  } catch (err) {
    return handleApiError(res, err);
  }
});

// ==========================================
// SUPABASE CLOUD INTEGRATION
// ==========================================

// GET /api/supabase/status - Test connection and inspect tables
apiRouter.get('/supabase/status', async (_req: Request, res: Response) => {
  try {
    const status = await supabaseAdapter.checkStatus();
    return res.json(status);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// POST /api/supabase/sync - Push all meetings, decisions, and action items to Supabase
apiRouter.post('/supabase/sync', async (_req: Request, res: Response) => {
  try {
    const result = await db.syncToSupabase();
    return res.json(result);
  } catch (err) {
    return handleApiError(res, err);
  }
});

// GET /api/supabase/sql - Get full DDL setup script for Supabase SQL Editor
apiRouter.get('/supabase/sql', (_req: Request, res: Response) => {
  try {
    return res.json({ sql: SUPABASE_SQL_SCRIPT });
  } catch (err) {
    return handleApiError(res, err);
  }
});
