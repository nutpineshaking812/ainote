import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { db } from '../db/index.js';
import WorkflowRepository from '../repositories/workflow.repository.js';

/**
 * 自动从 registry/workflows 加载所有 JSON 定义
 */
const REGISTRY_DIR = path.join(__dirname, '../registry/workflows');

async function seed() {
  const force = process.argv.includes('--force');

  try {
    if (!fs.existsSync(REGISTRY_DIR)) {
      console.error(`Registry directory not found: ${REGISTRY_DIR}`);
      return;
    }

    const files = fs.readdirSync(REGISTRY_DIR).filter((f) => f.endsWith('.json'));
    const workflows = files.map((f) => {
      const content = fs.readFileSync(path.join(REGISTRY_DIR, f), 'utf-8');
      return JSON.parse(content);
    });

    console.log(`Read ${workflows.length} workflows from registry. Starting seed to PostgreSQL...`);

    for (const wf of workflows) {
      // Ensure workflowKey is set for system workflows
      if (!wf.workflowKey) {
        wf.workflowKey = wf.name;
      }
      wf.scope = 'SYSTEM'; // Safety override

      // Find existing in PG by Key and Scope (System has no appId)
      const existing = await WorkflowRepository.findOneByWorkflowKey(wf.workflowKey, null);

      if (!existing) {
        await WorkflowRepository.create(wf);
        console.log(`[Seed] Created system workflow in PG: ${wf.name} (${wf.workflowKey})`);
      } else if (force) {
        await WorkflowRepository.update(existing.id, wf);
        console.log(`[Seed] Forced UPDATE for system workflow in PG: ${wf.name}`);
      } else {
        console.log(
          `[Seed] System workflow "${wf.name}" already exists in PG, skipping. (Use --force to update)`,
        );
      }
    }
    console.log('Seeding completed successfully.');
  } catch (err) {
    console.error('Seed error:', err);
  } finally {
    process.exit(0);
  }
}

seed();

