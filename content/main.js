/**
 * GitHub Repo Remark - 统一入口
 * 检测当前页面类型，分发到对应处理器
 */
(function () {
  'use strict';

  // ==================== 页面类型检测 ====================

  const PageType = {
    REPO: 'repo',
    TRENDING: 'trending',
    STARS: 'stars',
    SEARCH: 'search',
    OTHER: 'other'
  };

  function detectPageType() {
    const url = location.href;
    const path = location.pathname;

    // Trending: /trending 或 /trending/xxx
    if (path.startsWith('/trending')) {
      return PageType.TRENDING;
    }

    // Search: /search
    if (path.startsWith('/search')) {
      return PageType.SEARCH;
    }

    // Stars: ?tab=stars 或 /stars/ 列表页
    if (url.includes('tab=stars') || path.startsWith('/stars/')) {
      return PageType.STARS;
    }

    // 仓库主页: /owner/repo (精确两段路径，排除特殊页面)
    const repoName = RemarkUtils.getRepoFullNameFromUrl();
    if (repoName) {
      return PageType.REPO;
    }

    return PageType.OTHER;
  }

  // ==================== 处理器注册 ====================

  const handlers = {};
  let currentPageType = null;
  let currentRepoName = null;
  let isActive = false;

  function registerHandler(type, handler) {
    handlers[type] = handler;
  }

  async function runHandler(type, ...args) {
    const handler = handlers[type];
    if (handler) {
      await handler(...args);
    }
  }

  // ==================== 仓库主页处理器 ====================

  registerHandler(PageType.REPO, async function repoPageHandler(repoName) {
    console.log('[Repo Remark] 仓库页面:', repoName);
    await injectRemarkCard(repoName);
    startDomObserver();
  });

  registerHandler(PageType.TRENDING, listPageHandler);
  registerHandler(PageType.STARS, listPageHandler);
  registerHandler(PageType.SEARCH, listPageHandler);

  let cardContainer = null;
  let retryTimer = null;

  /**
   * 注入（或校正）仓库主页的备注卡片。
   * 幂等：已在目标位置 → 什么都不做；位置不对 / 被 GitHub 重渲染清掉 → 重建。
   * 注意：正在编辑时绝不能重建，否则会清掉用户输入。
   */
  async function injectRemarkCard(repoName, attempt = 0) {
    // 检查当前 URL 是否还是同一个仓库
    if (RemarkUtils.getRepoFullNameFromUrl() !== repoName) return;

    // 尝试定位 About 区域
    const aboutArea = findAboutArea();

    if (!aboutArea) {
      if (attempt >= 30) {
        console.log('[Repo Remark] 超时放弃注入:', repoName);
        return;
      }
      // 顶层调用时若已有重试链在跑，就不再叠加（自愈会高频触发）
      if (attempt === 0 && retryTimer) return;
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => {
        retryTimer = null;
        injectRemarkCard(repoName, attempt + 1);
      }, 500);
      return;
    }

    const existing = document.querySelector('.grr-card--detail');

    // 正在编辑 → 保持原样，不重建（避免丢失未保存的输入）
    if (existing && isCardEditing(existing)) {
      cardContainer = existing;
      return;
    }

    // 已经在正确的容器里 → 幂等返回
    if (existing && existing.parentElement === aboutArea && document.contains(existing)) {
      cardContainer = existing;
      return;
    }

    if (attempt > 0) console.log('[Repo Remark] 重试/校正注入 #' + attempt + ':', repoName);

    // 移除旧卡片（位置不对的、或残留的）
    document.querySelectorAll('.grr-card--detail').forEach(el => el.remove());
    cardContainer = null;

    const card = await RemarkCard.create(repoName, 'detail');
    if (RemarkUtils.getRepoFullNameFromUrl() !== repoName) return;

    aboutArea.appendChild(card);
    cardContainer = card;
    isActive = true;
    console.log('[Repo Remark] 备注卡片已注入:', repoName,
      '→', aboutArea.id || aboutArea.className);
  }

  /** 卡片是否处于编辑态（编辑器可见） */
  function isCardEditing(card) {
    const editor = card.querySelector('.grr-card-editor');
    return !!editor && editor.style.display !== 'none';
  }

  /**
   * 定位备注卡片要插入的容器（仓库主页右侧栏）。
   * GitHub 2025 起把仓库页换成了 Primer React + CSS Modules，
   * 类名带 hash（如 SidebarSection-module__sidebarSection__e8jFN）且每次部署都会变，
   * 所以优先用稳定的 data-component 属性 + 文案锚定，最后才回退到旧版类名。
   */
  function findAboutArea() {
    // 方案1：新版仓库页侧栏 —— SplitPageLayout.Pane 内部的 borderGrid
    const pane = document.querySelector('[data-component="SplitPageLayout.Pane"]');
    if (pane) {
      const grid = pane.querySelector('[class*="borderGrid"], [class*="BorderGrid"]');
      if (grid) {
        console.log('[Repo Remark] 找到新版侧栏 (SplitPageLayout.Pane > borderGrid)');
        return grid;
      }
      if (pane.textContent && pane.textContent.indexOf('About') !== -1) {
        console.log('[Repo Remark] 找到新版侧栏 (SplitPageLayout.Pane)');
        return pane;
      }
    }

    // 方案2：用 "About" 标题反向锚定侧栏容器（类名 hash 变化时仍然有效）
    const headings = document.querySelectorAll('h2, h3');
    for (const h of headings) {
      if (h.textContent.trim() !== 'About') continue;
      const section = h.closest('[class*="sidebarSection"], [class*="SidebarSection"]');
      if (section && section.parentElement) {
        console.log('[Repo Remark] 通过 About 标题锚定侧栏');
        return section.parentElement;
      }
    }

    // 方案3：旧版布局 .Layout-sidebar
    const sidebar = document.querySelector('.Layout-sidebar');
    if (sidebar) {
      console.log('[Repo Remark] 找到 Layout-sidebar');
      return sidebar;
    }

    // 方案4：旧版布局 .BorderGrid
    const borderGrid = document.querySelector('.BorderGrid');
    if (borderGrid) {
      console.log('[Repo Remark] 找到 BorderGrid');
      return borderGrid.parentElement || borderGrid;
    }

    // 方案5：repo 描述附近的容器
    const descEl = document.querySelector(
      '[itemprop="description"], .f4.my-3, [class*="SidebarAbout-module__description"]'
    );
    if (descEl) {
      const container = descEl.closest('[class*="sidebarSection"], .BorderGrid-row');
      if (container && container.parentElement) return container.parentElement;
      if (descEl.parentElement) return descEl.parentElement;
    }

    // 方案6：仓库头部（位置不理想，但至少用户能看到）
    const repoHeader = document.querySelector('#repository-container-header');
    if (repoHeader) {
      console.log('[Repo Remark] 使用仓库头部作为 Fallback');
      return repoHeader;
    }

    return null;
  }

  // ==================== 列表页处理器 (Trending/Stars/Search) ====================
  //
  // 去重策略：以「行元素」为单位（WeakSet），而不是仓库名。
  // GitHub 的搜索结果/仓库页现在是 React 渲染，水合或重新查询时整行元素会被替换，
  // 用仓库名去重会导致新元素永远补不上标识（= 「有时候标识不出现」）。
  // 用元素去重 + 每轮校验标识是否仍在 DOM 中，被抹掉就能自动补回。
  const processedRows = new WeakSet();
  let domObserver = null;
  let injectDebounce = null;
  let suppressObserver = false;   // 忽略自身写入引发的 mutation，避免自触发循环

  async function listPageHandler(pageType) {
    console.log('[Repo Remark] 列表页面:', pageType);
    await injectInlineRemarks();
    isActive = true;
    startDomObserver();
  }

  async function injectInlineRemarks() {
    const rows = findRepoRows();

    for (const row of rows) {
      // 快路径：该行已注入且标识还在 → 跳过
      if (processedRows.has(row) && row.querySelector('.grr-card--inline')) continue;

      const repoLink = findRepoLink(row);
      if (!repoLink) continue;

      const repoName = RemarkUtils.getRepoFullNameFromLink(repoLink);
      if (!repoName) continue;

      // 跳过已经是当前仓库主页的链接（避免在主页面重复）
      if (repoName === currentRepoName) continue;

      const titleEl = findTitleElement(row, repoLink);
      if (!titleEl) continue;  // 还没渲染完，下一轮再试

      // 标识已在 → 只补记元素，不重复插入
      if (titleEl.querySelector('.grr-card--inline')) {
        processedRows.add(row);
        continue;
      }

      const inlineCard = await RemarkCard.create(repoName, 'inline');
      titleEl.appendChild(inlineCard);
      processedRows.add(row);
    }
  }

  function findRepoRows() {
    const pageType = detectPageType();

    // Trending 页
    if (pageType === PageType.TRENDING) {
      const rows = document.querySelectorAll('article.Box-row, .Box-row');
      if (rows.length > 0) { console.log('[Repo Remark] Trending 找到', rows.length, '行'); return rows; }
    }

    // Stars 页
    if (pageType === PageType.STARS) {
      const rows = document.querySelectorAll(
        '#user-starred-repos .col-12, .col-12.d-block.width-full, [data-hovercard-type="repository"]'
      );
      if (rows.length > 0) { console.log('[Repo Remark] Stars 找到', rows.length, '个仓库链接'); return rows; }
    }

    // Search 页 - GitHub 2025 起为 React + CSS Modules 渲染
    if (pageType === PageType.SEARCH) {
      const newSearchSels = [
        '[data-testid="results-list"] > div',   // 新版（实测命中）
        '[class*="Result-module__Result"]',     // 新版（class 前缀匹配）
        '[class*="Repositories-module__resultRow"]',
        '.search-title-wrap',                   // 旧版
        '.repo-list-item',
        '.repo-list li',
      ];
      for (const sel of newSearchSels) {
        const rows = document.querySelectorAll(sel);
        if (rows.length > 0 && rows.length < 500) {
          console.log('[Repo Remark] Search 找到', rows.length, '行, 选择器:', sel);
          return rows;
        }
      }
    }

    // ===== 通用 fallback: 找所有仓库 hovercard 链接 =====
    let repoLinks = document.querySelectorAll('a[data-hovercard-type="repository"]');
    console.log('[Repo Remark] fallback hovercard链接:', repoLinks.length);

    // 如果没有 hovercard 链接（新版页面已去掉该属性），找所有 /owner/repo 格式的链接
    if (repoLinks.length === 0) {
      const allLinks = document.querySelectorAll('a[href^="/"]');
      repoLinks = Array.from(allLinks).filter(link => {
        const href = link.getAttribute('href') || '';
        // 匹配 /owner/repo 格式，排除 /settings, /notifications 等
        const m = href.match(/^\/([^\/]+)\/([^\/]+)$/);
        if (!m) return false;
        const reserved = ['settings','notifications','explore','marketplace','pulls','issues',
          'discussions','projects','security','codespaces','sponsors','topics','trending',
          'new','organizations','search','features','login','signup','account','logout'];
        return !reserved.includes(m[1]) && !reserved.includes(m[2]);
      });
      console.log('[Repo Remark] fallback /owner/repo链接:', repoLinks.length);
    }

    const parentRows = new Set();
    repoLinks.forEach(link => {
      const row = link.closest('[data-testid="results-list"] > div, [class*="Result-module__Result"], article, li, .col-12, [class*="Box-row"], .d-block, [class*="width-full"], [class*="py-4"], [class*="search-title"], .Box-row');
      if (row) parentRows.add(row);
      else parentRows.add(link); // 找不到容器就用 link 本身
    });
    console.log('[Repo Remark] fallback: 映射到', parentRows.size, '个容器');
    return [...parentRows];
  }

  function findRepoLink(row) {
    // 如果 row 本身是链接
    if (row.tagName === 'A' && row.getAttribute('href')) {
      const href = row.getAttribute('href');
      if (href.match(/^\/([^\/]+)\/([^\/]+)/)) return row;
    }
    // 查找 hovercard 链接（旧版页面）
    const hcLink = row.querySelector('a[data-hovercard-type="repository"]');
    if (hcLink) return hcLink;
    // 查找标题链接（新版搜索结果标题容器为 .search-title / Header-module__title）
    const titleLink = row.querySelector(
      '.search-title a[href^="/"], [class*="Header-module__title"] a[href^="/"], h2 a, h1 a, h3 a, .f4 a, .f3 a, [class*="f3"] a, [class*="f4"] a'
    );
    if (titleLink) return titleLink;
    // 查找任何 /owner/repo 格式的链接
    const links = row.querySelectorAll('a[href^="/"]');
    for (const link of links) {
      const href = link.getAttribute('href') || '';
      if (href.match(/^\/([^\/]+)\/([^\/]+)$/)) return link;
    }
    // 最后兜底
    return row.querySelector('a[href*="/"]');
  }

  function findTitleElement(row, repoLink) {
    // 新版搜索结果：插到标题容器里（紧跟仓库名），而不是外层 h3，避免掉到下一行
    return repoLink.closest(
      '.search-title, [class*="Header-module__title"], [class*="Repositories-module__headerRow"], h2, h1, h3, .f4, .f3, [class*="f3"], [class*="f4"]'
    ) || repoLink.parentElement;
  }

  function startDomObserver() {
    if (domObserver) return;
    domObserver = new MutationObserver(() => {
      if (suppressObserver) return;
      clearTimeout(injectDebounce);
      injectDebounce = setTimeout(selfHeal, 400);
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }

  /**
   * 自愈：GitHub 的 React 重渲染会连带清掉我们注入的节点，
   * 检测到缺失就补回。注入过程对 observer 静默，防止自触发死循环。
   */
  async function selfHeal() {
    const type = detectPageType();
    if (type === PageType.OTHER) return;

    suppressObserver = true;
    try {
      if (type === PageType.REPO) {
        const repoName = RemarkUtils.getRepoFullNameFromUrl();
        if (repoName) await injectRemarkCard(repoName);
      } else if (type === PageType.TRENDING || type === PageType.STARS || type === PageType.SEARCH) {
        await injectInlineRemarks();
      }
    } catch (e) {
      console.warn('[Repo Remark] 自愈失败:', e);
    } finally {
      // 等本轮 mutation 记录派发完再恢复监听，否则会把自身写入当成页面变化
      setTimeout(() => { suppressObserver = false; }, 0);
    }
  }

  // ==================== SPA 导航处理 ====================

  function setupNavigation() {
    if (!window.__GRR_Navigation) {
      setTimeout(setupNavigation, 100);
      return;
    }

    window.__GRR_Navigation.onChange((newUrl) => {
      handleNavigation();
    });
  }

  function handleNavigation() {
    const newType = detectPageType();

    // 清理
    clearTimeout(retryTimer);
    clearTimeout(injectDebounce);

    // 移除旧卡片（仓库页切换时）
    if (cardContainer && cardContainer.parentNode) {
      cardContainer.remove();
      cardContainer = null;
    }
    document.querySelectorAll('.grr-card--detail').forEach(el => el.remove());

    // 注：processedRows 是元素级 WeakSet，旧元素随 DOM 一起被回收，无需清理
    currentPageType = newType;

    // 分发到对应处理器
    if (newType === PageType.REPO) {
      const repoName = RemarkUtils.getRepoFullNameFromUrl();
      if (repoName) {
        currentRepoName = repoName;
        setTimeout(() => runHandler(PageType.REPO, repoName), 600);
      }
    } else if (newType === PageType.TRENDING || newType === PageType.STARS || newType === PageType.SEARCH) {
      currentRepoName = null;
      setTimeout(() => runHandler(newType, newType), 600);
    }
  }

  // ==================== 启动 ====================

  async function init() {
    const pageType = detectPageType();
    currentPageType = pageType;

    console.log('[Repo Remark] 初始化, 页面类型:', pageType, 'URL:', location.href);

    if (pageType === PageType.REPO) {
      const repoName = RemarkUtils.getRepoFullNameFromUrl();
      currentRepoName = repoName;
      await runHandler(PageType.REPO, repoName);
    } else if (pageType === PageType.TRENDING || pageType === PageType.STARS || pageType === PageType.SEARCH) {
      await runHandler(pageType, pageType);
    }

    setupNavigation();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // 延迟重试（页面可能还在加载）
  setTimeout(() => {
    if (!isActive) {
      const pageType = detectPageType();
      if (pageType !== PageType.OTHER) init();
    }
  }, 2000);

})();
