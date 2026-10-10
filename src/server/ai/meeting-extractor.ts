import { GoogleGenAI, Type } from '@google/genai';
import { aiExtractionResponseSchema } from '../../lib/validation.ts';
import { ExtractionResult, ExtractedDecision, ExtractedActionItem } from '../../types/index.ts';

// Model definition conforming to gemini-api skill instructions
const MODEL_NAME = 'gemini-3.8-flash';

export interface ExtractOptions {
  meetingTitle: string;
  meetingDate: string; // YYYY-MM-DD reference date
  participants: string[];
  transcript: string;
}

export class MeetingExtractorService {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  /**
   * Main extraction entry point
   */
  public async extractActionItems(options: ExtractOptions): Promise<ExtractionResult> {
    const startTime = Date.now();
    const { meetingTitle, meetingDate, participants, transcript } = options;

    if (!transcript || transcript.trim().length < 10) {
      throw new Error('Transcript is too short to extract action items');
    }

    // If Gemini client is available, attempt real AI extraction
    if (this.ai && process.env.GEMINI_API_KEY) {
      try {
        const result = await this.callGeminiModel(
          meetingTitle,
          meetingDate,
          participants,
          transcript
        );
        const processingTimeMs = Date.now() - startTime;
        return {
          decisions: result.decisions,
          action_items: result.action_items,
          processingTimeMs,
          modelUsed: MODEL_NAME,
        };
      } catch (err: any) {
        console.warn(
          `[MeetingExtractorService] Gemini API call error: ${err.message}. Falling back to deterministic NLP heuristic parser.`
        );
      }
    } else {
      console.info(
        '[MeetingExtractorService] GEMINI_API_KEY not configured. Running deterministic heuristic extractor.'
      );
    }

    // Heuristic parser fallback
    const heuristicResult = this.heuristicExtract(
      meetingTitle,
      meetingDate,
      participants,
      transcript
    );
    const processingTimeMs = Date.now() - startTime;
    return {
      decisions: heuristicResult.decisions,
      action_items: heuristicResult.action_items,
      processingTimeMs,
      modelUsed: 'heuristic-nlp-engine',
    };
  }

