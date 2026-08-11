import React, { useState } from 'react';
import { Modal, List, Avatar, Typography, Space, Tag, Button, Divider } from 'antd';
import {
  TeamOutlined,
  RightOutlined,
  CheckOutlined,
  ApartmentOutlined,
  PlusOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useOrg } from '../store/OrgContext';
import CreateOrganizationModal from './CreateOrganizationModal';
import JoinOrganizationModal from './JoinOrganizationModal';

const { Text } = Typography;

export default function OrganizationSwitchModal({ open, onCancel, onSwitch }) {
  const { t } = useTranslation();
  const { organizations, currentOrganization, switchToOrganization } = useOrg();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);

  const handleSwitch = async (org) => {
    const orgId = org.id || org.organization?.id || org.organization?._id;
    const orgName = org.name || org.organization?.name;

    Modal.confirm({
      title: t('organization.switchConfirmTitle'),
      content: t('organization.switchConfirmContent', { name: orgName }),
      okText: t('common.confirm'),
      cancelText: t('common.cancel'),
      onOk: async () => {
        try {
          await switchToOrganization(orgId);
          if (onSwitch) {
            onSwitch(org);
          } else {
            window.location.href = '/';
          }
        } catch (err) {
          console.error('Switch organization failed', err);
        }
      },
    });
  };

  const sortedOrgs = [...(organizations || [])].sort((a, b) => {
    const aIsPersonal = a.type === 'PERSONAL' || a.organization?.type === 'PERSONAL';
    const bIsPersonal = b.type === 'PERSONAL' || b.organization?.type === 'PERSONAL';
    if (aIsPersonal) return -1;
    if (bIsPersonal) return 1;
    return 0;
  });

  return (
    <>
      <Modal
        title={t('organization.switchOrganization') || '切换组织'}
        open={open}
        onCancel={onCancel}
        footer={
          <div style={{ display: 'flex', gap: 8, width: '100%' }}>
            <Button
              type="default"
              style={{ flex: 1, borderRadius: 6, fontSize: 13 }}
              onClick={() => setShowJoinModal(true)}
            >
              {t('organization.joinBtn')}
            </Button>
            {organizations.length < 2 && (
              <Button
                type="default"
                style={{ flex: 1, borderRadius: 6, fontSize: 13 }}
                icon={<PlusOutlined />}
                onClick={() => setShowCreateModal(true)}
              >
                {t('organization.createNew')}
              </Button>
            )}
          </div>
        }
        width={380}
        centered
        styles={{
          body: { padding: '8px 16px 8px' },
          footer: { padding: '0 16px 16px', borderTop: 'none' },
        }}
      >
        <List
          dataSource={[...organizations].sort((a, b) => {
            if (a.type === 'PERSONAL') return -1;
            if (b.type === 'PERSONAL') return 1;
            return 0;
          })}
          renderItem={(org) => {
            const isCurrent = org.id === currentOrganization?.id;
            const isPersonal = org.type === 'PERSONAL';
            return (
              <List.Item
                onClick={() => !isCurrent && (onCancel(), handleSwitch(org))}
                style={{
                  cursor: isCurrent ? 'default' : 'pointer',
                  padding: '8px 12px',
                  borderRadius: 6,
                  marginBottom: 4,
                  background: isCurrent ? '#f0fdf4' : 'transparent',
                  border: isCurrent ? '1px solid #bdf4c9' : '1px solid #f0f0f0',
                  transition: 'all 0.2s',
                }}
                className={isCurrent ? '' : 'org-item-hover'}
              >
                <List.Item.Meta
                  avatar={
                    <div
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 4,
                        background: isPersonal ? '#f0f5ff' : '#f5f5f5',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      {org.logo ? (
                        <img
                          src={org.logo}
                          alt=""
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <ApartmentOutlined
                          style={{ color: isPersonal ? '#1890ff' : '#8c8c8c', fontSize: 14 }}
                        />
                      )}
                    </div>
                  }
                  title={
                    <Space size={4}>
                      <span style={{ fontWeight: isCurrent ? 600 : 400, fontSize: 13 }}>
                        {org.name}
                      </span>
                      {isPersonal && (
                        <Tag
                          color="blue"
                          style={{
                            margin: 0,
                            fontSize: 10,
                            borderRadius: 3,
                            padding: '0 4px',
                            lineHeight: '16px',
                          }}
                        >
                          个人
                        </Tag>
                      )}
                      {isCurrent && (
                        <Tag
                          color="success"
                          style={{
                            margin: 0,
                            fontSize: 10,
                            borderRadius: 3,
                            padding: '0 4px',
                            lineHeight: '16px',
                          }}
                        >
                          {t('common.current')}
                        </Tag>
                      )}
                    </Space>
                  }
                  description={
                    <Text
                      type="secondary"
                      style={{ fontSize: 11, display: 'block', marginTop: -2 }}
                      ellipsis
                    >
                      {org.slogan || isPersonal ? '我的个人空间' : '暂无标语'}
                    </Text>
                  }
                />
                {!isCurrent && <RightOutlined style={{ color: '#bfbfbf', fontSize: 10 }} />}
              </List.Item>
            );
          }}
        />
      </Modal>

      <CreateOrganizationModal
        open={showCreateModal}
        onCancel={() => setShowCreateModal(false)}
        onSuccess={async (newOrg) => {
          setShowCreateModal(false);
          onCancel(); // Close the switch modal too
          // Switch to the new org
          try {
            await switchToOrganization(newOrg.id);
            window.location.href = '/';
          } catch (err) {
            console.error('Switch to new organization failed', err);
          }
        }}
      />

      <JoinOrganizationModal
        open={showJoinModal}
        onCancel={() => setShowJoinModal(false)}
        onSuccess={async (joinedOrg) => {
          setShowJoinModal(false);
          onCancel(); // Close the switch modal too
          // Switch to the newly joined organization
          try {
            await switchToOrganization(joinedOrg.id);
            window.location.href = '/';
          } catch (err) {
            console.error('Switch to joined organization failed', err);
          }
        }}
      />
    </>
  );
}
