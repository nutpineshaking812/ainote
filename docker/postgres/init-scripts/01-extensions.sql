-- 1. 创建核心扩展
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS zhparser;
CREATE EXTENSION IF NOT EXISTS age;

-- 2. 创建应用模式 (Schema)
CREATE SCHEMA IF NOT EXISTS lc;

-- 3. 配置中文分词 (zhparser)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_ts_config WHERE cfgname = 'chinese') THEN
        CREATE TEXT SEARCH CONFIGURATION chinese (PARSER = zhparser);
    END IF;
END $$;

-- 刷新映射规则 (n=名词, v=动词, a=形容词, i=成语, e=叹词, l=习用语)
ALTER TEXT SEARCH CONFIGURATION chinese ALTER MAPPING FOR n,v,a,i,e,l WITH simple;

-- 4. 优化：设置全局搜索路径
-- 确保 lc 模式被优先搜索，ag_catalog 用于 Apache AGE
DO $$
DECLARE
    db_name text;
BEGIN
    db_name := current_database();
    EXECUTE format('ALTER DATABASE %I SET search_path = lc, ag_catalog, "$user", public', db_name);
END $$;

-- 5. 性能优化：为全文检索创建 GIN 索引
-- 注意：实际建表通常由 Drizzle ORM 处理，所以这里加了 IF EXISTS 检查
DO $$ 
BEGIN 
    -- 只有当 ai_vectors 表存在且索引不存在时才创建
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'lc' AND table_name = 'ai_vectors') THEN
        IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'lc' AND indexname = 'ai_vectors_content_tsv_idx') THEN
            CREATE INDEX ai_vectors_content_tsv_idx ON lc.ai_vectors USING gin(to_tsvector('chinese', content));
            RAISE NOTICE 'Created GIN index for ai_vectors content';
        END IF;
    END IF;
END $$;
