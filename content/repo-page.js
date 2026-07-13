/**
 * GitHub Repo Remark - 仓库主页注入
 * 在仓库主页右侧 About 侧边栏注入备注卡片
 */
(function () {
  'use strict';

  let currentRepo = null;
  let cardContainer = null;
  let retryTimer = null;

  // ==================== 注入逻辑 ====================

  async function init() {
    const repoName = RemarkUtils.getRepoFullNameFromUrl();
    if (!repoName) {
      // 不在仓库页面，注册导航监听等待跳转
      registerNavigation();
      return;
    }
    await injectPage(repoName);
    registerNavigation();
  }

  async function injectPage(repoName) {
    if (currentRepo === repoName && cardContainer && document.contains(cardContainer)) {
      return;
    }
    currentRepo = repoName;
    await injectRemarkCard(repoName);
  }

  async function injectRemarkCard(repoName, attempt = 0) {
    if (attempt > 20) return; // 最多等待 10 秒

    // 移除旧卡片
    if (cardContainer && cardContainer.parentNode) {
      cardContainer.remove();
      cardContainer = null;
    }

    // 尝试多个选择器定位 About 区域
    let aboutArea = findAboutArea();

    if (!aboutArea) {
      clearTimeout(retryTimer);
      retryTimer = setTimeout(() => injectRemarkCard(repoName, attempt + 1), 500);
      return;
    }

    // 检查仓库是否已切换
    const currentUrlRepo = RemarkUtils.getRepoFullNameFromUrl();
    if (currentUrlRepo !== repoName) return;

    const card = await RemarkCard.create(repoName, 'detail');
    cardContainer = card;

    // 移除已存在的卡片
    const existingCard = aboutArea.querySelector('.grr-card--detail');
    if (existingCard) existingCard.remove();
    // 也检查全局
    const anyExisting = document.querySelector('.grr-card--detail');
    if (anyExisting && anyExisting !== card) anyExisting.remove();

    // 插入卡片
    if (aboutArea.classList.contains('Layout-sidebar') || aboutArea.closest('.Layout-sidebar')) {
      const sidebar = aboutArea.classList.contains('Layout-sidebar') ? aboutArea : aboutArea.closest('.Layout-sidebar');
      sidebar.appendChild(card);
    } else {
      aboutArea.appendChild(card);
    }
  }

  function findAboutArea() {
    const selectors = [
      '.Layout-sidebar',
      '#repo-content-pjax-container .Layout-sidebar',
      '.BorderGrid',
    ];

    for (const selector of selectors) {
      const el = document.querySelector(selector);
      if (el) {
        // 检查这个区域是否包含 About 内容或 repo 描述
        const hasAbout = el.querySelector('[itemprop="description"], .f4.my-3, h2, h3');
        // 检查是否为右侧边栏（有 About 相关的类或内容）
        const sidebar = el.closest('.Layout-sidebar') || el;
        if (hasAbout || el.classList.contains('Layout-sidebar') || el.classList.contains('BorderGrid')) {
          return sidebar;
        }
      }
    }

    // fallback: 查找 repo 描述所在区域
    const descEl = document.querySelector('[itemprop="description"]');
    if (descEl) {
      const container = descEl.closest('.BorderGrid-row, .Layout-sidebar, [class*="sidebar"]');
      if (container) return container;
      // 在描述后面创建容器
      const parent = descEl.parentElement;
      if (parent) {
        const wrapper = document.createElement('div');
        wrapper.className = 'grr-about-wrapper';
        parent.appendChild(wrapper);
        return wrapper;
      }
    }

    return null;
  }

  // ==================== 导航监听 ====================

  function registerNavigation() {
    if (!window.__GRR_Navigation) {
      setTimeout(registerNavigation, 100);
      return;
    }
    window.__GRR_Navigation.onChange(handleNavigation);
  }

  function handleNavigation(newUrl) {
    const newRepoName = RemarkUtils.getRepoFullNameFromUrl();
    if (newRepoName && newRepoName !== currentRepo) {
      clearTimeout(retryTimer);
      currentRepo = null;
      // 移除旧卡片确保重新注入
      if (cardContainer && cardContainer.parentNode) {
        cardContainer.remove();
        cardContainer = null;
      }
      setTimeout(() => injectRemarkCard(newRepoName), 600);
    } else if (!newRepoName) {
      // 导航到了非仓库页面
      currentRepo = null;
      if (cardContainer && cardContainer.parentNode) {
        cardContainer.remove();
        cardContainer = null;
      }
    }
  }

  // ==================== 启动 ====================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
