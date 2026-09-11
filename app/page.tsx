"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type AllocationRecord = {
  rank: number;
  address: string;
  allocation: number;
  allocationExact: string;
  rawAmount: string;
  block: number;
  txHash: string;
};

type DatasetSummary = {
  wallets: number;
  unique_addresses: number;
  total_xdp_allocation: string;
  transaction_count: number;
  first_block: number;
  last_block: number;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const XDP_TOTAL_SUPPLY = 10_000_000_000;
const AIRDROP_RATIO = 0.01;
const VERIFIED_ASPECTA_FDV = 170_649_818.1;
const ASPECTA_PROJECT_URL = "https://trade.aspecta.ai/projects/usdt/doppler.finance";
const ASPECTA_POOL_ADDRESS = "0x9803Bc0c3A9bC8127E4e76CB596C91bDbfb66fA5";
const ASPECTA_PAYMENT_TOKEN = "0x55d398326f99059fF775485246999027B3197955";
const BSC_RPC_URLS = [
  "https://bsc-rpc.publicnode.com",
  "https://bsc-dataseed.binance.org/",
  "https://1rpc.io/bnb",
];

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

const priceFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 4,
  maximumFractionDigits: 6,
});

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (character === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += character;
    }
  }

  values.push(value);
  return values;
}

function parseAllocations(csv: string): AllocationRecord[] {
  const lines = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^\uFEFF/, ""));
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const numeric = (values: string[], key: string) => Number(values[column[key]] || 0);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return {
      rank: numeric(values, "Rank"),
      address: values[column.Address],
      allocation: numeric(values, "XDP Allocation"),
      allocationExact: values[column["XDP Allocation"]],
      rawAmount: values[column["Raw Amount"]],
      block: numeric(values, "Block"),
      txHash: values[column["Tx Hash"]],
    };
  }).sort((a, b) => a.rank - b.rank);
}

function decodeUint256Word(hex: string, index = 0) {
  const start = 2 + index * 64;
  return BigInt(`0x${hex.slice(start, start + 64)}`);
}

async function fetchBscRpcCall(to: string, data: string) {
  for (const rpcUrl of BSC_RPC_URLS) {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 6500);
    try {
      const response = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: Date.now(),
          method: "eth_call",
          params: [{ to, data }, "latest"],
        }),
        signal: controller.signal,
      });
      if (!response.ok) continue;
      const payload = await response.json() as { result?: string };
      if (payload.result && payload.result !== "0x") return payload.result;
    } catch {
      // Try the next public RPC endpoint.
    } finally {
      window.clearTimeout(timeout);
    }
  }
  return null;
}

async function fetchAspectaPremarketFdv() {
  const [priceRaw, settlementRaw, decimalsRaw] = await Promise.all([
    fetchBscRpcCall(ASPECTA_POOL_ADDRESS, "0xeb91d37e"),
    fetchBscRpcCall(ASPECTA_POOL_ADDRESS, "0xe805156e"),
    fetchBscRpcCall(ASPECTA_PAYMENT_TOKEN, "0x313ce567"),
  ]);
  if (!priceRaw || !settlementRaw || !decimalsRaw) return null;

  const paymentDecimals = Number(decodeUint256Word(decimalsRaw));
  const keyPriceUsd = Number(decodeUint256Word(priceRaw)) / 10 ** paymentDecimals;
  const redeemRatio = Number(decodeUint256Word(settlementRaw, 2)) / 1e18;
  const fdv = redeemRatio > 0 ? keyPriceUsd / redeemRatio : 0;
  return Number.isFinite(fdv) && fdv > 0 ? fdv : null;
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? numberFormat.format(value) : "—";
}

function formatCompact(value: number) {
  return Number.isFinite(value) ? compactFormat.format(value) : "—";
}

function formatPrice(value: number) {
  return Number.isFinite(value) ? priceFormat.format(value) : "—";
}

