# Context Layer Agent

A TypeScript research assistant demonstrating the integration of three key architectural layers:
- **Skills Layer**: Modular, reusable capabilities
- **Memory Layer**: Simplified temporal memory with Neo4j full-text search
- **Evaluation Layer**: Response quality assessment

## Architecture Overview

### Skills Layer (`src/skills/`)
The Skills Layer provides modular, reusable capabilities that extend the agent's functionality.

**Components:**
- `loader.ts`: Skill registration and execution system
- `definitions/`: Individual skill implementations
  - `research-quick.ts`: Fast web research
  - `research-deep.ts`: Comprehensive analysis
  - `synthesis.ts`: Multi-source information synthesis

**Design Principles:**
- Each skill is a self-contained module
- Skills expose structured schemas (Zod validation)
- Executor pattern for consistent execution
- Easy to add new skills by implementing the `SkillExecutor` interface

### Memory Layer (`src/memory/`)
A simplified temporal memory layer using Neo4j with full-text indexing for reliable retrieval.

**Components:**
- `client.ts`: Neo4j memory client with full-text search

**Key Features:**
- **Full-text indexing**: Uses Neo4j's `db.index.fulltext.queryNodes` for reliable semantic search
- **Temporal storage**: Timestamps for chronological ordering
- **Metadata support**: Extensible metadata for rich context
- **Recent memory access**: Retrieve last N interactions

**Note on Production Usage:**
This implementation demonstrates a simplified temporal memory layer. For production systems requiring sophisticated temporal knowledge graphs with entity extraction, relationship tracking, and advanced reasoning capabilities, consider using [Graphiti](https://github.com/getzep/graphiti) - a production-ready temporal knowledge graph library.

### Evaluation Layer (`src/evaluation/`)
Automated response quality assessment using Claude as an evaluator.

**Components:**
- `evaluator.ts`: Response evaluation system

**Evaluation Criteria:**
- **Accuracy**: Factual correctness
- **Completeness**: Coverage of the query
- **Relevance**: Alignment with the question
- **Clarity**: Communication quality

**Outputs:**
- Numeric score (0-100)
- Reasoning for the score
- Actionable improvement suggestions

## Project Structure

```
the-context-layer-part3/
├── .context/
│   └── PROJECT.md              # This file
├── src/
│   ├── agent.ts                # Main agent orchestration
│   ├── index.ts                # Entry point and demo
│   ├── skills/
│   │   ├── loader.ts           # Skill registration system
│   │   └── definitions/
│   │       ├── research-quick.ts
│   │       ├── research-deep.ts
│   │       └── synthesis.ts
│   ├── memory/
│   │   └── client.ts           # Neo4j memory client
│   └── evaluation/
│       └── evaluator.ts        # Response evaluator
├── package.json
├── tsconfig.json
└── .env.example
```

## Setup

### Prerequisites
- Node.js 18+
- Neo4j 5.x (running locally or remote)
- Anthropic API key

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up Neo4j:
```bash
# Using Docker
docker run -d \
  --name neo4j \
  -p 7474:7474 -p 7687:7687 \
  -e NEO4J_AUTH=neo4j/yourpassword \
  neo4j:latest
```

3. Configure environment:
```bash
cp .env.example .env
# Edit .env with your credentials
```

Required environment variables:
```
ANTHROPIC_API_KEY=your_api_key_here
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=yourpassword
```

### Running

```bash
# Development mode
npm run dev

# Build and run
npm run build
npm start
```

## Usage Example

```typescript
import { ContextLayerAgent } from './agent';
import { researchQuickDefinition, ResearchQuickExecutor } from './skills/definitions/research-quick';

const agent = new ContextLayerAgent({
  anthropicApiKey: process.env.ANTHROPIC_API_KEY!,
  neo4jUri: 'bolt://localhost:7687',
  neo4jUser: 'neo4j',
  neo4jPassword: process.env.NEO4J_PASSWORD!,
});

// Register skills
agent.registerSkill(researchQuickDefinition, new ResearchQuickExecutor());

// Initialize (creates Neo4j indexes)
await agent.initialize();

// Process queries
const response = await agent.processQuery(
  'What are the key principles of prompt engineering?',
  true  // Enable evaluation
);

console.log(response.content);
console.log(`Score: ${response.evaluationScore}/100`);
console.log(`Tools used: ${response.toolsUsed.join(', ')}`);
console.log(`Memory retrieved: ${response.memoryRetrieved} entries`);

await agent.close();
```

## Implementation Details

### Memory Retrieval Flow
1. Query arrives at agent
2. Agent searches memory using Neo4j full-text index
3. Top N relevant memories retrieved
4. Memory context injected into system prompt
5. Claude generates response with historical context

### Skill Execution Flow
1. Claude decides to use a tool
2. Agent receives tool_use block
3. SkillLoader executes the skill
4. Result returned to Claude
5. Claude continues reasoning or generates final response

### Evaluation Flow
1. Query and response sent to evaluator
2. Claude (as evaluator) assesses quality
3. Structured evaluation returned (score + reasoning)
4. Results logged and stored

## Emoji Log Prefixes

All log messages use specific emoji prefixes for visual clarity:

- 🔵 Agent lifecycle (initialization, shutdown)
- ⚙️ Skill operations (registration, execution)
- ✅ Success confirmations
- 🧠 Memory operations (store, retrieve)
- 📝 Response generation
- 🔍 Search operations
- 📊 Evaluation results
- 💾 Data persistence
- 📋 Results and outputs
- ❌ Errors

## Design Considerations

### Skills Layer
- **Modularity**: Each skill is independent and composable
- **Extensibility**: New skills added without modifying core
- **Type Safety**: Zod schemas for runtime validation
- **Tool Abstraction**: Claude-compatible tool definitions

### Memory Layer
- **Full-text Search**: Reliable retrieval using Neo4j native indexing
- **Temporal Awareness**: Timestamp-based ordering
- **Metadata Flexibility**: Store arbitrary context
- **Constraint Safety**: Unique ID constraints prevent duplicates

**Production Recommendation**: For advanced temporal reasoning, entity extraction, and relationship tracking, migrate to [Graphiti](https://github.com/getzep/graphiti) which provides:
- Automatic entity and relationship extraction
- Temporal reasoning capabilities
- Graph-based knowledge representation
- Production-ready scalability

### Evaluation Layer
- **Self-Assessment**: Claude evaluates its own responses
- **Structured Feedback**: JSON format for programmatic use
- **Multi-Criteria**: Customizable evaluation dimensions
- **Batch Support**: Efficient bulk evaluation

## Next Steps

### Enhancements
1. **Skills**: Add web search, document processing, data analysis
2. **Memory**: Implement memory consolidation and pruning
3. **Evaluation**: Add custom criteria and weighted scoring
4. **Observability**: Integrate tracing and metrics
5. **Production Memory**: Migrate to Graphiti for advanced temporal reasoning

### Production Considerations
1. **Error Handling**: Add retry logic and circuit breakers
2. **Monitoring**: Add structured logging and metrics
3. **Security**: Implement API key rotation and secrets management
4. **Scaling**: Connection pooling and query optimization
5. **Testing**: Unit tests, integration tests, and benchmarks
6. **Advanced Memory**: Use Graphiti for entity-relationship tracking

## References

- [Anthropic API Documentation](https://docs.anthropic.com/)
- [Neo4j Full-Text Search](https://neo4j.com/docs/cypher-manual/current/indexes-for-full-text-search/)
- [Zod Schema Validation](https://zod.dev/)
- [Graphiti - Temporal Knowledge Graphs](https://github.com/getzep/graphiti)
