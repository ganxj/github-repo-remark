/**
 * GitHub Repo Remark - Background Service Worker
 * 处理扩展安装、更新等事件
 */

// 安装时
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Repo Remark] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[Repo Remark] Extension updated to', chrome.runtime.getManifest().version);
  }
});

// 点击扩展图标时，如果不在 GitHub 页面则打开 GitHub
chrome.action.onClicked.addListener((tab) => {
  // popup 会自动处理，这里不需要额外操作
  // 但可以作为 fallback
});
