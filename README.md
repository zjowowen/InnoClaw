# NotebookLM Clone

一个类似 Google NotebookLM 的 AI 研究助手 Web 应用。用户可以打开服务器端文件夹作为工作空间，浏览/管理文件，并与 AI 进行基于 RAG（检索增强生成）的对话。

An AI-powered research assistant web app similar to Google NotebookLM. Users open server-side folders as workspaces, browse/manage files, and chat with AI grounded in workspace files via RAG.

---

## 概览 / Overview

本项目旨在提供一个可自托管的、类似 Google NotebookLM 的 AI 研究助手。它让用户将服务器端文件夹作为「工作空间」，利用 RAG（检索增强生成）技术，让 AI 基于用户自有文档进行对话、回答问题并生成笔记，从而显著提升研究和信息整理效率。

This project provides a self-hostable AI research assistant inspired by Google NotebookLM. It allows users to turn server-side folders into "workspaces" and leverages RAG (Retrieval-Augmented Generation) so that AI can answer questions and generate notes grounded in your own documents — significantly boosting research and information organization efficiency.

**核心亮点 / Key Highlights:**
- 🗂️ **工作空间 + 文件管理 / Workspace & File Management** — 映射服务器文件夹，支持浏览、上传、编辑
- 🤖 **RAG 增强对话 / RAG-Powered Chat** — AI 基于文档内容回答问题，附带来源引用
- 📝 **智能笔记生成 / Smart Note Generation** — 自动生成摘要、FAQ、简报、时间线等
- 🔀 **多模型 & 多语言 / Multi-LLM & i18n** — 支持 OpenAI / Anthropic，中英双语界面，暗色模式
- 💬 **飞书机器人 / Feishu Bot** — WebSocket 长连接，Agent 工具调用，交互卡片实时更新

