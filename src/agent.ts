import Anthropic from '@anthropic-ai/sdk';
import { SkillLoader } from './skills/loader';
import { MemoryClient } from './memory/client';
import { Evaluator } from './evaluation/evaluator';

export interface AgentConfig {
  anthropicApiKey: string;
  neo4jUri: string;
  neo4jUser: string;
  neo4jPassword: string;
  model?: string;
}

export interface AgentResponse {
  content: string;
  toolsUsed: string[];
  memoryRetrieved: number;
  evaluationScore?: number;
}

export class ContextLayerAgent {
  private client: Anthropic;
  private skillLoader: SkillLoader;
  private memory: MemoryClient;
  private evaluator: Evaluator;
  private model: string;

  constructor(config: AgentConfig) {
    this.client = new Anthropic({ apiKey: config.anthropicApiKey });
    this.skillLoader = new SkillLoader();
    this.memory = new MemoryClient(config.neo4jUri, config.neo4jUser, config.neo4jPassword);
    this.evaluator = new Evaluator(config.anthropicApiKey);
    this.model = config.model || 'claude-opus-4-6';
  }

  registerSkill(definition: any, executor: any): void {
    this.skillLoader.registerSkill(definition, executor);
    console.log(`⚙️ Registered skill: ${definition.name}`);
  }

  async initialize(): Promise<void> {
    console.log('🔵 Initializing Context Layer Agent...');
    await this.memory.initialize();
    console.log('✅ Agent initialized successfully');
  }

  private async generateMemorySummary(query: string, response: string, toolsUsed: string[]): Promise<string> {
    const summaryPrompt = `Generate a 2-3 sentence factual summary of this research session. Include ONLY key findings, not conversational elements.

Query: ${query}
Tools used: ${toolsUsed.join(', ')}
Response: ${response.substring(0, 1000)}

Format as: "Research on [topic]: [key finding 1]. [key finding 2]. [optional: key finding 3]."`;

    try {
      const summaryResponse = await this.client.messages.create({
        model: this.model,
        max_tokens: 150,
        messages: [{ role: 'user', content: summaryPrompt }],
      });

      const summaryText = summaryResponse.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join(' ')
        .trim();

      return summaryText || `Research on "${query}": Used ${toolsUsed.join(', ')}.`;
    } catch (error) {
      console.error('Failed to generate memory summary:', error);
      return `Research on "${query}": Used ${toolsUsed.join(', ')}.`;
    }
  }

  async processQuery(query: string): Promise<AgentResponse> {
    console.log(`\n🔵 Processing query: "${query}"\n`);

    // 1. RETRIEVE MEMORY
    const relevantMemories = await this.memory.search(query, 3);
    console.log(`🧠 Retrieved ${relevantMemories.length} relevant memories`);

    const memoryContext = relevantMemories.length > 0
      ? `\n\n--- PRIOR RESEARCH CONTEXT (background only, not conversation history) ---\n${relevantMemories.map((m, i) => `[${new Date(m.timestamp).toISOString().split('T')[0]}] ${m.content}`).join('\n')}\n---`
      : '';

    // 2. SELECT SKILL
    const skills = this.skillLoader.getSkillDefinitions();
    const systemPrompt = `You are a research assistant with access to specialized skills. Use the available tools to help answer queries thoroughly.${memoryContext}`;

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: query,
      },
    ];

    // 3. GENERATE
    let response = await this.client.messages.create({
      model: this.model,
      max_tokens: 4096,
      system: systemPrompt,
      tools: skills.map((skill) => ({
        name: skill.name,
        description: skill.description,
        input_schema: skill.input_schema,
      })),
      messages,
    });

    const toolsUsed: string[] = [];
    let skillName = 'none';

    // Execute only the first tool once, then force final response
    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      // Use only the first tool
      const firstTool = toolUseBlocks[0];
      if (!firstTool) {
        throw new Error('No tool use block found despite stop_reason === tool_use');
      }

      console.log(`⚙️ Executing skill: ${firstTool.name}`);
      skillName = firstTool.name;
      toolsUsed.push(firstTool.name);

      const result = await this.skillLoader.executeSkill(firstTool.name, firstTool.input as Record<string, any>);

      // Add assistant message with only the first tool_use block
      messages.push({
        role: 'assistant',
        content: [
          ...response.content.filter((block): block is Anthropic.TextBlock => block.type === 'text'),
          firstTool,
        ],
      });

      // Add user message with the tool_result
      messages.push({
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: firstTool.id,
            content: result,
          },
        ],
      });

      // Get final response without tools (force text completion)
      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      });
    }

    let finalContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('\n');

    console.log(`\n📝 Response generated (${finalContent.length} chars)`);

    // 4. STORE TO MEMORY
    const memorySummary = await this.generateMemorySummary(query, finalContent, toolsUsed);
    await this.memory.store(memorySummary, {
      query,
      toolsUsed,
      timestamp: new Date().toISOString(),
    });

    // 5. EVALUATE
    let evaluation = await this.evaluator.evaluateResponse(
      query,
      skillName,
      finalContent,
      memoryContext
    );
    
    console.log(`📊 Evaluation score: ${evaluation.score}/100`);

    // Retry logic if score is below threshold
    if (!evaluation.passed) {
      console.log(`🔄 Score below threshold. Retrying with evaluator feedback...`);
      
      // Retry with feedback injected
      const retryPrompt = `${query}\n\n[Evaluator feedback]: ${evaluation.feedback}`;
      
      messages.push({
        role: 'user',
        content: retryPrompt,
      });

      response = await this.client.messages.create({
        model: this.model,
        max_tokens: 4096,
        system: systemPrompt,
        messages,
      });

      finalContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('\n');

      // Re-evaluate the retry
      evaluation = await this.evaluator.evaluateResponse(
        query,
        skillName,
        finalContent,
        memoryContext
      );
      
      console.log(`📊 Evaluation score: ${evaluation.score}/100`);
    }

    console.log(`✅ Returning response`);

    const agentResponse: AgentResponse = {
      content: finalContent,
      toolsUsed,
      memoryRetrieved: relevantMemories.length,
      evaluationScore: evaluation.score,
    };

    return agentResponse;
  }

  async close(): Promise<void> {
    await this.memory.close();
    console.log('✅ Agent closed');
  }
}
