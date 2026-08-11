import React from 'react';
import { Space, Checkbox, Input, Button, Select, DatePicker, Typography } from 'antd';
import dayjs from 'dayjs';

const { Text } = Typography;

/**
 * FillRestrictionsPanel
 * 凭密码访问 + 自定义有效期 控件集合。
 * 所有状态与行为由父组件传入，保持无副作用、无内部持久状态。
 */
const FillRestrictionsPanel = ({
  localSettings,
  accessCodeInput,
  setAccessCodeInput,
  handleAccessCodeToggle,
  handleRefreshAccessCode,
  handleClearAccessCode,
  useLinkExpiryToggle,
  setUseLinkExpiryToggle,
  linkExpiryType,
  setLinkExpiryType,
  linkCustomExpiry,
  setLinkCustomExpiry,
  applyLinkExpiry,
  clearLinkExpiry,
  remainingText,
  isExpired,
}) => {
  return (
    <>
      <Text style={{ fontWeight: 600 }}>填写限制</Text>
      <Space direction="vertical" size={12} style={{ width: '100%' }}>
        <Checkbox
          checked={localSettings.useAccessCode}
          onChange={(e) => handleAccessCodeToggle(e.target.checked)}
        >
          凭密码访问
        </Checkbox>
        {localSettings.useAccessCode && (
          <Space align="center" style={{ width: '100%' }}>
            <Text strong style={{ whiteSpace: 'nowrap' }}>
              授权码
            </Text>
            <Input
              placeholder="F3A9-B8D1 或自定义"
              value={localSettings.accessCode || accessCodeInput}
              onChange={(e) => setAccessCodeInput(e.target.value)}
              onBlur={() => {
                const val = accessCodeInput.trim();
                if (val) {
                  // 交由父组件保存
                  handleRefreshAccessCode(val); // 使用传入值替换
                }
              }}
              style={{ flex: 1 }}
            />
            <Button onClick={() => handleRefreshAccessCode()}>刷新</Button>
            <Button danger onClick={handleClearAccessCode}>
              清除
            </Button>
          </Space>
        )}
        <Checkbox
          checked={useLinkExpiryToggle}
          onChange={(e) => {
            const checked = e.target.checked;
            setUseLinkExpiryToggle(checked);
            if (!checked) {
              clearLinkExpiry();
            } else {
              setLinkExpiryType('1440');
            }
          }}
        >
          自定义有效期{' '}
          <Text type="secondary" style={{ marginLeft: 4, fontSize: 12 }}>
            {localSettings.linkExpiresAt
              ? isExpired
                ? '已过期'
                : `剩余：${remainingText}`
              : '当前永久有效'}
          </Text>
        </Checkbox>
        {useLinkExpiryToggle && (
          <Space align="center" wrap style={{ width: '100%' }}>
            <Select
              value={linkExpiryType}
              onChange={setLinkExpiryType}
              style={{ width: 160 }}
              size="small"
            >
              <Select.Option value="30">30分钟</Select.Option>
              <Select.Option value="60">1小时</Select.Option>
              <Select.Option value="360">6小时</Select.Option>
              <Select.Option value="1440">1天</Select.Option>
              <Select.Option value="10080">7天</Select.Option>
              <Select.Option value="never">永久有效</Select.Option>
              <Select.Option value="custom">自定义</Select.Option>
            </Select>
            {linkExpiryType === 'custom' && (
              <DatePicker
                showTime
                size="small"
                value={linkCustomExpiry}
                onChange={setLinkCustomExpiry}
                placeholder="过期时间"
                disabledDate={(current) => current && current < dayjs().startOf('day')}
              />
            )}
            <Button
              size="small"
              type="primary"
              onClick={applyLinkExpiry}
              disabled={linkExpiryType === 'custom' && !linkCustomExpiry}
            >
              应用
            </Button>
            {localSettings.linkExpiresAt && (
              <Button size="small" onClick={clearLinkExpiry}>
                取消
              </Button>
            )}
          </Space>
        )}
      </Space>
    </>
  );
};

export default FillRestrictionsPanel;