  private async callGeminiModel(
    meetingTitle: string,
    meetingDate: string,
    participants: string[],
    transcript: string
  ) {
    if (!this.ai) throw new Error('Gemini client not initialized');

    const systemInstruction = `You are an elite Forward Deployed Engineering AI assistant specialized in analyzing business meetings and executive transcripts.
Your task is to extract:
1. Major Decisions: Strategic conclusions, approved choices, architectural determinations, or formal agreements made during the meeting.
2. Action Items: Explicit commitments, work tasks, deliverables, or follow-ups.

RULES:
- DO NOT invent information or hallucinate facts not present in the transcript.
- If the owner of an action item is NOT clearly stated, you MUST set "owner" to null.
- If the due date or deadline is NOT clearly stated, you MUST set "due_date" to null.
- If an item is vague, uncertain, an unassigned suggestion, or has ambiguous scope, set "needs_review": true.
- Normalize relative dates (e.g. "by tomorrow", "next Friday", "in 4 days") into concrete YYYY-MM-DD dates using the meeting reference date: ${meetingDate}.
- For each item, provide a confidence score between 0.0 and 1.0. High confidence (>=0.85) items have explicit owners, clear deadlines, and direct commitments. Low confidence (<0.70) items have missing or ambiguous information.
- Always quote the exact "evidence" string from the transcript where the decision or action was mentioned.`;

    const userPrompt = `Meeting Title: "${meetingTitle}"
Meeting Date: ${meetingDate}
Known Participants: ${participants.join(', ')}

Meeting Transcript:
"""
${transcript}
"""

Extract all decisions and action items in strict JSON format.`;

    const response = await this.ai.models.generateContent({
      model: MODEL_NAME,
      contents: userPrompt,
      config: {
        systemInstruction,
        temperature: 0.1,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            decisions: {
              type: Type.ARRAY,
              description: 'List of key strategic decisions agreed upon in the meeting',
              items: {
                type: Type.OBJECT,
                properties: {
                  decision: {
                    type: Type.STRING,
                    description: 'Clear summary of the decision',
                  },
                  confidence: {
                    type: Type.NUMBER,
                    description: 'Confidence score from 0.0 to 1.0',
                  },
                  evidence: {
                    type: Type.STRING,
                    description: 'Direct verbatim quote or excerpt from the transcript',
                  },
                },
                required: ['decision', 'confidence', 'evidence'],
              },
            },
            action_items: {
              type: Type.ARRAY,
              description: 'List of tasks and deliverables agreed upon',
              items: {
                type: Type.OBJECT,
                properties: {
                  action: {
                    type: Type.STRING,
                    description: 'Description of the task to be completed',
                  },
                  owner: {
                    type: Type.STRING,
                    description: 'Full name or role of the owner, or null if unassigned',
                    nullable: true,
                  },
                  due_date: {
                    type: Type.STRING,
                    description: 'Normalized YYYY-MM-DD due date, or null if no deadline mentioned',
                    nullable: true,
                  },
                  confidence: {
                    type: Type.NUMBER,
                    description: 'Confidence score from 0.0 to 1.0',
                  },
                  evidence: {
                    type: Type.STRING,
                    description: 'Direct quote from transcript',
                  },
                  needs_review: {
                    type: Type.BOOLEAN,
                    description: 'True if ambiguous, unassigned, or low confidence',
                  },
                },
                required: ['action', 'confidence', 'evidence', 'needs_review'],
              },
            },
          },
          required: ['decisions', 'action_items'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Gemini returned an empty response');
    }

    const parsed = JSON.parse(text);
    const validated = aiExtractionResponseSchema.parse(parsed);

    return validated;
  }

  /**
   * Deterministic heuristic fallback when Gemini API is offline or testing.
   */
  public heuristicExtract(
    meetingTitle: string,
    meetingDate: string,
    participants: string[],
    transcript: string
  ): { decisions: ExtractedDecision[]; action_items: ExtractedActionItem[] } {
    const lines = transcript.split('\n').filter((l) => l.trim().length > 0);
    const decisions: ExtractedDecision[] = [];
    const actionItems: ExtractedActionItem[] = [];

    const refDate = new Date(meetingDate);

    // Helper for relative dates
    const calculateRelativeDate = (daysAhead: number): string => {
      const d = new Date(refDate.getTime() + daysAhead * 86400000);
      return d.toISOString().split('T')[0];
    };

    for (const line of lines) {
      const cleanLine = line.trim();
      const lower = cleanLine.toLowerCase();

      // Check speaker prefix: "Marcus: ..."
      const speakerMatch = cleanLine.match(/^([A-Za-z\s]+):(.*)$/);
      const speaker = speakerMatch ? speakerMatch[1].trim() : null;
      const content = speakerMatch ? speakerMatch[2].trim() : cleanLine;
      const lowerContent = content.toLowerCase();

      // Decision detection
      if (
        lowerContent.includes('decision:') ||
        lowerContent.includes('approved') ||
        lowerContent.includes('agreed to') ||
        lowerContent.includes('let us standardize') ||
        lowerContent.includes("let's standardize") ||
        lowerContent.includes('we should standardize') ||
        lowerContent.includes('we will proceed with')
      ) {
        decisions.push({
          decision: content.replace(/^decision:\s*/i, '').trim(),
          confidence: 0.95,
          evidence: cleanLine,
        });
        continue;
      }

      // Action item indicators
      const isAction =
        lowerContent.includes('will ') ||
        lowerContent.includes('i will ') ||
        lowerContent.includes('please ') ||
        lowerContent.includes('need to ') ||
        lowerContent.includes('needs to ') ||
        lowerContent.includes('can take ') ||
        lowerContent.includes('action:') ||
        lowerContent.includes('prepare ') ||
        lowerContent.includes('someone should ') ||
        lowerContent.includes('could someone ') ||
        lowerContent.includes('should probably') ||
        lowerContent.includes('look into') ||
        lowerContent.includes('investigate');

      if (isAction) {
        let owner: string | null = null;
        let dueDate: string | null = null;
        let confidence = 0.85;
        let needsReview = false;

        // Owner determination
        if (lowerContent.includes('i will') || lowerContent.includes('i can take')) {
          owner = speaker || null;
        } else {
          for (const p of participants) {
            const firstName = p.split(' ')[0];
            if (content.includes(p) || content.includes(firstName)) {
              owner = p;
              break;
            }
          }
        }

        // Relative date detection
        if (lowerContent.includes('tomorrow')) {
          dueDate = calculateRelativeDate(1);
        } else if (lowerContent.includes('in 2 days')) {
          dueDate = calculateRelativeDate(2);
        } else if (lowerContent.includes('in 3 days')) {
          dueDate = calculateRelativeDate(3);
        } else if (lowerContent.includes('in 4 days')) {
          dueDate = calculateRelativeDate(4);
        } else if (lowerContent.includes('next friday') || lowerContent.includes('by friday')) {
          dueDate = calculateRelativeDate(5);
        } else if (lowerContent.includes('by monday') || lowerContent.includes('monday morning')) {
          dueDate = calculateRelativeDate(4);
        } else if (lowerContent.includes('by wednesday')) {
          dueDate = calculateRelativeDate(3);
        } else if (lowerContent.includes('by thursday') || lowerContent.includes('this thursday')) {
          dueDate = calculateRelativeDate(4);
        } else if (lowerContent.includes('next tuesday')) {
          dueDate = calculateRelativeDate(6);
        }

        // Missing owner or deadline adjustments
        if (
          lowerContent.includes('someone should') ||
          lowerContent.includes('could someone') ||
          lowerContent.includes('we should probably') ||
          !owner
        ) {
          owner = null;
          confidence = 0.62;
          needsReview = true;
        }

        if (!dueDate) {
          confidence = Math.min(confidence, 0.75);
          needsReview = true;
        }

        // Action text cleansing
        let actionDesc = content
          .replace(/^action:\s*/i, '')
          .replace(/^(elena|marcus|sarah|dave|carlos|devon|rachel|amara|liam|zoe),\s*/i, '')
          .trim();

        actionItems.push({
          action: actionDesc,
          owner,
          due_date: dueDate,
          confidence,
          evidence: cleanLine,
          needs_review: needsReview,
        });
      }
    }

    // If nothing found from strict rules, extract summary action item
    if (actionItems.length === 0) {
      actionItems.push({
        action: `Review and follow up on ${meetingTitle}`,
        owner: participants[0] || null,
        due_date: calculateRelativeDate(3),
        confidence: 0.72,
        evidence: lines[0] || meetingTitle,
        needs_review: true,
      });
    }

    return { decisions, action_items: actionItems };
  }
}

export const meetingExtractor = new MeetingExtractorService();
