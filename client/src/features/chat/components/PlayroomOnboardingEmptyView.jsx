/**
 * PlayroomOnboardingEmptyView.jsx
 * Centered onboarding geometric view shown when no active teams exist in the current application.
 */

import React from 'react';
import { Button, Empty, Spin } from 'antd';
import { PlusOutlined } from '@ant-design/icons';

export function PlayroomOnboardingEmptyView({
  isLoadingTeams,
  setIsCreateModalOpen,
  renderCreateTeamModal,
}) {
  return (
    <div
      className="agent-playroom-wrapper state-onboarding-empty"
      style={{
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#fcfcfb',
      }}
    >
      <div style={{ maxWidth: 480, width: '100%', textAlign: 'center', padding: '24px' }}>
        {isLoadingTeams ? (
          <Spin size="large" tip="正在载入圆桌会项目组..." />
        ) : (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span style={{ color: '#64748b', fontSize: '13px', display: 'block', lineHeight: 1.6 }}>
                当前应用下暂无协同项目组。您可以通过组建项目组指派 CEO 并招募数字员工一同入驻像素办公室，启动 Milestone 流程仿真。
              </span>
            }
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setIsCreateModalOpen(true)}
              style={{ borderRadius: '6px', height: '36px', padding: '0 20px', marginTop: '12px', fontWeight: 600 }}
            >
              组建首个协同项目组
            </Button>
          </Empty>
        )}
      </div>
      {renderCreateTeamModal()}
    </div>
  );
}
