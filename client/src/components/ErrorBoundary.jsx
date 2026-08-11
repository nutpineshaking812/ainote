import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    // 更新 state 使下一次渲染能够显示降级后的 UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // 你可以在这里记录错误日志
    console.error('BlockNote 内部崩溃被拦截:', error, errorInfo);
  }

  componentDidUpdate(prevProps) {
    // 关键点：当 key (比如文档ID) 变化时，重置错误状态，
    // 这样新文档可以尝试重新渲染编辑器
    if (this.props.resetKey !== prevProps.resetKey) {
      this.setState({ hasError: false });
    }
  }

  render() {
    console.log('ErrorBoundary render, hasError:', this.state.hasError);
    if (this.state.hasError) {
      return <div></div>;
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
