"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type WalletRecord = {
  rank: number;
  sourceRank: number;
  chain: string;
  address: string;
  receivingAddress: string;
  registeredAt: string;
  season1Total: number;
  season1Deposit: number;
  season1Referrer: number;
  season1Referee: number;
  season2Total: number;
  season2Deposit: number;
  season2Referrer: number;
  season2Referee: number;
  total: number;
  deposit: number;
  referrer: number;
  referee: number;
  status: string;
};

type DatasetSummary = {
  generated_at_utc: string;
  source_wallets: number;
  wallets: number;
  receiving_addresses: number;
  wallets_by_chain: Record<string, number>;
  status_counts: Record<string, number>;
  season_1_total_dp: string;
  season_2_total_dp: string;
  all_seasons_total_dp: string;
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

function parseWallets(csv: string): WalletRecord[] {
  const lines = csv.trim().split(/\r?\n/);
  const headers = parseCsvLine(lines[0]).map((header) => header.replace(/^\uFEFF/, ""));
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const numeric = (values: string[], key: string) => Number(values[column[key]] || 0);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return {
      rank: 0,
      sourceRank: numeric(values, "source_rank"),
      chain: values[column.blockchain],
      address: values[column.earning_address],
      receivingAddress: values[column.receiving_base_address],
      registeredAt: values[column.registered_at_utc],
      season1Total: numeric(values, "season_1_total_dp"),
      season1Deposit: 0,
      season1Referrer: 0,
      season1Referee: 0,
      season2Total: numeric(values, "season_2_total_dp"),
      season2Deposit: 0,
      season2Referrer: 0,
      season2Referee: 0,
      total: numeric(values, "all_seasons_total_dp"),
      deposit: numeric(values, "all_seasons_deposit_dp"),
      referrer: numeric(values, "all_seasons_referrer_dp"),
      referee: numeric(values, "all_seasons_referee_dp"),
      status: values[column.registered] === "true" ? "registered" : values[column.query_status],
    };
  }).sort((a, b) => b.total - a.total).map((wallet, index) => ({ ...wallet, rank: index + 1 }));
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

function chainName(chain: string) {
  return chain.toLowerCase() === "ethereum" ? "Ethereum" : "XRPL";
}

function MetricBar({ label, value, total }: { label: string; value: number; total: number }) {
  const width = total > 0 ? Math.max((value / total) * 100, value > 0 ? 1.25 : 0) : 0;
  return (
    <div className="metric-bar">
      <div className="metric-bar__head">
        <span>{label}</span>
        <strong>{formatNumber(value)}</strong>
      </div>
      <div className="metric-bar__track" aria-hidden="true">
        <span style={{ width: `${Math.min(width, 100)}%` }} />
      </div>
    </div>
  );
}

