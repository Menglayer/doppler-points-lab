# Doppler Points Lab

基于 Doppler 积分快照制作的非官方空投情景计算器。支持 Ethereum 与 XRPL 地址搜索、Season 1 / 2 积分拆分、全局排名，以及按自定义空投池进行比例估算。

## 本地运行

```bash
npm install
npm run dev
```

浏览器打开 `http://localhost:3000`。

## 验证静态版本

```bash
npm test
```

生成文件位于 `out/`，可直接托管在 GitHub Pages。

## 发布到 GitHub Pages

1. 将仓库推送到 GitHub 的 `main` 分支。
2. 在仓库 Settings → Pages → Build and deployment 中选择 **GitHub Actions**。
3. 工作流会自动构建并发布；普通项目仓库的子路径会在构建时自动处理。

当前自定义域名：<https://doppler.menglayer.cc/>

## 计算口径

`预估空投 = 钱包积分 ÷ 所选积分池总积分 × 自定义空投代币池`

实际分配规则可能包含门槛、分层、女巫过滤或其他系数。本工具不是 Doppler 官方产品，也不构成财务建议。
