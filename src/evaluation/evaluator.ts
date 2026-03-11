import Anthropic from '@anthropic-ai/sdk';

export interface EvaluationResult {
  score: number;
  reasoning: string;
  suggestions: string[];
}

export interface EvaluationCriteria {
  accuracy?: boolean;
  completeness?: boolean;
  relevance?: boolean;
  clarity?: boolean;
}

export class Evaluator {
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  async evaluateResponse(
    query: string,
    response: string,
    criteria: EvaluationCriteria = {}
  ): Promise<EvaluationResult> {
    const activeCriteria = {
      accuracy: criteria.accuracy !== false,
      completeness: criteria.completeness !== false,
      relevance: criteria.relevance !== false,
      clarity: criteria.clarity !== false,
    };

    const criteriaList = Object.entries(activeCriteria)
      .filter(([_, enabled]) => enabled)
      .map(([criterion]) => criterion);

    const prompt = `Evaluate the following response to a query based on these criteria: ${criteriaList.join(', ')}.

Query: "${query}"

Response: "${response}"

Provide:
1. A score from 0-100
2. Brief reasoning for the score
3. 2-3 specific suggestions for improvement

Format your response as JSON:
{
  "score": <number>,
  "reasoning": "<string>",
  "suggestions": ["<string>", "<string>", ...]
}`;

    try {
      const message = await this.client.messages.create({
        model: 'claude-opus-4-6',
        max_tokens: 1024,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
      });

      const content = message.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const jsonMatch = content.text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const result = JSON.parse(jsonMatch[0]) as EvaluationResult;
      console.log(`📊 Evaluation score: ${result.score}/100`);
      
      return result;
    } catch (error) {
      console.error('Evaluation failed:', error);
      return {
        score: 0,
        reasoning: 'Evaluation failed due to an error',
        suggestions: ['Retry evaluation', 'Check API connection'],
      };
    }
  }

  async evaluateBatch(
    evaluations: Array<{ query: string; response: string }>
  ): Promise<EvaluationResult[]> {
    console.log(`📊 Evaluating batch of ${evaluations.length} responses`);
    
    const results = await Promise.all(
      evaluations.map((item) => this.evaluateResponse(item.query, item.response))
    );

    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    console.log(`📊 Average batch score: ${avgScore.toFixed(1)}/100`);

    return results;
  }
}
