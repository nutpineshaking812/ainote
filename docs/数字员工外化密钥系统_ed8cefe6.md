---
name: 数字员工外化密钥系统
overview: 设计应用级密钥系统，外化数字员工全套能力（Dock+AgentWorkspace UI+API），让外部应用通过密钥认证后集成数字员工。混合方式：既提供REST API也提供可嵌入前端组件。
design:
  architecture:
    framework: react
  styleKeywords:
    - Glassmorphism
    - Modern
    - Clean
  fontSystem:
    fontFamily: PingFang-SC
    heading:
      size: 20px
      weight: 600
    subheading:
      size: 14px
      weight: 500
    body:
      size: 13px
      weight: 400
  colorSystem:
    primary:
      - "#6366F1"
      - "#4F46E5"
      - "#818CF8"
    background:
      - "#FFFFFF"
      - "#F9FAFB"
    text:
      - "#1E293B"
      - "#64748B"
    functional:
      - "#EF4444"
      - "#10B981"
      - "#F59E0B"
todos:
  - id: db-schema
    content: 创建 employeeShareKeys 数据库表定义和 Repository
    status: completed
  - id: key-service
    content: 实现密钥管理 Service 和 Controller(创建/撤销/续期/验证)
    status: completed
    dependencies:
      - db-schema
  - id: key-middleware
    content: 实现 employeeKeyAuth 密钥认证中间件(含过期校验)
    status: completed
    dependencies:
      - key-service
  - id: public-api
    content: 实现外部访问接口(员工信息/对话流SSE/会话管理)并挂载路由
    status: completed
    dependencies:
      - key-middleware
  - id: key-routes-cors
    content: 挂载密钥管理路由、配置CORS和allowedHeaders
    status: completed
    dependencies:
      - public-api
  - id: embed-page
    content: 创建 iframe 嵌入页面 EmployeeEmbedPage(复用AgentDock+AgentWorkspace)
    status: completed
    dependencies:
      - public-api
  - id: key-manager-ui
    content: 创建密钥管理前端组件 EmployeeKeyManager 并集成到数字员工编辑弹窗
    status: completed
    dependencies:
      - key-routes-cors
---

## 产品概述

将 DocumentResourcePanel 中的 Dock 和 AI 相关能力（数字员工全套 UI）外化，基于现有 `apiKeys` 表扩展，让外部应用可以通过密钥认证后，嵌入/调用数字员工的对话流和完整 UI 组件。

## 核心功能

- **密钥管理**：为数字员工创建、撤销、续期分享密钥，支持过期时间
- **外部 API 访问**：通过密钥认证，提供数字员工信息查询、对话流(SSE)、会话管理等 REST API
- **前端嵌入组件**：提供 iframe 嵌入页面，外部应用一行代码即可集成数字员工全套 UI（Dock + AgentWorkspace）
- **密钥认证中间件**：独立于现有 Form Token 和 JWT 认证，通过 `X-Employee-Key` Header 鉴权

## 技术栈

- 后端：Node.js + Express.js（沿用现有技术栈）
- 数据库：PostgreSQL + Drizzle ORM（沿用现有技术栈）
- 前端嵌入：iframe 方案（复用现有 React 组件，打包为独立页面）
- 认证：自定义 `X-Employee-Key` Header 中间件（参考现有 `X-Form-Token` 模式）

## 实现方案

### 整体架构

```mermaid
graph TB
    subgraph 外部应用
        A[第三方网站/应用]
        B[API 调用方]
    end
    
    subgraph 密钥认证层
        C[X-Employee-Key 中间件]
    end
    
    subgraph 外部访问接口
        D[/public/employee/info]
        E[/public/employee/chat SSE]
        F[/public/employee/conversations]
    end
    
    subgraph 嵌入页面
        G[/embed/employee/:keyId iframe页面]
    end
    
    subgraph 内部服务层
        H[digitalEmployee.service]
        I[agentStream.controller]
        J[conversation.controller]
    end
    
    A -->|iframe嵌入| G
    B -->|X-Employee-Key| C
    C --> D & E & F
    D & E & F --> H & I & J
    G --> C
```

