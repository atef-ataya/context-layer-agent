import neo4j, { Driver, Session } from 'neo4j-driver';

export interface MemoryEntry {
  id: string;
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export class MemoryClient {
  private driver: Driver;
  private indexCreated: boolean = false;

  constructor(uri: string, user: string, password: string) {
    this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  }

  async initialize(): Promise<void> {
    const session = this.driver.session();
    try {
      await session.run(`
        CREATE CONSTRAINT memory_id IF NOT EXISTS
        FOR (m:Memory)
        REQUIRE m.id IS UNIQUE
      `);

      await session.run(`
        CREATE FULLTEXT INDEX memory_content_index IF NOT EXISTS
        FOR (m:Memory)
        ON EACH [m.content]
      `);

      this.indexCreated = true;
      console.log('🧠 Memory layer initialized with full-text index');
    } catch (error) {
      console.error('Failed to initialize memory layer:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  async store(content: string, metadata?: Record<string, any>): Promise<string> {
    const session = this.driver.session();
    try {
      const id = `mem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const timestamp = new Date().toISOString();

      await session.run(
        `
        CREATE (m:Memory {
          id: $id,
          content: $content,
          timestamp: datetime($timestamp),
          metadata: $metadata
        })
        RETURN m.id as id
        `,
        { id, content, timestamp, metadata: JSON.stringify(metadata || {}) }
      );

      console.log(`💾 Stored memory: ${id}`);
      return id;
    } finally {
      await session.close();
    }
  }

  async search(query: string, limit: number = 5): Promise<MemoryEntry[]> {
    if (!this.indexCreated) {
      await this.initialize();
    }

    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        CALL db.index.fulltext.queryNodes('memory_content_index', $query)
        YIELD node, score
        RETURN node.id as id,
               node.content as content,
               node.timestamp as timestamp,
               node.metadata as metadata,
               score
        ORDER BY score DESC
        LIMIT $limit
        `,
        { query, limit: neo4j.int(limit) }
      );

      const memories: MemoryEntry[] = result.records.map((record) => ({
        id: record.get('id'),
        content: record.get('content'),
        timestamp: new Date(record.get('timestamp').toString()),
        metadata: JSON.parse(record.get('metadata') || '{}'),
      }));

      console.log(`🔍 Found ${memories.length} memories for query: "${query}"`);
      return memories;
    } finally {
      await session.close();
    }
  }

  async getRecent(limit: number = 10): Promise<MemoryEntry[]> {
    const session = this.driver.session();
    try {
      const result = await session.run(
        `
        MATCH (m:Memory)
        RETURN m.id as id,
               m.content as content,
               m.timestamp as timestamp,
               m.metadata as metadata
        ORDER BY m.timestamp DESC
        LIMIT $limit
        `,
        { limit: neo4j.int(limit) }
      );

      return result.records.map((record) => ({
        id: record.get('id'),
        content: record.get('content'),
        timestamp: new Date(record.get('timestamp').toString()),
        metadata: JSON.parse(record.get('metadata') || '{}'),
      }));
    } finally {
      await session.close();
    }
  }

  async close(): Promise<void> {
    await this.driver.close();
    console.log('🧠 Memory client closed');
  }
}
