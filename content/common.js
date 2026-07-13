/**
 * GitHub Repo Remark - Common Module
 * 存储封装、备注卡片UI组件、工具函数
 */

// ==================== 存储封装 ====================

const RemarkStorage = {
  /**
   * 获取单个仓库的备注
   * @param {string} repoFullName - 仓库全名，如 "facebook/react"
   * @returns {Promise<{note: string, updatedAt: number}|null>}
   */
  async getNote(repoFullName) {
    try {
      const result = await chrome.storage.sync.get(repoFullName);
      return result[repoFullName] || null;
    } catch (e) {
      console.error('[Repo Remark] Failed to get note:', e);
      return null;
    }
  },

  /**
   * 保存备注
   * @param {string} repoFullName
   * @param {string} note - 备注文本
   * @returns {Promise<boolean>}
   */
  async setNote(repoFullName, note) {
    try {
      await chrome.storage.sync.set({
        [repoFullName]: {
          note,
          updatedAt: Date.now()
        }
      });
      return true;
    } catch (e) {
      console.error('[Repo Remark] Failed to save note:', e);
      return false;
    }
  },

  /**
   * 删除备注
   * @param {string} repoFullName
   * @returns {Promise<boolean>}
   */
  async deleteNote(repoFullName) {
    try {
      await chrome.storage.sync.remove(repoFullName);
      return true;
    } catch (e) {
      console.error('[Repo Remark] Failed to delete note:', e);
      return false;
    }
  },

  /**
   * 获取所有备注
   * @returns {Promise<Object>}
   */
  async getAllNotes() {
    try {
      return await chrome.storage.sync.get(null);
    } catch (e) {
      console.error('[Repo Remark] Failed to get all notes:', e);
      return {};
    }
  }
};

// ==================== URL / 仓库名工具 ====================

