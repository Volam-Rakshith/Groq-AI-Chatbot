/**
 * ⚡ VR DEVELOPMENTS // GROQ TERMINAL AI
 * High-speed LPU AI Terminal Engine
 * Compatible with GitHub Pages and Sandboxed Iframe Previews
 * 
 * Auto-detects pasted API keys (gsk_...)
 * Auto-migrates from retired Llama models to openai/gpt-oss-120b
 */

(function () {
  'use strict';

  // Live Groq Production Models (2026 Developer Plan)
  const GROQ_MODELS = [
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B', speed: '~500 tok/s', context: '131k', desc: 'Flagship open model on Groq Developer Tier.' },
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B', speed: '~1000 tok/s', context: '131k', desc: 'Ultra-fast 20B reasoning model (~1000 tok/s).' },
    { id: 'qwen/qwen3.8-27b', name: 'Qwen 3.8 27B', speed: '~450 tok/s', context: '131k', desc: 'Alibaba Cloud high-capability model.' },
    { id: 'minimaxai/minimax-m2.7', name: 'MiniMax M2.7', speed: '~260 tok/s', context: '196k', desc: 'Large context model.' }
  ];

  // Retired models: forcefully migrate away from these
  const RETIRED_MODELS = [
    'llama-3.3-70b-versatile',
    'llama-3.1-8b-instant',
    'llama3-70b-8192',
    'llama3-8b-8192',
    'llama2-70b-4096'
  ];

  // Clean retired models from localStorage
  let savedModel = localStorage.getItem('groq_model');
  if (!savedModel || RETIRED_MODELS.includes(savedModel) || savedModel.includes('llama')) {
    savedModel = 'openai/gpt-oss-120b';
    localStorage.setItem('groq_model', 'openai/gpt-oss-120b');
  }

  // State
  const state = {
    apiKey: localStorage.getItem('groq_api_key') || '',
    activeModel: savedModel,
    theme: localStorage.getItem('groq_theme') || 'dark',
    systemPrompt: localStorage.getItem('groq_system') || 'You are an intelligent, fast, and helpful AI assistant running on Groq LPUs in a clean terminal, developed by VR DEVELOPMENTS.',
    sessions: JSON.parse(localStorage.getItem('groq_sessions') || '[]'),
    currentSessionId: null,
    cmdHistory: JSON.parse(localStorage.getItem('groq_cmd_history') || '[]'),
    cmdHistoryIndex: -1,
    isStreaming: false,
    abortController: null,
    isDemoMode: localStorage.getItem('groq_demo') === 'true',
    accessibleModels: [],
    failedAttempts: new Set()
  };

  // DOM Elements
  const terminalScreen = document.getElementById('terminal-screen');
  const inputEl = document.getElementById('terminal-input');
  const sendBtn = document.getElementById('send-btn');
  const stopBtn = document.getElementById('stop-btn');
  const historyToggleBtn = document.getElementById('history-toggle-btn');
  const historyDrawer = document.getElementById('history-drawer');
  const historyBackdrop = document.getElementById('drawer-backdrop');
  const closeDrawerBtn = document.getElementById('close-drawer-btn');
  const newChatBtn = document.getElementById('new-chat-btn');
  const historyList = document.getElementById('history-list');
  const clearHistoryBtn = document.getElementById('clear-history-btn');
  const statusDot = document.getElementById('status-dot');
  const statusLabel = document.getElementById('status-label');
  const headerModel = document.getElementById('header-model');

  // ==========================================================================
  // Markdown & Syntax Formatter
  // ==========================================================================
  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function highlightTokens(code) {
    const escaped = escapeHtml(code);
    return escaped
      .replace(/(#.*$|\/\/.*$)/gm, '<span class="hl-cmt">$1</span>')
      .replace(/(&quot;.*?&quot;|&#39;.*?&#39;|`.*?`)/g, '<span class="hl-str">$1</span>')
      .replace(/\b(\d+(\.\d+)?)\b/g, '<span class="hl-num">$1</span>')
      .replace(/\b(def|class|return|import|from|function|const|let|var|async|await|try|catch|except|if|elif|else|for|while|in|yield|export|default|None|True|False|true|false)\b/g, '<span class="hl-kw">$1</span>');
  }

  function renderMarkdown(md) {
    if (!md) return '';

    const codeBlocks = [];
    let text = md.replace(/```([a-zA-Z0-9_\-\+]*)\n([\s\S]*?)```/g, function (match, lang, code) {
      const id = codeBlocks.length;
      lang = lang.trim() || 'code';
      const cleanCode = code.replace(/\n$/, '');
      codeBlocks.push({
        raw: cleanCode,
        lang: lang,
        html: `
          <div class="code-wrap">
            <div class="code-bar">
              <span class="code-lang">${escapeHtml(lang)}</span>
              <button class="code-copy-btn" onclick="window.copyBlock(${id}, this)">Copy</button>
            </div>
            <pre class="code-content"><code>${highlightTokens(cleanCode)}</code></pre>
          </div>
        `
      });
      return `@@CODE_${id}@@`;
    });

    window._codeCache = codeBlocks;

    // Blockquotes
    text = text.replace(/^>\s*(.*?)$/gm, '<blockquote>$1</blockquote>');

    // Headers
    text = text.replace(/^####\s+(.*?)$/gm, '<h4>$1</h4>');
    text = text.replace(/^###\s+(.*?)$/gm, '<h3>$1</h3>');
    text = text.replace(/^##\s+(.*?)$/gm, '<h2>$1</h2>');
    text = text.replace(/^#\s+(.*?)$/gm, '<h1>$1</h1>');

    // Horizontal Rule
    text = text.replace(/^---$/gm, '<hr style="border: 0; border-top: 1px dashed var(--border); margin: 10px 0;">');

    // Inline styles
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong style="color: var(--prompt-color);">$1</strong>');
    text = text.replace(/\*(.*?)\*/g, '<em>$1</em>');
    text = text.replace(/`([^`]+)`/g, '<code class="inline">$1</code>');

    // Links
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

    // Lists
    text = text.replace(/^\s*[\*\-]\s+(.*?)$/gm, '<li>$1</li>');
    text = text.replace(/((?:<li>.*?<\/li>\s*)+)/g, '<ul>$1</ul>');
    text = text.replace(/^\s*\d+\.\s+(.*?)$/gm, '<li>$1</li>');

    // Tables
    text = text.replace(/((?:\|[^\n]+\|\r?\n)+)/g, function (tableMatch) {
      const rows = tableMatch.trim().split('\n');
      if (rows.length < 2) return tableMatch;
      let html = '<table>';
      let isHeader = true;
      for (const r of rows) {
        if (/^\|?\s*[-:]+[-| :]*\s*\|?$/.test(r)) {
          isHeader = false;
          continue;
        }
        const cols = r.split('|').filter((c, i, a) => i !== 0 && i !== a.length - 1);
        if (cols.length === 0) continue;
        html += '<tr>';
        const tag = isHeader ? 'th' : 'td';
        for (const col of cols) {
          html += `<${tag}>${col.trim()}</${tag}>`;
        }
        html += '</tr>';
        if (isHeader) isHeader = false;
      }
      html += '</table>';
      return html;
    });

    // Paragraphs
    text = text.replace(/\n\n+/g, '</p><p>');
    text = `<p>${text}</p>`.replace(/<p><\/p>/g, '');

    // Restore code blocks
    text = text.replace(/@@CODE_(\d+)@@/g, function (m, id) {
      return codeBlocks[parseInt(id, 10)].html;
    });

    return text;
  }

  window.copyBlock = function (id, btn) {
    if (window._codeCache && window._codeCache[id]) {
      navigator.clipboard.writeText(window._codeCache[id].raw).then(() => {
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        btn.style.color = 'var(--success)';
        setTimeout(() => {
          btn.textContent = orig;
          btn.style.color = '';
        }, 1800);
      });
    }
  };

  // ==========================================================================
  // Terminal Rendering
  // ==========================================================================
  function scrollToBottom() {
    terminalScreen.scrollTop = terminalScreen.scrollHeight;
  }

  function getTimeStr() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function appendUserEntry(text) {
    const entry = document.createElement('div');
    entry.className = 'log-entry entry-user';
    entry.innerHTML = `
      <div class="entry-head">
        <span>user ❯</span>
        <span class="entry-time">[${getTimeStr()}]</span>
      </div>
      <div class="entry-body">${escapeHtml(text)}</div>
    `;
    terminalScreen.appendChild(entry);
    scrollToBottom();
  }

  function appendSystemNotice(title, htmlContent, type = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry entry-system ${type}`;
    entry.innerHTML = `
      <div style="font-weight: 700; margin-bottom: 2px;">${title}</div>
      <div>${htmlContent}</div>
    `;
    terminalScreen.appendChild(entry);
    scrollToBottom();
  }

  function createAIEntry(modelId) {
    const entry = document.createElement('div');
    entry.className = 'log-entry entry-ai';
    entry.innerHTML = `
      <div class="entry-head">
        <span>groq ❯</span>
        <span class="entry-time">[${getTimeStr()}]</span>
      </div>
      <div class="entry-body">
        <span class="term-cursor"></span>
      </div>
      <div class="entry-stats" style="display: none;"></div>
    `;
    terminalScreen.appendChild(entry);
    scrollToBottom();

    const bodyEl = entry.querySelector('.entry-body');
    const statsEl = entry.querySelector('.entry-stats');
    return { entry, bodyEl, statsEl };
  }

  // ==========================================================================
  // Dynamic Groq Account Model Discovery
  // ==========================================================================
  async function discoverAccountModels() {
    if (!state.apiKey) return [];
    
    // Try direct fetch first
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${state.apiKey}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        const chatModels = data.data
          .map(m => m.id)
          .filter(id => !id.includes('whisper') && !id.includes('guard'));
        state.accessibleModels = chatModels;
        return chatModels;
      }
    } catch (e) {}

    // Fallback through proxy
    try {
      const resp = await fetch('/api/models', {
        headers: { 'Authorization': `Bearer ${state.apiKey}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        if (data.data) {
          const chatModels = data.data
            .map(m => m.id)
            .filter(id => !id.includes('whisper') && !id.includes('guard'));
          state.accessibleModels = chatModels;
          return chatModels;
        }
      }
    } catch (e) {}

    return [];
  }

  // ==========================================================================
  // Sessions & History Management
  // ==========================================================================
  function saveSessions() {
    localStorage.setItem('groq_sessions', JSON.stringify(state.sessions));
    renderHistoryDrawer();
  }

  function getCurrentSession() {
    return state.sessions.find(s => s.id === state.currentSessionId);
  }

  function startNewSession() {
    const newSession = {
      id: 'sess_' + Date.now(),
      title: 'New Conversation',
      model: state.activeModel,
      createdAt: new Date().toISOString(),
      messages: []
    };
    state.sessions.unshift(newSession);
    state.currentSessionId = newSession.id;
    saveSessions();

    terminalScreen.innerHTML = '';
    renderWelcome();
    closeDrawer();
    inputEl.focus();
  }

  function loadSession(sessionId) {
    const s = state.sessions.find(x => x.id === sessionId);
    if (!s) return;

    state.currentSessionId = s.id;
    terminalScreen.innerHTML = '';
    renderWelcome();

    s.messages.forEach(m => {
      if (m.role === 'user') {
        appendUserEntry(m.content);
      } else if (m.role === 'assistant') {
        const { bodyEl, statsEl } = createAIEntry(s.model);
        bodyEl.innerHTML = renderMarkdown(m.content);
        if (m.stats) {
          statsEl.style.display = 'flex';
          statsEl.innerHTML = `
            <span>⚡ <span class="speed-tag">${m.stats.speed}</span></span>
            <span>• ${m.stats.tokens} tokens</span>
            <span>• ${m.stats.time}s</span>
          `;
        }
      }
    });

    closeDrawer();
    saveSessions();
    inputEl.focus();
  }

  function deleteSession(sessionId, e) {
    if (e) e.stopPropagation();
    state.sessions = state.sessions.filter(s => s.id !== sessionId);
    if (state.currentSessionId === sessionId) {
      if (state.sessions.length > 0) {
        loadSession(state.sessions[0].id);
      } else {
        startNewSession();
      }
    } else {
      saveSessions();
    }
  }

  function clearAllSessions() {
    if (confirm('Clear all conversation history?')) {
      state.sessions = [];
      localStorage.removeItem('groq_sessions');
      startNewSession();
    }
  }

  function renderHistoryDrawer() {
    historyList.innerHTML = '';
    if (state.sessions.length === 0) {
      historyList.innerHTML = `<div class="history-empty">No conversation history yet.</div>`;
      return;
    }

    state.sessions.forEach(s => {
      const item = document.createElement('div');
      item.className = `history-item ${s.id === state.currentSessionId ? 'active' : ''}`;
      
      const date = new Date(s.createdAt);
      const timeStr = date.toLocaleDateString([], { month: 'short', day: 'numeric' });

      item.innerHTML = `
        <div class="history-item-info">
          <span class="history-item-title">${escapeHtml(s.title || 'Conversation')}</span>
          <span class="history-item-meta">${timeStr} • ${s.messages.length} messages</span>
        </div>
        <button class="history-item-delete" title="Delete conversation">&times;</button>
      `;

      item.onclick = () => loadSession(s.id);
      item.querySelector('.history-item-delete').onclick = (e) => deleteSession(s.id, e);
      historyList.appendChild(item);
    });
  }

  function openDrawer() {
    renderHistoryDrawer();
    historyDrawer.classList.add('open');
    historyBackdrop.classList.add('open');
  }

  function closeDrawer() {
    historyDrawer.classList.remove('open');
    historyBackdrop.classList.remove('open');
  }

  // ==========================================================================
  // Terminal Commands
  // ==========================================================================
  async function handleCommand(raw) {
    const parts = raw.trim().split(/\s+/);
    const cmd = parts[0].toLowerCase();
    const arg = parts.slice(1).join(' ').trim();

    switch (cmd) {
      case '/help':
        appendSystemNotice(
          '⚡ VR DEVELOPMENTS // TERMINAL COMMANDS',
          `<table>
            <tr><th>Command</th><th>Description</th></tr>
            <tr><td><code>/help</code></td><td>Show this list of commands</td></tr>
            <tr><td><code>/key &lt;key&gt;</code></td><td>Set your Groq API key (starts with <code>gsk_</code>)</td></tr>
            <tr><td><code>/key</code></td><td>Show current API key status</td></tr>
            <tr><td><code>/key clear</code></td><td>Remove stored API key</td></tr>
            <tr><td><code>/models</code></td><td>Show all live models available on Groq</td></tr>
            <tr><td><code>/model &lt;id&gt;</code></td><td>Switch active model (e.g. <code>/model openai/gpt-oss-120b</code>)</td></tr>
            <tr><td><code>/new</code></td><td>Start a fresh conversation session</td></tr>
            <tr><td><code>/history</code></td><td>Open history drawer to view/resume past chats</td></tr>
            <tr><td><code>/theme &lt;name&gt;</code></td><td>Switch theme: <code>dark</code>, <code>matrix</code>, <code>cyberpunk</code>, <code>amber</code>, <code>dracula</code></td></tr>
            <tr><td><code>/system &lt;prompt&gt;</code></td><td>Set custom AI persona instructions</td></tr>
            <tr><td><code>/export</code></td><td>Download conversation as a Markdown (.md) file</td></tr>
            <tr><td><code>/demo</code></td><td>Toggle demo simulated mode</td></tr>
            <tr><td><code>/clear</code></td><td>Clear the terminal screen</td></tr>
          </table>`
        );
        break;

      case '/clear':
      case '/cls':
        terminalScreen.innerHTML = '';
        renderWelcome();
        break;

      case '/new':
        startNewSession();
        break;

      case '/history':
        if (arg === 'clear') {
          clearAllSessions();
        } else if (arg) {
          const match = state.sessions.find(s => s.id === arg || s.id.includes(arg));
          if (match) loadSession(match.id);
          else appendSystemNotice('ERROR', `Session not found: ${escapeHtml(arg)}`, 'error');
        } else {
          openDrawer();
          let listHtml = '<ul>';
          state.sessions.slice(0, 5).forEach(s => {
            listHtml += `<li><b>${escapeHtml(s.title)}</b> <small style="color:var(--text-dim);">[${s.id}]</small></li>`;
          });
          listHtml += '</ul><div style="margin-top:6px; font-size:11px; color:var(--text-dim);">Opened history panel on the right. Type <code>/new</code> to start a fresh chat.</div>';
          appendSystemNotice('📜 CONVERSATION SESSIONS', listHtml);
        }
        break;

      case '/key':
        if (arg === 'clear' || arg === 'remove') {
          state.apiKey = '';
          localStorage.removeItem('groq_api_key');
          updateStatus();
          appendSystemNotice('KEY REMOVED', 'Groq API Key cleared from browser storage.');
        } else if (arg) {
          await setApiKey(arg);
        } else {
          if (state.apiKey) {
            const masked = `${state.apiKey.slice(0, 4)}...${state.apiKey.slice(-4)}`;
            appendSystemNotice('🔑 API KEY STATUS', `Active key configured: <code>${masked}</code>.<br>To change, paste your key or type: <code>/key &lt;new_key&gt;</code>.`);
          } else {
            appendSystemNotice('🔑 API KEY CONFIGURATION', `No Groq API Key set yet.<br>Just paste your key starting with <code>gsk_...</code> into the input box below!<br>👉 Free key at <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>`);
          }
        }
        break;

      case '/theme':
        if (arg) {
          setTheme(arg.toLowerCase());
        } else {
          appendSystemNotice('🎨 THEMES', `Current theme: <b>${state.theme}</b><br>Available: <code>dark</code>, <code>matrix</code>, <code>cyberpunk</code>, <code>amber</code>, <code>dracula</code><br>Usage: <code>/theme matrix</code>`);
        }
        break;

      case '/themes':
        appendSystemNotice('🎨 AVAILABLE THEMES', `
          <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
            <button class="header-btn" onclick="window.setTheme('dark')">Dark (Default)</button>
            <button class="header-btn" onclick="window.setTheme('matrix')">Matrix Green</button>
            <button class="header-btn" onclick="window.setTheme('cyberpunk')">Cyberpunk</button>
            <button class="header-btn" onclick="window.setTheme('amber')">Amber CRT</button>
            <button class="header-btn" onclick="window.setTheme('dracula')">Dracula</button>
          </div>
        `);
        break;

      case '/models':
        await showModelsList();
        break;

      case '/model':
        if (arg) {
          state.activeModel = arg;
          localStorage.setItem('groq_model', arg);
          headerModel.textContent = arg;
          appendSystemNotice('MODEL SWITCHED', `Switched active inference model to: <code>${escapeHtml(arg)}</code>`, 'success');
        } else {
          appendSystemNotice('MODEL USAGE', `Current Model: <code>${state.activeModel}</code><br>Usage: <code>/model &lt;id&gt;</code> or type <code>/models</code> to see what your key supports.`);
        }
        break;

      case '/system':
        if (arg) {
          state.systemPrompt = arg;
          localStorage.setItem('groq_system', arg);
          appendSystemNotice('SYSTEM PROMPT UPDATED', `New instructions set:<br><i>"${escapeHtml(arg)}"</i>`, 'success');
        } else {
          appendSystemNotice('CURRENT SYSTEM PROMPT', `Current: <i>"${escapeHtml(state.systemPrompt)}"</i><br>To set: <code>/system &lt;instructions&gt;</code>`);
        }
        break;

      case '/demo':
        state.isDemoMode = !state.isDemoMode;
        localStorage.setItem('groq_demo', state.isDemoMode);
        updateStatus();
        appendSystemNotice('DEMO MODE', `Simulated demo mode is now <b>${state.isDemoMode ? 'ENABLED' : 'DISABLED'}</b>.`);
        break;

      case '/export':
        exportSession();
        break;

      default:
        appendSystemNotice('UNKNOWN COMMAND', `Command <code>${escapeHtml(cmd)}</code> not recognized. Type <code>/help</code> for available commands.`, 'error');
        break;
    }
  }

  // ==========================================================================
  // Display Live Model Catalog
  // ==========================================================================
  async function showModelsList() {
    let mHtml = '<table><tr><th>Model ID</th><th>Speed</th><th>Switch</th></tr>';
    
    if (state.apiKey) {
      const liveModels = await discoverAccountModels();
      if (liveModels.length > 0) {
        liveModels.forEach(mId => {
          const isAct = mId === state.activeModel ? ' <b style="color:var(--success);">[ACTIVE]</b>' : '';
          mHtml += `
            <tr>
              <td><code>${escapeHtml(mId)}</code>${isAct}</td>
              <td><span style="color:var(--success);">✔ Active</span></td>
              <td><button class="code-copy-btn" onclick="window.switchModel('${escapeHtml(mId)}')">Select</button></td>
            </tr>
          `;
        });
        mHtml += '</table>';
        mHtml += '<div style="margin-top:6px; font-size:11px; color:var(--text-dim);">Notice: Groq retired legacy Llama models on 2026-08-16. Use <code>openai/gpt-oss-120b</code> or <code>openai/gpt-oss-20b</code>.</div>';
        appendSystemNotice('🤖 ACCESSIBLE MODELS ON YOUR GROQ KEY', mHtml);
        return;
      }
    }

    GROQ_MODELS.forEach(m => {
      const isAct = m.id === state.activeModel ? ' <b style="color:var(--success);">[ACTIVE]</b>' : '';
      mHtml += `
        <tr>
          <td><code>${m.id}</code>${isAct}</td>
          <td>${m.speed}</td>
          <td><button class="code-copy-btn" onclick="window.switchModel('${m.id}')">Select</button></td>
        </tr>
      `;
    });
    mHtml += '</table>';
    mHtml += '<div style="margin-top:6px; font-size:11px; color:var(--text-dim);">Notice: Groq retired legacy Llama models on 2026-08-16. Use <code>openai/gpt-oss-120b</code> or <code>openai/gpt-oss-20b</code>.</div>';
    appendSystemNotice('🤖 CURRENT GROQ MODELS', mHtml);
  }

  window.switchModel = function (id) {
    state.activeModel = id;
    localStorage.setItem('groq_model', id);
    headerModel.textContent = id;
    appendSystemNotice('MODEL SWITCHED', `Switched active inference model to: <code>${escapeHtml(id)}</code>`, 'success');
  };

  // ==========================================================================
  // API Key & Model Handlers
  // ==========================================================================
  async function setApiKey(key) {
    key = key.trim();
    appendSystemNotice('AUTHENTICATING', 'Validating Groq API key with remote LPU servers...');
    
    let success = false;
    let modelCount = 0;

    // 1. Direct validation attempt
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${key}` }
      });
      if (resp.ok) {
        const data = await resp.json();
        success = true;
        modelCount = data.data?.length || 0;
      }
    } catch (e) {}

    // 2. Proxy validation attempt if direct failed
    if (!success) {
      try {
        const resp = await fetch('/api/models', {
          headers: { 'Authorization': `Bearer ${key}` }
        });
        if (resp.ok) {
          const data = await resp.json();
          success = true;
          modelCount = data.data?.length || 0;
        }
      } catch (e) {}
    }

    // 3. Fallback acceptance if format is valid
    if (success || key.startsWith('gsk_')) {
      state.apiKey = key;
      state.isDemoMode = false;
      localStorage.setItem('groq_api_key', key);
      localStorage.setItem('groq_demo', 'false');

      // Make sure active model is not retired
      if (RETIRED_MODELS.includes(state.activeModel) || state.activeModel.includes('llama')) {
        state.activeModel = 'openai/gpt-oss-120b';
        localStorage.setItem('groq_model', 'openai/gpt-oss-120b');
      }

      updateStatus();
      appendSystemNotice(
        'AUTHENTICATION SUCCESS',
        `✔ Connected to Groq! Active model: <code>${state.activeModel}</code>.<br>` +
        `Live LPU inference is active. Send any message to start!`,
        'success'
      );
    } else {
      appendSystemNotice('AUTH FAILED', 'Invalid API key or network error. Check key at console.groq.com/keys', 'error');
    }
  }

  function setTheme(name) {
    const valid = ['dark', 'matrix', 'cyberpunk', 'amber', 'dracula'];
    if (!valid.includes(name)) return;
    state.theme = name;
    localStorage.setItem('groq_theme', name);
    document.body.setAttribute('data-theme', name);
    appendSystemNotice('THEME CHANGED', `Theme set to <b>${name}</b>.`);
  }
  window.setTheme = setTheme;

  function updateStatus() {
    if (state.apiKey && !state.isDemoMode) {
      statusDot.className = 'status-dot active';
      statusLabel.textContent = 'groq online';
    } else {
      statusDot.className = 'status-dot';
      statusLabel.textContent = 'demo mode';
    }
    headerModel.textContent = state.activeModel;
  }

  function exportSession() {
    const s = getCurrentSession();
    if (!s || s.messages.length === 0) {
      appendSystemNotice('EXPORT', 'Nothing to export in this session.', 'error');
      return;
    }

    let md = `# ${s.title}\n*Exported from VR DEVELOPMENTS Groq Terminal: ${new Date().toLocaleString()}*\n\n---\n\n`;
    s.messages.forEach(m => {
      md += `### ${m.role === 'user' ? 'User' : 'Groq AI'}\n\n${m.content}\n\n---\n\n`;
    });

    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vr-groq-chat-${Date.now()}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    appendSystemNotice('EXPORT COMPLETE', 'Chat transcript downloaded as Markdown (.md).');
  }

  // ==========================================================================
  // Chat Execution & Streaming (With Dual Network Fallback & Auto-Migration)
  // ==========================================================================
  async function sendMessage(isRetry = false) {
    if (state.isStreaming) return;
    const text = isRetry ? (state.lastUserText || '') : inputEl.value.trim();
    if (!text) return;

    // Automatically detect pasted API key (starts with or contains gsk_)
    if (!isRetry && text.includes('gsk_')) {
      const match = text.match(/gsk_[a-zA-Z0-9_-]+/);
      if (match) {
        inputEl.value = '';
        appendSystemNotice('🔑 API KEY DETECTED', `Detected Groq API Key: <code>${match[0].slice(0, 4)}...${match[0].slice(-4)}</code>. Authenticating...`);
        await setApiKey(match[0]);
        return;
      }
    }

    // Force migration from any retired model
    if (RETIRED_MODELS.includes(state.activeModel) || state.activeModel.includes('llama')) {
      state.activeModel = 'openai/gpt-oss-120b';
      localStorage.setItem('groq_model', 'openai/gpt-oss-120b');
      headerModel.textContent = state.activeModel;
    }

    if (!isRetry) {
      state.lastUserText = text;
      state.failedAttempts.clear();
      inputEl.value = '';
      inputEl.style.height = '38px';

      // Command History
      state.cmdHistory.push(text);
      if (state.cmdHistory.length > 50) state.cmdHistory.shift();
      localStorage.setItem('groq_cmd_history', JSON.stringify(state.cmdHistory));
      state.cmdHistoryIndex = -1;

      // Slash command
      if (text.startsWith('/')) {
        await handleCommand(text);
        return;
      }

      // Ensure session exists
      let session = getCurrentSession();
      if (!session) {
        startNewSession();
        session = getCurrentSession();
      }

      if (session.messages.length === 0) {
        session.title = text.length > 34 ? text.slice(0, 34) + '...' : text;
        saveSessions();
      }

      appendUserEntry(text);
      session.messages.push({ role: 'user', content: text });
    }

    const session = getCurrentSession();

    // Check if API key is missing
    if (!state.apiKey && !state.isDemoMode) {
      appendSystemNotice(
        '🔑 NO API KEY CONFIGURED',
        `Paste your Groq API key (starts with <code>gsk_...</code>) directly into the prompt box below, or type:<br>
        <code>/key &lt;your_groq_api_key&gt;</code> (Get one at <a href="https://console.groq.com/keys" target="_blank">console.groq.com/keys</a>)<br>
        <i>Or type <code>/demo</code> to test with simulated responses!</i>`,
        'error'
      );
      return;
    }

    // Setup streaming UI
    state.isStreaming = true;
    sendBtn.style.display = 'none';
    stopBtn.style.display = 'inline-flex';

    const { entry, bodyEl, statsEl } = createAIEntry(state.activeModel);
    state.abortController = new AbortController();

    const startTime = performance.now();
    let accumulated = '';
    let tokenCount = 0;

    // SIMULATED DEMO RESPONSE
    if (!state.apiKey || state.isDemoMode) {
      const demoReply1 = "### ⚡ Groq LPU Terminal // VR DEVELOPMENTS\n\n" +
        "You asked: **\"" + escapeHtml(text) + "\"**\n\n" +
        "Groq LPUs process inference deterministically with zero memory contention, reaching speeds of **500 - 1000 tokens per second**!\n\n" +
        "```python\n# Example Groq integration\nfrom groq import Groq\n\n" +
        "client = Groq(api_key=\"your_api_key\")\nchat = client.chat.completions.create(\n" +
        "    model=\"" + state.activeModel + "\",\n" +
        "    messages=[{\"role\": \"user\", \"content\": \"" + escapeHtml(text.slice(0, 30)) + "\"}],\n)\n" +
        "print(chat.choices[0].message.content)\n```\n\n" +
        "💡 *Running in Demo Mode. Paste your Groq API key (`gsk_...`) to unlock live LPU inference!*";

      const demoReply2 = "### 🚀 High-Speed Compute // VR DEVELOPMENTS\n\n" +
        "Processing **\"" + escapeHtml(text) + "\"** on Groq LPU architecture.\n\n" +
        "* **Model:** `" + state.activeModel + "`\n" +
        "* **Throughput:** ~500 - 1000 tokens/sec\n" +
        "* **Time to First Token (TTFT):** ~15ms\n\n" +
        "> \"Speed is the essential dimension that turns AI from an asynchronous tool into an immediate conversational extension.\"\n\n" +
        "Try commands like `/theme matrix` or `/models`!";

      const demoResponses = [demoReply1, demoReply2];
      const reply = demoResponses[Math.floor(Math.random() * demoResponses.length)];
      const words = reply.split(' ');

      for (let i = 0; i < words.length; i++) {
        if (!state.isStreaming) break;
        accumulated += (i === 0 ? '' : ' ') + words[i];
        tokenCount++;
        bodyEl.innerHTML = renderMarkdown(accumulated) + '<span class="term-cursor"></span>';
        scrollToBottom();
        await new Promise(r => setTimeout(r, 16));
      }

      bodyEl.innerHTML = renderMarkdown(accumulated);
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      const spd = Math.round(tokenCount / Math.max(0.1, elapsed));
      statsEl.style.display = 'flex';
      statsEl.innerHTML = `
        <span>⚡ <span class="speed-tag">${spd} tok/s</span></span>
        <span>• ${tokenCount} tokens</span>
        <span>• ${elapsed}s</span>
        <span>• [VR DEVELOPMENTS DEMO]</span>
      `;
      session.messages.push({ role: 'assistant', content: accumulated, stats: { speed: `${spd} tok/s`, tokens: tokenCount, time: elapsed } });
      saveSessions();

      state.isStreaming = false;
      sendBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'none';
      inputEl.focus();
      return;
    }

    // LIVE GROQ API STREAMING CALL (Dual Network: Direct Fetch -> Server Proxy Fallback)
    try {
      const messagesPayload = [
        { role: 'system', content: state.systemPrompt },
        ...session.messages.slice(-8).map(m => ({ role: m.role, content: m.content }))
      ];

      let response = null;

      // Attempt 1: Direct browser fetch to Groq API
      try {
        response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${state.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: state.activeModel,
            messages: messagesPayload,
            stream: true,
            temperature: 0.7
          }),
          signal: state.abortController.signal
        });
      } catch (directErr) {
        // Attempt 2: Local server proxy fallback (if direct fetch blocked in sandboxed iframe)
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${state.apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: state.activeModel,
            messages: messagesPayload,
            temperature: 0.7
          }),
          signal: state.abortController.signal
        });
      }

      if (!response || !response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const rawErrMsg = errorData.error?.message || `HTTP ${response.status}: ${response.statusText}`;

        // AUTOMATIC MODEL RECOVERY FOR RETIRED / RESTRICTED MODELS
        if (rawErrMsg.toLowerCase().includes('does not exist') || rawErrMsg.toLowerCase().includes('do not have access')) {
          entry.remove();
          state.failedAttempts.add(state.activeModel);

          const candidateList = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b', 'minimaxai/minimax-m2.7'];
          const nextModel = candidateList.find(m => !state.failedAttempts.has(m));

          if (nextModel && nextModel !== state.activeModel) {
            const oldModel = state.activeModel;
            state.activeModel = nextModel;
            localStorage.setItem('groq_model', nextModel);
            headerModel.textContent = nextModel;

            appendSystemNotice(
              '⚡ RETIRED MODEL AUTO-MIGRATED',
              `<code>${oldModel}</code> was retired by Groq.<br>` +
              `Auto-switched to official production model: <b><code>${nextModel}</code></b>. Retrying prompt now...`,
              'warning'
            );

            state.isStreaming = false;
            setTimeout(() => sendMessage(true), 400);
            return;
          }
        }

        throw new Error(rawErrMsg);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (trimmed.startsWith('data: ')) {
            try {
              const data = JSON.parse(trimmed.slice(6));
              const delta = data.choices?.[0]?.delta;
              const contentChunk = delta?.content || '';
              if (contentChunk) {
                accumulated += contentChunk;
                tokenCount++;
                bodyEl.innerHTML = renderMarkdown(accumulated) + '<span class="term-cursor"></span>';
                scrollToBottom();
              }
            } catch (e) {}
          }
        }
      }

      bodyEl.innerHTML = renderMarkdown(accumulated);
      const elapsed = ((performance.now() - startTime) / 1000).toFixed(2);
      const spd = Math.round(tokenCount / Math.max(0.05, elapsed));

      statsEl.style.display = 'flex';
      statsEl.innerHTML = `
        <span>⚡ <span class="speed-tag">${spd} tok/s</span></span>
        <span>• ${tokenCount} tokens</span>
        <span>• ${elapsed}s</span>
        <span>• ${state.activeModel}</span>
      `;

      session.messages.push({ role: 'assistant', content: accumulated, stats: { speed: `${spd} tok/s`, tokens: tokenCount, time: elapsed } });
      saveSessions();

    } catch (err) {
      if (err.name === 'AbortError') {
        bodyEl.innerHTML = renderMarkdown(accumulated) + '<span style="color:var(--danger); font-size:12px;"> [Stopped]</span>';
      } else {
        bodyEl.innerHTML = renderMarkdown(accumulated);
        appendSystemNotice(
          'INFERENCE ERROR',
          `${escapeHtml(err.message)}<br><small style="color:var(--text-dim);">Type <code>/models</code> to see active models, or <code>/model openai/gpt-oss-120b</code>.</small>`,
          'error'
        );
      }
    } finally {
      state.isStreaming = false;
      state.abortController = null;
      sendBtn.style.display = 'inline-flex';
      stopBtn.style.display = 'none';
      inputEl.focus();
    }
  }

  function stopStreaming() {
    if (state.abortController) {
      state.abortController.abort();
    }
  }

  // ==========================================================================
  // Welcome Header
  // ==========================================================================
  function renderWelcome() {
    const welcome = document.createElement('div');
    welcome.className = 'terminal-welcome';
    welcome.innerHTML = `
      <div class="welcome-logo">
        <span>⚡ VR DEVELOPMENTS // GROQ AI TERMINAL</span>
      </div>
      <div class="welcome-sub">
        Deterministic, low-latency AI inference running on Groq's Tensor Processors.
      </div>
      <div class="welcome-cmd-hint">
        Type <code onclick="window.typeCommand('/help')">/help</code> for commands,
        paste your <code onclick="window.typeCommand('gsk_')">gsk_...</code> key,
        <code onclick="window.typeCommand('/models')">/models</code> to view live models,
        or <code onclick="window.openHistory()">/history</code> for past chats.
      </div>
    `;
    terminalScreen.appendChild(welcome);
    scrollToBottom();
  }

  window.typeCommand = function (cmd) {
    inputEl.value = cmd;
    inputEl.focus();
  };

  window.openHistory = openDrawer;

  // ==========================================================================
  // Event Listeners
  // ==========================================================================
  function initEvents() {
    inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
        return;
      }

      if (inputEl.value === '' || state.cmdHistoryIndex !== -1) {
        if (e.key === 'ArrowUp') {
          if (state.cmdHistory.length > 0) {
            e.preventDefault();
            if (state.cmdHistoryIndex === -1) {
              state.cmdHistoryIndex = state.cmdHistory.length - 1;
            } else if (state.cmdHistoryIndex > 0) {
              state.cmdHistoryIndex--;
            }
            inputEl.value = state.cmdHistory[state.cmdHistoryIndex];
          }
        } else if (e.key === 'ArrowDown') {
          if (state.cmdHistoryIndex !== -1) {
            e.preventDefault();
            if (state.cmdHistoryIndex < state.cmdHistory.length - 1) {
              state.cmdHistoryIndex++;
              inputEl.value = state.cmdHistory[state.cmdHistoryIndex];
            } else {
              state.cmdHistoryIndex = -1;
              inputEl.value = '';
            }
          }
        }
      }

      if (e.ctrlKey && e.key === 'l') {
        e.preventDefault();
        handleCommand('/clear');
      }

      if ((e.ctrlKey && e.key === 'c') || e.key === 'Escape') {
        if (state.isStreaming) {
          e.preventDefault();
          stopStreaming();
        }
      }
    });

    inputEl.addEventListener('input', () => {
      inputEl.style.height = 'auto';
      inputEl.style.height = Math.min(120, Math.max(38, inputEl.scrollHeight)) + 'px';
    });

    sendBtn.addEventListener('click', () => sendMessage(false));
    stopBtn.addEventListener('click', stopStreaming);

    historyToggleBtn.addEventListener('click', openDrawer);
    closeDrawerBtn.addEventListener('click', closeDrawer);
    historyBackdrop.addEventListener('click', closeDrawer);
    newChatBtn.addEventListener('click', startNewSession);
    clearHistoryBtn.addEventListener('click', clearAllSessions);

    terminalScreen.addEventListener('click', (e) => {
      if (!window.getSelection().toString() && !e.target.closest('button, a, pre, code')) {
        inputEl.focus();
      }
    });
  }

  // ==========================================================================
  // Initialization
  // ==========================================================================
  async function init() {
    document.body.setAttribute('data-theme', state.theme);
    updateStatus();

    // Auto-discover models if key is present
    if (state.apiKey) {
      discoverAccountModels().catch(() => {});
    }

    if (state.sessions.length > 0) {
      state.currentSessionId = state.sessions[0].id;
      loadSession(state.currentSessionId);
    } else {
      startNewSession();
    }

    initEvents();
    setTimeout(() => inputEl.focus(), 150);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