function formatPercent(value: number, digits = 4) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(digits)}%`;
}

export default function Home() {
  const [wallets, setWallets] = useState<AllocationRecord[]>([]);
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<AllocationRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [aspectaFdv, setAspectaFdv] = useState(VERIFIED_ASPECTA_FDV);
  const [aspectaStatus, setAspectaStatus] = useState<"syncing" | "live" | "fallback">("syncing");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${basePath}/data/xdp_airdrop_allocations.csv`).then((response) => {
        if (!response.ok) throw new Error("最终分配数据加载失败");
        return response.text();
      }),
      fetch(`${basePath}/data/xdp_airdrop_summary.json`).then((response) => {
        if (!response.ok) throw new Error("最终分配摘要加载失败");
        return response.json() as Promise<DatasetSummary>;
      }),
    ])
      .then(([csv, datasetSummary]) => {
        const parsed = parseAllocations(csv);
        setWallets(parsed);
        setSummary(datasetSummary);

        const preset = new URLSearchParams(window.location.search).get("address");
        if (preset) {
          setQuery(preset);
          const match = parsed.find(
            (wallet) => wallet.address.toLowerCase() === preset.trim().toLowerCase(),
          );
          if (match) setSelected(match);
        }
      })
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : "数据加载失败，请刷新页面重试。");
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchAspectaPremarketFdv()
      .then((fdv) => {
        if (fdv) {
          setAspectaFdv(fdv);
          setAspectaStatus("live");
        } else {
          setAspectaStatus("fallback");
        }
      })
      .catch(() => setAspectaStatus("fallback"));
  }, []);

  const walletLookup = useMemo(
    () => new Map(wallets.map((wallet) => [wallet.address.toLowerCase(), wallet])),
    [wallets],
  );

  const totalAllocated = Number(summary?.total_xdp_allocation ?? 0);
  const fdv = aspectaFdv;
  const walletShare = selected && totalAllocated > 0 ? selected.allocation / totalAllocated : 0;
  const impliedTokenPrice = fdv / XDP_TOTAL_SUPPLY;
  const airdropTokenPool = XDP_TOTAL_SUPPLY * AIRDROP_RATIO;
  const airdropValuation = airdropTokenPool * impliedTokenPrice;
  const allocatedValuation = totalAllocated * impliedTokenPrice;
  const estimatedValue = (selected?.allocation ?? 0) * impliedTokenPrice;
  const leadingPercent = selected && summary ? ((summary.wallets - selected.rank) / summary.wallets) * 100 : 0;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setSelected(null);
      setError("请输入 Base 接收地址。");
      return;
    }

    const match = walletLookup.get(cleanQuery.toLowerCase());
    if (!match) {
      setSelected(null);
      setError("最终分配名单中没有找到这个地址，请检查输入是否完整。");
      return;
    }

    setSelected(match);
    setError("");
    window.history.replaceState(null, "", `${window.location.pathname}?address=${encodeURIComponent(match.address)}`);
  }

  async function copyAddress() {
    if (!selected) return;
    await navigator.clipboard.writeText(selected.address);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <main>
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Doppler Points Lab 首页">
          <span className="brand__mark" aria-hidden="true"><i /></span>
          <span>Doppler</span>
        </a>
        <nav aria-label="页面导航">
          <a href="#calculator">计算器</a>
          <a href="#leaderboard">排行榜</a>
          <a href="#method">说明</a>
        </nav>
        <span className="unofficial">Unofficial tool</span>
      </header>

      <section className="hero" id="top">
        <div className="hero__eyebrow section-tag">
          <span>Doppler.finance</span>
          <span>{`{ Points lab }`}</span>
        </div>
        <div className="hero__grid">
          <div>
            <p className="hero__kicker">链上最终分配结果</p>
            <h1>Doppler<br />空投计算器</h1>
          </div>
          <div className="hero__aside">
            <p>
              搜索 Base 接收地址，直接查看最终 $XDP 分配数量、链上批次，
              并按 Aspecta 实时盘前 FDV 换算参考价值。
            </p>
            <a className="primary-button" href="#calculator">开始计算 <span>↗</span></a>
          </div>
        </div>
        <div className="hero__stats" aria-label="数据摘要">
          <article>
            <span>最终分配地址</span>
            <strong>{summary ? formatNumber(summary.wallets) : "—"}</strong>
          </article>
          <article>
            <span>明细分配合计</span>
            <strong>{summary ? `${formatCompact(totalAllocated)} XDP` : "—"}</strong>
          </article>
          <article>
            <span>链上批次</span>
            <strong>{summary ? formatNumber(summary.transaction_count) : "—"}</strong>
          </article>
          <article>
            <span>分配区块</span>
            <strong>{summary ? `${summary.first_block.toLocaleString()}–${summary.last_block.toLocaleString()}` : "—"}</strong>
          </article>
        </div>
      </section>

      <section className="calculator section-shell" id="calculator">
        <div className="section-heading">
          <div className="section-tag"><span>Doppler.finance</span><span>{`{ Calculator }`}</span></div>
          <h2>输入 Base 地址，<br />查看最终分配。</h2>
        </div>

        <form className="wallet-search" onSubmit={handleSearch}>
          <label htmlFor="wallet-address">Base 接收地址</label>
          <div className="wallet-search__row">
            <input
              id="wallet-address"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="0x…"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" disabled={loading}>{loading ? "加载中" : "查询分配"}</button>
          </div>
          <p className={error ? "form-note form-note--error" : "form-note"} role={error ? "alert" : undefined}>
            {error || "查询 2,717 个最终分配地址；地址只在本地浏览器中匹配。"}
          </p>
        </form>

        <div className={`result-grid ${selected ? "result-grid--active" : ""}`}>
          <article className="wallet-card">
            {selected ? (
              <>
                <div className="wallet-card__topline">
                  <span className="chain-pill">Base</span>
                  <span>数据状态 · FINAL</span>
                </div>
                <div className="wallet-card__address">
                  <div><small>Base receiving address</small><span>{selected.address}</span></div>
                  <button type="button" onClick={copyAddress}>{copied ? "已复制" : "复制"}</button>
                </div>
                <div className="rank-lockup">
                  <div>
                    <span>最终分配排名</span>
                    <strong>#{formatNumber(selected.rank)}</strong>
                  </div>
                  <p>领先最终分配地址中的 <b>{formatPercent(leadingPercent, 2)}</b></p>
                </div>
                <div className="points-total">
                  <span>最终 $XDP 分配</span>
                  <strong>{formatNumber(selected.allocation)} <small>$XDP</small></strong>
                </div>
                <div className="allocation-proof">
                  <div><span>分配区块</span><strong>{formatNumber(selected.block)}</strong></div>
                  <div><span>精确数量</span><strong title={selected.allocationExact}>{selected.allocationExact}</strong></div>
                  <div><span>Raw Amount</span><strong title={selected.rawAmount}>{selected.rawAmount}</strong></div>
                  <a href={`https://bscscan.com/tx/${selected.txHash}`} target="_blank" rel="noreferrer">查看链上交易 ↗</a>
                </div>
              </>
            ) : (
              <div className="wallet-card__empty">
                <span className="empty-orbit" aria-hidden="true"><i /></span>
                <div>
                  <strong>等待地址</strong>
                  <p>查询后将在这里显示最终排名、$XDP 数量与链上分配交易。</p>
                </div>
              </div>
            )}
          </article>

          <article className="estimate-card">
            <div className="estimate-card__head">
              <span>$XDP 最终分配</span>
              <b>$XDP</b>
            </div>
            <div className="market-assumptions">
              <div className="market-assumption">
                <span>Aspecta 盘前 FDV</span>
                <strong>{`$${formatCompact(fdv)}`}</strong>
                <small className={`market-status market-status--${aspectaStatus}`}>
                  {aspectaStatus === "live" ? "链上实时" : aspectaStatus === "syncing" ? "正在同步" : "最近验证值"}
                </small>
                <a href={ASPECTA_PROJECT_URL} target="_blank" rel="noreferrer">查看 Aspecta ↗</a>
              </div>
              <div className="market-assumption">
                <span>$XDP 空投比例</span>
                <strong>1%</strong>
                <small>固定参数</small>
              </div>
            </div>
            <div className="estimate-output">
              <span>你的最终 $XDP 分配</span>
              <strong>{selected ? formatNumber(selected.allocation) : "—"}</strong>
              <small>$XDP</small>
              <div className="estimate-output__value">
                <span>预估价值</span>
                <b>{selected ? `$${formatNumber(estimatedValue)}` : "—"}</b>
              </div>
            </div>
            <div className="estimate-meta">
              <div><span>$XDP 总供应量</span><strong>{formatCompact(XDP_TOTAL_SUPPLY)} $XDP</strong></div>
              <div><span>FDV 隐含币价</span><strong>{`$${formatPrice(impliedTokenPrice)}`}</strong></div>
              <div><span>1% 空投总池</span><strong>{formatCompact(airdropTokenPool)} $XDP</strong></div>
              <div><span>1% 总池估值</span><strong>{`$${formatCompact(airdropValuation)}`}</strong></div>
              <div><span>本明细分配合计</span><strong>{formatCompact(totalAllocated)} $XDP</strong></div>
              <div><span>本明细参考价值</span><strong>{`$${formatCompact(allocatedValuation)}`}</strong></div>
              <div><span>占本明细比例</span><strong>{selected ? formatPercent(walletShare * 100, 6) : "—"}</strong></div>
            </div>
            <p className="estimate-note">
              钱包数量直接来自最终分配文件，不再按积分估算。1% 总池为 100M $XDP；当前地址明细合计 {formatNumber(totalAllocated)} $XDP。美元价值按 Aspecta 盘前 FDV 换算，仅供参考。
            </p>
          </article>
        </div>
      </section>

      <section className="leaderboard section-shell" id="leaderboard">
        <div className="section-heading section-heading--row">
          <div>
            <div className="section-tag"><span>Doppler.finance</span><span>{`{ Top wallets }`}</span></div>
            <h2>最终分配前列</h2>
          </div>
          <p>按最终 $XDP 分配数量排序，地址和排名直接来自最终结果。</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Rank</th><th>Base Address</th><th>XDP Allocation</th><th>Block</th><th>Transaction</th></tr></thead>
            <tbody>
              {wallets.slice(0, 8).map((wallet) => (
                <tr key={wallet.address}>
                  <td>#{wallet.rank.toString().padStart(2, "0")}</td>
                  <td title={wallet.address}>{`${wallet.address.slice(0, 7)}…${wallet.address.slice(-5)}`}</td>
                  <td>{formatNumber(wallet.allocation)}</td>
                  <td>{formatNumber(wallet.block)}</td>
                  <td><a href={`https://bscscan.com/tx/${wallet.txHash}`} target="_blank" rel="noreferrer">BscScan ↗</a></td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="table-loading">正在读取最终分配…</div>}
        </div>
      </section>

      <section className="method section-shell" id="method">
        <div className="section-tag"><span>Doppler.finance</span><span>{`{ Methodology }`}</span></div>
        <div className="method__grid">
          <h2>数据透明，<br />假设清晰。</h2>
          <div className="method__steps">
            <article><span>01</span><div><h3>最终分配数据</h3><p>数据包含 2,717 个唯一 Base 地址、最终 $XDP 数量、原始链上金额、区块与交易哈希；页面直接按最终数量查询和排名。</p></div></article>
            <article><span>02</span><div><h3>Aspecta 实时 FDV</h3><p>通过 Aspecta Doppler 盘前池的 BSC 只读合约调用计算 FDV，再除以 10B 总供应量得到参考币价。</p></div></article>
            <article><span>03</span><div><h3>数量与估值分离</h3><p>最终 $XDP 数量来自分配文件，不受 FDV 变化影响；只有美元参考价值随盘前 FDV 变化。本工具不构成财务建议。</p></div></article>
          </div>
        </div>
      </section>

      <footer>
        <div className="brand brand--footer"><span className="brand__mark" aria-hidden="true"><i /></span><span>Doppler Points Lab</span></div>
        <p>Independent analytics interface · Final allocation blocks 51,115,411–51,115,422</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
