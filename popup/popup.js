/**
 * GitHub Repo Remark - Popup 逻辑
 */
(function () {
  'use strict';

  // ==================== DOM 引用 ====================
  const noteList = document.getElementById('noteList');
  const emptyState = document.getElementById('emptyState');
  const loadingState = document.getElementById('loadingState');
  const searchInput = document.getElementById('searchInput');
  const noteCount = document.getElementById('noteCount');
  const footer = document.getElementById('footer');
  const btnGotoTrending = document.getElementById('btnGotoTrending');

  // ==================== 状态 ====================
  let allNotes = {};
  let editMode = {}; // { repoName: true/false }

  // ==================== 初始化 ====================

  async function init() {
    showLoading();
    await loadNotes();
    hideLoading();
    renderNotes();
    bindEvents();
  }

  async function loadNotes() {
    const data = await chrome.storage.sync.get(null);
    allNotes = {};
    for (const [key, value] of Object.entries(data)) {
      if (value && typeof value === 'object' && 'note' in value) {
        allNotes[key] = value;
      }
    }
  }

  // ==================== 渲染 ====================

  function renderNotes(filter = '') {
    const entries = Object.entries(allNotes)
      .sort((a, b) => b[1].updatedAt - a[1].updatedAt);

    const filtered = filter
      ? entries.filter(([name, data]) => {
          const note = data.note || '';
          const filterLower = filter.toLowerCase();
          return name.toLowerCase().includes(filterLower) ||
                 note.toLowerCase().includes(filterLower);
        })
      : entries;

    // 更新计数
    noteCount.textContent = `${entries.length} 条备注`;

    // 清空列表
    noteList.innerHTML = '';

    if (filtered.length === 0) {
      if (entries.length === 0) {
        // 完全没有备注
        noteList.innerHTML = `
          <div class="popup-empty">
            <svg width="48" height="48" viewBox="0 0 16 16" fill="currentColor" class="empty-icon">
              <path d="M2 2.5A1.5 1.5 0 013.5 1h5.086a1.5 1.5 0 011.06.44l3.915 3.914a1.5 1.5 0 01.439 1.06V13.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 13.5v-11z" opacity="0.4"/>
              <path d="M4 5.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h6a.5.5 0 010 1h-6a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h6a.5.5 0 010 1h-6a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h4a.5.5 0 010 1h-4a.5.5 0 01-.5-.5z" fill="white" opacity="0.6"/>
            </svg>
            <p>还没有备注</p>
            <p class="empty-hint">浏览 GitHub 仓库时点击 📝 图标添加备注</p>
          </div>
        `;
        footer.style.display = 'none';
      } else {
        noteList.innerHTML = `
          <div class="popup-empty">
            <p>没有匹配的备注</p>
          </div>
        `;
        footer.style.display = '';
      }
      return;
    }

    footer.style.display = '';

    for (const [repoName, data] of filtered) {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'note-item';
      itemDiv.dataset.repo = repoName;

      const timeStr = data.updatedAt
        ? formatTime(data.updatedAt)
        : '';

      const isEditing = editMode[repoName];

      if (isEditing) {
        itemDiv.innerHTML = `
          <div class="note-item-header">
            <span class="note-repo-name">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z"/>
              </svg>
              ${escapeHtml(repoName)}
            </span>
            <span class="note-time">${timeStr}</span>
          </div>
          <div class="note-editor">
            <textarea maxlength="2000" placeholder="输入备注...">${escapeHtml(data.note)}</textarea>
            <div class="note-editor-actions">
              <button class="note-btn note-btn-cancel">取消</button>
              <button class="note-btn note-btn-save">保存</button>
            </div>
          </div>
        `;
      } else {
        itemDiv.innerHTML = `
          <div class="note-item-header">
            <span class="note-repo-name" data-repo="${escapeAttr(repoName)}">
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 110-1.5h1.75v-2h-8a1 1 0 00-.714 1.7.75.75 0 01-1.072 1.05A2.495 2.495 0 012 11.5v-9zm10.5-1V9h-8c-.356 0-.694.074-1 .208V2.5a1 1 0 011-1h8z"/>
              </svg>
              ${escapeHtml(repoName)}
            </span>
            <span class="note-time">${timeStr}</span>
          </div>
          <div class="note-content">${escapeHtml(data.note)}</div>
          <div class="note-item-actions">
            <button class="note-btn note-btn-edit" data-action="edit">编辑</button>
            <button class="note-btn note-btn-delete" data-action="delete">删除</button>
          </div>
        `;
      }

      noteList.appendChild(itemDiv);
    }

    // 绑定事件
    bindItemEvents();
  }

  function bindItemEvents() {
    const items = noteList.querySelectorAll('.note-item');

    for (const item of items) {
      const repoName = item.dataset.repo;

      // 仓库名点击打开 GitHub
      const repoLink = item.querySelector('.note-repo-name');
      if (repoLink && !repoLink.dataset.bound) {
        repoLink.dataset.bound = '1';
        repoLink.addEventListener('click', () => {
          if (editMode[repoName]) return; // 编辑模式下不跳转
          chrome.tabs.create({ url: `https://github.com/${repoName}` });
        });
      }

      // 编辑按钮
      const editBtn = item.querySelector('[data-action="edit"]');
      if (editBtn) {
        editBtn.addEventListener('click', () => {
          editMode[repoName] = true;
          renderNotes(searchInput.value.trim());
        });
      }

      // 删除按钮
      const deleteBtn = item.querySelector('[data-action="delete"]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', async () => {
          if (confirm(`确定要删除「${repoName}」的备注吗？`)) {
            await chrome.storage.sync.remove(repoName);
            await loadNotes();
            renderNotes(searchInput.value.trim());
          }
        });
      }

      // 取消编辑
      const cancelBtn = item.querySelector('.note-btn-cancel');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', () => {
          editMode[repoName] = false;
          renderNotes(searchInput.value.trim());
        });
      }

      // 保存编辑
      const saveBtn = item.querySelector('.note-btn-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          const textarea = item.querySelector('textarea');
          if (!textarea) return;
          const note = textarea.value.trim();
          if (!note) {
            // 清空视为删除
            await chrome.storage.sync.remove(repoName);
          } else {
            await chrome.storage.sync.set({
              [repoName]: { note, updatedAt: Date.now() }
            });
          }
          editMode[repoName] = false;
          await loadNotes();
          renderNotes(searchInput.value.trim());
        });
      }
    }
  }

  // ==================== 搜索 ====================

  function bindEvents() {
    searchInput.addEventListener('input', () => {
      const filter = searchInput.value.trim();
      renderNotes(filter);
    });

    // 去 Trending
    btnGotoTrending.addEventListener('click', () => {
      chrome.tabs.create({ url: 'https://github.com/trending' });
    });
  }

  // ==================== 辅助 ====================

  function showLoading() {
    loadingState.style.display = '';
    noteList.style.display = 'none';
  }

  function hideLoading() {
    loadingState.style.display = 'none';
    noteList.style.display = '';
  }

  function formatTime(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now - date;

    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`;

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function escapeAttr(text) {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  // ==================== 启动 ====================

  document.addEventListener('DOMContentLoaded', init);

})();
