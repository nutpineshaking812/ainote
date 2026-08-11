// client/src/components/LanguageSwitcher.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Dropdown } from 'antd';
import { GlobalOutlined, CheckOutlined } from '@ant-design/icons';
import './LanguageSwitcher.css';

const LanguageSwitcher = () => {
  const { i18n } = useTranslation();
  const currentLang = i18n.language || 'zh';

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const languages = {
    en: { name: 'English', short: 'EN' },
    zh: { name: '简体中文', short: 'ZH' },
  };

  const items = Object.keys(languages).map((lng) => ({
    key: lng,
    label: (
      <div className="lang-item-content">
        <span className="lang-label">{languages[lng].name}</span>
        {currentLang.startsWith(lng) && <CheckOutlined className="lang-active-check" />}
      </div>
    ),
    onClick: () => changeLanguage(lng),
  }));

  const activeLang = languages[currentLang.startsWith('en') ? 'en' : 'zh'];

  return (
    <Dropdown
      menu={{ items }}
      placement="bottomRight"
      trigger={['click']}
      overlayClassName="language-switcher-dropdown"
    >
      <div className="language-switcher-trigger">
        <GlobalOutlined className="language-switcher-icon" />
        <span className="language-switcher-text">{activeLang.name}</span>
      </div>
    </Dropdown>
  );
};

export default LanguageSwitcher;
