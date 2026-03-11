import * as dotenv from 'dotenv';
import { ContextLayerAgent } from './agent';
import { researchQuickDefinition, ResearchQuickExecutor } from './skills/definitions/research-quick';
import { researchDeepDefinition, ResearchDeepExecutor } from './skills/definitions/research-deep';
import { synthesisDefinition, SynthesisExecutor } from './skills/definitions/synthesis';

dotenv.config();

async function main() {
  const task = process.argv.slice(2).join(' ');

  if (!task) {
    console.error('Usage: npm run dev "your task here"');
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  const neo4jUri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const neo4jUser = process.env.NEO4J_USER || 'neo4j';
  const neo4jPassword = process.env.NEO4J_PASSWORD;

  if (!apiKey) {
    console.error('❌ ANTHROPIC_API_KEY is required');
    process.exit(1);
  }

  if (!neo4jPassword) {
    console.error('❌ NEO4J_PASSWORD is required');
    process.exit(1);
  }

  const agent = new ContextLayerAgent({
    anthropicApiKey: apiKey,
    neo4jUri,
    neo4jUser,
    neo4jPassword,
  });

  agent.registerSkill(researchQuickDefinition, new ResearchQuickExecutor());
  agent.registerSkill(researchDeepDefinition, new ResearchDeepExecutor());
  agent.registerSkill(synthesisDefinition, new SynthesisExecutor());

  try {
    await agent.initialize();

    console.log('\n' + '='.repeat(80));
    console.log('Context Layer Agent');
    console.log('='.repeat(80) + '\n');

    const response = await agent.processQuery(task, true);
    console.log('\n📋 Final Response:');
    console.log(response.content);
    console.log(`\n✅ Tools used: ${response.toolsUsed.join(', ') || 'none'}`);
    console.log(`🧠 Memory retrieved: ${response.memoryRetrieved} entries`);
    if (response.evaluationScore) {
      console.log(`📊 Score: ${response.evaluationScore}/100`);
    }

    console.log('\n' + '='.repeat(80) + '\n');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await agent.close();
  }
}

main().catch(console.error);
