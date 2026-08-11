/**
 * Base Gateway Provider
 * Defines the contract for all platform-specific gateway implementations.
 */
export class BaseProvider {
  /**
   * 启动并管理渠道连接（持久化连接）
   */
  async start(channel) {
    throw new Error('Method not implemented');
  }

  /**
   * 优雅停止渠道连接
   */
  async stop(channelId) {
    throw new Error('Method not implemented');
  }

  /**
   * 解析平台特定的入站 Payload 转化为内部标准化逻辑
   */
  parseContent(payload) {
    // throw new Error('Method not implemented');
    return payload.content;
  }

  /**
   * 工厂方法：创建一个支撑流式/有状态发送的服务器、状态执行器 (StreamSender)
   */
  createStreamSender(platformMetadata, channelConfig, executionId) {
    return null; // 默认返回 null，子类需按需覆盖
  }

  /**
   * 解析需要响应该入站消息的数字员工 ID。如果返回 null/undefined 则视为不处理。
   * 基类默认直接返回 channel.employeeId。
   */
  async resolveEmployee(channel, rawPayload) {
    return channel.employeeId;
  }
}

export default BaseProvider;
