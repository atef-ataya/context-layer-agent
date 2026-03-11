import { SkillDefinition, SkillExecutor } from '../loader';

export const researchQuickDefinition: SkillDefinition = {
  name: 'research_quick',
  description: 'Perform quick web research on a topic. Returns a brief summary with key facts.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'The research query or topic',
      },
    },
    required: ['query'],
  },
};

export class ResearchQuickExecutor implements SkillExecutor {
  async execute(params: Record<string, any>): Promise<string> {
    const query = params.query as string;
    
    return `📋 Quick research results for: "${query}"

This is a simulated quick research response. In a production system, this would:
- Perform web searches via APIs
- Extract key facts from top results
- Return a concise summary

Key findings:
• Topic overview identified
• Primary sources located
• Core concepts extracted

Research completed in quick mode.`;
  }
}
