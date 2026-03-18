# InnoClaw

<p align="center">
  <img src="site/logos/20260316-112548.png" alt="InnoClaw Logo" width="200" />
</p>

**English** | [简体中文](README.md)

A self-hostable AI research assistant. Turn server-side folders into workspaces, chat with AI grounded in your documents via RAG, and leverage 206 built-in scientific skills.

📖 **[Full Documentation](https://zjowowen.github.io/InnoClaw/)**

---

## What's New

<!-- whats-new-start -->

#### 2026-03-17
- **Remote Job Profile Management & SSH Hardening**: Secure remote profile creation, editing, and SSH-hardened job submission for research execution
- **Rich Markdown Rendering in Agent Panel**: Agent messages now render tables, LaTeX math, and syntax-highlighted code blocks
- **API Provider Settings UI**: Configure AI provider API keys and endpoints directly from the Settings page


#### 2026-03-17
- **rjob Profile Config & Submission Hardening**: Remote profiles now store full rjob defaults (image, GPU, CPU, memory, mounts, charged-group, private-machine, env vars, host-network, example commands). `submitRemoteJob` builds the rjob command internally from stored config — the agent can no longer modify flags like `--charged-group` or `--image`. SSH transport fixed with `-o StrictHostKeyChecking=no -tt`, init script sourcing, and double-quote wrapping for correct quoting.
- **Profile Editing**: Edit button (pencil icon) on remote profiles in the Remotes tab. Click to load profile into the form for updating, including all rjob config fields.
- **Direct Job Submission Shortcut**: Agent-Long mode can skip inspect/patch/sync stages for simple job submissions: `listRemoteProfiles → prepareJobSubmission → approval → submitRemoteJob`.


#### 2026-03-16
- **Paper Discussion & Ideation Robustness**: Per-role token budgets (2–2.5x increase), automatic retry on empty/short responses, and error visibility in the UI. Fixes agents returning empty or truncated output with reasoning-capable models (SH-Lab, Qwen, etc.)
- **Full Paper Context**: Discussion and ideation agents now receive up to 30k chars of the full paper text (local files) instead of just the abstract, enabling deeper analysis of methodology, experiments, and results
- **Abstract Extraction Fix**: Heuristic regex-based abstract extraction with improved AI prompt to prevent extracting author names instead of the actual abstract


#### 2026-03-14
- **Research Execution Engine**: New AI-driven research orchestration system with remote profiles, capability toggles, run history, and agent tools
- **Auto-updating README "What's New"**: GitHub Actions workflow that automatically generates and commits a What's New section daily

*No entries yet. This section is auto-updated when significant new features are detected by CI.*





<!-- whats-new-end -->

---

## Overview

**Key Highlights:**
- 🗂️ **Workspace + File Management** — Map server folders, browse, upload, and edit files
- 🤖 **RAG-Powered Chat** — AI answers questions based on your documents with source citations
- 📝 **Smart Note Generation** — Auto-generate summaries, FAQs, briefings, and timelines
- 🔀 **Multi-Model & Multi-Language** — OpenAI / Anthropic / Gemini, bilingual (EN/ZH), dark mode
- 💬 **Feishu Bot** — WebSocket long-polling, agent tool calls, interactive card real-time updates
- 🧠 **Context Management** — MAX mode auto-summarization to prevent context overflow
- 🔬 **206 SCP Scientific Skills** — Covering drug discovery, genomics, protein engineering, and 5 more domains
- 🛠️ **Skills System** — Import skills to quickly configure Feishu bot, SCP scientific skills, and more
- 🗂️ **Multi-Agent Sessions** — Tabbed multi-session management with rename and independent context
- 📚 **Paper Study** — Cross-search arXiv / HuggingFace / Semantic Scholar, AI-enhanced queries, one-click summaries
- 🎓 **Paper Discussion Mode** — 5-role multi-agent structured discussion (Moderator/Librarian/Skeptic/Reproducer/Scribe), 6-stage deterministic flow
- 💡 **Research Ideation** — Multi-agent AI brainstorming, generating cross-disciplinary research directions and innovations from papers
- 📑 **Multi-Tab Preview** — Open multiple papers and files simultaneously, tabbed switching, one-click transition from file preview to paper study mode
- 🧪 **Research Execution Workspace** — 13-stage automated experiment workflow: code review → patch proposal → remote sync → job submission → smart monitoring → result collection → analysis & recommendations. Supports Shell / Slurm / rjob scheduling backends, 5 AI agent roles, fine-grained permission control. rjob backend supports full container config (GPU/CPU/memory/image/mounts/charged-group/env vars), auto-builds commands from stored config to prevent agent tampering
- ⚡ **Agent-Long / Agent-Short Modes** — Agent-Short (default) for quick single-step tasks; Agent-Long optimized for multi-step research pipelines, maxSteps=100, auto-continue limit 50, built-in 15-stage research execution pipeline instructions

**Target Audience:** Researchers · Developers · Self-hosters · Students and Educators

---

## Community

Join the InnoClaw community to get the latest updates, share your experience, and provide feedback!

**Feishu Group:**

<img src="site/social/飞书体验群.png" alt="InnoClaw Feishu Community Group" width="200" />

> Scan the QR code to join our Feishu group. Feel free to report bugs, suggest features, or share your experience!

---

## Quick Start

> **Prerequisites:** Node.js >=20.0.0, npm, Git, C++ build toolchain (for compiling the `better-sqlite3` native module)

---

### Install Prerequisites by OS

<details>
<summary><b>🪟 Windows</b></summary>

#### 1. Install Node.js

Download the LTS version (>=20.0.0) Windows installer (`.msi`) from [nodejs.org](https://nodejs.org/), run the installer, and check **"Automatically install the necessary tools"**.

Or use [nvm-windows](https://github.com/coreybutler/nvm-windows):
```powershell
nvm install 20
nvm use 20
```

Verify installation:
```powershell
node -v   # Should show v20.x.x or higher
npm -v
```

#### 2. Install Git

Download and install from [git-scm.com](https://git-scm.com/download/win). Keep the default options during installation.

```powershell
git --version
```

#### 3. Install C++ Build Toolchain

This project depends on `better-sqlite3`, which requires a C++ build environment. **Choose one of the following:**

**Option A: Auto-install via npm (recommended)**
```powershell
npm install -g windows-build-tools
```

**Option B: Manually install Visual Studio Build Tools**
1. Download [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
2. Select the **"Desktop development with C++"** workload
3. Ensure **MSVC** and **Windows SDK** are checked

#### 4. Install Python (if not auto-installed)

Some Node.js native modules require Python 3 for compilation. Install from [python.org](https://www.python.org/downloads/) and ensure **"Add Python to PATH"** is checked.

```powershell
python --version   # Should show Python 3.x
```

</details>

<details>
<summary><b>🐧 Linux (Ubuntu/Debian)</b></summary>

#### 1. Install Node.js

**Option A: Using NodeSource (recommended)**
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

**Option B: Using nvm**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

Verify installation:
```bash
node -v   # Should show v20.x.x or higher
npm -v
```

#### 2. Install Git and C++ Build Toolchain

```bash
sudo apt-get update
sudo apt-get install -y git build-essential python3
```

- `build-essential` includes `gcc`, `g++`, `make`, etc., needed to compile the `better-sqlite3` native module
- `python3` is required by some Node.js native module builds

Verify installation:
```bash
git --version
gcc --version
python3 --version
```

</details>

<details>
<summary><b>🐧 Linux (CentOS/RHEL/Fedora)</b></summary>

#### 1. Install Node.js

**Option A: Using NodeSource (recommended)**
```bash
curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
sudo yum install -y nodejs       # CentOS/RHEL
# or
sudo dnf install -y nodejs       # Fedora
```

**Option B: Using nvm**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc
nvm install 20
nvm use 20
```

#### 2. Install Git and C++ Build Toolchain

```bash
sudo yum groupinstall -y "Development Tools"   # CentOS/RHEL
sudo yum install -y git python3
# or
sudo dnf groupinstall -y "Development Tools"   # Fedora
sudo dnf install -y git python3
```

</details>

<details>
<summary><b>🍎 macOS</b></summary>

#### 1. Install Xcode Command Line Tools

macOS requires Xcode Command Line Tools (includes `clang`, `make`, etc.) to compile native modules:

```bash
xcode-select --install
```

Click **"Install"** in the dialog and wait for completion.

#### 2. Install Node.js

**Option A: Using Homebrew (recommended)**
```bash
# If you haven't installed Homebrew:
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

brew install node@20
```

**Option B: Using nvm**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.zshrc    # or source ~/.bashrc
nvm install 20
nvm use 20
```

**Option C: Download from official site**

Download the macOS installer (`.pkg`) from [nodejs.org](https://nodejs.org/).

Verify installation:
```bash
node -v   # Should show v20.x.x or higher
npm -v
```

#### 3. Install Git

Git is included with Xcode Command Line Tools, or update via Homebrew:
```bash
brew install git
git --version
```

</details>

---

### Option 1: Manual Setup (Universal)

Works for all users with no extra dependencies. Make sure you've installed the prerequisites above.

#### Step 1: Clone & Install

```bash
git clone https://github.com/zjowowen/InnoClaw.git
cd InnoClaw
npm install
```

> **💡 Tip:** If `npm install` fails due to network issues, use a mirror registry:
> ```bash
> npm install --registry=https://registry.npmmirror.com
> ```

> **💡 Windows users:** If you encounter `better-sqlite3` build errors, make sure Visual Studio Build Tools are installed (see Windows prerequisites above).

#### Step 2: Minimal Configuration

**Linux / macOS:**
```bash
cp .env.example .env.local
```

**Windows (PowerShell):**
```powershell
Copy-Item .env.example .env.local
```

**Windows (CMD):**
```cmd
copy .env.example .env.local
```

Edit `.env.local`, only two settings are required to start:

```env
# [Required] Workspace root directories (comma-separated absolute paths, directories must exist)

# Linux/macOS example:
WORKSPACE_ROOTS=/home/yourname/research,/home/yourname/projects

# Windows example:
# WORKSPACE_ROOTS=D:/Data/research,D:/Data/projects

# [Recommended] At least one AI API Key (app starts without it, but AI features won't work)
OPENAI_API_KEY=sk-xxx
# or ANTHROPIC_API_KEY=sk-ant-xxx
# or GEMINI_API_KEY=xxx
```

> For the full list of environment variables, see [Environment Variables](#environment-variables).

#### Step 3: Init & Start

**Linux / macOS:**
```bash
# Create data directory + initialize database
mkdir -p ./data && npx drizzle-kit migrate

# Start dev server
npm run dev
```

**Windows (PowerShell):**
```powershell
# Create data directory + initialize database
if (-not (Test-Path ./data)) { New-Item -ItemType Directory -Path ./data }
npx drizzle-kit migrate

# Start dev server
npm run dev
```

**Windows (CMD):**
```cmd
if not exist data mkdir data
npx drizzle-kit migrate
npm run dev
```

Open **http://localhost:3000** in your browser. If you see the workspace list page, the installation is successful.

---

### Option 2: Auto Setup via Claude Code (Optional)

> **Prerequisites:**
> - [Claude Code](https://docs.anthropic.com/en/docs/claude-code) CLI must be installed
> - Claude Code has **regional restrictions** — it may not be available in some regions
> - If you cannot install or use Claude Code, use **Option 1: Manual Setup** above

If you have [Claude Code](https://docs.anthropic.com/en/docs/claude-code) installed, follow these steps:

**Step 1: Clone the Repository**

```bash
git clone https://github.com/zjowowen/InnoClaw.git
cd InnoClaw
```

**Step 2: Launch Claude Code**

```bash
claude
```

**Step 3: Run the Setup Wizard Inside Claude Code**

Type the following in the Claude Code interactive prompt:

```
/setup
```

> **Note:**
> - Do NOT run `claude /setup` directly in the terminal — this will not trigger the setup wizard.
> - The correct approach is to first enter Claude Code with the `claude` command, then type `/setup` inside it.

The `/setup` command interactively guides you through: dependency installation → environment configuration (workspace paths, AI API keys, etc.) → database initialization → server startup.

---

## Setup Advanced Features via Skills

The **Skills system** is the preferred way to configure and extend advanced features. After starting the app, visit `/skills` to import and manage skills.

### How to Import Skills

**Option 1: Web UI (recommended)**
1. Visit `/skills` page → click **"Import Skill"**
2. Enter a GitHub repo URL or JSON URL → confirm import
3. The system auto-discovers and batch-imports all skills

**Option 2: API**
```bash
curl -X POST http://localhost:3000/api/skills/import \
  -H "Content-Type: application/json" \
  -d '{"url":"https://github.com/InternScience/scp/tree/main"}'
```

**Option 3: Local script**
```bash
node scripts/import-local-skills.mjs
```

---

### SCP Scientific Skills

[SCP (Science Context Protocol)](https://github.com/InternScience/scp) provides **206 pre-built scientific skills**, connecting to real scientific computing endpoints via the [Intern-Discovery platform](https://scphub.intern-ai.org.cn/).

| Domain | Skills | Representative Capabilities |
|--------|:------:|----------------------------|
| 💊 Drug Discovery & Pharmacology | 71 | Target identification, ADMET prediction, virtual screening, molecular docking |
| 🧬 Genomics & Genetic Analysis | 41 | Variant pathogenicity assessment, cancer genomics, population genetics |
| 🧬 Protein Science & Engineering | 38 | Structure prediction (ESMFold/AlphaFold), binding site analysis |
| 🧪 Chemistry & Molecular Science | 24 | Structure analysis, molecular fingerprints, structure-activity relationships |
| ⚙️ Physics & Engineering Computing | 18 | Circuit analysis, thermodynamics, optics |
| 🔬 Lab Automation & Literature Mining | 7 | Experimental protocol generation, PubMed search |
| 🌍 Earth & Environmental Science | 5 | Atmospheric science, oceanography |

**Setup steps:**

1. Register at [SCP Platform](https://scphub.intern-ai.org.cn/) and obtain an API Key
2. Add `SCP_HUB_API_KEY=sk-your-key` to `.env.local`, restart the service
3. Visit `/skills` → import `https://github.com/InternScience/scp/tree/main`

After importing, describe your research goals in natural language in the Agent panel to auto-invoke the corresponding skills:

```
> Identify potential drug targets for lung cancer, then retrieve detailed info from ChEMBL for the top targets
> Analyze the structure of p53 protein (PDB: 1TUP), compute structural geometry parameters and evaluate quality metrics
```

---

### Feishu Bot Setup

The Feishu bot uses WebSocket long-polling to receive messages in real time, allowing users to interact with the Agent directly in Feishu.

**Step 1: Create a Feishu App**

1. Log in to the [Feishu Developer Console](https://open.feishu.cn/app) → create an enterprise custom app
2. Record the **App ID** and **App Secret** (from the Credentials page)
3. **App Capabilities** → enable **Bot**
4. **Permissions** → grant: `im:message`, `im:message:send_as_bot`, `im:resource`, `im:chat`

> **Note:** Do NOT configure long-polling or event callbacks at this point — the connection must be established first before these settings can be saved.

**Step 2: Publish the App**

**Version Management & Release** → create a version and submit for review. Wait for approval.

**Step 3: Configure Environment Variables and Establish Connection**

Add to `.env.local`:

```env
FEISHU_BOT_ENABLED=true
FEISHU_APP_ID=cli_xxxxxxxxxxxxxxxx
FEISHU_APP_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Start (or restart) the service and confirm the terminal shows:

```
[feishu-ws] WSClient connected successfully
```

**Step 4: Configure Long-Polling and Event Callbacks**

Back in the Feishu Developer Console:

1. **Events & Callbacks** → select **"Use long-polling to receive events"** and save
2. **Events & Callbacks** → add event `im.message.receive_v1`
3. In **Events & Callbacks** → **Encryption Strategy**, record the **Verification Token** and **Encrypt Key**
4. **Version Management & Release** → create a new version and re-publish

**Step 5: Add Remaining Environment Variables and Verify**

Add the obtained values to `.env.local`:

```env
FEISHU_VERIFICATION_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FEISHU_ENCRYPT_KEY=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
# Optional: custom secret for Web → Feishu push API
# FEISHU_PUSH_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Restart the service, search for and open the bot conversation in Feishu, and send a message to verify communication.

**Feishu Bot Commands:**

| Command | Description |
|---------|-------------|
| `/help` | Show help information |
| `/workspace <path>` | Bind/view workspace directory |
| `/mode <agent\|plan\|ask>` | Switch agent mode (full/read-only/Q&A) |
| `/status` | View current chat status, get Chat ID |
| `/clear` | Clear conversation history |

**Web → Feishu Push API:**

```bash
curl -X POST http://localhost:3000/api/bot/feishu/push \
  -H "Content-Type: application/json" \
  -d '{"chatId": "oc_xxx", "content": "Hello!", "type": "text"}'
```

---

### K8s Job Submission

The Agent panel supports submitting GPU compute jobs to Kubernetes clusters.

1. Install `kubectl` ([official installation guide](https://kubernetes.io/docs/tasks/tools/))
2. Configure `KUBECONFIG_PATH=/path/to/your/kubeconfig` in `.env.local`
3. After restarting the service, `submitK8sJob` and `kubectl` tools become available in the Agent panel

---

## Features

- **Workspace Management** — Map server folders, persistent storage
- **File Browser** — Tree directory, upload, create, edit, Markdown rendering
- **GitHub Integration** — Clone/pull repositories (supports private repos)
- **RAG Chat** — AI answers questions based on file content with source citations
- **Note Generation** — Summaries, FAQs, briefings, timelines
- **Multi-LLM** — OpenAI GPT / Anthropic Claude / Google Gemini
- **Bilingual + Dark Mode**
- **Context Overflow Protection** — MAX mode auto-summarization, configurable conservative/standard/extended strategies
- **Feishu Bot** — WebSocket long-polling, agent tool calls, interactive cards
- **SCP Scientific Skills** — 206 skills covering 8 scientific domains
- **Skills System** — Import/export/customize skills, managed via `/skills` page
- **Multi-Agent Sessions** — Tabbed multi-session management, independent context, rename and two-step close confirmation
- **Paper Study** — Cross-search arXiv / HuggingFace / Semantic Scholar, AI query expansion, batch summary generation
- **Paper Discussion Mode** — Multi-agent structured paper review: 5 expert roles (Moderator / Librarian / Skeptic / Reproducer / Scribe) through 6 stages (Agenda→Evidence→Critique→Reproduction→Consensus→Report) generating structured review reports, supports Quick/Full modes
- **Research Ideation** — Multi-agent AI brainstorming: based on paper abstracts, multiple AI expert roles generate research directions and innovations from different perspectives (methodological innovation, cross-disciplinary fusion, application expansion, etc.), supports interactive deep-dive
- **Multi-Tab Preview Panel** — Open multiple papers and files simultaneously with tabbed switching. File preview includes "Study Paper" button for one-click transition from PDF/MD/TXT to paper study mode (with Summary, Discussion, Notes, Discussion, Ideation tabs)
- **Paper Notes Management** — Local notes directory integration, save discussions to files, AI-powered related note discovery
- **Theme Styles** — Default / Cartoon / Cyber Pixel / Retro Handheld, four visual styles
- **Research Execution Workspace** — End-to-end automated experiment management:
  - **13-Stage Workflow**: Code review → Patch proposal → Approval → Apply → Sync preview → Sync execute → Job preparation → Submit → Monitor → Approval collection → Collect results → Analysis → Next-step recommendations
  - **5 AI Agent Roles**: Repo Agent (code analysis), Patch Agent (patch generation), Remote Agent (remote operations), Result Analyst (result analysis), Research Planner (strategy planning)
  - **3 Scheduling Backends**: Shell (nohup), Slurm (sbatch), rjob (containerized jobs, supporting GPU/memory/image/mounts/charged-group/env vars/host-network full config)
  - **rjob Secure Submission**: `submitRemoteJob` tool auto-builds rjob commands from stored config, agent cannot tamper with charged-group, image, mounts, and other critical parameters
  - **Profile Editing**: Remote profiles support editing, click pencil icon to modify existing config (all rjob parameters included)
  - **Smart Job Monitoring**: SSH single-command batch checks (scheduler status + flag files + heartbeat + logs), automatic status inference and conflict detection
  - **SSH Quick Config**: Paste SSH commands to auto-parse host, username, port, key; existing configs support editing
  - **8 Permission Controls**: Read code / Write code / Local terminal / SSH / Remote sync / Job submission / Collect results / Auto-apply
  - **Manual Approval Gates**: Patch approval, sync execution, job submission, result collection — four critical checkpoints require human confirmation
- **Agent-Long / Agent-Short Modes** — Selectable from the Agent panel input bar:
  - **Agent-Short** (default): Quick tasks, maxSteps=50, auto-continue limit 20
  - **Agent-Long**: Multi-step research pipeline, maxSteps=100, auto-continue limit 50, system prompt includes 15-stage research execution pipeline instructions, ensuring long workflows don't disconnect

---

## Usage Guide

### 1. Create Workspace
Visit the homepage → **"Open Workspace"** → select directory → confirm. You can also import via **"Clone from GitHub"**.

### 2. Manage Files
Left file browser: expand directories, upload, create, right-click operations. Click **"Sync"** to trigger RAG indexing.

### 3. AI Chat
Enter questions in the middle panel, AI answers based on workspace files with `[Source: filename]` citations. Click "Sync" before first use.

### 4. Generate Notes
Right panel → **"Generate"** → select type (Summary/FAQ/Briefing/Timeline).

### 5. Settings
Visit `/settings`: switch AI providers and models, MAX mode toggle, context strategy, API Key status.

### 6. Paper Study
Visit the `/paper` page to search papers from arXiv, HuggingFace Daily Papers, and Semantic Scholar:
- **Keyword Search**: Add keyword tags then click **"Search"** for precise results
- **AI Smart Search**: Enter a natural language description (e.g., "diffusion models for video generation") in any input box, click **"AI Search"** → AI auto-extracts optimized keywords and searches across all three sources
- **Paper Summary**: Select papers and click **"Summarize"** to generate AI-structured summaries
- **Paper Discussion**: Click a paper preview to discuss paper details with AI
- **Multi-Agent Paper Discussion**: In the paper preview's **"Discussion"** tab, launch a 5-role structured discussion (Moderator/Librarian/Skeptic/Reproducer/Scribe), automatically generating review reports through 6 stages. Supports Quick and Full modes, exportable as Markdown or saved to notes
- **Research Ideation**: In the paper preview's **"Ideation"** tab, AI expert roles brainstorm from different perspectives (methodological innovation, cross-disciplinary fusion, application expansion, etc.), generating research directions and innovations based on the paper
- **Paper Notes**: In the **"Notes"** tab, manage local notes directories, save discussion records, AI auto-discovers related notes
- **Study Paper One-Click**: In the file preview panel, PDF/MD/TXT files show a **"Study Paper"** button. Click to auto-extract paper metadata and open study mode (with Summary, Discussion, Notes, Discussion, Ideation tabs), while keeping the original file preview open

### 7. Multi-Agent Sessions
In the workspace Agent panel, click the **"+"** button to create a new session. Each session independently maintains conversation context and memory:
- Tab bar shows all active sessions, click to switch
- Double-click a tab or click the pencil icon to rename
- Closing a tab requires two-step confirmation (prevents accidental closure)

### 8. Agent Mode Selection
The mode selector on the left side of the Agent panel input bar provides four modes:

| Mode | Description | maxSteps | Auto-continue |
|------|-------------|:--------:|:-------------:|
| **Agent-Short** | Default mode, for quick single-step tasks | 50 | 20 times |
| **Agent-Long** | Multi-step research pipeline, built-in 15-stage execution pipeline | 100 | 50 times |
| **Plan** | Read-only analysis mode, generates implementation plans | — | — |
| **Ask** | Read-only Q&A mode, answers code/file questions | — | — |

> **Agent-Long** is designed for research execution: the system prompt includes 15-stage pipeline instructions from code review to result analysis, with higher step limits and auto-continue limits to ensure long-running experiments don't disconnect.

### 9. Research Execution Workspace
Open the **Research Execution** panel from the workspace sidebar to manage the full remote experiment workflow:

**Configure Remote Targets:**
1. In the **"Remotes"** tab, add remote execution configs (or paste an SSH command to auto-parse)
2. Select scheduling type: Shell (nohup) / Slurm (sbatch) / rjob (container)
3. In the **"Capabilities"** tab, enable required permissions

**Run Experiments:**
1. Agent auto-analyzes the codebase structure (Repo Agent)
2. Proposes and approves experimental code changes (Patch Agent)
3. Syncs code to the remote target and submits jobs (Remote Agent)
4. Smart job monitoring: batch-checks scheduler status, flag files, heartbeat, and logs via SSH
5. After manual approval, collects results, AI analyzes and recommends next experiment directions

**rjob Container Job Example:**
The rjob backend supports specifying container image, GPU count, memory, mount paths, charged-group, environment variables, and more — ideal for deep learning experiments requiring containerized environments. Config is saved in remote profiles and commands are auto-built on submission — the agent cannot modify these parameters, ensuring correct cluster configuration every time. You can paste example rjob commands in the config for the agent to reference the format.

---

## Environment Variables

All variables are configured in `.env.local`, used only on the server side, and never exposed to the browser.

### Core Configuration

| Variable | Required | Description | Default |
|----------|:--------:|-------------|---------|
| `WORKSPACE_ROOTS` | ✅ | Workspace root directories (comma-separated absolute paths, directories must exist) | — |
| `DATABASE_URL` | | SQLite database path. On network file systems (NFS/CIFS), point to a local path | `./data/innoclaw.db` |
| `NEXT_BUILD_DIR` | | Next.js build directory. On network file systems, point to a local path | `.next` |

### AI Models

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | OpenAI API Key (at least one AI Key is required for chat features) |
| `ANTHROPIC_API_KEY` | Anthropic API Key |
| `GEMINI_API_KEY` | Google Gemini API Key |
| `LLM_PROVIDER` | Default provider: `openai` / `anthropic` / `gemini` (switchable in Settings UI) |
| `LLM_MODEL` | Default model name (switchable in Settings UI) |
| `OPENAI_BASE_URL` | OpenAI-compatible API URL (for third-party proxies/self-hosted services) |
| `ANTHROPIC_BASE_URL` | Anthropic-compatible API URL |
| `GEMINI_BASE_URL` | Gemini-compatible API URL |

### Embedding

> Defaults to `OPENAI_API_KEY` + `OPENAI_BASE_URL`. If your chat provider doesn't support embedding, configure separately.

| Variable | Description | Default |
|----------|-------------|---------|
| `EMBEDDING_API_KEY` | Embedding API key | Falls back to `OPENAI_API_KEY` |
| `EMBEDDING_BASE_URL` | Embedding API URL | Falls back to `OPENAI_BASE_URL` |
| `EMBEDDING_MODEL` | Embedding model | `text-embedding-3-small` |

### Integration Services

| Variable | Description |
|----------|-------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token (required for cloning private repos, needs `repo` scope) |
| `SCP_HUB_API_KEY` | SCP Hub API Key (required for scientific skills) |
| `KUBECONFIG_PATH` | Kubernetes kubeconfig path (required for K8s job submission) |
| `AGENT_MAX_STEPS` | Max tool call steps per agent request (default 10, max 100) |
| `HF_TOKEN` | HuggingFace Token (required for dataset downloads, also configurable in Settings UI) |

### Feishu Bot

| Variable | Description |
|----------|-------------|
| `FEISHU_BOT_ENABLED` | Enable Feishu bot (`true`/`false`) |
| `FEISHU_APP_ID` | Feishu app App ID |
| `FEISHU_APP_SECRET` | Feishu app App Secret |
| `FEISHU_VERIFICATION_TOKEN` | Event subscription Verification Token |
| `FEISHU_ENCRYPT_KEY` | Event subscription Encrypt Key |
| `FEISHU_PUSH_SECRET` | Push API secret (optional) |

### Network Proxy

> Configure when Node.js cannot directly access external APIs in intranet environments. Node.js `fetch()` does not automatically read system proxy settings.

| Variable | Description |
|----------|-------------|
| `HTTP_PROXY` | HTTP proxy address |
| `HTTPS_PROXY` | HTTPS proxy address |
| `NO_PROXY` | Comma-separated list of addresses that bypass the proxy |

### Backup

Only back up the `./data/` directory (database) and the `.env.local` file.

---

## Production Deployment

> **Note:** Production deployment is typically done on Linux servers. Windows users are recommended to use WSL2 or Docker.

### Option 1: Direct Deployment

**Linux / macOS:**
```bash
npm install
cp .env.example .env.local  # Edit configuration
mkdir -p ./data && npx drizzle-kit migrate
npm run build
npm run start               # Default port 3000, customize with PORT=8080
```

**Windows (PowerShell):**
```powershell
npm install
Copy-Item .env.example .env.local   # Edit configuration
if (-not (Test-Path ./data)) { New-Item -ItemType Directory -Path ./data }
npx drizzle-kit migrate
npm run build
$env:PORT=3000; npm run start       # Default port 3000
```

### Option 2: PM2

```bash
npm install -g pm2
npm run build
pm2 start npm --name "innoclaw" -- start
pm2 startup && pm2 save     # Auto-start on boot
```

### Option 3: Docker

```dockerfile
FROM node:20-alpine
RUN apk add --no-cache git python3 make g++
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && mkdir -p /app/data
EXPOSE 3000
CMD ["sh", "-c", "npx drizzle-kit migrate && npm run start"]
```

```yaml
# docker-compose.yml
version: '3.8'
services:
  innoclaw:
    build: .
    ports: ["3000:3000"]
    volumes:
      - ./data:/app/data
      - /path/to/research:/data/research
    environment:
      - WORKSPACE_ROOTS=/data/research
      - OPENAI_API_KEY=sk-xxx
    restart: unless-stopped
```

---

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Home page (workspace list)
│   ├── settings/page.tsx         # Settings page
│   ├── skills/page.tsx           # Skills management page
│   ├── workspace/[workspaceId]/  # Workspace page
│   └── api/                      # API routes
│       ├── workspaces/           # Workspace CRUD
│       ├── files/                # File operations
│       ├── chat/                 # AI chat (streaming)
│       ├── agent/                # Agent panel API
│       ├── paper-study/          # Paper study API (search/summary/discussion/AI query expansion/ideation)
│       ├── research-exec/        # Research execution API (config/run/monitor)
│       ├── skills/               # Skills CRUD + import
│       ├── bot/feishu/           # Feishu webhook + push
│       ├── generate/             # Note generation
│       └── settings/             # Settings
├── components/                   # React components
│   ├── ui/                       # shadcn/ui base components
│   ├── agent/                    # Agent panel (multi-session tabs)
│   ├── paper-study/              # Paper study components
│   ├── preview/                  # Preview panel (multi-tab, file preview)
│   ├── research-exec/            # Research execution components (workflow/config/monitor/history)
│   ├── skills/                   # Skills management components
│   ├── chat/                     # Chat components
│   └── files/                    # File browser
├── lib/                          # Core logic
│   ├── ai/                       # AI providers, agent tools, prompts
│   ├── article-search/           # Paper search (arXiv / HuggingFace / Semantic Scholar)
│   ├── paper-discussion/         # Multi-agent paper discussion (roles/prompts/orchestrator)
│   ├── research-ideation/        # Multi-agent research ideation (roles/prompts/orchestrator)
│   ├── research-exec/            # Research execution engine (types/orchestrator/monitor/roles/permissions/prompts)
│   ├── db/                       # Drizzle ORM + SQLite
│   ├── rag/                      # RAG pipeline (chunking/embedding/retrieval)
│   ├── bot/feishu/               # Feishu adapter
│   └── files/                    # File system operations
├── i18n/messages/                # EN/ZH translation files
└── types/                        # TypeScript types
```

**Tech Stack:** Next.js 16 · TypeScript · Tailwind CSS 4 · shadcn/ui · Vercel AI SDK 6 · SQLite (better-sqlite3 + Drizzle ORM) · next-intl · next-themes

---

## RAG Pipeline Architecture

```
Indexing (click "Sync"):   Files → Text extraction → Chunking → Vector embedding → SQLite storage
Querying (user question):  Question → Vectorize → Cosine similarity search → Top-8 text chunks
Generation:                System prompt + Chunks + Question → LLM → Streaming response (with source citations)
```

**Indexing Flow:**
1. Traverse the workspace, filter supported file types (`.pdf`, `.txt`, `.md`, `.html`, `.json`, `.csv`, code files, etc.)
2. MD5 hash comparison, only process new/modified files
3. Text extraction → Chunking → Call Embedding API to generate vectors → Store in SQLite

**Embedding Configuration:** Embedding and chat models can use different providers. See the `EMBEDDING_*` variables in [Environment Variables](#embedding).

---

## Troubleshooting

### Claude Code Issues

**`/setup` reports `unknown skill` or not found?**
`/setup` is a Claude Code custom command defined in `.claude/commands/setup.md` in the project directory. Verify: ① Run `claude` in the project root to enter the interactive interface, then type `/setup` (don't run `claude /setup` directly in the terminal); ② Your Claude Code version is recent enough (check with `claude --version`). If outdated, upgrade Claude Code or use **Option 1: Manual Setup**.

**Claude Code installation says region not supported?**
Claude Code CLI has regional availability restrictions. Some regions may not work even with VPN due to account registration region. If you encounter this, use **Option 1: Manual Setup** directly — it's functionally identical, just requires manually editing the `.env.local` config file.

### Installation Issues

**`better-sqlite3` build fails?**
A C++ build toolchain is required (see "Install Prerequisites by OS" above):
- **Windows**: Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/), select "Desktop development with C++" workload
- **macOS**: Run `xcode-select --install`
- **Linux (Debian/Ubuntu)**: Run `sudo apt-get install -y build-essential python3`
- **Linux (CentOS/RHEL)**: Run `sudo yum groupinstall -y "Development Tools" && sudo yum install -y python3`

**`npm install` network errors?**
Use a mirror registry: `npm install --registry=https://registry.npmmirror.com`

**`npx drizzle-kit migrate` errors?**
Confirm the `./data/` directory exists (`mkdir -p ./data`). If the database is corrupted, delete and recreate: `rm -f ./data/innoclaw.db && npx drizzle-kit migrate`.

**`SQLITE_IOERR_SHMMAP` / `disk I/O error`?**
Common when the project is on a network file system (NFS/CIFS). Set `DATABASE_URL=/tmp/innoclaw/innoclaw.db` in `.env.local`, then `mkdir -p /tmp/innoclaw && npx drizzle-kit migrate`.

**`Persisting failed` / `No such device`?**
Turbopack cache warning on network file systems, doesn't affect functionality. Set `NEXT_BUILD_DIR=/tmp/innoclaw-next` to suppress.

**Port already in use?**
`PORT=3001 npm run dev`

### Feature Issues

**Can I use the app without an API Key?**
Yes. Workspace, file management, GitHub cloning, etc. don't require an API Key. Only AI chat and note generation need at least one Key.

**How to use a third-party API proxy?**
Set `OPENAI_BASE_URL` / `ANTHROPIC_BASE_URL` / `GEMINI_BASE_URL`. If the proxy doesn't support embedding, configure `EMBEDDING_*` variables separately.

**AI chat shows `Connect Timeout Error`?**
Intranet environments need HTTP proxy configuration: set `HTTP_PROXY` and `HTTPS_PROXY`.

**SCP skill import shows "No skills found"?**
Ensure the URL includes `/tree/main`: `https://github.com/InternScience/scp/tree/main`. Private repos require `GITHUB_TOKEN`.

**Feishu Developer Console shows "No app connection detected"?**
Ensure the service is running and the terminal shows `[feishu-ws] WSClient connected successfully`. Check `FEISHU_BOT_ENABLED=true` and credential configuration.

**Agent panel K8s job fails?**
Ensure `kubectl` is installed (`kubectl version --client`) and `KUBECONFIG_PATH` is configured correctly.

**How to reset the database?**
`rm -f ./data/innoclaw.db && npx drizzle-kit migrate`

---

## Development

```bash
npm run dev              # Dev mode (hot reload)
npm run build            # Type check + build
npm run lint             # Lint
npx drizzle-kit generate # Generate migrations (after schema changes)
mkdir -p ./data && npx drizzle-kit migrate  # Run migrations
```

---

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=zjowowen/InnoClaw&type=Date)](https://star-history.com/#zjowowen/InnoClaw&Date)
