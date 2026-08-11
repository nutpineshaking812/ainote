import React, { createContext, useContext, useEffect, useState } from 'react';
import { localDb, LocalDatabaseManager } from './LocalDatabaseManager';

import { Spin, Result, Button } from 'antd';

const LocalDatabaseContext = createContext<LocalDatabaseManager | null>(null);

export const useLocalDb = () => {
  const context = useContext(LocalDatabaseContext);
  if (!context) {
    throw new Error('useLocalDb must be used within a LocalDatabaseProvider');
  }
  return context;
};

interface LocalDatabaseProviderProps {
  children: React.ReactNode;
}

export const LocalDatabaseProvider: React.FC<LocalDatabaseProviderProps> = ({ children }) => {
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const init = async () => {
    try {
      setIsReady(false);
      setError(null);
      await localDb.initialize();
      setIsReady(true);
      console.log('Local database system ready');
    } catch (err: any) {
      setError(err.message || 'Unknown database initialization error');
      console.error('Failed to initialize local database system:', err);
    }
  };

  useEffect(() => {
    init();
    return () => {
      // Cleanup worker on unmount/HMR to prevent OPFS lock issues
      localDb.terminate();
    };
  }, []);

  if (error) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          background: '#f0f2f5',
        }}
      >
        <Result
          status="error"
          title="Local Database Error"
          subTitle={error}
          extra={[
            <Button type="primary" key="retry" onClick={init}>
              Retry Initialization
            </Button>,
          ]}
        />
      </div>
    );
  }

  return (
    <LocalDatabaseContext.Provider value={localDb}>
      {/* 
        We no longer block the entire app. 
        Individual components can check localDb.isReady() if needed,
        or we can show a small non-blocking global sync indicator later.
      */}
      {children}
      {!isReady && !error && (
        <div style={{ position: 'fixed', bottom: 20, right: 20, zIndex: 9999 }}>
          <Spin size="small" tip="同步中..." />
        </div>
      )}
    </LocalDatabaseContext.Provider>
  );
};
