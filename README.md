# GitHub Repo Remark

为 GitHub 仓库添加个人中文备注的浏览器扩展。

## 痛点

GitHub 上 Star 了很多仓库，但描述大多是英文，有些描述也说不清仓库的实际用途。这个扩展让你可以给每个仓库添加自己的中文备注，在所有浏览场景中直接看到。

## 功能

| 页面 | 效果 |
|---|---|
| 仓库主页 | 右侧 "我的备注" 卡片，可编辑/保存 |
| Trending 页 | 有备注时直接展示备注标签，点击可编辑 |
| Star 列表 | 同上 |
| 搜索结果 | 同上 |
| 扩展弹窗 | 查看/搜索/管理所有备注 |

## 安装

### 开发者模式（本地加载）

1. 克隆仓库
2. 打开 Chrome/Edge → `chrome://extensions/`
3. 开启右上角 "开发者模式"
4. 点击 "加载已解压的扩展程序" → 选择项目目录

### Chrome Web Store

[![Chrome Web Store](https://img.shields.io/badge/Chrome%20Web%20Store-GitHub%20Repo%20Remark-blue?logo=googlechrome&logoColor=white)](https://chromewebstore.google.com/detail/github-repo-remark/jigeibgngdhfegnlpjhhhfjckngjcfic)

👉 <https://chromewebstore.google.com/detail/github-repo-remark/jigeibgngdhfegnlpjhhhfjckngjcfic>

点击「添加至 Chrome」即可安装，无需开发者模式。

## 技术栈

- Manifest V3
- 原生 JavaScript（零依赖，无构建步骤）
- chrome.storage.sync（跨设备同步）

## 项目结构

```
├── manifest.json          # 扩展配置
├── content/
│   ├── common.js          # 公共模块（存储、UI 组件）
│   ├── main.js            # 统一入口 + 页面路由
│   ├── nav-handler.js     # SPA 导航拦截
│   └── content.css        # 注入样式（支持 light/dark）
├── popup/                 # 扩展弹窗
├── background/            # 后台 service worker
├── icons/                 # 扩展图标
└── _locales/              # 国际化
```

## 数据

备注存储在 `chrome.storage.sync` 中，登录同一浏览器账号即可跨设备同步。
