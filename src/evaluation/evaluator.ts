import Anthropic from '@anthropic-ai/sdk';

export interface EvaluationResult {
  score: number;       // 0–100
  passed: boolean;     // score >= 70 — computed in code, not by the model
  feedback: string;    // one sentence — what the evaluator found
  flags: string[];     // specific issues for debugging
}

export class Evaluator {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async evaluateResponse(
    task: string,
    skill: string,
    response: string,
    memoryContext?: string
  ): Promise<EvaluationResult> {
    const evalPrompt = `You are evaluating a research response.

Original task: "${task}"
Skill used: ${skill}
Memory context provided: ${memoryContext ? 'Yes' : 'No'}

Response to evaluate:
"""
${response}
"""

Evaluate on these criteria:
1. Answers the actual task (0–40)
2. Uses appropriate depth for the skill type (0–30)
3. Makes claims with appropriate certainty markers (0–20)
4. Integrates prior context when provided (0–10)

Return ONLY valid JSON, no preamble, no explanation:
{ "score": 0, "feedback": "one sentence", "flags": ["issue1"] }`;

    try {
      const result = await this.client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: evalPrompt }]
      });

      const raw = (result.content[0] as { type: 'text'; text: string }).text.trim();
      const parsed = JSON.parse(raw);

      return {
        score: parsed.score,
        passed: parsed.score >= 70,
        feedback: parsed.feedback,
        flags: parsed.flags ?? []
      };
    } catch (error) {
      console.error('❌ Evaluation failed:', error);
      return {
        score: 0,
        passed: false,
        feedback: 'Evaluation failed due to an error',
        flags: ['evaluation_error']
      };
    }
  }
}
