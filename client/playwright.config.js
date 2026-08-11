import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E 测试配置文件
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* 每个测试的最大运行时间 */
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  /* 并行运行测试 */
  fullyParallel: true,
  /* 仅在 CI 环境中禁止使用 test.only */
  forbidOnly: !!process.env.CI,
  /* 失败重试次数 */
  retries: process.env.CI ? 2 : 0,
  /* 并发测试线程数 */
  workers: process.env.CI ? 1 : undefined,
  /* 测试报告格式 */
  reporter: 'html',
  /* 共享的浏览器配置 */
  use: {
    /* 请求的基础 URL，对应 Vite 启动的端口 */
    baseURL: 'http://localhost:5000',
    /* 收集测试 Trace 信息 (调试利器) */
    trace: 'on-first-retry',
    /* 运行失败时截屏 */
    screenshot: 'only-on-failure',
    /* 运行失败时录制视频 */
    video: 'retain-on-failure',
  },

  /* 配置要测试的浏览器环境 */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
