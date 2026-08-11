import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import WorkflowRepository from '../../repositories/workflow.repository.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REGISTRY_PATH = path.join(__dirname, '../../registry/workflows');

/**
 * Workflow Registry Service
 * Handles system-level default workflows defined in JSON files.
 */
class WorkflowRegistryService {
  constructor() {
    this.cache = null;
  }

  /**
   * Load all system default workflows from the registry directory.
   */
  async loadSystemDefaults() {
    if (this.cache) return this.cache;

    if (!fs.existsSync(REGISTRY_PATH)) {
      this.cache = [];
      return [];
    }

    const files = fs.readdirSync(REGISTRY_PATH);
    const defaults = [];

    for (const file of files) {
      if (file.endsWith('.json')) {
        try {
          const content = fs.readFileSync(path.join(REGISTRY_PATH, file), 'utf-8');
          const workflow = JSON.parse(content);
          // Set scope to SYSTEM if not present
          workflow.scope = 'SYSTEM';
          defaults.push(workflow);
        } catch (err) {
          console.error(`[WorkflowRegistry] Failed to load ${file}:`, err);
        }
      }
    }

    this.cache = defaults;
    return defaults;
  }

  /**
   * Get merged workflows for a specific app.
   * Merges system defaults with database overrides (shadowing).
   */
  async getMergedWorkflows(organizationId, appId = null) {
    const defaults = await this.loadSystemDefaults();

    // Find all database overrides for these system keys from PostgreSQL
    const systemKeys = defaults.map((d) => d.workflowKey);
    const dbOverrides =
      systemKeys.length > 0 ? await WorkflowRepository.findByWorkflowKeys(systemKeys, appId) : [];

    const result = defaults.map((def) => {
      // 1. Find the most specific override (App > Global DB > File)
      // Mirroring original logic: if appId is null, these might match the same record
      const appOverride = dbOverrides.find(
        (o) => o.workflowKey === def.workflowKey && o.appId?.toString() === appId?.toString(),
      );
      const globalOverride = dbOverrides.find(
        (o) => o.workflowKey === def.workflowKey && o.scope === 'SYSTEM' && !o.appId,
      );

      const merged = appOverride || globalOverride || { ...def, _id: `system_${def.workflowKey}` };

      // Result formatting: ensure BOTH id and _id exist for frontend stability
      return {
        ...merged,
        id: (merged.id || merged._id).toString(),
        isSystem: true,
        isCustomized: !!appOverride,
      };
    });

    return result;
  }

  /**
   * Get a specific system workflow by key, considering overrides.
   */
  async getWorkflowByKey(workflowKey, appId = null) {
    const def = await this.getRawSystemDefault(workflowKey);

    if (!def) return null;

    const override = await WorkflowRepository.findOneByWorkflowKey(workflowKey, appId);
    const merged = override || { ...def, _id: `system_${def.workflowKey}` };

    return {
      ...merged,
      id: (merged.id || merged._id).toString(),
      isSystem: true,
      isCustomized: override && override.appId?.toString() === appId?.toString(),
    };
  }

  /**
   * 仅获取系统默认定义 (忽略数据库中的任何覆盖)
   */
  async getRawSystemDefault(workflowKey) {
    const defaults = await this.loadSystemDefaults();
    return defaults.find((d) => d.workflowKey === workflowKey) || null;
  }
}

export default new WorkflowRegistryService();