export default function Home() {
  const [wallets, setWallets] = useState<WalletRecord[]>([]);
  const [summary, setSummary] = useState<DatasetSummary | null>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<WalletRecord | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [aspectaFdv, setAspectaFdv] = useState(VERIFIED_ASPECTA_FDV);
  const [aspectaStatus, setAspectaStatus] = useState<"syncing" | "live" | "fallback">("syncing");
  const [copied, setCopied] = useState<"earning" | "receiving" | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${basePath}/data/doppler_registered_addresses.csv`).then((response) => {
        if (!response.ok) throw new Error("积分数据加载失败");
        return response.text();
      }),
      fetch(`${basePath}/data/doppler_registration_summary.json`).then((response) => {
        if (!response.ok) throw new Error("积分摘要加载失败");
        return response.json() as Promise<DatasetSummary>;
      }),
    ])
      .then(([csv, datasetSummary]) => {
        const parsed = parseWallets(csv);
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

  const totalPoints = Number(summary?.all_seasons_total_dp ?? 0);
  const fdv = aspectaFdv;
  const denominator = totalPoints;
  const walletShare = selected && denominator > 0 ? selected.total / denominator : 0;
  const impliedTokenPrice = fdv / XDP_TOTAL_SUPPLY;
  const airdropTokenPool = XDP_TOTAL_SUPPLY * AIRDROP_RATIO;
  const estimatedTokens = airdropTokenPool * walletShare * 0.7;
  const airdropValuation = airdropTokenPool * impliedTokenPrice;
  const estimatedValue = estimatedTokens * impliedTokenPrice;
  const leadingPercent = selected && summary ? ((summary.wallets - selected.rank) / summary.wallets) * 100 : 0;

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      setSelected(null);
      setError("请输入 Ethereum 或 XRPL 钱包地址。");
      return;
    }

    const match = walletLookup.get(cleanQuery.toLowerCase());
    if (!match) {
      setSelected(null);
      setError("当前快照中没有找到这个地址，请检查输入是否完整。");
      return;
    }

    setSelected(match);
    setError("");
    window.history.replaceState(null, "", `${window.location.pathname}?address=${encodeURIComponent(match.address)}`);
  }

  async function copyAddress(value: string, kind: "earning" | "receiving") {
    await navigator.clipboard.writeText(value);
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1600);
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
            <p className="hero__kicker">把积分变成可计算的空投预期</p>
            <h1>Doppler<br />空投计算器</h1>
          </div>
          <div className="hero__aside">
            <p>
              搜索已登记的 Ethereum 或 XRPL earning 地址，查看积分与登记信息，
              并按 Aspecta 实时盘前 FDV 和固定 1% 空投比例估算 $XDP 价值。
            </p>
            <a className="primary-button" href="#calculator">开始计算 <span>↗</span></a>
          </div>
        </div>
        <div className="hero__stats" aria-label="数据摘要">
          <article>
            <span>确认已登记</span>
            <strong>{summary ? formatNumber(summary.wallets) : "—"}</strong>
          </article>
          <article>
            <span>已登记总积分</span>
            <strong>{summary ? formatCompact(totalPoints) : "—"}</strong>
          </article>
          <article>
            <span>XRPL / ETH</span>
            <strong>
              {summary
                ? `${formatNumber(summary.wallets_by_chain.xrpl)} / ${formatNumber(summary.wallets_by_chain.ethereum)}`
                : "—"}
            </strong>
          </article>
          <article>
            <span>数据日期</span>
            <strong>{summary ? new Date(summary.generated_at_utc).toLocaleDateString("zh-CN") : "—"}</strong>
          </article>
        </div>
      </section>

      <section className="calculator section-shell" id="calculator">
        <div className="section-heading">
          <div className="section-tag"><span>Doppler.finance</span><span>{`{ Calculator }`}</span></div>
          <h2>输入登记地址，<br />查看你的空投预估。</h2>
        </div>

        <form className="wallet-search" onSubmit={handleSearch}>
          <label htmlFor="wallet-address">Earning 地址</label>
          <div className="wallet-search__row">
            <input
              id="wallet-address"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="0x… 或 r…"
              autoComplete="off"
              spellCheck={false}
            />
            <button type="submit" disabled={loading}>{loading ? "加载中" : "查询积分"}</button>
          </div>
          <p className={error ? "form-note form-note--error" : "form-note"} role={error ? "alert" : undefined}>
            {error || "仅查询 2,646 个已确认登记地址；地址只在本地浏览器中匹配。"}
          </p>
        </form>

        <div className={`result-grid ${selected ? "result-grid--active" : ""}`}>
          <article className="wallet-card">
            {selected ? (
              <>
                <div className="wallet-card__topline">
                  <span className="chain-pill">{chainName(selected.chain)}</span>
                  <span>数据状态 · {selected.status.toUpperCase()}</span>
                </div>
                <div className="wallet-card__address">
                  <div><small>Earning address</small><span>{selected.address}</span></div>
                  <button type="button" onClick={() => copyAddress(selected.address, "earning")}>{copied === "earning" ? "已复制" : "复制"}</button>
                </div>
                <div className="wallet-card__address wallet-card__address--receiving">
                  <div><small>Base receiving address</small><span>{selected.receivingAddress}</span></div>
                  <button type="button" onClick={() => copyAddress(selected.receivingAddress, "receiving")}>{copied === "receiving" ? "已复制" : "复制"}</button>
                </div>
                <div className="rank-lockup">
                  <div>
                    <span>已登记积分排名</span>
                    <strong>#{formatNumber(selected.rank)}</strong>
                  </div>
                  <p>领先已登记地址中的 <b>{formatPercent(leadingPercent, 2)}</b> · 原全量排名 #{selected.sourceRank}</p>
                </div>
                <div className="points-total">
                  <span>Season 1 + 2 总积分</span>
                  <strong>{formatNumber(selected.total)} <small>DP</small></strong>
                </div>
                <div className="season-pair">
                  <div><span>Season 01</span><strong>{formatNumber(selected.season1Total)}</strong></div>
                  <div><span>Season 02</span><strong>{formatNumber(selected.season2Total)}</strong></div>
                </div>
                <div className="breakdown">
                  <MetricBar label="存款积分" value={selected.deposit} total={selected.total} />
                  <MetricBar label="邀请人积分" value={selected.referrer} total={selected.total} />
                  <MetricBar label="被邀请积分" value={selected.referee} total={selected.total} />
                </div>
              </>
            ) : (
              <div className="wallet-card__empty">
                <span className="empty-orbit" aria-hidden="true"><i /></span>
                <div>
                  <strong>等待地址</strong>
                  <p>查询后将在这里显示排名、积分结构与 Season 对比。</p>
                </div>
              </div>
            )}
          </article>

          <article className="estimate-card">
            <div className="estimate-card__head">
              <span>$XDP 空投情景</span>
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
              <span>你的预估 $XDP 空投</span>
              <strong>{selected ? formatNumber(estimatedTokens) : "—"}</strong>
              <small>$XDP</small>
              <div className="estimate-output__value">
                <span>预估价值</span>
                <b>{selected ? `$${formatNumber(estimatedValue)}` : "—"}</b>
              </div>
            </div>
            <div className="estimate-meta">
              <div><span>$XDP 总供应量</span><strong>{formatCompact(XDP_TOTAL_SUPPLY)} $XDP</strong></div>
              <div><span>FDV 隐含币价</span><strong>{`$${formatPrice(impliedTokenPrice)}`}</strong></div>
              <div><span>空投代币总量</span><strong>{formatCompact(airdropTokenPool)} $XDP</strong></div>
              <div><span>空投池估值</span><strong>{`$${formatCompact(airdropValuation)}`}</strong></div>
              <div><span>钱包积分占比</span><strong>{selected ? formatPercent(walletShare * 100, 6) : "—"}</strong></div>
            </div>
            <p className="estimate-note">
              固定总供应量为 10B $XDP、空投比例为 1%。FDV 来自 Aspecta Doppler 盘前池的链上价格；钱包份额按已确认登记地址的积分池计算。
            </p>
          </article>
        </div>
      </section>

      <section className="leaderboard section-shell" id="leaderboard">
        <div className="section-heading section-heading--row">
          <div>
            <div className="section-tag"><span>Doppler.finance</span><span>{`{ Top wallets }`}</span></div>
            <h2>积分排名前列</h2>
          </div>
          <p>仅包含已确认登记地址，按 Season 1 + 2 总积分重新排序。</p>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Rank</th><th>Wallet</th><th>Chain</th><th>Season 01</th><th>Season 02</th><th>Total DP</th></tr></thead>
            <tbody>
              {wallets.slice(0, 8).map((wallet) => (
                <tr key={wallet.address}>
                  <td>#{wallet.rank.toString().padStart(2, "0")}</td>
                  <td title={wallet.address}>{`${wallet.address.slice(0, 7)}…${wallet.address.slice(-5)}`}</td>
                  <td><span className="chain-dot" />{chainName(wallet.chain)}</td>
                  <td>{formatCompact(wallet.season1Total)}</td>
                  <td>{formatCompact(wallet.season2Total)}</td>
                  <td>{formatNumber(wallet.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {loading && <div className="table-loading">正在读取积分快照…</div>}
        </div>
      </section>

      <section className="method section-shell" id="method">
        <div className="section-tag"><span>Doppler.finance</span><span>{`{ Methodology }`}</span></div>
        <div className="method__grid">
          <h2>数据透明，<br />假设清晰。</h2>
          <div className="method__steps">
            <article><span>01</span><div><h3>已确认登记快照</h3><p>从 12,580 个源地址中确认 2,646 个已登记地址；400 个查询错误不计入未登记，也不进入本计算器分母。</p></div></article>
            <article><span>02</span><div><h3>Aspecta 实时 FDV</h3><p>通过 Aspecta Doppler 盘前池的 BSC 只读合约调用计算 FDV；总供应量固定 10B $XDP，空投比例固定 1%，即 100M $XDP。</p></div></article>
            <article><span>03</span><div><h3>非官方预测</h3><p>积分按已确认登记地址比例分配；未解决的查询错误或官方门槛、分层、过滤规则都可能改变最终结果。本工具不构成财务建议。</p></div></article>
          </div>
        </div>
      </section>

      <footer>
        <div className="brand brand--footer"><span className="brand__mark" aria-hidden="true"><i /></span><span>Doppler Points Lab</span></div>
        <p>Independent analytics interface · Registration snapshot 2026-08-05</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
