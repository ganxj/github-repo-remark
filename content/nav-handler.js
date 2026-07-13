/**
 * GitHub Repo Remark - SPA 导航监听
 * 处理 GitHub 单页应用导航 (PJAX / Turbo)
 * 此文件需要在所有 content script 中首先加载
 */

(function () {
  'use strict';

  // 存储所有注册的回调
  const listeners = [];

  // 将回调暴露到全局
  window.__GRR_Navigation = {
    /**
     * 注册 URL 变化回调
     * @param {Function} callback - 接收 (newUrl, oldUrl)
     */
    onChange(callback) {
      listeners.push(callback);
    },

    /**
     * 获取当前 URL
     */
    getCurrentUrl() {
      return location.href;
    }
  };

  // ==================== History API 拦截 ====================

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args) {
    const oldUrl = location.href;
    const result = originalPushState.apply(this, args);
    notifyListeners(oldUrl);
    return result;
  };

  history.replaceState = function (...args) {
    const oldUrl = location.href;
    const result = originalReplaceState.apply(this, args);
    notifyListeners(oldUrl);
    return result;
  };

  // ==================== 浏览器前进/后退 ====================

  window.addEventListener('popstate', () => {
    // popstate 在 URL 改变后触发，oldUrl 需要我们在上一个状态记录
    notifyListeners(window.__GRR_Navigation._lastUrl || location.href);
  });

  // 记录每次变化前的 URL
  function notifyListeners(oldUrl) {
    const newUrl = location.href;
    if (newUrl === oldUrl) return;

    window.__GRR_Navigation._lastUrl = oldUrl;
    for (const cb of listeners) {
      try { cb(newUrl, oldUrl); } catch (e) { /* ignore */ }
    }
  }

  // ==================== Turbo 框架事件 ====================

  document.addEventListener('turbo:load', () => {
    setTimeout(() => {
      for (const cb of listeners) {
        try { cb(location.href, window.__GRR_Navigation._lastUrl || location.href); } catch (e) { /* ignore */ }
      }
    }, 100);
  });

  document.addEventListener('turbo:render', () => {
    setTimeout(() => {
      for (const cb of listeners) {
        try { cb(location.href, window.__GRR_Navigation._lastUrl || location.href); } catch (e) { /* ignore */ }
      }
    }, 100);
  });

  // ==================== PJAX 事件 ====================

  document.addEventListener('pjax:complete', () => {
    setTimeout(() => {
      for (const cb of listeners) {
        try { cb(location.href, window.__GRR_Navigation._lastUrl || location.href); } catch (e) { /* ignore */ }
      }
    }, 100);
  });

  document.addEventListener('pjax:end', () => {
    setTimeout(() => {
      for (const cb of listeners) {
        try { cb(location.href, window.__GRR_Navigation._lastUrl || location.href); } catch (e) { /* ignore */ }
      }
    }, 100);
  });

  console.log('[Repo Remark] Navigation handler initialized');
})();
