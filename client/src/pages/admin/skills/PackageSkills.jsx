import React, {
  useState,
  useEffect,
  useImperativeHandle,
  forwardRef,
  useRef,
  useLayoutEffect,
} from 'react';
import { Table, Typography, Space, Button, Modal, Form, Input, message, Popconfirm } from 'antd';
import { useTranslation } from 'react-i18next';
import { getPackageSkills, installSkill, uninstallSkill } from '../../../api/skills';
import { RobotOutlined, CloudDownloadOutlined, DeleteOutlined } from '@ant-design/icons';

const { Text } = Typography;

const PackageSkills = forwardRef((props, ref) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState([]);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [form] = Form.useForm();
  const [scrollY, setScrollY] = useState(500);
  const containerRef = useRef(null);

  const columns = [
    {
      title: t('common.name', 'Name'),
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space>
          <RobotOutlined style={{ color: '#eb2f96' }} />
          <Text strong>{text}</Text>
        </Space>
      ),
      width: '200px',
    },
    {
      title: t('common.id', 'ID'),
      dataIndex: 'id',
      key: 'id',
      render: (id) => <Text code>{id}</Text>,
      width: '240px',
    },
    {
      title: t('common.description', 'Description'),
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: t('common.action', 'Action'),
      key: 'action',
      width: '120px',
      render: (_, record) => {
        if (!record.isRemovable) return null;

        return (
          <Space size="middle">
            <Popconfirm
              title={t('admin.ability.uninstallConfirm', 'Are you sure to uninstall this skill?')}
              onConfirm={() => handleUninstall(record)}
              okText={t('common.yes', 'Yes')}
              cancelText={t('common.no', 'No')}
            >
              <Button type="link" danger icon={<DeleteOutlined />}>
                {t('common.uninstall', 'Uninstall')}
              </Button>
            </Popconfirm>
          </Space>
        );
      },
    },
  ];

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await getPackageSkills();
      setData(res || []);
    } catch (err) {
      console.error(err);
      message.error(t('common.loadFailed', 'Load failed'));
    } finally {
      setLoading(false);
    }
  };

  const handleUninstall = async (record) => {
    try {
      if (!record.repoFolderName) {
        throw new Error('This skill is not part of an installed repository');
      }

      await uninstallSkill(record.repoFolderName);
      message.success(t('common.updateSuccess', 'Uninstall successful'));
      fetchData();
    } catch (err) {
      message.error(err.message || t('common.operationFailed', 'Operation failed'));
    }
  };

  const handleInstall = async (values) => {
    try {
      setInstalling(true);
      await installSkill(values.url);
      message.success(t('admin.ability.installSuccess', 'Skill installed successfully'));
      setIsModalVisible(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error(err.message || t('admin.ability.installFailed', 'Install failed'));
    } finally {
      setInstalling(false);
    }
  };

  useImperativeHandle(ref, () => ({
    refresh: fetchData,
  }));

  useLayoutEffect(() => {
    const calcHeight = () => {
      if (containerRef.current) {
        const { top } = containerRef.current.getBoundingClientRect();
        const h = window.innerHeight - top - 140;
        setScrollY(h > 200 ? h : 200);
      }
    };
    calcHeight();
    window.addEventListener('resize', calcHeight);
    return () => window.removeEventListener('resize', calcHeight);
  }, []);

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div
      ref={containerRef}
      style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={{ marginBottom: 16 }}>
        <Space>
          <Button
            type="primary"
            icon={<CloudDownloadOutlined />}
            onClick={() => setIsModalVisible(true)}
          >
            {t('admin.ability.installSkill', 'Install Skill (Git URL)')}
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={data}
        rowKey="id"
        loading={loading}
        pagination={false}
        scroll={{ y: scrollY }}
        style={{ flex: 1, overflow: 'hidden' }}
      />

      <Modal
        title={t('admin.ability.installSkill', 'Install Skill')}
        open={isModalVisible}
        onOk={() => form.submit()}
        onCancel={() => setIsModalVisible(false)}
        confirmLoading={installing}
      >
        <Form form={form} layout="vertical" onFinish={handleInstall}>
          <Form.Item
            name="url"
            label={t('admin.ability.gitUrl', 'Git Repository URL')}
            rules={[
              { required: true, message: t('admin.ability.urlRequired', 'Please enter Git URL') },
              { type: 'url', message: t('admin.ability.urlInvalid', 'Please enter a valid URL') },
            ]}
          >
            <Input placeholder="https://github.com/user/ai-skill-repo.git" />
          </Form.Item>
          <Text type="secondary">
            {t(
              'admin.ability.installHint',
              'The system will clone the repo and search for SKILL.md files.',
            )}
          </Text>
        </Form>
      </Modal>
    </div>
  );
});

export default PackageSkills;
