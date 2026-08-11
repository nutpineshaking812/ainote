/**
 * PlayroomHeader.jsx
 * Ultimate Premium V5.0 - "Infinity Horizon" Cockpit Header.
 * Designed for extreme aesthetic luxury, deep cybernetic-notion fusion, and high-fidelity micro-interactions.
 * Key Refinements:
 * 1. BOTTOM [Micro-Laser Progress Rail]: A whisper-thin, dynamic gradient progress rail at the bottom margin,
 *    subtly flowing with a linear cyber laser pulse to show SOP milestone completion.
 * 2. LEFT [Notion Crystal Knob]: Title is nested in a sleek, borderless inset crystal container with a scale-down
 *    0.98x spring feedback upon clicking.
 * 3. CENTER [Frosted Oracle Isle / Milestone Pill]: Middle space holds the elegant dynamic stage indicator.
 *    In normal ticks, it renders as a beautiful self-contained slate capsule showing "当前阶段: xxx".
 *    In gated approval ticks, it smoothly transforms into a glowing warning pill with a gold gradient button.
 * 4. RIGHT [Commander CEO Crown Pill & Macaron Staff Stack]: CEO is uniquely extracted into a high-end gold
 *    capsule pill showing "👑 CEO: Name". The other digital employees are elegantly stacked as Macaron avatars next to it.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Divider,
  Button,
  Typography,
  Space,
  Popconfirm,
  Tag,
  Avatar,
  Tooltip,
  Badge,
  Modal,
  List,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  PauseCircleOutlined,
  PlayCircleOutlined,
  CheckCircleOutlined,
  FolderOpenOutlined,
  CheckOutlined,
  SwapOutlined,
  CompassOutlined,
  ApiOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';

const { Text } = Typography;

export function PlayroomHeader({
  activeTeamId,
  teamsList,
  loadExistingTeam,
  setIsCreateModalOpen,
  currentCeoAgent,
  agents,
  isRunningSOP,
  waitingForBossApproval,
  currentMilestone,
  approveMilestone,
  isPlaying,
  pauseSOP,
  resumeSOP,
  removeTeam,
  siderCollapsed,
  setSiderCollapsed,
}) {
  const { t } = useTranslation();
  const [isSwitchModalOpen, setIsSwitchModalOpen] = useState(false);
  const [isPressed, setIsPressed] = useState(false);

  // Helper to fetch first letter for Slack-style stack
  const getAbbr = (name) => {
    if (!name) return '?';
    const clean = name
      .replace(
        /[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD00-\uDFFF]/g,
        '',
      )
      .trim();
    return clean.charAt(clean.length - 1) || name.charAt(0);
  };

  const cleanCeoName = (name) => {
    if (!name) return '';
    return name.replace(/^👑\s*/, '').trim();
  };

  const activeTeam = teamsList.find((t) => t.id === activeTeamId);

  // Filter out the CEO for the staff stack representation
  const ceoId = currentCeoAgent?.id;
  const staffAgents = agents.filter((a) => a.id !== ceoId && a.role !== 'CEO' && !a.isCeo);

  return (
    <div
      style={{
        padding: '10px 24px',
        background: 'rgba(255, 255, 255, 0.82)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexShrink: 0,
        borderBottom: '1px solid rgba(226, 232, 240, 0.6)',
        marginBottom: 24,
        zIndex: 10,
        position: 'relative',
        height: '60px',
        userSelect: 'none',
      }}
    >
      {/* ==================== LEFT: NOTION CRYSTAL KNOB (SPRING CLICK) ==================== */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        {siderCollapsed && (
          <Tooltip title={t('dashboard.expandSidebar')}>
            <Button
              size="small"
              type="text"
              icon={
                <MenuUnfoldOutlined style={{ fontSize: '14px', color: '#64748b' }} />
              }
              onClick={() => setSiderCollapsed?.(false)}
              style={{
                width: '24px',
                height: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            />
          </Tooltip>
        )}
        <div
          onMouseDown={() => setIsPressed(true)}
          onMouseUp={() => setIsPressed(false)}
          onMouseLeave={() => setIsPressed(false)}
          onClick={() => setIsSwitchModalOpen(true)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            // background: 'rgba(0, 0, 0, 0.02)',
            padding: '5px 12px',
            borderRadius: '16px',
            // border: '1px solid rgba(0, 0, 0, 0.04)',
            cursor: 'pointer',
            // transform: isPressed ? 'scale(0.97)' : 'scale(1)',
            // transition: 'all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
            // boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.01)',
          }}
          className="crystal-knob-container"
        >
          {/* <CompassOutlined style={{ color: '#4f46e5', fontSize: '13px' }} /> */}
          <Text
            style={{
              fontWeight: 800,
              fontSize: '13.5px',
              color: '#0f172a',
              fontFamily: 'Outfit, sans-serif',
              letterSpacing: '-0.1px',
            }}
          >
            {activeTeam ? activeTeam.name : '未选定协同项目组'}
          </Text>
          <SwapOutlined style={{ fontSize: '10px', color: '#94a3b8' }} />
        </div>
      </div>

      {/* ==================== CENTER: FROSTED ORACLE APPROVAL ISLE / MILESTONE PILL ==================== */}
      <div style={{ flex: '1 1 200px', display: 'flex', justifyContent: 'center', minWidth: 0 }}>
        {isRunningSOP &&
          (waitingForBossApproval ? (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(255, 251, 235, 0.85)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(254, 240, 138, 0.8)',
                padding: '4px 12px 4px 10px',
                borderRadius: '20px',
                maxWidth: '400px',
                width: '100%',
                justifyContent: 'space-between',
                boxShadow: '0 4px 12px rgba(217, 119, 6, 0.05)',
                animation: 'border-glow-red-light 1.5s infinite alternate',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}
              >
                <Badge status="warning" className="pulse-tag" />
                <Text
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: '#b45309',
                  }}
                  ellipsis={{ tooltip: currentMilestone }}
                >
                  等待审批: {currentMilestone}
                </Text>
              </div>

              <Button
                type="primary"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={approveMilestone}
                style={{
                  background: 'linear-gradient(135deg, #fbbf24, #d97706)',
                  borderColor: '#d97706',
                  height: '20px',
                  fontSize: '10px',
                  borderRadius: '10px',
                  fontWeight: 700,
                  boxShadow: '0 2px 6px rgba(217, 119, 6, 0.2)',
                  marginLeft: '6px',
                  flexShrink: 0,
                  padding: '0 8px',
                }}
                className="boss-approve-glowing-btn"
              >
                准予
              </Button>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                padding: '4px 14px',
                borderRadius: '20px',
                maxWidth: '400px',
                width: '100%',
                justifyContent: 'center',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.01)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <Badge status="processing" />
                <Text
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 500,
                    color: '#475569',
                  }}
                  ellipsis={{ tooltip: currentMilestone || '仿真大纲规划中...' }}
                >
                  当前阶段: {currentMilestone || '仿真大纲规划中...'}
                </Text>
              </div>
            </div>
          ))}
      </div>

      {/* ==================== RIGHT: CEO CROWN PILL, AVATAR STACK & DECK CONTROLS ==================== */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {/* Dynamic AIs Online Status Capsule */}
        <Tooltip
          title={
            <div style={{ padding: '4px', fontSize: '11px', width: '180px' }}>
              {agents.map((agent) => (
                <div
                  key={agent.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '3px',
                    fontSize: '10px',
                  }}
                >
                  <span>
                    {agent.name} ({agent.role})
                  </span>
                  <span
                    style={{
                      color: agent.state === 'SLACKING' ? '#94a3b8' : '#34d399',
                      fontWeight: 700,
                    }}
                  >
                    {agent.state === 'SLACKING' ? 'SLACKING' : 'WORKING'}
                  </span>
                </div>
              ))}
            </div>
          }
          placement="bottomRight"
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: '#f0fdf4',
              border: '1px solid #dcfce7',
              padding: '4px 10px',
              borderRadius: '12px',
              cursor: 'pointer',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#22c55e',
                display: 'inline-block',
                animation: 'pulse-dot 1s infinite alternate',
              }}
            />
            <span style={{ fontSize: '11px', color: '#166534', fontWeight: 700 }}>
              {agents.length} AIs
            </span>
          </div>
        </Tooltip>

        <Divider type="vertical" style={{ height: '16px', borderColor: '#e2e8f0', margin: 0 }} />

        {/* 👑 Commander CEO Gold Capsule Pill */}
        {currentCeoAgent && (
          <Tooltip
            title={
              <div style={{ fontSize: '11.5px', lineHeight: 1.5, padding: '4px' }}>
                <div
                  style={{
                    fontWeight: 800,
                    color: '#fef3c7',
                    borderBottom: '1px solid rgba(255,255,255,0.2)',
                    paddingBottom: '2px',
                    marginBottom: '4px',
                  }}
                >
                  {cleanCeoName(currentCeoAgent.name)} 👑
                </div>
                <div style={{ opacity: 0.9 }}>
                  <b>职务:</b> 首席执行官 (CEO)
                </div>
                <div style={{ opacity: 0.8, fontSize: '10px', marginTop: '2px' }}>
                  职责: 项目总指挥及Milestone全局把控
                </div>
              </div>
            }
            placement="bottom"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
                border: '1px solid #fde68a',
                padding: '4px 12px 4px 6px',
                borderRadius: '16px',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(251, 191, 36, 0.05)',
                transition: 'all 0.2s ease-in-out',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#d97706';
                e.currentTarget.style.boxShadow = '0 3px 8px rgba(217, 119, 6, 0.15)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = '#fde68a';
                e.currentTarget.style.boxShadow = '0 2px 4px rgba(251, 191, 36, 0.05)';
                e.currentTarget.style.transform = 'none';
              }}
            >
              <Avatar
                size="small"
                style={{
                  backgroundColor: '#d97706',
                  color: '#ffffff',
                  border: 'none',
                  fontWeight: 800,
                  fontSize: '9.5px',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {getAbbr(currentCeoAgent.name)}
              </Avatar>
              <span
                style={{
                  fontSize: '12px',
                  fontWeight: 700,
                  color: '#b45309',
                  whiteSpace: 'nowrap',
                  fontFamily: 'Outfit, sans-serif',
                }}
              >
                👑 CEO: {cleanCeoName(currentCeoAgent.name)}
              </span>
            </div>
          </Tooltip>
        )}

        {/* Digital Employees (Staff Only, Excluding CEO) Stack */}
        {staffAgents.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '4px' }}>
            <span
              style={{
                fontSize: '12px',
                fontWeight: 700,
                color: '#64748b',
                whiteSpace: 'nowrap',
                fontFamily: 'Outfit, sans-serif',
              }}
            >
              员工:
            </span>
            <Avatar.Group
              maxCount={5}
              size="small"
              maxStyle={{
                color: '#4f46e5',
                backgroundColor: '#e0e7ff',
                fontSize: '10px',
                fontWeight: 700,
                border: '1.5px solid #ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              }}
            >
              {staffAgents.map((agent) => {
                const nameAbbr = getAbbr(agent.name);

                const bgColors = {
                  PM: '#e0f2fe',
                  DEV: '#dcfce7',
                  DEVELOPER: '#dcfce7',
                  ARCHITECT: '#f3e8ff',
                  TESTER: '#fee2e2',
                  QA: '#fee2e2',
                  DESIGN: '#fce7f3',
                  GENERAL: '#f1f5f9',
                  ASSIST: '#fef3c7',
                };
                const textColors = {
                  PM: '#0369a1',
                  DEV: '#15803d',
                  DEVELOPER: '#15803d',
                  ARCHITECT: '#6b21a8',
                  TESTER: '#b91c1c',
                  QA: '#b91c1c',
                  DESIGN: '#be185d',
                  GENERAL: '#475569',
                  ASSIST: '#b45309',
                };

                const roleKey = (agent.role || 'DEV').toUpperCase();
                const bg = bgColors[roleKey] || '#f1f5f9';
                const color = textColors[roleKey] || '#475569';

                return (
                  <Tooltip
                    key={agent.id}
                    title={
                      <div style={{ fontSize: '11px', lineHeight: 1.4, padding: '2px' }}>
                        <div style={{ fontWeight: 700, color: '#ffffff' }}>{agent.name}</div>
                        <div style={{ opacity: 0.9 }}>职责: {agent.role}</div>
                      </div>
                    }
                    placement="bottom"
                  >
                    <Avatar
                      style={{
                        backgroundColor: bg,
                        color: color,
                        fontWeight: 800,
                        fontSize: '10px',
                        border: '1.5px solid #ffffff',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                        cursor: 'pointer',
                        transition: 'transform 0.15s ease-in-out, z-index 0.15s',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.2) translateY(-2px)';
                        e.currentTarget.style.zIndex = 999;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                        e.currentTarget.style.zIndex = 'auto';
                      }}
                    >
                      {nameAbbr}
                    </Avatar>
                  </Tooltip>
                );
              })}
            </Avatar.Group>
          </div>
        )}

        <Divider type="vertical" style={{ height: '16px', borderColor: '#e2e8f0', margin: 0 }} />

        {/* Globalized Iconic Control Area */}
        <Space size={4}>
          <Tooltip title={isPlaying ? '暂停协同' : '恢复协同 ⚡'}>
            <Button
              type="text"
              icon={
                isPlaying ? (
                  <PauseCircleOutlined style={{ color: '#475569', fontSize: '16px' }} />
                ) : (
                  <PlayCircleOutlined style={{ color: '#6366f1', fontSize: '16px' }} />
                )
              }
              onClick={isPlaying ? pauseSOP : resumeSOP}
              style={{
                width: '28px',
                height: '28px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                background: isPlaying ? 'transparent' : '#f5f3ff',
              }}
            />
          </Tooltip>

          <Popconfirm
            title="确定要物理解散当前项目组吗？"
            description="解散后该项目的所有历史配置和仿真产出将被永久抹去，此操作不可逆。"
            onConfirm={async () => {
              if (activeTeamId) {
                await removeTeam(activeTeamId);
              }
            }}
            okText="确定解散"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Tooltip title="解散项目组">
              <Button
                type="text"
                danger
                icon={<DeleteOutlined style={{ fontSize: '15px' }} />}
                style={{
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '6px',
                }}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      </div>

      {/* ==================== WORKSPACE PROJECT SWITCHER MODAL DOCK ==================== */}
      <Modal
        title={
          <div
            style={{
              fontSize: '15px',
              fontWeight: 800,
              color: '#1e293b',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <span>📁</span>
            <span>切换协同项目组</span>
          </div>
        }
        open={isSwitchModalOpen}
        onCancel={() => setIsSwitchModalOpen(false)}
        footer={[
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setIsSwitchModalOpen(false);
              setIsCreateModalOpen(true);
            }}
            style={{ borderRadius: '6px', background: '#6366f1', borderColor: '#6366f1' }}
          >
            新建项目组
          </Button>,
          <Button
            key="close"
            onClick={() => setIsSwitchModalOpen(false)}
            style={{ borderRadius: '6px' }}
          >
            关闭
          </Button>,
        ]}
        width={500}
        centered
        destroyOnClose
      >
        <div style={{ marginTop: '12px' }}>
          <List
            dataSource={teamsList}
            renderItem={(item) => {
              const isActive = item.id === activeTeamId;
              return (
                <div
                  onClick={() => {
                    loadExistingTeam(item);
                    setIsSwitchModalOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 16px',
                    borderRadius: '8px',
                    border: isActive ? '1px solid #6366f1' : '1px solid #edece9',
                    background: isActive ? '#f5f3ff' : '#ffffff',
                    cursor: 'pointer',
                    marginBottom: '8px',
                    transition: 'all 0.2s',
                  }}
                  className="switch-team-item-card"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <FolderOpenOutlined
                      style={{ color: isActive ? '#6366f1' : '#94a3b8', fontSize: '16px' }}
                    />
                    <span
                      style={{
                        fontSize: '13px',
                        fontWeight: isActive ? 700 : 500,
                        color: isActive ? '#4f46e5' : '#334155',
                      }}
                    >
                      {item.name}
                    </span>
                  </div>
                  {isActive ? (
                    <Tag
                      color="purple"
                      icon={<CheckOutlined />}
                      style={{ margin: 0, fontWeight: 600 }}
                    >
                      当前活动中
                    </Tag>
                  ) : (
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>点击切换</span>
                  )}
                </div>
              );
            }}
          />
        </div>
      </Modal>
    </div>
  );
}
