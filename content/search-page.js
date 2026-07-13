/**
 * GitHub Repo Remark - 搜索结果页注入
 */
(function () {
  'use strict';

  let processedRepos = new Set();
  let injectTimer = null;
  let domObserver = null;

  async function init() {
    await injectNotes();
    registerNavigation();
    startDomObserver();
  }

  async function injectNotes() {
    const itemSelectors = [
      '[data-testid="results-list"] > div',
      '.repo-list-item',
      'ul.repo-list li',
      '.search-title-wrap',
    ];

    let items = [];
    for (const selector of itemSelectors) {
      items = document.querySelectorAll(selector);
      if (items.length > 0) break;
    }

    for (const item of items) {
      const repoLink = item.querySelector('a[data-hovercard-type="repository"]') ||
                       item.querySelector('a.v-align-middle') ||
                       item.querySelector('.f4 a, h3 a') ||
                       item.querySelector('a[href*="/"]');

      if (!repoLink) continue;

      const repoName = RemarkUtils.getRepoFullNameFromLink(repoLink);
      if (!repoName || processedRepos.has(repoName)) continue;

      processedRepos.add(repoName);

      const titleEl = repoLink.closest('.f4, h3, .search-title-wrap, .text-normal') || repoLink.parentElement;
      if (titleEl.querySelector('.grr-card--inline')) continue;

      const inlineCard = await RemarkCard.create(repoName, 'inline');
      titleEl.appendChild(inlineCard);
    }
  }

  function startDomObserver() {
    if (domObserver) return;
    let timer;
    domObserver = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(injectNotes, 400);
    });
    domObserver.observe(document.body, { childList: true, subtree: true });
  }

  function registerNavigation() {
    if (!window.__GRR_Navigation) {
      setTimeout(registerNavigation, 100);
      return;
    }
    window.__GRR_Navigation.onChange(() => {
      processedRepos.clear();
      clearTimeout(injectTimer);
      injectTimer = setTimeout(injectNotes, 1000);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
