import React from 'react';
import ReactDOM from 'react-dom/client';
import './utils/dayjs'; // Import configured dayjs to ensure plugins are loaded
import { AuthProvider } from './store/AuthContext.jsx';
import { OrgProvider } from './store/OrgContext.jsx';
import 'antd/dist/reset.css';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './index.css';
import App from './App.jsx';
import './i18n'; // Import i18n configuration

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <AuthProvider>
      <OrgProvider>
        <App />
      </OrgProvider>
    </AuthProvider>
   </React.StrictMode>,
);
