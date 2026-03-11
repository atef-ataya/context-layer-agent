const neo4j = require('neo4j-driver');
require('dotenv').config();

async function clearMemory() {
  const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
  const user = process.env.NEO4J_USER || 'neo4j';
  const password = process.env.NEO4J_PASSWORD;

  if (!password) {
    console.error('❌ NEO4J_PASSWORD is required');
    process.exit(1);
  }

  const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
  const session = driver.session();

  try {
    console.log('🗑️  Clearing all memory entries...');
    const result = await session.run('MATCH (n:Memory) DETACH DELETE n RETURN count(n) as deleted');
    const deletedCount = result.records[0].get('deleted').toNumber();
    console.log(`✅ Deleted ${deletedCount} memory entries`);
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

clearMemory();
