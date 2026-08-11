import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { eq, and } from 'drizzle-orm';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { db } from '../db/index.js';
import { workflows } from '../db/schema/workflow.js';
import WorkflowRepository from '../repositories/workflow.repository.js';

const DEFAULTS_DIR = path.join(__dirname, '../resources/defaults/workflows');

/**
 * 导出指定名称的工作流到本地 JSON
 */
async function exportWorkflow(name, filename) {
  const [workflow] = await db.select().from(workflows).where(eq(workflows.name, name));
  
  if (!workflow) {
    console.error(`[Export] Workflow "${name}" not found in DB.`);
    return;
  }

  const exportData = {
    name: workflow.name,
    description: workflow.description,
    nodes: workflow.nodes,
    edges: workflow.edges,
    triggerType: workflow.triggerType,
    triggerConfig: workflow.triggerConfig,
    isSkill: workflow.isSkill,
    skillConfig: workflow.skillConfig,
    scope: 'SYSTEM', // 导出默认为系统级说明
  };

  const filePath = path.join(DEFAULTS_DIR, filename);
  if (!fs.existsSync(DEFAULTS_DIR)) {
    fs.mkdirSync(DEFAULTS_DIR, { recursive: true });
  }
  fs.writeFileSync(filePath, JSON.stringify(exportData, null, 2));
  console.log(`[Export] Successfully exported "${name}" to ${filePath}`);
}

/**
 * 将本地所有的默认 JSON 注入/同步到数据库
 * 如果 exists = true, 则根据 name 覆盖 (Restore)
 */
async function syncFromLocal(forceRestore = false) {
  if (!fs.existsSync(DEFAULTS_DIR)) return;
  const files = fs.readdirSync(DEFAULTS_DIR).filter((f) => f.endsWith('.json'));

  for (const file of files) {
    const filePath = path.join(DEFAULTS_DIR, file);
    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

    // Find in PG by name and scope
    const [existing] = await db.select().from(workflows).where(
      and(
        eq(workflows.name, data.name),
        eq(workflows.scope, 'SYSTEM')
      )
    );

    if (existing) {
      if (forceRestore) {
        await WorkflowRepository.update(existing.id, {
          ...data,
          status: 'ACTIVE'
        });
        console.log(`[Sync] Restored/Updated SYSTEM workflow: ${data.name}`);
      } else {
        // console.log(`[Sync] SYSTEM workflow "${data.name}" already exists, skipping.`);
      }
    } else {
      await WorkflowRepository.create({
        ...data,
        status: 'ACTIVE',
        organizationId: null,
        appId: null,
        scope: 'SYSTEM',
      });
      console.log(`[Sync] Injected NEW SYSTEM workflow: ${data.name}`);
    }
  }
}

async function run() {
  const command = process.argv[2]; // export | sync | restore
  const name = process.argv[3];
  const filename = process.argv[4];

  try {
    if (command === 'export') {
      if (!name || !filename) {
        console.error('Usage: node scripts/workflow-sync.js export "Workflow Name" "output.json"');
      } else {
        await exportWorkflow(name, filename);
      }
    } else if (command === 'restore') {
      await syncFromLocal(true);
    } else {
      await syncFromLocal(false);
    }
    console.log('Task completed.');
  } catch (err) {
    console.error('Error:', err);
  } finally {
    process.exit(0);
  }
}

run();

