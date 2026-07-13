/**
 * GitHub Repo Remark - Trending 页注入
 */
(function () {
  'use strict';

  let processedRepos = new Set();
  let injectTimer = null;

  async function init() {
    await injectNotes();
    registerNavigation();
  }

  async function injectNotes() {
    const rowSelectors = ['article.Box-row', '.Box-row'];

    let rows = [];
    for (const selector of rowSelectors) {
      rows = document.querySelectorAll(selector);
      if (rows.length > 0) break;
    }

    for (const row of rows) {
      const repoLink = row.querySelector('h2 a, h1 a, h3 a');
      if (!repoLink) continue;

      const repoName = RemarkUtils.getRepoFullNameFromLink(repoLink);
      if (!repoName || processedRepos.has(repoName)) continue;

      processedRepos.add(repoName);

      const titleEl = repoLink.closest('h2, h1, h3') || repoLink;
      if (titleEl.querySelector('.grr-card--inline')) continue;

      const inlineCard = await RemarkCard.create(repoName, 'inline');
      titleEl.appendChild(inlineCard);
    }
  }

  function registerNavigation() {
    if (!window.__GRR_Navigation) {
      setTimeout(registerNavigation, 100);
      return;
    }
    window.__GRR_Navigation.onChange(() => {
      processedRepos.clear();
      clearTimeout(injectTimer);
      injectTimer = setTimeout(injectNotes, 800);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
