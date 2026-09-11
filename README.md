# Doppler Points Lab

基于 Doppler 最终分配结果制作的非官方查询工具。支持按 Base 接收地址查询最终 `$XDP` 数量、分配排名、区块与交易，并按 Aspecta 盘前 FDV 换算参考价值。

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

`Aspecta 盘前 FDV = 盘前池 Key 价格 ÷ 结算兑换比例`

`$XDP 隐含币价 = Aspecta 盘前 FDV ÷ 10B 总供应量`

`钱包最终空投数量 = 最终分配 CSV 中的 XDP Allocation`

`钱包参考价值 = 最终 XDP 数量 × FDV 隐含币价`

固定 `1%` 总池为 `100M $XDP`。最终文件包含 2,717 个唯一 Base 地址，明细合计 `70,762,272.527897447522955691 $XDP`，覆盖 7 笔链上分配交易。页面通过 BSC 公共 RPC 只读查询 [Aspecta Doppler 盘前池](https://trade.aspecta.ai/projects/usdt/doppler.finance)；RPC 不可用时显示最近验证的 FDV。

最终数量直接来自提供的分配文件，不再根据积分推算。Aspecta 盘前 FDV 仅影响美元参考价值。本工具不是 Doppler 官方产品，也不构成财务建议。
