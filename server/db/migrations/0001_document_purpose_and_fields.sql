-- Custom SQL migration to refactor documents table schema

-- 1. Create document_purpose enum
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_namespace n ON t.typnamespace = n.oid WHERE t.typname = 'document_purpose' AND n.nspname = 'lc') THEN
        CREATE TYPE "lc"."document_purpose" AS ENUM('NORMAL', 'SKILL', 'KNOWLEDGE');
    END IF;
END$$;

-- 2. Add new columns (safe: IF NOT EXISTS)
ALTER TABLE "lc"."documents" ADD COLUMN IF NOT EXISTS "purpose" "lc"."document_purpose" DEFAULT 'NORMAL' NOT NULL;
ALTER TABLE "lc"."documents" ADD COLUMN IF NOT EXISTS "description" text;
ALTER TABLE "lc"."documents" ADD COLUMN IF NOT EXISTS "parameters" jsonb DEFAULT '{}'::jsonb NOT NULL;

-- 3. Migrate existing data (only if old columns exist)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'lc' AND table_name = 'documents' AND column_name = 'skill_description'
    ) THEN
        UPDATE "lc"."documents" 
        SET 
            "description" = "skill_description", 
            "parameters" = "skill_parameters", 
            "purpose" = CASE WHEN "is_skill" = true THEN 'SKILL'::"lc"."document_purpose" ELSE 'NORMAL'::"lc"."document_purpose" END;
    END IF;
END$$;

-- 4. Drop deprecated columns (safe: IF EXISTS)
ALTER TABLE "lc"."documents" DROP COLUMN IF EXISTS "is_skill";
ALTER TABLE "lc"."documents" DROP COLUMN IF EXISTS "skill_description";
ALTER TABLE "lc"."documents" DROP COLUMN IF EXISTS "skill_parameters";
ALTER TABLE "lc"."documents" DROP COLUMN IF EXISTS "skill_tools";