### 关键设计决策

1. **复用现有 apiKeys 表**：通过扩展 `employeeId` 和 `expiresAt` 两个字段，同一张表同时服务"普通应用密钥"和"数字员工分享密钥"。当 `employeeId IS NOT NULL` 时为员工分享密钥。
2. **密钥与数字员工绑定**：每条密钥关联一个数字员工（employeeId），外部应用获取特定员工的对话能力。
3. **iframe 优于 Web Component**：现有 AgentDock/AgentWorkspace 组件依赖链深，iframe 嵌入方式实现成本最低、隔离性最好。
4. **复用现有 Service 层**：外部接口调用内部已有 service，避免重复实现。
5. **密钥格式**：员工分享密钥使用 `emp_sk_` 前缀（区别于普通密钥的 `app_sk_`），hash 存储，仅创建时返回明文。

### 涉及的接口梳理

#### 已有接口（需外化，创建对应的 public 版本）

| 原接口 | 外化接口 | 说明 |
| --- | --- | --- |
| POST /ai/employ/:employeeId/generate | POST /public/employee/chat | 数字员工对话流(SSE) |
| GET /apps/:appId/digital-employees/get-detail | GET /public/employee/info | 员工详情(脱敏) |
| GET /conversations/apps/:appId/ | GET /public/employee/conversations | 会话列表 |
| GET /conversations/:convId/messages | GET /public/employee/conversations/:convId/messages | 会话消息 |
| GET /agent-dock-states/get-detail | (内置在embed页面) | Dock状态 |
| POST /agent-dock-states/update | (内置在embed页面) | 更新Dock状态 |


#### 新增接口

| 接口 | 方法 | 说明 |
| --- | --- | --- |
| /api/v1/apps/:appId/employee-keys | GET | 列出员工分享密钥(需JWT认证) |
| /api/v1/apps/:appId/employee-keys | POST | 创建员工分享密钥(需JWT认证) |
| /api/v1/apps/:appId/employee-keys/:keyId | DELETE | 撤销员工分享密钥(需JWT认证) |
| /api/v1/apps/:appId/employee-keys/:keyId | PATCH | 续期员工分享密钥(需JWT认证) |
| /api/v1/public/employee/chat | POST | 对话流SSE(X-Employee-Key) |
| /api/v1/public/employee/info | GET | 员工信息(X-Employee-Key) |
| /api/v1/public/employee/conversations | GET | 会话列表(X-Employee-Key) |
| /api/v1/public/employee/conversations/:convId/messages | GET | 会话消息(X-Employee-Key) |


### 数据库设计

**扩展现有 `api_keys` 表**，新增两个字段：

```sql
ALTER TABLE lc.api_keys 
  ADD COLUMN employee_id VARCHAR(255),       -- 绑定的数字员工ID (NULL=普通应用密钥)
  ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;  -- 过期时间 (NULL=永不过期);

CREATE INDEX api_key_employee_idx ON lc.api_keys (employee_id);
```

扩展后的完整表结构：

```
api_keys (扩展后)
├── id: varchar(255) PK
├── appId: varchar(255) NOT NULL             -- 归属应用
├── employeeId: varchar(255) NULL [NEW]      -- 绑定的数字员工(NULL=普通应用密钥)
├── name: varchar(255) NOT NULL              -- 密钥名称/备注
├── prefix: varchar(50) NOT NULL             -- 密钥前缀(emp_sk_或app_sk_的前8位)
├── hash: varchar(255) NOT NULL              -- 密钥哈希(bcrypt)
├── expiresAt: timestamp NULL [NEW]          -- 过期时间(NULL=永不过期)
├── lastUsedAt: timestamp                    -- 最后使用时间
├── createdAt: timestamp NOT NULL
├── updatedAt: timestamp NOT NULL
├── 索引: appId, employeeId [NEW], prefix
```

**区分逻辑**：

