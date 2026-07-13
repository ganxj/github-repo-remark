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
  });

  registerHandler(PageType.TRENDING, listPageHandler);
  registerHandler(PageType.STARS, listPageHandler);
  registerHandler(PageType.SEARCH, listPageHandler);

  let cardContainer = null;
  let retryTimer = null;

  async function injectRemarkCard(repoName, attempt = 0) {
    if (attempt > 30) {
      console.log('[Repo Remark] 超时放弃注入:', repoName);
      return;
    }

    if (attempt > 0) {
      console.log('[Repo Remark] 重试注入 #' + attempt + ':', repoName);
    }

    // 检查当前 URL 是否还是同一个仓库
    if (RemarkUtils.getRepoFullNameFromUrl() !== repoName) return;

    // 移除旧卡片
    if (cardContainer && cardContainer.parentNode) {
      cardContainer.remove();
      cardContainer = null;
    }

    // 移除所有已存在的卡片（防止重复）
    document.querySelectorAll('.grr-card--detail').forEach(el => el.remove());

    // 尝试定位 About 区域
    let aboutArea = findAboutArea();

    if (!aboutArea) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => injectRemarkCard(repoName, attempt + 1), 500);
      return;
    }

    if (RemarkUtils.getRepoFullNameFromUrl() !== repoName) return;

    const card = await RemarkCard.create(repoName, 'detail');
    cardContainer = card;
    aboutArea.appendChild(card);
    isActive = true;
    console.log('[Repo Remark] 备注卡片已注入:', repoName);
  }

  function findAboutArea() {
    // 方案1：新版 GitHub 布局 - Layout-sidebar
    const sidebar = document.querySelector('.Layout-sidebar');
    if (sidebar) {
      console.log('[Repo Remark] 找到 Layout-sidebar');
      return sidebar;
    }

    // 方案2：BorderGrid 布局（旧版）
    const borderGrid = document.querySelector('.BorderGrid');
    if (borderGrid) {
      console.log('[Repo Remark] 找到 BorderGrid');
      return borderGrid.parentElement || borderGrid;
    }

    // 方案3：About 区域的各种选择器
    const aboutSelectors = [
      '[data-component="about"]',
      '.BorderGrid-row:first-child',
      '.repository-content .BorderGrid',
    ];
    for (const sel of aboutSelectors) {
      const el = document.querySelector(sel);
      if (el) {
        console.log('[Repo Remark] 找到 About 区域:', sel);
        return el;
      }
    }

    // 方案4：查找 repo 描述附近的容器
    const descEl = document.querySelector('[itemprop="description"], .f4.my-3');
    if (descEl) {
      const container = descEl.closest('.BorderGrid-row');
      if (container) {
        const wrapper = document.createElement('div');
        container.parentElement.insertBefore(wrapper, container.nextSibling);
        console.log('[Repo Remark] 在描述旁创建容器');
        return wrapper;
      }
      const parent = descEl.parentElement;
      if (parent) {
        const wrapper = document.createElement('div');
        parent.appendChild(wrapper);
        console.log('[Repo Remark] 在描述父元素中创建容器');
        return wrapper;
      }
    }

    // 方案5：仓库头部容器
    const repoHeader = document.querySelector('#repository-container-header');
    if (repoHeader) {
      console.log('[Repo Remark] 使用仓库头部作为 Fallback');
      return repoHeader;
    }

    // 方案6：主内容区域
    const mainContent = document.querySelector('#repo-content-pjax-container, [data-turbo-frame="repo-content-turbo-frame"]');
    if (mainContent) {
      console.log('[Repo Remark] 使用主内容区作为 Fallback');
      return mainContent;
    }

    console.log('[Repo Remark] 未找到合适的注入位置, attempt:', arguments[0]);
    return null;
  }

  // ==================== 列表页处理器 (Trending/Stars/Search) ====================

  let processedRepos = new Set();
  let domObserver = null;
  let injectDebounce = null;

  async function listPageHandler(pageType) {
    console.log('[Repo Remark] 列表页面:', pageType);
    await injectInlineRemarks();
    isActive = true;
    startDomObserver();
  }

  async function injectInlineRemarks() {
    const rows = findRepoRows();

    for (const row of rows) {
      const repoLink = findRepoLink(row);
      if (!repoLink) continue;

      const repoName = RemarkUtils.getRepoFullNameFromLink(repoLink);
      if (!repoName || processedRepos.has(repoName)) continue;

      // 跳过已经是当前仓库主页的链接（避免在主页面重复）
      if (repoName === currentRepoName) continue;

      processedRepos.add(repoName);

      const titleEl = findTitleElement(row, repoLink);
      if (!titleEl || titleEl.querySelector('.grr-card--inline')) continue;

      const inlineCard = await RemarkCard.create(repoName, 'inline');
      titleEl.appendChild(inlineCard);
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

    // Search 页 - 新版 GitHub 搜索
    if (pageType === PageType.SEARCH) {
      // 新版搜索选择器
      const newSearchSels = [
        '[data-testid="results-list"] > div',
        '[data-testid="results-list"] > *',
        '.search-title-wrap',
        'div[data-testid="search-results"] > div',
        '#search-results-container .Box-row',
        '.repo-list-item',
        '.repo-list li',
        '[class*="search"] [data-testid]',
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

    // 如果没有 hovercard 链接（搜索页可能出现），找所有 /owner/repo 格式的链接
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
      const row = link.closest('article, li, .col-12, [class*="Box-row"], .d-block, [class*="width-full"], [class*="py-4"], [class*="search-title"], .Box-row');
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
    // 查找 hovercard 链接
    const hcLink = row.querySelector('a[data-hovercard-type="repository"]');
    if (hcLink) return hcLink;
    // 查找标题链接
    const titleLink = row.querySelector('h2 a, h1 a, h3 a, .f4 a, .f3 a, [class*="f3"] a, [class*="f4"] a');
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
    return repoLink.closest('h2, h1, h3, .f4, .f3, [class*="f3"], [class*="f4"]') || repoLink.parentElement;
  }

  function startDomObserver() {
    if (domObserver) return;
    let timer;
    domObserver = new MutationObserver(() => {
      clearTimeout(timer);
      clearTimeout(injectDebounce);
      injectDebounce = setTimeout(injectInlineRemarks, 500);
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
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

    if (newType !== currentPageType) {
      processedRepos.clear();
    }

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