const RemarkUtils = {
  /**
   * 从当前 URL 提取仓库全名
   * @returns {string|null} 如 "facebook/react"
   */
  getRepoFullNameFromUrl() {
    const path = window.location.pathname;
    // /owner/repo 格式，排除 settings/wiki/issues/pull 等子页面
    const match = path.match(/^\/([^\/]+)\/([^\/]+)$/);
    if (match) {
      // 排除 GitHub 的特殊页面
      const specialPages = [
        'settings', 'notifications', 'explore', 'marketplace',
        'pulls', 'issues', 'discussions', 'projects', 'security',
        'codespaces', 'sponsors', 'topics', 'trending', 'new',
        'organizations', 'search', 'account', 'logout', 'login',
        'signup', 'pricing', 'features', 'mobile', 'blog', 'about',
        'customer-stories', 'team', 'enterprise', 'partners',
        'readme', 'collections', 'events'
      ];
      const owner = match[1];
      if (specialPages.includes(owner)) return null;
      return `${match[1]}/${match[2]}`;
    }
    return null;
  },

  /**
   * 从链接元素提取仓库全名
   * @param {Element} linkEl - <a> 元素
   * @returns {string|null}
   */
  getRepoFullNameFromLink(linkEl) {
    if (!linkEl) return null;
    const href = linkEl.getAttribute('href') || '';
    const match = href.match(/^\/([^\/]+)\/([^\/]+)$/);
    if (match) {
      // 排除非仓库页面
      const specialOwners = ['settings', 'notifications', 'explore', 'marketplace',
        'pulls', 'issues', 'discussions', 'projects', 'security',
        'codespaces', 'sponsors', 'topics', 'trending', 'new',
        'organizations', 'search', 'account', 'logout', 'login',
        'signup', 'features'];
      const specialRepos = ['settings', 'wiki', 'issues', 'pulls', 'projects',
        'discussions', 'actions', 'packages', 'releases', 'network',
        'graphs', 'pulse', 'community', 'compare', 'labels', 'milestones',
        'branches', 'tags', 'notifications', 'stargazers', 'watchers',
        'forks', 'dependents', 'deployments', 'security'];
      if (specialOwners.includes(match[1])) return null;
      // 对于仓库主页面链接（不包含子页面路径），直接返回
      // 如果链接是 /owner/repo/blob/... 或 /owner/repo/tree/... 我们也接受
      if (!specialRepos.includes(match[2])) {
        return `${match[1]}/${match[2]}`;
      }
      // 如果第二个部分看起来像是仓库子页面，只返回 owner
      return null;
    }
    // 也匹配含子路径的 /owner/repo/something
    const matchWithPath = href.match(/^\/([^\/]+)\/([^\/]+)\/.+$/);
    if (matchWithPath) {
      if (['settings', 'notifications', 'explore', 'marketplace'].includes(matchWithPath[1])) {
        return null;
      }
      return `${matchWithPath[1]}/${matchWithPath[2]}`;
    }
    return null;
  },

  /**
   * 等待元素出现
   * @param {string} selector
   * @param {number} timeout
   * @returns {Promise<Element|null>}
   */
  waitForElement(selector, timeout = 10000) {
    return new Promise((resolve) => {
      const el = document.querySelector(selector);
      if (el) return resolve(el);

      const observer = new MutationObserver(() => {
        const el = document.querySelector(selector);
        if (el) {
          observer.disconnect();
          resolve(el);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        resolve(null);
      }, timeout);
    });
  },

  /**
   * 检测当前主题
   * @returns {'light'|'dark'}
   */
  getTheme() {
    const html = document.documentElement;
    const mode = html.getAttribute('data-color-mode');
    return mode === 'dark' ? 'dark' : 'light';
  }
};

// ==================== 备注卡片 UI 组件 ====================

const RemarkCard = {
  CLASS_PREFIX: 'grr-',

  /**
   * 创建备注卡片容器
   * @param {string} repoFullName
   * @param {'detail'|'inline'} mode - detail: 完整卡片, inline: 紧凑行内
   * @returns {HTMLElement}
   */
  async create(repoFullName, mode = 'detail') {
    const data = await RemarkStorage.getNote(repoFullName);
    const hasNote = data && data.note && data.note.trim();

    const container = document.createElement('div');
    container.className = `${this.CLASS_PREFIX}card ${this.CLASS_PREFIX}card--${mode}`;
    container.dataset.repo = repoFullName;

    if (mode === 'detail') {
      container.innerHTML = this._buildDetailHTML(repoFullName, hasNote ? data.note : '');
    } else {
      container.innerHTML = this._buildInlineHTML(repoFullName, hasNote ? data.note : '');
    }

    this._bindEvents(container, repoFullName, data);
    return container;
  },

  _buildDetailHTML(repoFullName, note) {
    const hasNote = note && note.trim();
    return `
      <div class="${this.CLASS_PREFIX}card-header">
        <svg class="${this.CLASS_PREFIX}icon" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M2 2.5A1.5 1.5 0 013.5 1h5.086a1.5 1.5 0 011.06.44l3.915 3.914a1.5 1.5 0 01.439 1.06V13.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 13.5v-11z"/>
          <path d="M4 5.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h6a.5.5 0 010 1h-6a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h6a.5.5 0 010 1h-6a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h4a.5.5 0 010 1h-4a.5.5 0 01-.5-.5z" fill="white"/>
        </svg>
        <span>我的备注</span>
        <button class="${this.CLASS_PREFIX}btn-edit" title="编辑备注">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61zm1.414 1.06a.25.25 0 00-.354 0L10.811 3.75l1.439 1.44 1.263-1.263a.25.25 0 000-.354l-1.086-1.086zM11.189 6.25L9.75 4.81l-6.286 6.287a.25.25 0 00-.064.108l-.558 1.953 1.953-.558a.249.249 0 00.108-.064l6.286-6.286z"/>
          </svg>
        </button>
      </div>
      <div class="${this.CLASS_PREFIX}card-body">
        <div class="${this.CLASS_PREFIX}note-text"${hasNote ? '' : ' style="display:none"'}>${hasNote ? this._escapeHtml(note) : ''}</div>
        <div class="${this.CLASS_PREFIX}note-empty"${hasNote ? ' style="display:none"' : ''}>点击编辑按钮添加备注</div>
      </div>
      <div class="${this.CLASS_PREFIX}card-editor" style="display:none;">
        <textarea class="${this.CLASS_PREFIX}textarea" placeholder="输入你的中文备注..." maxlength="2000">${hasNote ? this._escapeHtml(note) : ''}</textarea>
        <div class="${this.CLASS_PREFIX}editor-actions">
          <span class="${this.CLASS_PREFIX}char-count">0/2000</span>
          <div class="${this.CLASS_PREFIX}editor-buttons">
            <button class="${this.CLASS_PREFIX}btn-cancel">取消</button>
            <button class="${this.CLASS_PREFIX}btn-save">保存</button>
          </div>
        </div>
      </div>
    `;
  },

  _buildInlineHTML(repoFullName, note) {
    const hasNote = note && note.trim();
    const safeName = repoFullName.replace(/[^a-zA-Z0-9_-]/g, '_');
    // 截断显示
    const displayText = hasNote ? (note.length > 40 ? note.slice(0, 40) + '...' : note) : '';

    return `
      ${hasNote
        ? `<span class="${this.CLASS_PREFIX}inline-tag" data-grr-action="toggle" data-grr-repo="${this._escapeAttr(safeName)}" title="${this._escapeAttr(note)}">
            <span class="${this.CLASS_PREFIX}inline-tag-text">${this._escapeHtml(displayText)}</span>
            <svg class="${this.CLASS_PREFIX}inline-tag-edit" width="11" height="11" viewBox="0 0 16 16" fill="currentColor">
              <path d="M11.013 1.427a1.75 1.75 0 012.474 0l1.086 1.086a1.75 1.75 0 010 2.474l-8.61 8.61c-.21.21-.47.364-.756.445l-3.251.93a.75.75 0 01-.927-.928l.929-3.25a1.75 1.75 0 01.445-.758l8.61-8.61z"/>
            </svg>
           </span>`
        : `<span class="${this.CLASS_PREFIX}inline-trigger" data-grr-action="toggle" data-grr-repo="${this._escapeAttr(safeName)}" title="添加备注">
            <svg class="${this.CLASS_PREFIX}inline-icon" width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M2 2.5A1.5 1.5 0 013.5 1h5.086a1.5 1.5 0 011.06.44l3.915 3.914a1.5 1.5 0 01.439 1.06V13.5a1.5 1.5 0 01-1.5 1.5h-9A1.5 1.5 0 012 13.5v-11z"/>
              <path d="M4 5.5a.5.5 0 01.5-.5h3a.5.5 0 010 1h-3a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h6a.5.5 0 010 1h-6a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h6a.5.5 0 010 1h-6a.5.5 0 01-.5-.5zm0 2a.5.5 0 01.5-.5h4a.5.5 0 010 1h-4a.5.5 0 01-.5-.5z" fill="white"/>
            </svg>
           </span>`
      }
      <div class="${this.CLASS_PREFIX}inline-popup" id="${safeName}-popup">
        ${hasNote
          ? `<div class="${this.CLASS_PREFIX}inline-note">${this._escapeHtml(note)}</div>`
          : `<div class="${this.CLASS_PREFIX}inline-note ${this.CLASS_PREFIX}note-empty">暂无备注</div>`
        }
        <div class="${this.CLASS_PREFIX}inline-editor" style="display:none;">
          <textarea class="${this.CLASS_PREFIX}textarea" placeholder="输入备注..." maxlength="2000">${hasNote ? this._escapeHtml(note) : ''}</textarea>
          <div class="${this.CLASS_PREFIX}editor-actions">
            <button class="${this.CLASS_PREFIX}btn-cancel" data-grr-action="hideEditor" data-grr-repo="${this._escapeAttr(safeName)}">取消</button>
            <button class="${this.CLASS_PREFIX}btn-save" data-grr-action="save" data-grr-repo="${this._escapeAttr(safeName)}">保存</button>
          </div>
          <button class="${this.CLASS_PREFIX}btn-delete" title="删除备注" data-grr-action="delete" data-grr-repo="${this._escapeAttr(safeName)}" ${!hasNote ? 'style="display:none"' : ''}>
            <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
              <path d="M6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zm4.5 0V3h2.25a.75.75 0 010 1.5h-.76l-.793 10.318A1.75 1.75 0 019.954 16.5H6.046a1.75 1.75 0 01-1.743-1.682L3.51 4.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75z"/>
            </svg>
          </button>
        </div>
        <div class="${this.CLASS_PREFIX}inline-actions">
          <button class="${this.CLASS_PREFIX}btn-edit-inline" data-grr-action="showEditor" data-grr-repo="${this._escapeAttr(safeName)}">${hasNote ? '编辑' : '添加备注'}</button>
        </div>
      </div>
    `;
  },

  _bindEvents(container, repoFullName, currentData) {
    const pref = this.CLASS_PREFIX;
    const isInline = container.classList.contains(pref + 'card--inline');

    // 注册 safeName 映射（inline 模式）
    if (isInline) {
      const safeName = repoFullName.replace(/[^a-zA-Z0-9_-]/g, '_');
      _registerRepo(safeName, repoFullName);
      return; // inline 模式的事件通过事件委托处理
    }

    // ===== 以下只处理 detail 模式 =====

    // 编辑按钮
    const btnEdit = container.querySelector(`.${pref}btn-edit`);
    if (btnEdit) {
      btnEdit.addEventListener('click', () => this._showEditor(container, pref));
    }

    // 取消按钮
    container.querySelectorAll(`.${pref}btn-cancel`).forEach(btn => {
      btn.addEventListener('click', () => this._hideEditor(container, pref));
    });

    // 保存按钮
    container.querySelectorAll(`.${pref}btn-save`).forEach(btn => {
      btn.addEventListener('click', async () => {
        const textarea = container.querySelector(`.${pref}textarea`);
        if (!textarea) return;
        const note = textarea.value.trim();
        if (!note) {
          await RemarkStorage.deleteNote(repoFullName);
        } else {
          await RemarkStorage.setNote(repoFullName, note);
        }
        await this._refreshCard(container, repoFullName, pref);
      });
    });

    // 字符计数
    const textarea = container.querySelector(`.${pref}textarea`);
    if (textarea) {
      const charCount = container.querySelector(`.${pref}char-count`);
      textarea.addEventListener('input', () => {
        if (charCount) {
          charCount.textContent = `${textarea.value.length}/2000`;
        }
      });
    }
  },

  _showEditor(container, pref) {
    const body = container.querySelector(`.${pref}card-body`);
    const editor = container.querySelector(`.${pref}card-editor`);
    if (body) body.style.display = 'none';
    if (editor) {
      editor.style.display = 'block';
      const ta = editor.querySelector('textarea');
      if (ta) ta.focus();
    }
  },

  _hideEditor(container, pref) {
    const body = container.querySelector(`.${pref}card-body`);
    const editor = container.querySelector(`.${pref}card-editor`);
    if (body) body.style.display = '';
    if (editor) editor.style.display = 'none';
  },

  async _refreshCard(container, repoFullName, pref) {
    const data = await RemarkStorage.getNote(repoFullName);
    const hasNote = data && data.note && data.note.trim();
    const note = hasNote ? data.note : '';

    // 更新 detail 模式
    const noteText = container.querySelector(`.${pref}note-text`);
    const noteEmpty = container.querySelector(`.${pref}note-empty`);

    if (noteText) {
      if (hasNote) {
        noteText.textContent = note;
        noteText.style.display = '';
      } else {
        noteText.style.display = 'none';
      }
    }
    if (noteEmpty) {
      noteEmpty.style.display = hasNote ? 'none' : '';
    }

    // 更新编辑器 textarea
    const textarea = container.querySelector(`.${pref}textarea`);
    if (textarea) {
      textarea.value = note;
      const charCount = container.querySelector(`.${pref}char-count`);
      if (charCount) charCount.textContent = `${textarea.value.length}/2000`;
    }

    // 隐藏编辑器
    this._hideEditor(container, pref);
  },

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  _escapeAttr(text) {
    return text.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
      .replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
};

// ==================== 全局事件委托 ====================

// 存储 safeName → repoFullName 映射
const _repoMap = {};

// 注册：在 inject 时调用
function _registerRepo(safeName, repoFullName) {
  _repoMap[safeName] = repoFullName;
}

// 用 IIFE 包装，捕获阶段监听，确保先于 GitHub 事件系统收到
(function setupDelegatedEvents() {
  document.addEventListener('click', async function (e) {
    const actionEl = e.target.closest('[data-grr-action]');
    if (!actionEl) {
      if (!e.target.closest('.grr-inline-popup') && !e.target.closest('.grr-inline-trigger')) {
        document.querySelectorAll('.grr-inline-popup.show').forEach(p => {
          p.classList.remove('show');
          p.style.display = 'none';
        });
      }
      return;
    }

    e.stopPropagation();
    e.preventDefault();
    e.stopImmediatePropagation();

    const action = actionEl.getAttribute('data-grr-action');
    const safeName = actionEl.getAttribute('data-grr-repo');
    const popupId = safeName + '-popup';
    const popup = document.getElementById(popupId);

    console.log('[Repo Remark] 事件委托触发:', action, safeName);

    switch (action) {
      case 'toggle':
        if (popup) {
          const isShowing = popup.classList.contains('show');
          // 先关闭其他
          document.querySelectorAll('.grr-inline-popup.show').forEach(p => {
            p.classList.remove('show');
            p.style.display = 'none';
          });
          if (!isShowing) {
            const rect = actionEl.getBoundingClientRect();
            popup.style.position = 'fixed';
            popup.style.top = (rect.bottom + 6) + 'px';
            popup.style.left = Math.min(rect.left, window.innerWidth - 310) + 'px';
            popup.style.display = 'block';
            popup.classList.add('show');
          } else {
            popup.style.display = 'none';
          }
        }
        break;

      case 'showEditor':
        if (popup) {
          popup.querySelector('.grr-inline-note').style.display = 'none';
          popup.querySelector('.grr-inline-editor').style.display = 'block';
          popup.querySelector('.grr-inline-actions').style.display = 'none';
          const ta = popup.querySelector('textarea');
          if (ta) ta.focus();
        }
        break;

      case 'hideEditor':
        if (popup) {
          popup.querySelector('.grr-inline-note').style.display = '';
          popup.querySelector('.grr-inline-editor').style.display = 'none';
          popup.querySelector('.grr-inline-actions').style.display = '';
        }
        break;

      case 'save': {
        const repoFullName = _repoMap[safeName];
        if (!repoFullName || !popup) return;
        const textarea = popup.querySelector('textarea');
        if (!textarea) return;
        const note = textarea.value.trim();
        if (!note) {
          await RemarkStorage.deleteNote(repoFullName);
        } else {
          await RemarkStorage.setNote(repoFullName, note);
        }
        await _refreshInlineCard(safeName, repoFullName);
        break;
      }

      case 'delete': {
        const repoFullName = _repoMap[safeName];
        if (!repoFullName) return;
        if (!confirm('确定要删除这条备注吗？')) return;
        await RemarkStorage.deleteNote(repoFullName);
        await _refreshInlineCard(safeName, repoFullName);
        break;
      }
    }
  }, true);  // 捕获阶段，确保先于 GitHub React 事件系统

  /**
   * 刷新内联卡片的显示
   */
  async function _refreshInlineCard(safeName, repoFullName) {
    const popup = document.getElementById(safeName + '-popup');
    const card = popup ? popup.closest('.grr-card--inline') : null;
    if (!card) return;

    const data = await RemarkStorage.getNote(repoFullName);
    const note = (data && data.note && data.note.trim()) ? data.note : '';

    // 完整重建 HTML
    card.innerHTML = RemarkCard._buildInlineHTML(repoFullName, note);

    // 重新注册 safeName 映射
    _registerRepo(safeName, repoFullName);
  }
})();

// ==================== 导出 ====================

// 使模块在 content script 的全局作用域中可用
// 注意：不同 content script 不会共享作用域，每个都需要引入 common.js
