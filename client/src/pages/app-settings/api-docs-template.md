### 使用示例

您可以使用 API 密钥通过简单的 HTTP 请求与应用进行交互。

#### 1. 提交数据

```bash
curl -X POST "{{origin}}/api/v1/open/apps/{{appId}}/forms/<FORM_ID>/submit" \
  -H "Authorization: Bearer {{apiKey}}" \
  -H "Content-Type: application/json" \
  -d '{"field_abc": "value"}'
```

#### 2. 获取数据列表

```bash
curl -X GET "{{origin}}/api/v1/open/apps/{{appId}}/forms/<FORM_ID>/records" \
  -H "Authorization: Bearer {{apiKey}}"
```

> 注意：请将 `<FORM_ID>` 替换为您实际的表单 ID，将 `{{apiKey}}` 替换为您生成的密钥。
