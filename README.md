# Context Layer Agent

TypeScript research assistant with Skills, Memory, and Evaluation layers.

## Quick Start

```bash
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

## Architecture

- **Skills Layer**: Modular capabilities (research, synthesis)
- **Memory Layer**: Neo4j with full-text search for temporal context
- **Evaluation Layer**: Automated response quality assessment

## Requirements

- Node.js 18+
- Neo4j 5.x
- Anthropic API key

See `.context/PROJECT.md` for detailed documentation.
