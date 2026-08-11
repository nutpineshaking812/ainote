import React, { useState, useEffect, useRef } from 'react';
import {
  theme,
  Layout,
  Button,
  Typography,
  Avatar,
  Space,
  Form,
  Input,
  Select,
  Switch,
  message,
  Spin,
  Tag,
  Divider,
  Tooltip,
  Popconfirm,
  Badge,
  Dropdown,
  Collapse,
  Modal,
} from 'antd';
import {
  PlusOutlined,
  RobotOutlined,
  SaveOutlined,
  ThunderboltOutlined,
  SettingOutlined,
  SafetyCertificateOutlined,
  MessageOutlined,
  DeleteOutlined,
  MoreOutlined,
  ArrowLeftOutlined,
  CameraOutlined,
  LoadingOutlined,
  UndoOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useParams, useNavigate, useLocation, useBlocker } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  getDigitalEmployees,
  getDigitalEmployee,
  updateDigitalEmployee,
  initDigitalEmployeeWorkflow,
  deleteDigitalEmployee,
} from '../../api/digital-employees';
import { getWorkflowById } from '../../api/workflow';
import EmployeeEditModal from './components/EmployeeEditModal';
import {
  EMPLOYEE_SCENARIOS,
  EMPLOYEE_SCENARIO_LABELS,
  EMPLOYEE_SCENARIO_COLORS,
  EMPLOYEE_SCENARIO_OPTIONS,
} from '../../constants/employee';
import ChatAssistant from '../../features/chat/components/ChatAssistant';
import { ChatProvider } from '../../features/chat/context/ChatProvider';
import PageHeader from '../../components/PageHeader';
import { renderWorkflowFormItems } from '../../components/common/WorkflowFieldRenderer';
import ImageUploadCrop from '../../components/common/ImageUploadCrop';
import './EmployeeStudio.css';
import { getDisplayRole, ROLE_KEYS } from '../../constants/employee';

const { Sider } = Layout;
const { Title, Text, Paragraph } = Typography;
const { TextArea } = Input;

