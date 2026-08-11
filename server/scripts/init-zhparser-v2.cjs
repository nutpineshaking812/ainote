const { Pool } = require('pg');
require('dotenv').config();

// 获取数据库连接 URL（优先使用 MONGO_URI 类似的 PG 变量，如果没有则从环境拼接）
const connectionString = process.env.DATABASE_URL || 'postgresql://user:password@localhost:5432/ainote';

const pool = new Pool({
  connectionString,
});

async function initializeDatabase() {
  const client = await pool.connect();
  try {
    console.log('--- Starting Database Environment Initialization ---');

    // 1. 创建扩展
    console.log('Step 1: Enabling extensions...');
    await client.query('CREATE EXTENSION IF NOT EXISTS vector;');
    await client.query('CREATE EXTENSION IF NOT EXISTS zhparser;');
    console.log('Extensions verified.');

    // 2. 创建 Schema
    console.log('Step 2: Ensuring schema "lc" exists...');
    await client.query('CREATE SCHEMA IF NOT EXISTS lc;');
    console.log('Schema "lc" verified.');

    // 3. 配置中文分词
    console.log('Step 3: Configuring "chinese" text search...');
    const configExists = await client.query("SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese'");
    if (configExists.rowCount === 0) {
      await client.query("CREATE TEXT SEARCH CONFIGURATION chinese (PARSER = zhparser);");
      console.log('Created text search configuration "chinese".');
    }
    
    // 刷新映射
    await client.query("ALTER TEXT SEARCH CONFIGURATION chinese ALTER MAPPING FOR n,v,a,i,e,l WITH simple;");
    console.log('Text search mapping updated.');

    // 4. 设置搜索路径 (全局) - 暂时注释掉，避免干扰 Drizzle Migration
    // console.log('Step 4: Setting search_path to include "lc"...');
    // await client.query('ALTER DATABASE ainote SET search_path = lc, ag_catalog, "$user", public;');
    // console.log('Search path updated successfully.');

    // 5. 验证表是否存在
    console.log('Step 5: Verifying ai_vectors table...');
    const tableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'lc' 
        AND table_name = 'ai_vectors'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('Table "lc.ai_vectors" is ready.');
      // 额外步骤：检查并创建 GIN 索引
      console.log('Step 6: Checking for GIN index...');
      await client.query(`
        DO $$ 
        BEGIN 
          IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'lc' AND indexname = 'ai_vectors_content_tsv_idx') THEN
            CREATE INDEX ai_vectors_content_tsv_idx ON lc.ai_vectors USING gin(to_tsvector('chinese', content));
            RAISE NOTICE 'Created missing GIN index';
          END IF;
        END $$;
      `);
      console.log('GIN index verified.');
    } else {
      console.warn('WARNING: Table "lc.ai_vectors" does not exist. You may need to run db:push.');
    }

    console.log('--- Initialization Complete ---');
    console.log('Note: Please restart your application server to apply new database settings.');

  } catch (err) {
    console.error('Initialization failed:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

initializeDatabase();
