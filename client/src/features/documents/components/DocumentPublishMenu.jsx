import React, { useState, useEffect, useCallback } from 'react';
import {
  Button,
  Dropdown,
  Badge,
  Tooltip,
  Tag,
  Space,
  Typography,
  Modal,
  List,
  Avatar,
  Divider,
  App,
} from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  TeamOutlined,
  HistoryOutlined,
  UserOutlined,
  SyncOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  discoverDocumentSkills,
  streamWorkflowExecute,
  getAllWorkflowExecutions,
} from '../../../api/workflow';
import { fetchEventSource } from '../../../utils/sse';
import { useAuth } from '../../../store/AuthContext';
import { useOrg } from '../../../store/OrgContext';
import dayjs from 'dayjs';
import resourceEventBus from '../../../pages/app-detail/utils/resourceEventBus.js';

const { Text } = Typography;

const DocumentPublishMenu = ({
  resourceId,
  documentId,
  tags = [],
  teamId,
  getMarkdownContent,
  content,
  title,
}) => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { currentOrganization } = useOrg();
  const effectiveTeamId = teamId || currentOrganization?.id || currentOrganization?._id;
  const { message } = App.useApp();

  const [skills, setSkills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [publishing, setPublishing] = useState(null);
  const [publishStatus, setPublishStatus] = useState({});
  const [historyVisible, setHistoryVisible] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const buttonStyle = {
    background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
    border: 'none',
    borderRadius: '14px',
    boxShadow: '0 4px 10px rgba(99, 102, 241, 0.2)',
    color: '#fff',
    fontWeight: 600,
    height: '28px',
    fontSize: '12px',
    padding: '0 12px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
    letterSpacing: '0.02em',
  };

  const loadSkills = useCallback(async () => {
    if (!tags || tags.length === 0) {
      setSkills([]);
      return;
    }

    try {
      setLoading(true);
      const tagsStr = Array.isArray(tags) ? tags.join(',') : tags;
      const res = await discoverDocumentSkills({ tags: tagsStr, teamId });
      setSkills(Array.isArray(res) ? res : res.data || []);
    } catch (err) {
      console.error('Failed to discover document skills', err);
    } finally {
      setLoading(false);
    }
  }, [tags, teamId]);

  const fetchHistory = useCallback(async () => {
    try {
      setHistoryLoading(true);
      const res = await getAllWorkflowExecutions({
        resourceId: documentId,
        resourceType: 'DOCUMENT',
        limit: 3,
      });
      setHistoryData(res.executions || []);
    } catch (err) {
      console.error('[ERROR] Failed to fetch history details:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    loadSkills();
    if (historyVisible) {
      fetchHistory();
    }
  }, [loadSkills, historyVisible, fetchHistory]);



  const handlePublish = async (skill) => {
    if (publishing) return;

    const isCrossOrg =
      skill.teamId && effectiveTeamId && skill.teamId.toString() !== effectiveTeamId.toString();

    // Show persistent loading message with cross-app synergy notification
    const loadingText = isCrossOrg
      ? `⚡ 跨应用协同中：正在安全调用「${skill.sourceTeam}」的「${skill.name}」操作...`
      : t('workflow.triggering', 'Starting: {{name}}...', { name: skill.name });

    const hideLoading = message.loading(loadingText, 0);

    setPublishing(skill.id);
    setPublishStatus((prev) => ({ ...prev, [skill.id]: 'loading' }));

    let markdownContent = content;
    if (getMarkdownContent) {
      try {
        markdownContent = await getMarkdownContent();
      } catch (err) {
        console.error('Failed to get markdown content', err);
      }
    }

    // 最小化改动：如果开启了 showStream，则桥接到对话框
    if (skill.showStream) {
      hideLoading();
      setPublishing(null);
      setPublishStatus((prev) => ({ ...prev, [skill.id]: 'loading' }));
      resourceEventBus.emit('chat:trigger-workflow', {
        workflowId: skill.id,
        userPrompt: isCrossOrg
          ? `⚡ 跨应用执行「${skill.sourceTeam}」的工作流：${skill.name}`
          : t('workflow.trigger_action', '⚡ 执行'),
        payload: {
          resourceId,
          documentId,
          title,
          content: markdownContent,
          author: user?.nickname || user?.username || 'Unknown',
          timestamp: new Date().toISOString(),
          tags,
          message: isCrossOrg
            ? `⚡ 跨应用执行「${skill.sourceTeam}」的工作流：${skill.name}`
            : t('workflow.trigger_action', '⚡ 执行'),
        },
      });
      return;
    }

    const closeConnection = fetchEventSource(
      streamWorkflowExecute(skill.id),
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          data: {
            resourceId,
            documentId,
            title,
            content: markdownContent,
            author: user?.nickname || user?.username || 'Unknown User',
            timestamp: new Date().toISOString(),
            tags,
          },
        }),
      },
      {
        onmessage: (msg) => {
          const { event } = msg;
          if (event === 'workflow:success') {
            hideLoading();
            const successText = isCrossOrg
              ? `🎉 跨应用协同成功！「${skill.sourceTeam}」的「${skill.name}」已顺利执行完毕`
              : t('workflow.publish.success', '{{name}} executed successfully', {
                  name: skill.name,
                });
            message.success(successText);
            setPublishStatus((prev) => ({ ...prev, [skill.id]: 'success' }));
            setPublishing(null);
            closeConnection();
          } else if (event === 'node:error') {
            try {
              const payload = JSON.parse(msg.data);
            } catch (e) {
              console.warn('Failed to parse node:error data', e);
            }
          } else if (event === 'workflow:error') {
            hideLoading();
            try {
              const payload = JSON.parse(msg.data);
              message.error(
                payload.error ||
                  t('workflow.publish.failed', 'Failed to execute {{name}}', { name: skill.name }),
              );
            } catch (e) {
              message.error(t('workflow.publish.failed', 'Execution failed'));
            }
            setPublishStatus((prev) => ({ ...prev, [skill.id]: 'error' }));
            setPublishing(null);
            closeConnection();
          }
        },
        onerror: (err) => {
          console.error('SSE Connection Error:', err);
          hideLoading();
          message.error(t('common.operationFailed', 'Operation failed'));
          setPublishing(null);
          closeConnection();
        },
      },
    );

    // Safety timeout (5 minutes)
    setTimeout(() => {
      hideLoading();
      closeConnection();
      setPublishing((curr) => (curr === skill.id ? null : curr));
    }, 300000);
  };

  const menuItems = [
    ...skills.map((skill) => {
      const status = publishStatus[skill.id];

      return {
        key: skill.id,
        label: (
          <div style={{ padding: '3px 4px', minWidth: '220px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '6px',
              }}
            >
              <div
                style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, flex: 1 }}
              >
                <Text
                  strong
                  style={{
                    color: '#1f2937',
                    fontSize: '12.5px',
                    letterSpacing: '-0.01em',
                    textOverflow: 'ellipsis',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {skill.name}
                </Text>
                {skill.teamId &&
                  effectiveTeamId &&
                  skill.teamId.toString() !== effectiveTeamId.toString() && (
                    <Tag
                      bordered={false}
                      style={{
                        fontSize: '8px',
                        borderRadius: '3px',
                        background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                        color: '#fff',
                        fontWeight: 700,
                        padding: '0 3px',
                        lineHeight: '12px',
                        height: '13px',
                        border: 'none',
                        flexShrink: 0,
                        boxShadow: '0 1px 4px rgba(236, 72, 153, 0.25)',
                      }}
                    >
                      跨应用
                    </Tag>
                  )}
              </div>
              {status === 'loading' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
                  <LoadingOutlined style={{ color: '#6366f1', fontSize: '11px' }} />
                  <span style={{ fontSize: '9px', color: '#6366f1', fontWeight: 500 }}>
                    running
                  </span>
                </div>
              )}
              {status === 'success' && (
                <CheckCircleOutlined
                  style={{ color: '#10b981', fontSize: '13px', flexShrink: 0 }}
                />
              )}
              {status === 'error' && (
                <CloseCircleOutlined
                  style={{ color: '#ef4444', fontSize: '13px', flexShrink: 0 }}
                />
              )}
            </div>
            {skill.description && (
              <div style={{ marginTop: 2, marginBottom: 4 }}>
                <Text
                  type="secondary"
                  style={{ fontSize: '10.5px', display: 'block', lineHeight: '1.3' }}
                >
                  {skill.description.length > 40
                    ? `${skill.description.slice(0, 40)}...`
                    : skill.description}
                </Text>
              </div>
            )}
            <div style={{ marginTop: skill.description ? 0 : 6 }}>
              <Space size={4} wrap>
                <Tag
                  icon={<TeamOutlined style={{ fontSize: '9px' }} />}
                  bordered={true}
                  style={{
                    fontSize: '9px',
                    borderRadius: '4px',
                    background: '#f8fafc',
                    borderColor: '#e2e8f0',
                    color: '#64748b',
                    fontWeight: 500,
                    marginRight: 0,
                    padding: '0 4px',
                  }}
                >
                  {skill.sourceTeam}
                </Tag>
                {(skill.matchTags || []).map((tag) => {
                  const tagColor = tag.color || '#4b5563';
                  return (
                    <Tag
                      key={tag.key}
                      size="small"
                      bordered={true}
                      style={{
                        fontSize: '9px',
                        borderRadius: '4px',
                        background: tag.color ? `${tag.color}15` : '#f3f4f6',
                        borderColor: tag.color ? `${tag.color}35` : '#e2e8f0',
                        color: tagColor,
                        fontWeight: 500,
                        marginRight: 0,
                        padding: '0 4px',
                      }}
                    >
                      {tag.label}
                    </Tag>
                  );
                })}
              </Space>
            </div>
          </div>
        ),
        onClick: () => handlePublish(skill),
        disabled: publishing !== null && publishing !== skill.id,
      };
    }),
    { type: 'divider' },
    {
      key: 'history',
      label: (
        <div style={{ padding: '4px 6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <HistoryOutlined style={{ color: '#6366f1' }} />
          <span style={{ fontSize: '11.5px', fontWeight: 500, color: '#4b5563' }}>
            {t('workflow.history.title', 'Execution History')}
          </span>
        </div>
      ),
      onClick: () => setHistoryVisible(true),
    },
  ];

  if (skills.length === 0 && !loading) return null;

  const btnTooltipTitle =
    skills.length === 1
      ? skills[0].name
      : t(
          'documentResourcePanel.smartActionsTooltip',
          'Discover and run actions based on document tags',
        );

  const btnElement = (
    <Button
      type="primary"
      icon={loading ? <LoadingOutlined /> : <span style={{ fontStyle: 'normal' }}>✨</span>}
      loading={publishing !== null}
      className="smart-actions-button"
      style={buttonStyle}
      onClick={skills.length === 1 ? () => handlePublish(skills[0]) : undefined}
      size="small"
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-1px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(99, 102, 241, 0.4)';
        e.currentTarget.style.filter = 'brightness(1.05)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 8px rgba(99, 102, 241, 0.25)';
        e.currentTarget.style.filter = 'brightness(1)';
      }}
    >
      {publishing !== null
        ? t('common.processing', 'Processing...')
        : skills.length === 1
          ? skills[0].name
          : t('common.smartActions', 'Smart Actions')}
    </Button>
  );

  return (
    skills.length > 0 && (
      <>
        {skills.length === 1 ? (
          <Space size={8}>
            <Tooltip title={btnTooltipTitle} placement="bottomLeft" arrow={{ pointAtCenter: true }}>
              <Badge count={0} size="small" offset={[2, 2]} color="#8b5cf6">
                {btnElement}
              </Badge>
            </Tooltip>
            <Tooltip title={t('workflow.history.title', 'Execution History')}>
              <Button
                type="text"
                icon={<HistoryOutlined />}
                onClick={() => setHistoryVisible(true)}
                style={{ color: '#64748b' }}
              />
            </Tooltip>
          </Space>
        ) : (
          <Dropdown
            trigger={['click']}
            disabled={loading}
            placement="bottomRight"
            open={menuOpen}
            onOpenChange={(flag) => setMenuOpen(flag)}
            overlayStyle={{ padding: 0, background: 'transparent', boxShadow: 'none' }}
            dropdownStyle={{ padding: 0, background: 'transparent', boxShadow: 'none' }}
            dropdownRender={() => (
              <div
                style={{
                  width: '280px',
                  background: 'rgba(255, 255, 255, 0.9)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: '1px solid rgba(255, 255, 255, 0.6)',
                  borderRadius: '16px',
                  padding: '12px',
                  boxShadow: '0 12px 30px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                {/* 顶部标题栏 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderBottom: '1px solid rgba(226, 232, 240, 0.6)',
                    paddingBottom: '8px',
                  }}
                >
                  <Space size={6}>
                    <span style={{ fontSize: '13px', display: 'flex', alignItems: 'center' }}>
                      ✨
                    </span>
                    <Text
                      strong
                      style={{ color: '#1f2937', fontSize: '12px', letterSpacing: '-0.01em' }}
                    >
                      数智协同推荐
                    </Text>
                  </Space>
                  <Button
                    type="text"
                    size="small"
                    icon={<HistoryOutlined style={{ fontSize: '11px', color: '#6366f1' }} />}
                    onClick={() => {
                      setHistoryVisible(true);
                      setMenuOpen(false);
                    }}
                    style={{
                      fontSize: '11px',
                      color: '#6366f1',
                      padding: '0 6px',
                      height: '20px',
                      borderRadius: '6px',
                      background: '#f5f3ff',
                      border: 'none',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    历史
                  </Button>
                </div>

                {/* 技能卡片流 */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    maxHeight: '320px',
                    overflowY: 'auto',
                    paddingRight: '2px',
                  }}
                >
                  {skills.map((skill) => {
                    const status = publishStatus[skill.id];
                    const isCrossOrg =
                      skill.teamId &&
                      effectiveTeamId &&
                      skill.teamId.toString() !== effectiveTeamId.toString();

                    return (
                      <div
                        key={skill.id}
                        onClick={() => handlePublish(skill)}
                        style={{
                          background: '#ffffff',
                          border: '1px solid rgba(241, 245, 249, 0.9)',
                          borderRadius: '12px',
                          padding: '10px 12px',
                          cursor: 'pointer',
                          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                          position: 'relative',
                          boxShadow: '0 2px 4px rgba(0, 0, 0, 0.01)',
                          userSelect: 'none',
                        }}
                        onMouseEnter={(e) => {
                          // e.currentTarget.style.transform = 'translateY(-1.5px)';
                          e.currentTarget.style.background =
                            'linear-gradient(135deg, #fbfaff 0%, #f6f9fe 100%)';
                          e.currentTarget.style.borderColor = 'rgba(99, 102, 241, 0.35)';
                          e.currentTarget.style.boxShadow = '0 6px 15px rgba(99, 102, 241, 0.08)';
                        }}
                        onMouseLeave={(e) => {
                          // e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.background = '#ffffff';
                          e.currentTarget.style.borderColor = 'rgba(241, 245, 249, 0.9)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0, 0, 0, 0.01)';
                        }}
                      >
                        {/* 名字与状态 */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                          }}
                        >
                          <span
                            style={{
                              fontWeight: 700,
                              fontSize: '12.5px',
                              color: '#1f2937',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              flex: 1,
                            }}
                          >
                            {skill.name}
                          </span>
                          {status === 'loading' && (
                            <LoadingOutlined style={{ color: '#6366f1', fontSize: '11px' }} />
                          )}
                          {status === 'success' && (
                            <CheckCircleOutlined style={{ color: '#10b981', fontSize: '12px' }} />
                          )}
                          {status === 'error' && (
                            <CloseCircleOutlined style={{ color: '#ef4444', fontSize: '12px' }} />
                          )}
                        </div>

                        {/* 描述 */}
                        {skill.description && (
                          <div style={{ marginTop: '4px', marginBottom: '6px' }}>
                            <Text
                              type="secondary"
                              style={{ fontSize: '10.5px', display: 'block', lineHeight: '1.3' }}
                            >
                              {skill.description.length > 36
                                ? `${skill.description.slice(0, 36)}...`
                                : skill.description}
                            </Text>
                          </div>
                        )}

                        {/* 底部属性与跨应用标 */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginTop: skill.description ? '0px' : '8px',
                            gap: '6px',
                          }}
                        >
                          <span
                            style={{
                              fontSize: '9px',
                              color: '#64748b',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '3px',
                            }}
                          >
                            <TeamOutlined style={{ fontSize: '8.5px' }} />
                            {skill.sourceTeam}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            {isCrossOrg && (
                              <span
                                style={{
                                  fontSize: '7.5px',
                                  borderRadius: '3px',
                                  background: 'linear-gradient(135deg, #a855f7 0%, #ec4899 100%)',
                                  color: '#fff',
                                  fontWeight: 700,
                                  padding: '0 3.5px',
                                  lineHeight: '11px',
                                  height: '11px',
                                  flexShrink: 0,
                                  boxShadow: '0 1px 3px rgba(236, 72, 153, 0.2)',
                                }}
                              >
                                跨应用
                              </span>
                            )}
                            {(skill.matchTags || []).slice(0, 1).map((tag) => {
                              const tagColor = tag.color || '#4b5563';
                              return (
                                <span
                                  key={tag.key}
                                  style={{
                                    fontSize: '7.5px',
                                    borderRadius: '3px',
                                    background: tag.color ? `${tag.color}15` : '#f3f4f6',
                                    border: `1px solid ${tag.color ? `${tag.color}35` : '#e2e8f0'}`,
                                    color: tagColor,
                                    fontWeight: 600,
                                    padding: '0 3.5px',
                                    lineHeight: '10px',
                                    height: '11px',
                                    flexShrink: 0,
                                  }}
                                >
                                  {tag.label}
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          >
            <Tooltip title={btnTooltipTitle} placement="bottomLeft" arrow={{ pointAtCenter: true }}>
              <Badge count={skills.length} size="small" offset={[2, 2]} color="#8b5cf6">
                {btnElement}
              </Badge>
            </Tooltip>
          </Dropdown>
        )}

        <Modal
          title={
            <Space>
              <HistoryOutlined style={{ color: '#6366f1' }} />
              <span style={{ fontWeight: 700, letterSpacing: '-0.01em' }}>
                {t('workflow.history.title', 'Execution History')}
              </span>
            </Space>
          }
          centered
          open={historyVisible}
          onCancel={() => setHistoryVisible(false)}
          footer={null}
          width={600}
          styles={{ body: { padding: '8px 12px 16px' } }}
          style={{ borderRadius: '16px', overflow: 'hidden' }}
        >
          <List
            loading={historyLoading}
            dataSource={historyData}
            renderItem={(item) => (
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #f1f5f9',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  marginBottom: '10px',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.03)';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                  e.currentTarget.style.borderColor = '#f1f5f9';
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Avatar
                    icon={<UserOutlined />}
                    src={item.triggeredBy?.avatar}
                    style={{
                      backgroundColor: '#e0e7ff',
                      color: '#4f46e5',
                      width: '36px',
                      height: '36px',
                      lineHeight: '36px',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        flexWrap: 'wrap',
                      }}
                    >
                      <Text
                        strong
                        style={{
                          color: '#1f2937',
                          fontSize: '13px',
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {item.workflowId?.name || 'Deleted Workflow'}
                      </Text>
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        by {item.triggeredBy?.name || item.triggeredBy?.username || 'Unknown'}
                      </Text>
                    </div>
                    <Text type="secondary" style={{ fontSize: '11px', marginTop: 2 }}>
                      {dayjs(item.createdAt).format('YYYY-MM-DD HH:mm:ss')}
                    </Text>
                    {item.status === 'FAILED' && item.error?.message && (
                      <Text
                        type="danger"
                        style={{
                          fontSize: '11px',
                          marginTop: 4,
                          display: 'block',
                          background: '#fff1f2',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          border: '1px solid #ffe4e6',
                        }}
                      >
                        {item.error.message}
                      </Text>
                    )}
                  </div>
                </div>
                <Tag
                  color={
                    item.status === 'SUCCESS'
                      ? 'success'
                      : item.status === 'FAILED'
                        ? 'error'
                        : 'processing'
                  }
                  icon={
                    item.status === 'SUCCESS' ? (
                      <CheckCircleOutlined />
                    ) : item.status === 'FAILED' ? (
                      <CloseCircleOutlined />
                    ) : (
                      <SyncOutlined spin />
                    )
                  }
                  style={{
                    borderRadius: '6px',
                    fontWeight: 600,
                    fontSize: '11px',
                    padding: '2px 8px',
                    border: 'none',
                    marginRight: 0,
                  }}
                >
                  {item.status}
                </Tag>
              </div>
            )}
            locale={{ emptyText: t('common.noData', 'No execution records found') }}
          />
        </Modal>
      </>
    )
  );
};

export default DocumentPublishMenu;
