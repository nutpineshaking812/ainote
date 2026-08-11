# OpenSandbox 部署与使用指南

本指南涵盖 OpenSandbox 沙箱服务的完整部署流程，包括环境准备、配置、部署、验证和日常运维。

部署脚本和配置文件位于 `lowcode-deploy/sandbox/`（可独立迁移至任意位置使用）。

---

## 1. 环境要求

- **操作系统**: Ubuntu 24.04 (2C2G 以上)
- **SSH**: 目标服务器需开启 SSH 访问
- **端口**: 开放 22（SSH）、8443（Nginx HTTPS）

---

## 2. 文件说明

| 文件 | 用途 |
|------|------|
| `config.toml` | OpenSandbox Server 配置文件 |
| `deploy.sh` | 一键部署脚本（SSH 远程部署） |
| `restart-server.sh` | 服务器上直接运行的重启 + 测试脚本 |
| `nginx-sandbox.conf` | Nginx 反向代理配置模板 |
| `test_sandbox.js` | Node.js 功能测试脚本 |
| `TROUBLESHOOTING.md` | 常见问题排查 |

---

## 3. 配置

编辑 `config.toml`，修改以下关键配置：

```toml
[server]
host = "0.0.0.0"
port = 5002
api_key = "<your-api-key>"          # 替换为你的 API Key
eip = "<your-server-ip>:8443"       # 替换为服务器公网 IP

[runtime]
default_image = "python:3.12-alpine"
default_timeout = 300
```

---

## 4. 一键部署

在本地执行部署脚本，将服务部署到远程服务器：

```bash
# 设置目标服务器信息
export REMOTE_USER="your-username"
export REMOTE_HOST="your-server-ip"

# 执行部署
bash deploy.sh
```

部署脚本会自动完成以下步骤：
1. 检查 SSH 连接
2. 安装 Docker（如未安装）
3. 配置 Docker 镜像加速器
4. 拉取 OpenSandbox 镜像
5. 上传配置并启动容器
6. 安装并配置 Nginx 反向代理（HTTPS，自签名证书）
7. 配置防火墙规则
8. 验证部署结果

---

## 5. 服务器上手动部署

如果无法通过 SSH 远程部署，也可以将文件上传到服务器后手动操作：

```bash
# 1. 上传文件到服务器
scp config.toml nginx-sandbox.conf user@server:~/opensandbox-deploy/

# 2. SSH 登录服务器
ssh user@server

# 3. 安装 Docker（参考 deploy.sh 中的步骤）

# 4. 启动容器
sudo docker run -d \
  --name opensandbox-server \
  --network host \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/opensandbox-deploy/config.toml:/etc/opensandbox/config.toml:ro \
  opensandbox/server:latest

# 5. 配置 Nginx
sudo cp ~/opensandbox-deploy/nginx-sandbox.conf /etc/nginx/sites-available/sandbox
sudo ln -sf /etc/nginx/sites-available/sandbox /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

---

## 6. 验证部署

### 健康检查

```bash
# 容器内服务
curl http://127.0.0.1:5002/health

# Nginx 代理
curl -k https://127.0.0.1:8443/health
```

### 完整功能测试

```bash
# 使用 Node.js 测试脚本
node test_sandbox.js
```

测试内容：API 连接、创建沙盒、执行 Python 代码、文件读写、沙盒销毁。

---

## 7. 服务重启

```bash
# 在服务器上执行
bash restart-server.sh
```

该脚本会：停止旧容器 → 重新启动 → 等待就绪 → 执行完整功能测试。

---

## 8. 日常运维

```bash
# 查看容器状态
sudo docker ps --filter name=opensandbox-server

# 查看服务日志
sudo docker logs -f opensandbox-server

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/sandbox.error.log

# 查看沙箱容器列表
sudo docker ps -a --filter label=opensandbox.io/id

# 重启服务
sudo docker restart opensandbox-server
```

---

## 9. 更新

### 更新 OpenSandbox 镜像

```bash
ssh user@server
sudo docker pull opensandbox/server:latest
sudo docker rm -f opensandbox-server
cd ~/opensandbox-deploy
sudo docker run -d \
  --name opensandbox-server \
  --network host \
  --restart unless-stopped \
  -v /var/run/docker.sock:/var/run/docker.sock \
  -v ~/opensandbox-deploy/config.toml:/etc/opensandbox/config.toml:ro \
  opensandbox/server:latest
```

### 修改配置后重新部署

```bash
# 更新 config.toml 后
bash deploy.sh
```

---

## 10. 故障排查

部署或运行中遇到问题，请查阅 `TROUBLESHOOTING.md`，包含以下常见问题的解决方案：

- 沙盒健康检查超时
- API 401/MISSING_API_KEY 错误
- 422 Unprocessable Entity 错误
- 无法获取沙盒容器 IP
- Execd 端口连接失败
