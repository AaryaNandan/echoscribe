/**
 * Production Test Suite for Meeting Action Item Tracker (Frontend Architecture)
 * Covers: Input validation, AI response parsing, NLP heuristic extraction,
 * missing owner/deadline detection, low confidence review flagging,
 * text similarity duplicate detection, and settings validation.
 */

import assert from 'assert';
import { calculateTextSimilarity } from '../src/lib/duplicate-detector.ts';
import { MeetingExtractorService } from '../src/lib/ai/meeting-extractor.ts';
import {
  createMeetingSchema,
  updateActionItemSchema,
  aiExtractionResponseSchema,
  settingsSchema,
} from '../src/lib/validation.ts';

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void | Promise<void>) {
  return (async () => {
    try {
      await fn();
      console.log(`  \x1b[32m✔ PASS\x1b[0m: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  \x1b[31m✖ FAIL\x1b[0m: ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  })();
}

async function runAllTests() {
  console.log('\n=============================================');
  console.log(' Meeting Action Item Tracker - Test Suite');
  console.log('=============================================\n');

  // Test 1: Validation - Happy Path
  await test('Validation: Valid meeting payload passes Zod schema', () => {
    const valid = {
      title: 'Sprint Planning Sync',
      meetingDate: '2026-10-15',
      participants: ['Alice Smith', 'Bob Jones'],
      transcript: 'Alice: I will prepare the API specification by tomorrow.',
    };
    const parsed = createMeetingSchema.parse(valid);
    assert.strictEqual(parsed.title, valid.title);
    assert.strictEqual(parsed.participants.length, 2);
  });

  // Test 2: Validation - Empty / Invalid Input
  await test('Validation: Empty meeting title and short transcript fail validation', () => {
    assert.throws(
      () => {
        createMeetingSchema.parse({
          title: '',
          meetingDate: '2026-10-15',
          participants: ['Alice'],
          transcript: '',
        });
      },
      /Meeting title must be at least 3 characters|Meeting notes or transcript must be at least 10 characters/
    );
  });

  // Test 3: Validation - Invalid Date Format
  await test('Validation: Invalid date format is rejected', () => {
    assert.throws(
      () => {
        createMeetingSchema.parse({
          title: 'Architecture Review',
          meetingDate: '15/10/2026', // wrong format
          participants: ['Alice'],
          transcript: 'This is a valid long transcript for testing.',
        });
      },
      /Date must be in YYYY-MM-DD format/
    );
  });

  // Test 4: AI Response Schema Validation
  await test('AI Response Schema: Validates structured JSON schema', () => {
    const rawAiOutput = {
      decisions: [
        {
          decision: 'Standardize on Supabase PostgreSQL database',
          confidence: 0.95,
          evidence: 'Let us standardize on Supabase PostgreSQL.',
        },
      ],
      action_items: [
        {
          action: 'Configure Supabase tables and RLS policies',
          owner: 'David Kim',
          due_date: '2026-10-20',
          confidence: 0.92,
          evidence: 'David will configure Supabase tables and RLS policies by Oct 20.',
          needs_review: false,
        },
      ],
    };
    const validated = aiExtractionResponseSchema.parse(rawAiOutput);
    assert.strictEqual(validated.decisions.length, 1);
    assert.strictEqual(validated.action_items[0].owner, 'David Kim');
    assert.strictEqual(validated.action_items[0].confidence, 0.92);
  });

  // Test 5: Missing Owner Handling
  await test('AI Extraction: Missing owner is parsed as null and flagged for review', async () => {
    const extractor = new MeetingExtractorService();
    const result = await extractor.heuristicExtract(
      'Security Standup',
      '2026-10-10',
      ['Amara', 'Dave'],
      'Someone should verify if contractor laptop encryption policies are enabled.'
    );
    assert(result.action_items.length > 0);
    const item = result.action_items[0];
    assert.strictEqual(item.owner, null);
    assert.strictEqual(item.needs_review, true);
  });

  // Test 6: Missing Deadline Handling
  await test('AI Extraction: Missing deadline is parsed as null', async () => {
    const extractor = new MeetingExtractorService();
    const result = await extractor.heuristicExtract(
      'GTM Planning',
      '2026-10-10',
      ['Carlos'],
      'Carlos will write the enterprise case study.'
    );
    assert(result.action_items.length > 0);
    const item = result.action_items[0];
    assert.strictEqual(item.due_date, null);
    assert.strictEqual(item.needs_review, true);
  });

  // Test 7: Low Confidence Classification
  await test('AI Extraction: Ambiguous item receives low confidence score', async () => {
    const extractor = new MeetingExtractorService();
    const result = await extractor.heuristicExtract(
      'DevOps Chat',
      '2026-10-10',
      ['Dave'],
      'We should probably look into whether webhook batching helps throughput.'
    );
    assert(result.action_items.length > 0);
    const item = result.action_items[0];
    assert(item.confidence < 0.70, `Expected confidence < 0.70, got ${item.confidence}`);
  });

  // Test 8: Duplicate Detection
  await test('Duplicate Detection: Flags high-similarity action items', () => {
    const item1 = 'Prepare the sales pipeline slide deck for executive committee';
    const item2 = 'Prepare the sales pipeline slide deck for the QBR';
    const similarity = calculateTextSimilarity(item1, item2);
    assert(similarity >= 0.65, `Expected similarity >= 0.65, got ${similarity}`);
  });

  // Test 9: Duplicate Detection Distinguishes Different Actions
  await test('Duplicate Detection: Does not flag distinctly different actions', () => {
    const item1 = 'Provision read-replica database pool in GCP Asia-East1';
    const item2 = 'Draft Architectural Decision Record for semantic search';
    const similarity = calculateTextSimilarity(item1, item2);
    assert(similarity < 0.3, `Expected similarity < 0.3, got ${similarity}`);
  });

  // Test 10: Action Item Update Validation
  await test('Action Item Update: Validates partial updates', () => {
    const validUpdate = {
      status: 'approved' as const,
      needsReview: false,
      owner: 'Elena Rostova',
      dueDate: '2026-10-25',
    };
    const parsed = updateActionItemSchema.parse(validUpdate);
    assert.strictEqual(parsed.status, 'approved');
    assert.strictEqual(parsed.owner, 'Elena Rostova');
  });

  // Test 11: Settings Schema Validation
  await test('Settings: Validates time-saved and threshold configuration', () => {
    const settings = {
      manualMinutesPerMeeting: 12,
      automatedMinutesPerMeeting: 2.5,
      confidenceThreshold: 0.75,
      aiModel: 'gemini-3.8-flash',
    };
    const parsed = settingsSchema.parse(settings);
    assert.strictEqual(parsed.manualMinutesPerMeeting, 12);
    assert.strictEqual(parsed.confidenceThreshold, 0.75);
  });

  console.log('\n---------------------------------------------');
  console.log(` Total Passed: ${passed} | Total Failed: ${failed}`);
  console.log('---------------------------------------------\n');

  if (failed > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error('Test execution error:', err);
  process.exit(1);
});
