/**
 * PlayroomCreateTeamModal.jsx
 * The digital employee recruitment and workspace configuration dialog board.
 */

import React from 'react';
import { Modal, Input, Select, Tooltip, Tag } from 'antd';

export function PlayroomCreateTeamModal({
  isOpen,
  onOk,
  onCancel,
  teamNameInput,
  setTeamNameInput,
  selectedCeoId,
  handleCeoChange,
  availableAgents,
  selectedAgentIds,
  handleToggleAgent,
}) {
  return (
    <Modal
      title={
        <div style={{ fontSize: '15px', fontWeight: 800, color: '#37352f', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>📁</span>
          <span>组建数字员工协同项目组</span>
        </div>
      }
      open={isOpen}
      onOk={onOk}
      onCancel={onCancel}
      okText="确认入驻协同办公室"
      cancelText="取消"
      width={700}
      destroyOnClose
      centered
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px' }}>
        {/* Step 1: Name and CEO Selectors */}
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                协同项目组命名 <span style={{ color: 'red' }}>*</span>
              </label>
              <Input
                placeholder="项目组名称..."
                value={teamNameInput}
                onChange={(e) => setTeamNameInput(e.target.value)}
                style={{ borderRadius: '6px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '4px' }}>
                指派首席执行官 (CEO) <span style={{ color: 'red' }}>*</span>
              </label>
              <Select
                placeholder="选择一位担任首席执行官..."
                value={selectedCeoId}
                onChange={handleCeoChange}
                options={availableAgents.map((a) => ({
                  value: a.id,
                  label: `${a.name} [${a.role}]`,
                }))}
                style={{ width: '100%', borderRadius: '6px' }}
              />
            </div>
          </div>
        </div>

        {/* Step 2: Member Recruit Board */}
        <div>
          <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '8px' }}>
            招募并入驻数字员工小组成员 (最多 8 名)
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: '10px' }}>
            {availableAgents.map((candidate) => {
              const isCeo = candidate.id === selectedCeoId;
              const isSelected = selectedAgentIds.includes(candidate.id) || isCeo;
              const matched = { color: '#4f46e5' };

              return (
                <Tooltip key={candidate.id} title={candidate.description || '暂无描述'}>
                  <div
                    onClick={() => handleToggleAgent(candidate.id)}
                    style={{
                      padding: '10px 12px',
                      borderRadius: '8px',
                      border: isCeo
                        ? '1px solid #d97706'
                        : isSelected
                          ? '1px solid #4f46e5'
                          : '1px solid #edece9',
                      background: isCeo
                        ? '#fffbeb'
                        : isSelected
                          ? '#f5f3ff'
                          : '#fff',
                      cursor: isCeo ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0 }}>
                      <span style={{ fontSize: '18px' }}>👤</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#37352f', lineHeight: 1.1 }}>
                          {candidate.name}{' '}
                          {isCeo && <span style={{ color: '#d97706', fontSize: '9px' }}>👑</span>}
                        </div>
                        <span style={{ fontSize: '9px', color: '#94a3b8' }}>
                          {candidate.role}
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '2px',
                        border: isCeo
                          ? '1px solid #ffb300'
                          : isSelected
                            ? `1px solid ${matched.color}`
                            : '1px solid #cbd5e1',
                        background: isCeo
                          ? '#ffb300'
                          : isSelected
                            ? matched.color
                            : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '7px',
                      }}
                    >
                      {isCeo ? '👑' : isSelected && '✓'}
                    </div>
                  </div>
                </Tooltip>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}
