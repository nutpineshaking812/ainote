import React, { useState, useEffect } from 'react';
import { Select, Avatar, Space } from 'antd';
import { getDigitalEmployees } from '../../../../api/digital-employees';
import { RobotOutlined } from '@ant-design/icons';

const DigitalEmployeeSelector = ({ value, onChange, appId, placeholder }) => {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const fetch = async () => {
      if (!appId) return;
      setLoading(true);
      try {
        const res = await getDigitalEmployees(appId);
        setEmployees(res || []);
      } catch (e) {
        console.error('Failed to load digital employees', e);
      } finally {
        setLoading(false);
      }
    };
    fetch();
  }, [appId]);

  return (
    <Select
      value={value}
      onChange={onChange}
      loading={loading}
      placeholder={placeholder || '请选择要执行的数字员工'}
      showSearch
      optionFilterProp="filterText"
      style={{ width: '100%' }}
      options={employees.map((emp) => {
        const empId = emp.id || emp._id;
        const filterText = `${emp.name} ${emp.roleTitle || ''}`;
        return {
          value: empId,
          filterText,
          label: (
            <Space>
              {emp.avatar ? (
                <Avatar size="small" src={emp.avatar} />
              ) : (
                <Avatar size="small" icon={<RobotOutlined />} style={{ backgroundColor: '#13c2c2' }} />
              )}
              <span style={{ fontWeight: 500 }}>{emp.name}</span>
              {emp.roleTitle && (
                <span style={{ fontSize: '11px', color: '#8c8c8c' }}>({emp.roleTitle})</span>
              )}
            </Space>
          ),
        };
      })}
    />
  );
};

export default DigitalEmployeeSelector;
