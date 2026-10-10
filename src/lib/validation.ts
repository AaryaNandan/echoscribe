import { z } from 'zod';

export const createMeetingSchema = z.object({
  title: z
    .string()
    .min(3, 'Meeting title must be at least 3 characters')
    .max(200, 'Meeting title must not exceed 200 characters'),
  meetingDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format'),
  participants: z
    .array(z.string().min(1, 'Participant name cannot be empty'))
    .min(1, 'At least one participant is required'),
  transcript: z
    .string()
    .min(10, 'Meeting notes or transcript must be at least 10 characters')
    .max(50000, 'Transcript exceeds maximum allowed length (50,000 characters)'),
});

export const updateActionItemSchema = z.object({
  action: z.string().min(3, 'Action description must be at least 3 characters').optional(),
  owner: z.string().nullable().optional(),
  dueDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Due date must be in YYYY-MM-DD format')
    .nullable()
    .optional(),
  status: z.enum(['pending', 'approved', 'rejected', 'completed']).optional(),
  needsReview: z.boolean().optional(),
  confidence: z.number().min(0).max(1).optional(),
  evidence: z.string().optional(),
});

export const extractedDecisionSchema = z.object({
  decision: z.string().min(1, 'Decision text cannot be empty'),
  confidence: z.number().min(0).max(1),
  evidence: z.string().default(''),
});

export const extractedActionItemSchema = z.object({
  action: z.string().min(1, 'Action description cannot be empty'),
  owner: z.union([z.string(), z.null()]).default(null),
  due_date: z.union([z.string(), z.null()]).default(null),
  confidence: z.number().min(0).max(1),
  evidence: z.string().default(''),
  needs_review: z.boolean().default(false),
});

export const aiExtractionResponseSchema = z.object({
  decisions: z.array(extractedDecisionSchema).default([]),
  action_items: z.array(extractedActionItemSchema).default([]),
});

export const settingsSchema = z.object({
  manualMinutesPerMeeting: z.number().min(1).max(120),
  automatedMinutesPerMeeting: z.number().min(0.5).max(60),
  confidenceThreshold: z.number().min(0.1).max(0.99).optional(),
});
