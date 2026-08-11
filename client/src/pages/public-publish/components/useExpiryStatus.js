import { useState, useEffect } from 'react';
import dayjs from 'dayjs';

/**
 * Hook to calculate and auto-refresh expiry status
 * @param {string|null} expiresAt - ISO datetime string
 * @returns {{ remainingText: string, isExpired: boolean }}
 */
const useExpiryStatus = (expiresAt) => {
  const calculateStatus = () => {
    if (!expiresAt) {
      return { remainingText: '永不过期', isExpired: false };
    }

    const now = dayjs();
    const expiry = dayjs(expiresAt);
    const diffMs = expiry.diff(now);

    if (diffMs <= 0) {
      return { remainingText: '已过期', isExpired: true };
    }

    const minutes = Math.floor(diffMs / 60000);
    if (minutes < 60) {
      return { remainingText: `${minutes}分钟`, isExpired: false };
    }

    const hours = Math.floor(minutes / 60);
    if (hours < 24) {
      return { remainingText: `${hours}小时`, isExpired: false };
    }

    const days = Math.floor(hours / 24);
    return { remainingText: `${days}天`, isExpired: false };
  };

  const [status, setStatus] = useState(calculateStatus);

  useEffect(() => {
    if (!expiresAt) {
      setStatus({ remainingText: '永不过期', isExpired: false });
      return;
    }

    // Update immediately
    setStatus(calculateStatus());

    // Auto refresh every minute
    const interval = setInterval(() => {
      setStatus(calculateStatus());
    }, 60000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  return status;
};

export default useExpiryStatus;
