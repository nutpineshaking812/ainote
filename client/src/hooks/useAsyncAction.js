import { useState, useCallback, useRef } from 'react';

/**
 * 通用的异步操作 Hook
 * @param {Function} actionFn 异步函数
 * @returns {Array} [runningFn, loading] 封装后的执行函数和加载状态
 */
export const useAsyncAction = (actionFn) => {
  const [loading, setLoading] = useState(false);
  const loadingRef = useRef(false);

  const run = useCallback(
    async (...args) => {
      // 如果已经在执行中，直接拦截
      if (loadingRef.current) return;

      loadingRef.current = true;
      setLoading(true);
      try {
        const result = await actionFn(...args);
        return result;
      } finally {
        loadingRef.current = false;
        setLoading(false);
      }
    },
    [actionFn],
  );

  return [run, loading];
};