const AgentStudio = () => {
  const { t } = useTranslation();
  const { token } = theme.useToken();
  const { appId, employeeId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  const [employees, setEmployees] = useState([]);
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [creatingWorkflow, setCreatingWorkflow] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [listCollapsed, setListCollapsed] = useState(true);
  const [workflowInputs, setWorkflowInputs] = useState([]);
  const [activeWorkflow, setActiveWorkflow] = useState(null);
  const [currentConfig, setCurrentConfig] = useState({});
  const [hasDraft, setHasDraft] = useState(false);
  const [form] = Form.useForm();

  // 浏览器刷新拦截
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasDraft) {
        e.preventDefault();
        e.returnValue = ''; // 现代浏览器需要这个
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasDraft]);

  // 应用内导航拦截 (React Router v7 useBlocker)
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasDraft && currentLocation.pathname !== nextLocation.pathname,
  );

  useEffect(() => {
    if (blocker.state === 'blocked') {
      Modal.confirm({
        title: '离开当前编辑？',
        content: '您有未保存的修改，离开将丢失这些改动。',
        okText: '离开',
        cancelText: '留在当前页',
        onOk: () => blocker.proceed(),
        onCancel: () => blocker.reset(),
      });
    }
  }, [blocker]);

  const nameWatch = Form.useWatch('name', form);
  const avatarWatch = Form.useWatch('avatar', form);
  const roleTitleWatch = Form.useWatch('roleTitle', form);
  const scenarioWatch = Form.useWatch('scenario', form);

  useEffect(() => {
    fetchEmployees(true);
  }, [appId]);

  useEffect(() => {
    if (employeeId) {
      fetchEmployeeDetail(employeeId);
    } else {
      setEmployee(null);
      form.resetFields();
      setWorkflowInputs([]);
    }
  }, [employeeId]);

  const loadWorkflowSchema = async (wfId) => {
    try {
      const wf = await getWorkflowById(wfId, { appId });
      setActiveWorkflow(wf);
      const startNode = wf.nodes?.find((n) => n.type === 'capability');
      if (startNode?.data?.inputs) {
        const filtered = startNode.data.inputs.filter((i) => !i.isSystem && i.name !== 'message');
        setWorkflowInputs(filtered);
      } else {
        setWorkflowInputs([]);
      }
    } catch (err) {
      console.error('Failed to load workflow schema:', err);
    }
  };

  const fetchEmployees = async (selectTarget = null) => {
    try {
      setLoading(true);
      const res = await getDigitalEmployees(appId);
      const list = res.data || res || [];
      setEmployees(list);
      // Collapse when data exists, expand when empty
      setListCollapsed(list.length > 0);

      if (selectTarget && selectTarget !== true) {
        navigate(`/apps/${appId}/digital-employees/${selectTarget}`);
      } else if (selectTarget === true && list.length > 0 && !employeeId) {
        navigate(`/apps/${appId}/digital-employees/${list[0].id || list[0]._id}`);
      }
    } catch (err) {
      message.error('加载列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployeeDetail = async (id) => {
    try {
      setDetailLoading(true);
      form.resetFields();
      const empData = await getDigitalEmployee(appId, id);
      setEmployee(empData);

      const roleValue = empData.roleTitle;
      const roleTitle = Array.isArray(roleValue) ? roleValue : roleValue ? [roleValue] : [];

      const initialValues = {
        ...empData,
        roleTitle,
        scenario: empData.scenario || 'GENERAL',
        ...(empData.metadata || {}),
      };

      form.setFieldsValue(initialValues);
      setCurrentConfig(initialValues);

      // --- 草稿恢复逻辑 ---
      const draftKey = `agent_draft_${appId}_${id}`;
      const savedDraft = localStorage.getItem(draftKey);
      if (savedDraft) {
        try {
          const { values, timestamp } = JSON.parse(savedDraft);
          // 如果草稿存在且是最近1小时内的（或者你可以根据需要调整判断逻辑）
          if (values) {
            form.setFieldsValue(values);
            setCurrentConfig(values);
            setHasDraft(true);
            message.info('已为您恢复未保存的草稿');
          }
        } catch (e) {
          console.error('Failed to parse draft:', e);
        }
      } else {
        setHasDraft(false);
      }

      // 优化：直接从详情数据中获取工作流定义，减少 API 调用
      if (empData.workflowSchema) {
        setWorkflowInputs(empData.workflowSchema);
      } else {
        setWorkflowInputs([]);
      }
    } catch (err) {
      message.error('获取详情失败');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setSaving(true);

      const basicFields = [
        'name',
        'roleTitle',
        'avatar',
        'description',
        'scenario',
        'workflowId',
        'isActive',
      ];
      const metadata = {};
      const payload = {};

      Object.keys(values).forEach((key) => {
        if (basicFields.includes(key)) {
          payload[key] = values[key];
        } else {
          metadata[key] = values[key];
        }
      });

      const processedValues = {
        ...payload,
        roleTitle: payload.roleTitle && payload.roleTitle.length > 0 ? payload.roleTitle[0] : '',
        metadata,
      };

      await updateDigitalEmployee(appId, { id: employeeId, ...processedValues });

      message.success('档案保存成功');
      // 清除草稿
      localStorage.removeItem(`agent_draft_${appId}_${employeeId}`);
      setHasDraft(false);

      setEmployee((prev) => ({ ...prev, ...processedValues }));
      setCurrentConfig(values);
      fetchEmployees(false);
    } catch (err) {
      if (err.errorFields) {
        message.warning('请检查必填配置');
        return;
      }
      message.error(`保存失败: ${err.message || '未知错误'}`);
    } finally {
      setSaving(false);
    }
  };

  const handleDiscardDraft = () => {
    Modal.confirm({
      title: '放弃未保存的修改？',
      content: '这将丢弃当前所有未保存的改动，并回退到最后一次保存的状态。',
      okText: '确定放弃',
      cancelText: '取消',
      okButtonProps: { danger: true },
      onOk: () => {
        localStorage.removeItem(`agent_draft_${appId}_${employeeId}`);
        setHasDraft(false);
        fetchEmployeeDetail(employeeId);
        message.success('已回退到保存版本');
      },
    });
  };

  const handleDelete = async () => {
    try {
      // Find the next available employee to select
      const remaining = employees.filter((e) => (e.id || e._id) !== employeeId);

      await deleteDigitalEmployee(appId, employeeId);
      message.success('职员档案已销毁');

      // Refresh the list
      await fetchEmployees(false);

      // Navigate to the first remaining employee if available
      if (remaining.length > 0) {
        const nextId = remaining[0].id || remaining[0]._id;
        navigate(`/apps/${appId}/digital-employees/${nextId}`);
      } else {
        navigate(`/apps/${appId}/digital-employees`);
      }
    } catch (err) {
      message.error(`删除失败: ${err.message || ''}`);
    }
  };

  const handleInitWorkflow = async () => {
    if (employee?.workflowId) {
      navigate(`/apps/${appId}/workflows/${employee.workflowId}`, {
        state: {
          backPath: location.pathname,
          employeeName: employee?.name,
        },
      });
    } else {
      try {
        setCreatingWorkflow(true);
        await initDigitalEmployeeWorkflow(appId, employeeId);
        message.success('逻辑引擎初始化成功');
        await fetchEmployeeDetail(employeeId);
      } catch (err) {
        message.error(`引擎准备失败: ${err.message || ''}`);
      } finally {
        setCreatingWorkflow(false);
      }
    }
  };

  const renderDynamicFormItems = () => {
    if (!workflowInputs || workflowInputs.length === 0) return null;
    return renderWorkflowFormItems(workflowInputs, appId);
  };

  // ─── Render ────────────────────────────────────────────────────────────────
  return (
    <Layout className="agent-studio-root">
      {/* ── Top Header ── */}
      <PageHeader
        onBack={() => navigate(`/apps/${appId}`)}
        title="数字员工"
        showUser
        extra={
          <Tooltip title="编辑内容会自动保存为本地草稿，点击“保存”同步至服务器。">
            <InfoCircleOutlined style={{ color: '#94a3b8', cursor: 'help', fontSize: 16 }} />
          </Tooltip>
        }
        style={{ flexShrink: 0 }}
      />

      {/* ── Body: 3-column ── */}
      <div className="agent-studio-body">
        {/* Column 1: Employee List */}
        <div
          className={`agent-studio-col agent-studio-col--list ${listCollapsed ? 'is-collapsed' : ''}`}
        >
          {/* Header with Title and Toggle */}
          <div
            className="agent-col-header"
            style={{
              justifyContent: listCollapsed ? 'center' : 'space-between',
              transition: 'all 0.2s',
            }}
          >
            {!listCollapsed && (
              <Title
                level={5}
                style={{ margin: 0, fontSize: 13, fontWeight: 700, color: '#475569' }}
              >
                职员列表
              </Title>
            )}
            <Button
              type="text"
              size="small"
              icon={
                listCollapsed ? (
                  <PlusOutlined style={{ transform: 'rotate(45deg)' }} />
                ) : (
                  <ArrowLeftOutlined style={{ fontSize: 12 }} />
                )
              }
              onClick={() => setListCollapsed((v) => !v)}
              className="list-col-inline-toggle"
              style={{
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                minWidth: 24,
                padding: 0,
              }}
            />
          </div>

          {/* Scrollable list area */}
          <div className="agent-col-scroll list-col-scroll">
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
                <Spin size="small" />
              </div>
            ) : employees.length === 0 && !listCollapsed ? (
              <div style={{ padding: '24px 12px', textAlign: 'center' }}>
                <RobotOutlined
                  style={{ fontSize: 28, color: '#e2e8f0', marginBottom: 8, display: 'block' }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  暂无员工
                </Text>
              </div>
            ) : (
              employees.map((emp) => {
                const empId = emp.id || emp._id;
                const isSelected = empId === employeeId;
                return (
                  <Tooltip key={empId} title={listCollapsed ? emp.name : ''} placement="right">
                    <div
                      className={`employee-list-item ${isSelected ? 'selected' : ''} ${listCollapsed ? 'collapsed' : ''}`}
                      onClick={() => navigate(`/apps/${appId}/digital-employees/${empId}`)}
                    >
                      <Avatar
                        src={emp.avatar}
                        size={32}
                        style={{
                          backgroundColor: !emp.avatar ? token.colorPrimary : 'transparent',
                          color: '#fff',
                          fontSize: 13,
                          fontWeight: 700,
                          flexShrink: 0,
                          boxShadow: emp.avatar ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                        }}
                      >
                        {emp.name?.[0]}
                      </Avatar>
                      {!listCollapsed && (
                        <div style={{ flex: 1, minWidth: 0, marginLeft: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Text
                              style={{
                                fontSize: 13,
                                fontWeight: isSelected ? 600 : 400,
                                color: isSelected ? token.colorPrimary : '#1e293b',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {emp.name}
                            </Text>
                            {emp.isActive && <Badge status="processing" />}
                          </div>
                          <Text
                            type="secondary"
                            style={{
                              fontSize: 11,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: 'block',
                            }}
                          >
                            {getDisplayRole(emp.roleTitle, t)}
                          </Text>
                        </div>
                      )}
                    </div>
                  </Tooltip>
                );
              })
            )}
          </div>

          {/* Add button – pinned to bottom */}
          <div className="list-col-footer">
            <Tooltip title={listCollapsed ? '新建数字员工' : ''} placement="right">
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={() => setDrawerOpen(true)}
                className={`list-add-btn ${listCollapsed ? 'icon-only' : ''}`}
              >
                {!listCollapsed && '新建数字员工'}
              </Button>
            </Tooltip>
          </div>
        </div>

        {/* Column 2: Config Panel */}
        <div className="agent-studio-col agent-studio-col--config">
          {detailLoading ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '100%',
              }}
            >
              <Spin size="large" />
            </div>
          ) : employee ? (
            <>
              {/* Config col header */}
              <div className="agent-col-header config-col-header">
                {/* Left: Profile Info */}
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, flex: 1 }}
                >
                  <Avatar
                    src={avatarWatch || employee.avatar}
                    size={36}
                    style={{
                      backgroundColor: !avatarWatch && !employee.avatar ? '#f0f2f5' : 'transparent',
                      color: token.colorPrimary,
                      fontWeight: 700,
                      fontSize: 15,
                      flexShrink: 0,
                      border: '1.5px solid #fff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
                    }}
                  >
                    {uploading ? <LoadingOutlined /> : (nameWatch || employee.name)?.[0]}
                  </Avatar>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <Text
                      strong
                      style={{
                        fontSize: 13,
                        color: '#1e293b',
                        display: 'block',
                        lineHeight: 1.2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {nameWatch || employee.name}
                    </Text>
                    <Text
                      type="secondary"
                      style={{
                        fontSize: 10.5,
                        color: '#64748b',
                        display: 'block',
                        lineHeight: 1.2,
                        marginTop: 2,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {(() => {
                        const rawRole =
                          roleTitleWatch !== undefined ? roleTitleWatch : employee?.roleTitle;
                        const finalRole = Array.isArray(rawRole) ? rawRole[0] : rawRole;
                        const displayRole =
                          finalRole && finalRole !== '待设定角色'
                            ? getDisplayRole(finalRole, t)
                            : '待设定角色';
                        const scenarioText =
                          EMPLOYEE_SCENARIO_LABELS[
                            scenarioWatch || employee?.scenario || 'GENERAL'
                          ] || '通用助理';
                        return `${displayRole} · ${scenarioText}`;
                      })()}
                    </Text>
                  </div>
                </div>

                {/* Right: Actions */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                  {hasDraft && (
                    <Tooltip title="放弃未保存的修改">
                      <Button
                        size="small"
                        type="text"
                        icon={<UndoOutlined />}
                        onClick={handleDiscardDraft}
                        style={{
                          color: '#64748b',
                          borderRadius: 6,
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      />
                    </Tooltip>
                  )}
                  <Button
                    size="small"
                    icon={<ThunderboltOutlined style={{ fontSize: 12 }} />}
                    onClick={handleInitWorkflow}
                    loading={creatingWorkflow}
                    style={{
                      borderRadius: 6,
                      fontWeight: 500,
                      height: 28,
                      fontSize: 12,
                      padding: '0 10px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    设计
                  </Button>
                  <Badge dot={hasDraft} offset={[-1, 1]}>
                    <Button
                      size="small"
                      type={hasDraft ? 'primary' : 'default'}
                      icon={<SaveOutlined style={{ fontSize: 12 }} />}
                      loading={saving}
                      onClick={handleSave}
                      style={{
                        borderRadius: 6,
                        fontWeight: 500,
                        height: 28,
                        fontSize: 12,
                        padding: '0 12px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                      }}
                    >
                      保存
                    </Button>
                  </Badge>

                  <Dropdown
                    menu={{
                      items: [
                        {
                          key: 'delete',
                          danger: true,
                          icon: <DeleteOutlined />,
                          label: (
                            <Popconfirm
                              title="注销档案"
                              description="确定要销毁该职员档案吗？此操作不可撤销。"
                              onConfirm={handleDelete}
                              okText="确定"
                              cancelText="取消"
                              okButtonProps={{ danger: true }}
                            >
                              <span>销毁档案</span>
                            </Popconfirm>
                          ),
                        },
                      ],
                    }}
                    placement="bottomRight"
                    trigger={['click']}
                  >
                    <Button
                      type="text"
                      size="small"
                      icon={<MoreOutlined />}
                      style={{ color: '#94a3b8', borderRadius: 6, flexShrink: 0 }}
                    />
                  </Dropdown>
                </div>
              </div>

              {/* Scrollable form area */}
              <div className="agent-col-scroll">
                <Form
                  key={employeeId}
                  form={form}
                  layout="vertical"
                  requiredMark={false}
                  className="studio-form"
                  onValuesChange={(_, allValues) => {
                    setCurrentConfig(allValues);
                    // 自动保存草稿
                    if (employeeId) {
                      localStorage.setItem(
                        `agent_draft_${appId}_${employeeId}`,
                        JSON.stringify({
                          values: allValues,
                          timestamp: Date.now(),
                        }),
                      );
                      setHasDraft(true);
                    }
                  }}
                >
                  {/* Basic Info (Collapsed by default) */}
                  <Collapse
                    ghost
                    size="small"
                    className="profile-collapse"
                    items={[
                      {
                        key: 'profile',
                        label: (
                          <Text type="secondary" style={{ fontSize: 13 }}>
                            职员档案
                          </Text>
                        ),
                        children: (
                          <div
                            className="config-section"
                            style={{
                              border: '1px solid #f1f5f9',
                              padding: 16,
                              borderRadius: 12,
                              marginBottom: 16,
                            }}
                          >
                            <div style={{ textAlign: 'center', marginBottom: 24 }}>
                              <Form.Item name="avatar" noStyle>
                                <Input hidden />
                              </Form.Item>
                              <ImageUploadCrop
                                value={avatarWatch || employee.avatar}
                                onChange={(url) => {
                                  form.setFieldsValue({ avatar: url });
                                  setEmployee((prev) => ({ ...prev, avatar: url }));
                                  setCurrentConfig((prev) => ({ ...prev, avatar: url }));
                                }}
                                onStatusChange={setUploading}
                                usageType="digital_employee_avatar"
                                usageId={employeeId}
                                maxWidth={200}
                                maxHeight={200}
                              >
                                <div
                                  style={{
                                    position: 'relative',
                                    display: 'inline-block',
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Avatar
                                    src={avatarWatch || employee.avatar}
                                    size={80}
                                    style={{
                                      backgroundColor:
                                        !avatarWatch && !employee.avatar
                                          ? '#f0f2f5'
                                          : 'transparent',
                                      color: token.colorPrimary,
                                      fontWeight: 700,
                                      fontSize: 32,
                                      flexShrink: 0,
                                      border: '4px solid #fff',
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
                                    }}
                                  >
                                    {uploading ? (
                                      <LoadingOutlined />
                                    ) : (
                                      (nameWatch || employee.name)?.[0]
                                    )}
                                  </Avatar>
                                  <Button
                                    shape="circle"
                                    size="small"
                                    icon={<CameraOutlined />}
                                    style={{
                                      position: 'absolute',
                                      bottom: 0,
                                      right: 0,
                                      boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                      zIndex: 1,
                                    }}
                                  />
                                </div>
                              </ImageUploadCrop>
                            </div>

                            <Form.Item name="name" label="职员姓名" rules={[{ required: true }]}>
                              <Input placeholder="输入职员姓名..." className="studio-input" />
                            </Form.Item>
                            <Form.Item name="roleTitle" label="岗位职能">
                              <Select
                                mode="tags"
                                maxCount={1}
                                placeholder="选择预设..."
                                options={ROLE_KEYS.map((k) => ({
                                  label: t(`digitalEmployee.rolePresets.${k}`),
                                  value: k.toLowerCase(),
                                }))}
                                className="studio-select"
                              />
                            </Form.Item>
                            <Form.Item name="description" label="职员简介">
                              <TextArea
                                placeholder="描述该数字员工的工作职责..."
                                autoSize={{ minRows: 3, maxRows: 6 }}
                                className="studio-textarea"
                              />
                            </Form.Item>
                            {/* <Form.Item
                              name="systemPrompt"
                              label="核心人格设定 (System Prompt)"
                              rules={[{ required: true, message: '核心人格设定不能为空' }]}
                            >
                              <TextArea
                                placeholder="定义 AI 的具体岗位、背景、语气及对话规制..."
                                autoSize={{ minRows: 4, maxRows: 8 }}
                                className="studio-textarea"
                              />
                            </Form.Item> */}
                            <Form.Item
                              name="scenario"
                              label="适用场景"
                              rules={[{ required: true, message: '请选择适用场景' }]}
                            >
                              <Select
                                className="studio-select"
                                options={EMPLOYEE_SCENARIO_OPTIONS}
                              />
                            </Form.Item>
                            <Form.Item name="isActive" label="服务状态">
                              <Select className="studio-select">
                                <Select.Option value={true}>启用中</Select.Option>
                                <Select.Option value={false}>已休眠</Select.Option>
                              </Select>
                            </Form.Item>
                          </div>
                        ),
                      },
                    ]}
                  />

                  {/* Brain Config (Primary Section) */}
                  <div className="config-section no-border" style={{ marginTop: 8 }}>
                    {workflowInputs.length > 0 ? (
                      renderDynamicFormItems()
                    ) : (
                      <div style={{ padding: '40px 0', textAlign: 'center' }}>
                        <Text type="secondary">
                          该职员暂无动态逻辑参数，请先通过右上角“设计”按钮进行配置
                        </Text>
                      </div>
                    )}
                  </div>
                </Form>
              </div>
            </>
          ) : (
            <div className="agent-col-empty">
              <RobotOutlined style={{ fontSize: 48, color: '#e2e8f0', marginBottom: 16 }} />
              <Text type="secondary">从左侧选择一名数字员工</Text>
            </div>
          )}
        </div>

        {/* Column 3: Chat Panel */}
        <div className="agent-studio-col agent-studio-col--chat">
          <div className="agent-col-scroll agent-col-chat-scroll">
            {employee?.workflowId ? (
              <ChatProvider
                key={employeeId}
                placeholderKey={`agent-thread-${employeeId}`}
                dataProvider={{ requestPath: `/ai/employ/${employeeId}/generate` }}
                appId={appId}
                extraParams={{
                  data: currentConfig,
                  employeeId,
                  type: 'GENERAL',
                }}
              >
                <ChatAssistant
                  appId={appId}
                  title={nameWatch || employee?.name}
                  welcome={`您好！我是您的数字人【${nameWatch || employee?.name || '您的助手'}】，基于当前逻辑配置已就绪。`}
                  showMinimizeAction={false}
                  defaultDisplayMode="panel"
                  modes={['panel']}
                />
              </ChatProvider>
            ) : (
              <div className="agent-col-empty">
                <MessageOutlined style={{ fontSize: 48, color: '#e2e8f0', marginBottom: 16 }} />
                <Text type="secondary" style={{ textAlign: 'center' }}>
                  {employee
                    ? '点击「逻辑编排」配置工作流后\n即可在此进行实时对练'
                    : '请先选择一名数字员工'}
                </Text>
                {employee && !employee.workflowId && (
                  <Button
                    type="primary"
                    icon={<ThunderboltOutlined />}
                    onClick={handleInitWorkflow}
                    loading={creatingWorkflow}
                    style={{ marginTop: 16 }}
                  >
                    初始化逻辑引擎
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <EmployeeEditModal
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        appId={appId}
        onSaved={(newId) => fetchEmployees(newId)}
      />
    </Layout>
  );
};

export default AgentStudio;
