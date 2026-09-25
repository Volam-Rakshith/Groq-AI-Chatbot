# ⚡ VR DEVELOPMENTS // Groq Terminal AI

A sleek, minimalist, terminal-styled AI chatbot powered by **Groq LPUs** (Language Processing Units). Designed and crafted by **VR DEVELOPMENTS** to be clean, distraction-free, fully responsive on any device (mobile, tablet, desktop), equipped with conversation history, and **100% static & ready to host directly on GitHub Pages** with zero backend required.

---

## 🌟 Key Highlights

- **VR DEVELOPMENTS Minimalist Aesthetic**: Stripped of all visual clutter, toolbars, and bulky buttons. All operations (switching models, themes, setting API keys, managing chat sessions) are run through native terminal slash commands.
- **Any Device Compatible**: Fluid responsive design (`100dvh`, dynamic safe areas, touch-friendly, mobile virtual keyboard adaptive).
- **Persistent Conversation History**:
  - Slide-over history drawer with `+ New Session` (`/new`).
  - Switch between past conversations with one click.
  - Automatically titles sessions from your first prompt.
  - Saved locally in browser `localStorage`.
- **GitHub Pages Ready (Zero Backend Required)**:
  - Built with pure client-side HTML, CSS, and modern JavaScript.
  - Directly streams from Groq's CORS-enabled REST API (`https://api.groq.com/openai/v1/chat/completions`).
  - Simply push the repo or upload files and enable GitHub Pages!
- **Automatic Model Fallback**:
  - Automatically prevents and resolves errors like `The model 'llama-3.3-70b-versatile' does not exist or you do not have access to it` by seamlessly switching to universally available models like `llama-3.1-8b-instant`.
- **Instant Out-of-the-Box Demo Mode**:
  - Try out prompts and commands right away in simulated mode.
  - Type `/key <your_api_key>` to unlock live Groq LPU inference.

---

## ❓ What to do if you get:
```
INFERENCE ERROR
The model `llama-3.3-70b-versatile` does not exist or you do not have access to it.
```

### Why does this happen?
1. **Tier or Regional Rollout**: Certain Groq API keys or free accounts do not have access to specific 70B preview models (`llama-3.3-70b-versatile`) while they are being rolled out.
2. **Groq Model Name Updates**: Groq occasionally updates, deprecates, or renames model IDs.

### How it is Solved in this App:
1. **Built-in Auto-Fallback**:
   Our engine automatically catches this error, informs you, and automatically switches to **`llama-3.1-8b-instant`** (which is 100% available on all Groq accounts, has generous rate limits, and runs at an ultra-fast ~800 tokens/sec!). It then immediately retries your prompt without you having to retype it.
2. **Manual Model Switching**:
   You can change your active model anytime with:
   ```bash
   /model llama-3.1-8b-instant
   ```
   Or see all models your API key has access to:
   ```bash
   /models
   ```

---

## 🚀 How to Host on GitHub Pages (Zip or Git)

### Method 1: Using the Downloadable Zip File
1. Extract the provided `vr-developments-groq-term.zip`.
2. Create a new repository on [GitHub](https://github.com/new).
3. Upload the files (`index.html`, `style.css`, `app.js`, `README.md`) directly to your repository root.
4. On GitHub, go to **Settings** ➔ **Pages** (under "Code and automation").
5. Under **Build and deployment** ➔ **Source**, select **Deploy from a branch**.
6. Select branch `main` (or `master`) and folder `/ (root)`. Click **Save**.
7. In ~30 seconds, your site is live at:
   `https://<your-username>.github.io/<your-repo-name>/`

### Method 2: Using Git CLI
```bash
git init
git add .
git commit -m "Deploy VR DEVELOPMENTS Groq Terminal to GitHub Pages"
git remote add origin https://github.com/<your-username>/<your-repo-name>.git
git branch -M main
git push -u origin main
```
Then enable Pages under **Settings ➔ Pages**.

---

## ⌨️ Terminal Slash Commands Reference

| Command | Action |
| :--- | :--- |
| `/help` | Display terminal command manual |
| `/key <api_key>` | Configure your Groq API key (`gsk_...`) |
| `/key` | View current API key status |
| `/key clear` | Remove stored API key |
| `/new` | Start a new conversation session |
| `/history` | Open history drawer & list previous chats |
| `/model <id>` | Switch model (e.g. `/model llama-3.1-8b-instant`) |
| `/models` | List all Groq models with speeds and account access |
| `/theme <name>` | Switch palette: `dark`, `matrix`, `cyberpunk`, `amber`, `dracula` |
| `/themes` | Show clickable theme buttons |
| `/system <prompt>` | Set custom AI system instructions |
| `/export` | Download transcript as a `.md` file |
| `/demo` | Toggle simulated demo mode on/off |
| `/clear` or `/cls` | Clear the terminal view |

---

## 📁 Repository Structure

```
├── index.html        # Clean, device-adaptive terminal layout (root for GitHub Pages)
├── style.css         # Modern minimalist terminal stylesheet & history drawer
├── app.js            # Pure client-side streaming Groq engine & history manager
├── app.py            # Minimal local dev server for live preview
├── groq_cli.py       # Standalone Python CLI terminal client (with rich)
└── README.md         # Documentation & deployment guide
```

---

*Engineered with precision by VR DEVELOPMENTS.*
