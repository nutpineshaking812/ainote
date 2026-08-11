import ApplicationRepository from '../../../repositories/application.repository.js';
import OrganizationMemberRepository from '../../../repositories/organizationMember.repository.js';

/** SKILL_REF 正则，用于提取说明书中的工具引用 */
export const SKILL_REF_REGEX = /\[SKILL_REF:\s*([^:]+):([^|\]]+?)\s*(?:\||\])/g;

/**
 * 将文档名称规范化为虚拟路径安全的名称
 */
export function safeName(doc) {
  const raw = doc.skillName || doc.title || `doc-${doc.id}`;
  return raw.trim().replace(/[\\/:*?"<>|]/g, '-');
}

/**
 * 从虚拟文件系统路径解析技能名称
 * 例如："/docs/question-parse/SKILL.md" -> "question-parse"
 */
export function extractSkillName(filePath) {
  const cleanPath = filePath.replace(/\\/g, '/');
  const parts = cleanPath.split('/');
  if (parts.length >= 4 && parts[1] === 'docs' && parts[3] === 'SKILL.md') {
    return parts[2];
  }
  return null;
}

/**
 * 获取用户的角色和部门上下文，用于访问权限控制
 */
export async function getUserContext(userId, appId) {
  if (!appId) return { roleIds: [], departmentIds: [] };
  const app = await ApplicationRepository.findById(appId);
  if (!app) return { roleIds: [], departmentIds: [] };
  const member = await OrganizationMemberRepository.findOne(userId, app.organizationId.toString());
  if (!member || member.status !== 'ACTIVE') {
    return {
      roleIds: [],
      departmentIds: [],
    };
  }
  return {
    roleIds: (member.roleIds || []).map((id) => id.toString()),
    departmentIds: (member.departmentIds || []).map((id) => id.toString()),
  };
}