- `employeeId IS NULL` → 普通应用级 API 密钥（现有行为不变）
- `employeeId IS NOT NULL` → 数字员工分享密钥

### 实现注意事项

- **CORS 配置**：嵌入页面和外部 API 需要在 server/index.js 的 CORS allowedOrigins 中支持动态来源，或在 /public/employee/* 路由上单独配置宽松 CORS
- **SSE 流式响应**：外部对话接口复用现有 SSEWriter，但需跳过 JWT 认证，改用密钥中间件
- **密钥过期校验**：中间件中检查 `expiresAt`，过期则返回 401
- **会话隔离**：外部密钥产生的会话需标记来源(如 submitSource: 'EMPLOYEE_KEY')，便于审计追踪
- **Rate Limiting**：外部接口应增加速率限制，防止密钥被滥用
- **现有 apiKeys 功能不受影响**：所有现有 CRUD 逻辑仅操作 `employeeId IS NULL` 的记录，新增的员工密钥逻辑操作 `employeeId IS NOT NULL` 的记录

## 目录结构

```
project-root/
├── server/
│   ├── db/
│   │   └── schema/
│   │       └── apiKeys.js                     # [MODIFY] 扩展 employeeId, expiresAt 字段
│   ├── repositories/
│   │   └── apiKey.repository.js               # [MODIFY] 增加按 employeeId 查询方法
│   ├── services/
│   │   ├── app.service.js                     # [KEEP] 现有密钥逻辑不动
│   │   └── employeeShareKey.service.js        # [NEW] 员工分享密钥管理 Service
│   ├── controllers/
│   │   ├── employeeShareKey.controller.js     # [NEW] 密钥管理 Controller(需JWT)
│   │   └── publicEmployee.controller.js       # [NEW] 外部访问 Controller(需X-Employee-Key)
│   ├── middleware/
│   │   └── employeeKeyAuth.middleware.js      # [NEW] 密钥认证中间件
│   └── routes/
│       ├── employeeShareKey.routes.js         # [NEW] 密钥管理路由(挂载到 /apps/:appId/employee-keys)
│       └── publicEmployee.routes.js           # [NEW] 外部访问路由(挂载到 /public/employee)
│
├── client/
│   └── src/
│       ├── pages/
│       │   └── EmployeeEmbedPage.jsx          # [NEW] iframe嵌入页面(含AgentDock+AgentWorkspace)
│       ├── api/
│       │   └── employee-share-keys.js         # [NEW] 密钥管理前端API
│       └── features/
│           └── digital-employees/
│               └── components/
│                   └── EmployeeKeyManager.jsx  # [NEW] 密钥管理UI组件
```

## 设计说明

### 嵌入页面设计 (EmployeeEmbedPage)

- 独立路由页面 `/embed/employee/:keyId`，供外部 iframe 嵌入
- 复用现有 AgentDock + AgentWorkspace 组件，去除 DocumentResourcePanel 中的文档编辑部分
- 使用密钥认证替代 JWT，初始化时通过 keyId 换取员工信息和临时 token
- 支持深色/浅色主题切换，通过 URL 参数 `?theme=dark` 控制

### 密钥管理 UI (EmployeeKeyManager)

- 在数字员工编辑弹窗(EmployeeEditModal)中增加"分享密钥"标签页
- 密钥列表：显示名称、前缀、创建时间、过期时间、最后使用时间
- 创建密钥弹窗：输入名称、选择过期时间(7天/30天/90天/永不过期/自定义)
- 创建成功后仅展示一次完整密钥，提示用户保存
- 撤销密钥需二次确认
- 续期操作：延长过期时间

### 嵌入代码生成

- 创建密钥成功后，自动生成 iframe 嵌入代码片段
- 提供 JS SDK 初始化代码示例

## SubAgent

- **code-explorer**
- Purpose: 在实现阶段深入探索数字员工 Service 层、UnifiedChatService、会话管理等内部实现细节，确保外部接口正确复用内部逻辑
- Expected outcome: 确认外部接口与内部 Service 的对接方式、参数传递、错误处理模式