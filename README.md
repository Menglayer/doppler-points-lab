# Doppler Points Lab

基于 Doppler 登记扫描快照制作的非官方空投情景计算器。支持查询已确认登记的 Ethereum 与 XRPL earning 地址、对应 Base 接收地址、Season 1 / 2 积分与登记地址排名，并按 Aspecta 盘前 FDV 估算空投价值。

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

`钱包预估空投数量 = 10B × 1% ×（钱包积分 ÷ 所选已登记积分池总积分）`

空投比例固定为 `1%`，即总空投池为 `100M $XDP`。页面通过 BSC 公共 RPC 只读查询 [Aspecta Doppler 盘前池](https://trade.aspecta.ai/projects/usdt/doppler.finance)；RPC 不可用时显示最近验证的 FDV。

当前数据包含 2,646 个已确认登记 earning 地址和 2,377 个唯一 Base 接收地址。源扫描中的 400 个查询错误不会被当作未登记，也不会进入当前估算分母。

实际分配规则可能包含门槛、分层、女巫过滤或其他系数。本工具不是 Doppler 官方产品，也不构成财务建议。
