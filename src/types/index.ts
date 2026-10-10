export type ActionItemStatus = 'pending' | 'approved' | 'rejected' | 'completed';

export interface Meeting {
  id: string;
  title: string;
  meetingDate: string; // YYYY-MM-DD
  participants: string[];
  transcript: string;
  status?: 'draft' | 'processed' | 'reviewed';
  createdAt: string;
  updatedAt: string;
}

export interface Decision {
  id: string;
  meetingId: string;
  decision: string;
  confidence: number; // 0.0 - 1.0
  evidence?: string;
  createdAt: string;
}

export interface ActionItem {
  id: string;
  meetingId: string;
  action: string;
  owner: string | null;
  dueDate: string | null; // YYYY-MM-DD
  confidence: number; // 0.0 - 1.0
  evidence?: string;
  status: ActionItemStatus;
  needsReview: boolean;
  reviewReason?: string;
  isDuplicate?: boolean;
  duplicateOfId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLog {
  id: string;
  meetingId?: string | null;
  actionItemId?: string | null;
  event:
    | 'extraction_started'
    | 'extraction_completed'
    | 'extraction_failed'
    | 'meeting_created'
    | 'item_created'
    | 'item_edited'
    | 'item_approved'
    | 'item_rejected'
    | 'item_deleted'
    | 'item_completed'
    | 'bulk_approved';
  oldValue?: Record<string, any> | string | null;
  newValue?: Record<string, any> | string | null;
  createdAt: string;
}

export interface SystemSettings {
  manualMinutesPerMeeting: number;
  automatedMinutesPerMeeting: number;
  confidenceThreshold: number;
  aiModel: string;
}

export interface ExtractedDecision {
  decision: string;
  confidence: number;
  evidence: string;
}

export interface ExtractedActionItem {
  action: string;
  owner: string | null;
  due_date: string | null;
  confidence: number;
  evidence: string;
  needs_review: boolean;
}

export interface ExtractionResult {
  decisions: ExtractedDecision[];
  action_items: ExtractedActionItem[];
  processingTimeMs: number;
  tokensEstimated?: number;
  modelUsed: string;
}

export interface DashboardMetrics {
  totalMeetings: number;
  totalActionItems: number;
  pendingActions: number;
  completedActions: number;
  overdueActions: number;
  itemsRequiringReview: number;
  averageConfidence: number;
  completionRate: number;
  reviewRate: number;
  overrideRate: number;
  averageProcessingTimeMs: number;
  estimatedMinutesSaved: number;
  settings: SystemSettings;
  confidenceBuckets: {
    high: number; // >= 0.85
    medium: number; // 0.70 - 0.84
    low: number; // < 0.70
  };
  statusBreakdown: {
    pending: number;
    approved: number;
    rejected: number;
    completed: number;
  };
}