_完整功能列表请见 [功能 / Features](#功能--features) / For the full feature list, see [Features](#功能--features)._

**适用人群 / Who is it for?**
- 📚 需要基于大量文档进行 AI 辅助研究和分析的**研究人员**
- 💻 希望利用 AI 探索和理解代码仓库的**开发者**
- 🏠 想要搭建私有、可控的 NotebookLM 替代方案的**自托管爱好者**
- 🎓 需要整理学习资料并快速生成笔记的**学生和教育工作者**

**快速导航 / Quick Links:**
- [⚡ 快速开始 / Quick Start](#快速开始--quick-start)
- [📖 使用指南 / Usage Guide](#使用指南--usage-guide)
- [💬 飞书机器人配置 / Feishu Bot Setup](#飞书机器人配置--feishu-bot-setup)
- [🏗️ 项目结构 / Project Structure](#项目结构--project-structure)
- [🔧 RAG 管道架构 / RAG Pipeline](#rag-管道架构--rag-pipeline-architecture)
- [❓ 常见问题 / FAQ](#常见问题--faq)

---

## 功能 / Features

- **工作空间管理** — 将服务器文件夹映射为工作空间，持久化存储，可重复打开
- **文件浏览器** — 树形目录浏览、上传、新建、编辑、重命名、删除文件
- **GitHub 集成** — 克隆/拉取 GitHub 仓库（支持私有仓库）
- **RAG 对话** — AI 基于工作空间文件内容回答问题，带来源引用
- **笔记生成** — 自动生成摘要、FAQ、简报、时间线等
- **多 LLM 支持** — 可切换 OpenAI GPT / Anthropic Claude
- **中英双语** — 前端 UI 支持中文/英文切换
- **暗色模式** — 支持亮色/暗色主题切换
- **飞书机器人** — 通过 WebSocket 长连接接入飞书，支持 Agent 工具调用、交互卡片、斜杠命令

---

## 技术栈 / Tech Stack

| 分类 | 技术 |
|------|------|
| 框架 | Next.js 16 (App Router) + TypeScript |
| UI | Tailwind CSS 4 + shadcn/ui + Radix UI |
| AI | Vercel AI SDK 6 + OpenAI + Anthropic |
| 数据库 | SQLite (better-sqlite3 + Drizzle ORM) |
| 向量搜索 | 纯 JS 余弦相似度（无需额外扩展） |
| IM 机器人 | @larksuiteoapi/node-sdk（飞书 WebSocket 长连接） |
| i18n | next-intl（中/英） |
| 主题 | next-themes |

---

## 前置要求 / Prerequisites

1. **Node.js >=20.9.0**（推荐最新 LTS 版本）
2. **npm**（随 Node.js 一起安装）
3. **Git**（如需 GitHub 克隆/拉取功能）
4. **AI API Key**（可选，至少配置一个才能使用 AI 对话和生成功能；不配置时其余功能正常可用）
5. **GitHub Token**（可选，如需克隆/拉取私有仓库）

**环境检查 / Environment Check：**

```bash
# 检查 Node.js 版本（需 >= 20.9.0）
node -v

# 检查 npm 版本
npm -v

# 检查 Git 版本（如需 GitHub 集成）
git --version
```

如果 `node -v` 显示版本低于 20.9.0，请前往 [Node.js 官网](https://nodejs.org/) 下载最新 LTS 版本。

---

## 快速开始 / Quick Start

### 第 1 步：克隆仓库并安装依赖

```bash
git clone https://github.com/zjowowen/notebooklm.git
cd notebooklm
npm install
```

**✅ 验证：** 安装完成后，确认 `node_modules` 目录已生成且无报错：

```bash
# 检查 node_modules 目录是否存在
ls node_modules   # Linux / macOS
dir node_modules  # Windows
```

如安装过程中出现 `better-sqlite3` 编译错误，请确保系统已安装 C++ 编译工具链（见下方 [常见安装问题排查](#常见安装问题排查--troubleshooting-installation)）。

### 第 2 步：配置环境变量

复制示例文件并编辑：

```bash
cp .env.example .env.local
```

编辑 `.env.local` 文件：

```env
# [必填] 工作空间根目录路径（逗号分隔的绝对路径）
# 用户只能在这些目录下创建/打开工作空间
# 这些目录必须在服务器上真实存在
WORKSPACE_ROOTS=D:/Data/research,D:/Data/projects

# [可选] OpenAI API Key（用于 AI 对话）
OPENAI_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx

# [可选] Anthropic API Key（如需使用 Claude 模型）
ANTHROPIC_API_KEY=sk-ant-xxxxxxxxxxxxxxxxxxxxxxxx

# [可选] 自定义 API Base URL（用于第三方兼容服务/代理）
# OPENAI_BASE_URL=https://api.your-provider.com/v1
# ANTHROPIC_BASE_URL=https://api.your-provider.com

# [可选] 独立的 Embedding API 配置（如与对话模型使用不同的服务商/密钥）
# 若不配置，默认使用 OPENAI_API_KEY 和 OPENAI_BASE_URL
# EMBEDDING_API_KEY=sk-xxxxxxxxxxxxxxxxxxxxxxxx
# EMBEDDING_BASE_URL=https://api.your-embedding-provider.com/v1
# EMBEDDING_MODEL=text-embedding-3-small

# [可选] GitHub Personal Access Token（如需克隆/拉取私有仓库）
# 需要 repo scope 权限
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxx
```

**重要说明：**
- `WORKSPACE_ROOTS` 指定的目录必须已经存在于服务器上，应用不会自动创建
- 不配置任何 API Key 时，工作空间、文件管理、GitHub 克隆等功能正常可用，仅 AI 对话和笔记生成功能会禁用
- 配置了 `OPENAI_API_KEY` 或 `EMBEDDING_API_KEY` 后，同步文件时会自动生成向量嵌入（embedding），支持 RAG 检索增强对话
- Embedding API 支持独立配置：如果你的对话模型代理不支持 embedding 接口（如仅提供 Gemini 聊天模型的代理），可以通过 `EMBEDDING_API_KEY`、`EMBEDDING_BASE_URL`、`EMBEDDING_MODEL` 指向一个单独的 embedding 服务
- `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` 支持指向任何兼容 OpenAI / Anthropic 协议的第三方服务（如自部署代理、国内中转等）
- 所有 Key 和 URL 仅在服务器端使用，不会暴露给前端浏览器

### 第 3 步：创建工作空间根目录

确保 `WORKSPACE_ROOTS` 中指定的目录存在：

```bash
# Windows (PowerShell)
mkdir D:/Data/research
mkdir D:/Data/projects

# Linux / macOS
mkdir -p /data/research /data/projects
```

### 第 4 步：初始化数据库

```bash
npx drizzle-kit migrate
```

这会在 `./data/notebooklm.db` 创建 SQLite 数据库并执行迁移。

**✅ 验证：** 确认数据库文件已生成：

```bash
# Linux / macOS
ls -lh ./data/notebooklm.db

# Windows (PowerShell)
dir .\data\notebooklm.db
```

### 第 5 步：启动开发服务器

```bash
npm run dev
```

打开浏览器访问 **http://localhost:3000** 即可使用。

**✅ 验证：** 在终端中看到类似以下输出表示启动成功：

```
✓ Ready in Xs
○ Compiling / ...
```

然后在浏览器中访问 `http://localhost:3000`，应能看到工作空间列表页面。

---

## 验证安装 / Verify Installation

完成上述步骤后，请按以下清单逐一确认：

| # | 检查项 | 预期结果 |
|---|--------|----------|
| 1 | `node -v` | 输出 `v20.9.x` 或更高版本 |
| 2 | `npm -v` | 输出版本号（无报错） |
| 3 | `node_modules/` 目录存在 | `npm install` 成功完成，无 ERR 报错 |
| 4 | `./data/notebooklm.db` 文件存在 | `npx drizzle-kit migrate` 成功执行 |
| 5 | `npm run dev` 终端输出 `Ready` | 开发服务器正常启动 |
| 6 | 浏览器访问 `http://localhost:3000` | 显示工作空间列表页面 |
| 7 | 点击"打开工作空间"可选择目录 | `WORKSPACE_ROOTS` 配置正确，目录存在 |
| 8 | （可选）进入工作空间后 AI 对话可用 | API Key 配置正确 |

**快速健康检查命令：**

```bash
# 代码检查（ESLint）
npm run lint

# TypeScript 类型检查
npx tsc --noEmit

# 构建项目（可用于验证整体编译是否正常）
npm run build
```

如以上命令均无报错，则表示项目安装和配置完全正确。

---

## 常见安装问题排查 / Troubleshooting Installation

### `better-sqlite3` 编译失败

`better-sqlite3` 是原生 Node.js 模块，需要 C++ 编译工具链：

- **Windows：** 安装 [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，勾选 "Desktop development with C++" 工作负载
- **macOS：** 安装 Xcode Command Line Tools
  ```bash
  xcode-select --install
  ```
- **Linux（Debian/Ubuntu）：**
  ```bash
  sudo apt-get install -y build-essential python3
  ```

### `npm install` 报网络错误

如果下载依赖超时或失败，可尝试使用国内镜像源：

```bash
npm install --registry=https://registry.npmmirror.com
```

### `npx drizzle-kit migrate` 执行报错

- 确认 `./drizzle/` 目录下存在 SQL 迁移文件（如 `0000_*.sql`）
- 确认 `./data/` 目录存在（若不存在会自动创建）
- 若数据库损坏，可删除后重新迁移：
  ```bash
  # Linux / macOS
  rm -f ./data/notebooklm.db

  # Windows PowerShell
  Remove-Item -Path .\data\notebooklm.db -ErrorAction SilentlyContinue

  # Windows CMD
  del /F /Q .\data\notebooklm.db
  ```
  然后重新执行：
  ```bash
  npx drizzle-kit migrate
  ```

### 启动 `npm run dev` 后端口被占用

```bash
# 查看 3000 端口占用情况
# Linux / macOS
lsof -i :3000

# Windows (PowerShell)
netstat -ano | findstr :3000
```

可通过环境变量指定其他端口：

```bash
# Linux / macOS / WSL / Git Bash
PORT=3001 npm run dev

# Windows PowerShell
$env:PORT=3001; npm run dev

# Windows CMD
set PORT=3001&& npm run dev
```

### 页面访问报 500 错误

- 检查 `.env.local` 文件是否存在且 `WORKSPACE_ROOTS` 已正确配置
- 确认 `WORKSPACE_ROOTS` 中指定的目录在服务器上真实存在
- 检查终端输出的错误日志，根据提示排查

---

## 生产部署 / Production Deployment

### 方式一：直接部署（推荐用于自托管）

```bash
# 1. 安装依赖
npm install

# 2. 配置环境变量（同上）
cp .env.example .env.local
# 编辑 .env.local

# 3. 初始化数据库
npx drizzle-kit migrate

# 4. 构建生产版本
npm run build

# 5. 启动生产服务器（默认端口 3000）
npm run start

# 或指定端口
PORT=8080 npm run start
```

### 方式二：使用 PM2 持久化运行

```bash
# 安装 PM2
npm install -g pm2

# 构建后启动
npm run build
pm2 start npm --name "notebooklm" -- start

# 查看状态
pm2 status

# 查看日志
pm2 logs notebooklm

# 开机自启
pm2 startup
pm2 save
```

### 方式三：Docker 部署

创建 `Dockerfile`：

```dockerfile
FROM node:20-alpine

# 安装 git（GitHub 集成需要）
RUN apk add --no-cache git python3 make g++

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# 创建数据目录
RUN mkdir -p /app/data

EXPOSE 3000

CMD ["sh", "-c", "npx drizzle-kit migrate && npm run start"]
```

创建 `docker-compose.yml`：

```yaml
version: '3.8'
services:
  notebooklm:
    build: .
    ports:
      - "3000:3000"
    volumes:
      # 持久化数据库
      - ./data:/app/data
      # 挂载工作空间目录
      - D:/Data/research:/data/research
      - D:/Data/projects:/data/projects
    environment:
      - WORKSPACE_ROOTS=/data/research,/data/projects
      - OPENAI_API_KEY=sk-xxx
      - ANTHROPIC_API_KEY=sk-ant-xxx
      - GITHUB_TOKEN=ghp_xxx
    restart: unless-stopped
```

```bash
docker-compose up -d
```

---

## 使用指南 / Usage Guide

### 1. 创建工作空间

访问首页 → 点击 **"打开工作空间"** → 从允许的根目录中选择一个文件夹 → 确认创建。

也可以点击 **"从 GitHub 克隆"** 来克隆一个 GitHub 仓库作为新工作空间。

### 2. 管理文件

进入工作空间后，左侧面板为文件浏览器：
- 📁 展开/折叠目录
- ⬆️ 上传文件（拖拽或点击）
- ➕ 新建文件/文件夹
- ✏️ 右键菜单：打开、重命名、删除
- 🔄 点击 "同步" 按钮触发 RAG 索引

### 3. AI 对话

中间面板为 AI 对话区：
- 输入问题，AI 会基于工作空间文件内容回答
- 回答中会包含 `[Source: 文件名]` 格式的来源引用
- 首次对话前，请先点击 "同步" 确保文件已被索引

### 4. 生成笔记

右侧面板为笔记区：
- 点击 "生成" 下拉菜单，选择生成类型（摘要/FAQ/简报/时间线）
- 也可以手动创建笔记

### 5. 设置

访问 `/settings` 页面：
- 切换 AI 提供商（OpenAI / Anthropic）和模型
- 查看 API Key 配置状态
- 查看工作空间根目录配置

### 6. 语言切换

点击页面顶部导航栏的语言切换按钮，可在中文/英文之间切换。

---

## 飞书机器人配置 / Feishu Bot Setup

本项目支持接入飞书（Lark）机器人，通过 WebSocket 长连接实时接收消息，让用户在飞书中直接与 Agent 交互（支持工具调用、文件操作等完整能力）。

This project supports Feishu (Lark) bot integration via WebSocket long connection. Users can interact with the Agent directly in Feishu, with full tool support (bash, readFile, writeFile, grep, etc.).

### 第 1 步：创建飞书应用

1. 登录 [飞书开发者后台](https://open.feishu.cn/app)
2. 点击 **"创建企业自建应用"**
3. 填写应用名称（如 "NotebookLM Agent"）和描述，完成创建

### 第 2 步：获取应用凭证

进入刚创建的应用 → **凭证与基础信息** 页面，记录：

| 字段 | 对应环境变量 |
|------|-------------|
| App ID | `FEISHU_APP_ID` |
| App Secret | `FEISHU_APP_SECRET` |

### 第 3 步：配置事件订阅

1. 进入应用 → **事件与回调** → **事件配置**
2. 点击 **"编辑"** 添加以下事件：
   - `im.message.receive_v1` — 接收消息
3. 在 **加密策略** 中记录：

| 字段 | 对应环境变量 |
|------|-------------|
| Verification Token | `FEISHU_VERIFICATION_TOKEN` |
| Encrypt Key | `FEISHU_ENCRYPT_KEY` |

### 第 4 步：启用长连接

1. 在 **事件与回调** → **事件配置** 页面
2. 选择 **"使用长连接接收事件"**（不是 Webhook URL 方式）
3. **注意**：必须先启动服务（`npm run dev`）并确认控制台输出 `[feishu-ws] WSClient connected successfully`，然后再回到飞书开发者后台保存长连接配置

> 如果看到 "未检测到应用连接信息，请确保长连接建立成功后再保存配置"，说明服务未启动或凭证配置有误，请检查 `.env.local` 中的 `FEISHU_APP_ID` 和 `FEISHU_APP_SECRET` 是否正确。

### 第 5 步：配置机器人能力

1. 进入应用 → **应用能力** → **机器人**
2. 启用机器人能力

### 第 6 步：配置权限

进入应用 → **权限管理**，开通以下权限：

| 权限 | 说明 |
|------|------|
| `im:message` | 获取与发送消息 |
| `im:message:send_as_bot` | 以机器人身份发送消息 |
| `im:resource` | 获取消息中的资源文件 |
| `im:chat` | 获取群组信息 |

### 第 7 步：发布应用

1. 进入应用 → **版本管理与发布**
2. 创建版本并提交审核
3. 管理员在 [飞书管理后台](https://feishu.cn/admin) 审核通过后，应用即可使用

### 第 8 步：配置环境变量

在 `.env.local` 中添加飞书配置：

```env
# Feishu (Lark) Bot configuration
FEISHU_BOT_ENABLED=true
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_ENCRYPT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

### 第 9 步：启动并验证

```bash
npm run dev
```

在终端中确认以下日志输出：

```
[feishu-ws] WSClient starting...
[feishu-ws] WSClient connected successfully
```

然后在飞书中搜索并打开机器人对话，发送消息即可。

### 飞书机器人命令

机器人支持以下斜杠命令：

| 命令 | 说明 |
|------|------|
| `/help` | 显示帮助信息 |
| `/workspace <path>` | 绑定工作空间目录（需要在 `WORKSPACE_ROOTS` 允许的路径下） |
| `/workspace` | 查看当前绑定的工作空间 |
| `/mode <agent\|plan\|ask>` | 切换 Agent 模式 |
| `/status` | 查看当前聊天状态 |
| `/clear` | 清空对话历史 |

**Agent 模式说明**：

| 模式 | 权限 | 适用场景 |
|------|------|---------|
| `agent` | 完整工具访问（bash, readFile, writeFile, grep 等） | 代码修改、执行命令 |
| `plan` | 只读（readFile, listDirectory, grep） | 分析代码、制定方案 |
| `ask` | 只读 | 询问代码相关问题 |

**使用示例**：

```
/workspace /home/user/projects/my-app   # 绑定工作空间
/mode plan                               # 切换到只读模式
请帮我分析这个项目的架构                      # 开始对话
/clear                                   # 清空历史，开始新话题
```

> **提示**：如果已在 `WORKSPACE_ROOTS` 中配置了路径，机器人会自动绑定第一个路径作为默认工作空间，无需手动执行 `/workspace` 命令即可直接使用。

### Web → 飞书推送 API

项目还提供了从 Web 端向飞书推送消息的 API：

```bash
# 发送文本消息
curl -X POST http://localhost:3000/api/bot/feishu/push \
  -H "Content-Type: application/json" \
  -d '{"chatId": "oc_xxx", "content": "Hello from web!", "type": "text"}'

# 发送卡片消息
curl -X POST http://localhost:3000/api/bot/feishu/push \
  -H "Content-Type: application/json" \
  -d '{"chatId": "oc_xxx", "title": "Task Complete", "content": "Build succeeded!"}'
```

### 常见问题

**Q: 飞书开发者后台提示 "未检测到应用连接信息"？**
A: 确保服务已启动且 `FEISHU_APP_ID` / `FEISHU_APP_SECRET` 配置正确。查看终端是否有 `[feishu-ws] WSClient connected successfully` 日志。如果看到 `Feishu bot not enabled or missing credentials`，检查 `FEISHU_BOT_ENABLED=true` 是否已设置。

**Q: 机器人回复 "目前无法直接查看" 或类似的无工具回复？**
A: 说明没有绑定工作空间。确认 `WORKSPACE_ROOTS` 环境变量已正确配置且目录存在，机器人会自动绑定第一个路径。或者手动发送 `/workspace <path>` 命令绑定。

**Q: 机器人报错 "Item with id 'rs_...' not found"？**
A: 这是因为 OpenAI 兼容代理不支持 Responses API。项目已使用 `openai.chat()` 强制走 Chat Completions API，确保使用最新代码即可。

**Q: 如何获取 chatId 用于推送 API？**
A: 发送 `/status` 命令，机器人会返回当前的 Chat ID。也可以在飞书开发者后台的消息日志中查看。

---

## 项目结构 / Project Structure

```
src/
├── app/                          # Next.js App Router 页面
│   ├── page.tsx                  # 首页（工作空间列表）
│   ├── settings/page.tsx         # 设置页面
│   ├── workspace/[workspaceId]/  # 工作空间页面（3面板布局）
│   └── api/                      # API 路由
│       ├── workspaces/           # 工作空间 CRUD
│       ├── files/                # 文件操作（browse/read/write/upload/rename/delete/mkdir）
│       ├── git/                  # Git 操作（clone/pull/status）
│       ├── chat/                 # AI 对话（流式）
│       ├── bot/                  # IM 机器人 API
│       │   └── feishu/           # 飞书 webhook + 推送 API
│       ├── generate/             # 笔记生成
│       ├── notes/                # 笔记 CRUD
│       └── settings/             # 设置
├── components/                   # React 组件
│   ├── ui/                       # shadcn/ui 基础组件
│   ├── layout/                   # 页面布局（header, theme-toggle, language-toggle）
│   ├── workspaces/               # 工作空间组件
│   ├── files/                    # 文件浏览器组件
│   ├── chat/                     # 对话组件
│   ├── notes/                    # 笔记组件
│   └── git/                      # Git 组件
├── lib/                          # 核心逻辑
│   ├── db/                       # 数据库（Drizzle ORM + SQLite）
│   ├── ai/                       # AI 提供商配置
│   ├── rag/                      # RAG 管道（分块/嵌入/检索）
│   ├── files/                    # 文件系统操作（含路径安全校验）
│   ├── bot/                      # IM 机器人核心
│   │   ├── types.ts              # 统一 BotAdapter 接口
│   │   ├── processor.ts          # 通用消息处理
│   │   └── feishu/               # 飞书适配器
│   │       ├── client.ts         # API 客户端（消息/卡片）
│   │       ├── ws-client.ts      # WebSocket 长连接
│   │       ├── agent-processor.ts # Agent 工具链处理
│   │       ├── commands.ts       # 斜杠命令
│   │       ├── cards.ts          # 交互卡片构建
│   │       └── state.ts          # 聊天状态管理
│   ├── git/                      # GitHub 操作
│   └── hooks/                    # SWR 数据 hooks
├── i18n/                         # 国际化
│   ├── request.ts                # 语言解析
│   └── messages/                 # 翻译文件（en.json / zh.json）
└── types/                        # TypeScript 类型定义
```

---

## 数据存储 / Data Storage

| 数据 | 位置 | 说明 |
|------|------|------|
| SQLite 数据库 | `./data/notebooklm.db` | 工作空间、来源索引、对话历史、笔记、设置 |
| 工作空间文件 | `WORKSPACE_ROOTS` 指定的目录 | 用户的实际文件，不在项目目录内 |

备份时只需备份 `./data/` 目录和 `.env.local` 文件。

---

## RAG 管道架构 / RAG Pipeline Architecture

本项目的核心功能是基于 RAG（检索增强生成）的 AI 对话。以下是 RAG 管道的完整工作流程：

### 索引阶段（点击"同步"时触发）

```
工作空间文件 → 文本提取 → 文本分块 → 向量嵌入 → SQLite 存储
```

1. **文件扫描** — 遍历工作空间文件夹，筛选支持的文件类型（`.pdf`, `.txt`, `.md`, `.html`, `.json`, `.csv`, 代码文件等）
2. **变更检测** — 通过 MD5 哈希比对文件内容，仅处理新增或修改的文件
3. **文本提取** — 从各类文件中提取纯文本内容（`src/lib/files/text-extractor.ts`）
4. **文本分块** — 将长文本切分为较小的片段（`src/lib/rag/chunker.ts`）
5. **向量嵌入** — 将每个文本块发送至 Embedding API，生成高维向量（`src/lib/rag/embeddings.ts`）
6. **持久化存储** — 文本块存入 `source_chunks` 表，向量以 BLOB 格式存入 `chunk_embeddings` 表（`src/lib/rag/vector-store.ts`）

### 检索阶段（用户提问时触发）

```
用户问题 → 问题向量化 → 余弦相似度搜索 → Top-K 相关片段
```

1. **问题向量化** — 使用同一 Embedding 模型将用户问题转为向量
2. **相似度搜索** — 在该工作空间的所有文本块向量中，通过纯 JS 余弦相似度计算找到最相关的片段（`src/lib/rag/retriever.ts`）
3. **返回结果** — 默认返回相似度最高的 8 个文本块，附带来源文件名和路径

### 生成阶段（LLM 基于上下文回答）

```
系统提示词 + 检索到的文本块 + 用户问题 → LLM → 流式回答（含来源引用）
```

1. **构建提示词** — 将检索到的文本块内容和来源信息注入系统提示词（`src/app/api/chat/route.ts`）
2. **调用 LLM** — 通过 Vercel AI SDK 调用配置的对话模型（支持 OpenAI 兼容接口 / Anthropic）
3. **流式输出** — LLM 的回答以流式方式返回，包含 `[Source: 文件名]` 格式的来源引用

### 数据流图

```
                    索引阶段（同步）
                    ═══════════════
   文件 ──→ 提取文本 ──→ 分块 ──→ 向量嵌入 ──→ SQLite
                                     │         （文本块 + 向量）
                                     │
                    查询阶段（对话）   │
                    ═══════════════   │
   用户 ──→ 问题向量化 ─────────────┘
               │
               ▼
         余弦相似度搜索（纯 JS 计算）
               │
               ▼
         Top-8 相关文本块 + 来源元数据
               │
               ▼
         LLM 提示词：系统提示 + 文本块 + 用户问题
               │
               ▼
         流式回答，附带 [Source: 文件名] 来源引用
```

### Embedding API 配置

Embedding（向量嵌入）和对话模型可以使用不同的 API 服务商。这在以下场景中非常有用：

- 对话模型使用的代理不支持 `/embeddings` 接口
- 希望使用更高质量或更低成本的专用 embedding 模型
- 对话和 embedding 需要不同的 API Key

| 环境变量 | 说明 | 默认值 |
|----------|------|--------|
| `EMBEDDING_API_KEY` | Embedding API 密钥 | 回退至 `OPENAI_API_KEY` |
| `EMBEDDING_BASE_URL` | Embedding API 地址 | 回退至 `OPENAI_BASE_URL` |
| `EMBEDDING_MODEL` | Embedding 模型名称 | `text-embedding-3-small` |

**配置示例：** 使用 Gemini 代理进行对话，同时使用独立的 Gemini Embedding 模型：

```env
# 对话模型（通过 OpenAI 兼容代理调用 Gemini）
OPENAI_API_KEY=sk-your-chat-key
OPENAI_BASE_URL=http://your-proxy:3888/v1

# Embedding 模型（独立配置）
EMBEDDING_API_KEY=sk-your-embedding-key
EMBEDDING_BASE_URL=http://your-proxy:3888/v1
EMBEDDING_MODEL=google/gemini-embedding-001
```

---

## 常见问题 / FAQ

**Q: 不配置 API Key 可以使用吗？**
A: 可以。工作空间管理、文件浏览、上传、编辑、GitHub 克隆等功能均不需要 API Key。只有 AI 对话和笔记生成功能会被禁用，界面上会显示相应提示。

**Q: 如何使用第三方兼容服务（如国内中转/自部署代理）？**
A: 在 `.env.local` 中设置 `OPENAI_BASE_URL` 或 `ANTHROPIC_BASE_URL` 即可。只要服务兼容对应的 API 协议即可正常使用。如果代理不支持 embedding 接口，可以通过 `EMBEDDING_API_KEY`、`EMBEDDING_BASE_URL`、`EMBEDDING_MODEL` 单独配置 embedding 服务。例如：
```env
# 对话模型
OPENAI_BASE_URL=https://api.your-proxy.com/v1
OPENAI_API_KEY=sk-your-chat-key

# Embedding 模型（独立配置）
EMBEDDING_API_KEY=sk-your-embedding-key
EMBEDDING_BASE_URL=https://api.your-embedding-proxy.com/v1
EMBEDDING_MODEL=google/gemini-embedding-001
```

**Q: 支持哪些文件格式？**
A: RAG 索引支持 `.pdf`, `.txt`, `.md`, `.html`, `.json`, `.csv` 以及常见代码文件（`.js`, `.ts`, `.py`, `.java` 等）。

**Q: 文件很多时索引会很慢吗？**
A: 首次同步会逐个文件处理（提取文本 → 分块 → 生成嵌入），取决于文件数量和大小。后续同步只处理新增/修改的文件（基于文件哈希比对）。

**Q: 可以在 Linux 上运行吗？**
A: 可以。将 `WORKSPACE_ROOTS` 设置为 Linux 路径即可，例如 `WORKSPACE_ROOTS=/home/user/research,/home/user/projects`。

**Q: GitHub 克隆失败？**
A: 确保服务器已安装 `git` 命令行工具，且 `GITHUB_TOKEN` 配置正确（需要 `repo` scope）。可在终端运行 `git --version` 验证。

**Q: 如何重置数据库？**
A: 删除 `./data/notebooklm.db` 文件，然后重新运行 `npx drizzle-kit migrate`。

---

## 开发 / Development

```bash
# 开发模式（带热更新）
npm run dev

# 类型检查 + 构建
npm run build

# 代码检查
npm run lint

# 数据库迁移（修改 schema 后）
npx drizzle-kit generate
npx drizzle-kit migrate
```
