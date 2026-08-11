import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

import { db } from '../db/index.js';
import { applications, digitalEmployees } from '../db/schema/index.js';
import { eq, and } from 'drizzle-orm';
import digitalEmployeeService from '../services/digitalEmployee.service.js';
import ApplicationRepository from '../repositories/application.repository.js';
import presetEmployees from '../registry/digital-employees/index.js';

async function seed() {
  const appIdArgIndex = process.argv.findIndex(arg => arg.startsWith('--appId='));
  let appId = appIdArgIndex !== -1 ? process.argv[appIdArgIndex].split('=')[1] : null;

  if (!appId) {
    const appIdIndex = process.argv.indexOf('--appId');
    if (appIdIndex !== -1 && process.argv[appIdIndex + 1]) {
      appId = process.argv[appIdIndex + 1];
    }
  }

  try {
    console.log(`📂 成功从 registry 引入了 ${presetEmployees.length} 个数字员工预设。`);

    // 2. 获取目标应用
    let targetApp;
    if (appId) {
      targetApp = await ApplicationRepository.findById(appId);
      if (!targetApp) {
        console.error(`❌ 未找到指定的应用，AppID: ${appId}`);
        process.exit(1);
      }
    } else {
      // 未指定 AppId，默认寻找第一个活跃的应用
      const allApps = await db.select().from(applications).limit(1);
      if (allApps.length === 0) {
        console.error('❌ 数据库中没有任何应用，请先在低代码平台中创建一个应用！');
        process.exit(1);
      }
      targetApp = allApps[0];
      appId = targetApp.id;
    }

    console.log(`🚀 开始为应用 【${targetApp.name}】 (ID: ${appId}) 注入内置数字员工...`);
    const userId = targetApp.owner || 'SYSTEM';

    let addedCount = 0;
    let skippedCount = 0;

    for (const preset of presetEmployees) {
      // 检查当前应用下是否已有同名员工，防止重复注入
      const existing = await db
        .select()
        .from(digitalEmployees)
        .where(
          and(
            eq(digitalEmployees.appRef, appId),
            eq(digitalEmployees.name, preset.name)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        console.log(`ℹ️ 数字员工 【${preset.name}】 已存在于该应用中，跳过注入。`);
        skippedCount++;
        continue;
      }

      // 创建数字员工，同时它会自动关联或克隆 DIGITAL_EMPLOYEE 大脑工作流！
      const newEmployee = await digitalEmployeeService.createEmployee(
        appId,
        {
          name: preset.name,
          roleTitle: preset.roleTitle,
          avatar: preset.avatar,
          description: preset.description,
          scenario: preset.scenario,
          metadata: {
            ...preset.metadata,
            roleKey: preset.roleKey
          },
          isActive: true
        },
        userId
      );

      console.log(`✅ 成功录用数字员工 【${preset.name}】 - 岗位: ${preset.roleTitle} (关联工作流: ${newEmployee.workflowId})`);
      addedCount++;
    }

    console.log(`\n🎉 注入完成！共录用新员工: ${addedCount} 名，跳过已存在员工: ${skippedCount} 名。`);
  } catch (err) {
    console.error('❌ 注入数字员工时出错:', err);
  } finally {
    process.exit(0);
  }
}

seed();
