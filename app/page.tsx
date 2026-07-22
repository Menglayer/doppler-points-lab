"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type WalletRecord = {
  rank: number;
  chain: string;
  address: string;
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
  wallets: number;
  wallets_by_chain: Record<string, number>;
  status_counts: Record<string, number>;
  season_1_total_dp: string;
  season_2_total_dp: string;
  all_seasons_total_dp: string;
};

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";
const XDP_TOTAL_SUPPLY = 10_000_000_000;

const numberFormat = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 2,
});

const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
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
  const headers = parseCsvLine(lines[0]);
  const column = Object.fromEntries(headers.map((header, index) => [header, index]));
  const numeric = (values: string[], key: string) => Number(values[column[key]] || 0);

  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    return {
      rank: numeric(values, "rank"),
      chain: values[column.chain],
      address: values[column.address],
      season1Total: numeric(values, "season_1_total_dp"),
      season1Deposit: numeric(values, "season_1_deposit_dp"),
      season1Referrer: numeric(values, "season_1_referrer_dp"),
      season1Referee: numeric(values, "season_1_referee_dp"),
      season2Total: numeric(values, "season_2_total_dp"),
      season2Deposit: numeric(values, "season_2_deposit_dp"),
      season2Referrer: numeric(values, "season_2_referrer_dp"),
      season2Referee: numeric(values, "season_2_referee_dp"),
      total: numeric(values, "all_seasons_total_dp"),
      deposit: numeric(values, "all_seasons_deposit_dp"),
      referrer: numeric(values, "all_seasons_referrer_dp"),
      referee: numeric(values, "all_seasons_referee_dp"),
      status: values[column.status],
    };
  });
}

function formatNumber(value: number) {
  return Number.isFinite(value) ? numberFormat.format(value) : "—";
}

function formatCompact(value: number) {
  return Number.isFinite(value) ? compactFormat.format(value) : "—";
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
  const [estimatedFdv, setEstimatedFdv] = useState("200000000");
  const [airdropRatio, setAirdropRatio] = useState("5");
  const [scope, setScope] = useState<"global" | "chain">("global");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch(`${basePath}/data/doppler_points_results.csv`).then((response) => {
        if (!response.ok) throw new Error("积分数据加载失败");
        return response.text();
      }),
      fetch(`${basePath}/data/doppler_points_summary.json`).then((response) => {
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

  const walletLookup = useMemo(
    () => new Map(wallets.map((wallet) => [wallet.address.toLowerCase(), wallet])),
    [wallets],
  );

  const chainTotals = useMemo(
    () =>
      wallets.reduce<Record<string, number>>((totals, wallet) => {
        totals[wallet.chain] = (totals[wallet.chain] ?? 0) + wallet.total;
        return totals;
      }, {}),
    [wallets],
  );

  const totalPoints = Number(summary?.all_seasons_total_dp ?? 0);
  const fdv = Number(estimatedFdv) || 0;
  const ratio = Math.min(Math.max(Number(airdropRatio) || 0, 0), 100);
  const denominator = selected
    ? scope === "chain"
      ? chainTotals[selected.chain] ?? 0
      : totalPoints
    : totalPoints;
  const walletShare = selected && denominator > 0 ? selected.total / denominator : 0;
  const impliedTokenPrice = fdv / XDP_TOTAL_SUPPLY;
  const airdropTokenPool = XDP_TOTAL_SUPPLY * (ratio / 100);
  const estimatedTokens = airdropTokenPool * walletShare;
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
            <p className="hero__kicker">把积分变成可计算的空投预期</p>
            <h1>Doppler<br />空投计算器</h1>
          </div>
          <div className="hero__aside">
            <p>
              搜索 Ethereum 或 XRPL 地址，查看 Season 1 + Season 2 积分、全局排名，
              并按你设定的 $XDP FDV 与空投比例直接估算美元价值。
            </p>
            <a className="primary-button" href="#calculator">开始计算 <span>↗</span></a>
          </div>
        </div>
        <div className="hero__stats" aria-label="数据摘要">
          <article>
            <span>快照地址</span>
            <strong>{summary ? formatNumber(summary.wallets) : "—"}</strong>
          </article>
          <article>
            <span>全季总积分</span>
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
          <h2>输入地址，<br />查看你的积分位置。</h2>
        </div>

        <form className="wallet-search" onSubmit={handleSearch}>
          <label htmlFor="wallet-address">钱包地址</label>
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
            {error || "仅在本地浏览器内搜索，地址不会被上传。"}
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
                  <span>{selected.address}</span>
                  <button type="button" onClick={copyAddress}>{copied ? "已复制" : "复制"}</button>
                </div>
                <div className="rank-lockup">
                  <div>
                    <span>全局排名</span>
                    <strong>#{formatNumber(selected.rank)}</strong>
                  </div>
                  <p>领先快照中 <b>{formatPercent(leadingPercent, 2)}</b> 的地址</p>
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
            <div className="scope-toggle" role="group" aria-label="积分池范围">
              <button type="button" className={scope === "global" ? "active" : ""} onClick={() => setScope("global")}>全体积分池</button>
              <button type="button" className={scope === "chain" ? "active" : ""} onClick={() => setScope("chain")}>同链积分池</button>
            </div>
            <label className="number-field">
              <span>$XDP 预估 FDV</span>
              <div><input type="number" min="0" step="10000000" value={estimatedFdv} onChange={(event) => setEstimatedFdv(event.target.value)} /><em>USD</em></div>
            </label>
            <label className="number-field">
              <span>预估空投比例</span>
              <div><input type="number" min="0" max="100" step="0.5" value={airdropRatio} onChange={(event) => setAirdropRatio(event.target.value)} /><em>%</em></div>
            </label>
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
              <div><span>FDV 隐含币价</span><strong>{`$${formatNumber(impliedTokenPrice)}`}</strong></div>
              <div><span>空投代币总量</span><strong>{formatCompact(airdropTokenPool)} $XDP</strong></div>
              <div><span>空投池估值</span><strong>{`$${formatCompact(airdropValuation)}`}</strong></div>
              <div><span>钱包积分占比</span><strong>{selected ? formatPercent(walletShare * 100, 6) : "—"}</strong></div>
            </div>
            <p className="estimate-note">
              固定总供应量为 10B $XDP。FDV 决定隐含币价，空投比例决定代币池数量，再按钱包在所选积分池中的占比分配。实际规则可能包含其他系数。
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
          <p>基于当前离线快照，按 Season 1 + 2 总积分排序。</p>
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
            <article><span>01</span><div><h3>原始积分快照</h3><p>覆盖 12,580 个 Ethereum 与 XRPL 地址，包含两个 Season 的存款、邀请人和被邀请积分。</p></div></article>
            <article><span>02</span><div><h3>$XDP FDV 模型</h3><p>总供应量固定为 10B $XDP。默认 $200M FDV 对应 $0.02 币价，5% 空投对应 500M $XDP，再按积分占比分配。</p></div></article>
            <article><span>03</span><div><h3>非官方预测</h3><p>工具不代表 Doppler 官方分配方案，也不构成财务建议。请将结果作为情景分析，而不是最终承诺。</p></div></article>
          </div>
        </div>
      </section>

      <footer>
        <div className="brand brand--footer"><span className="brand__mark" aria-hidden="true"><i /></span><span>Doppler Points Lab</span></div>
        <p>Independent analytics interface · Snapshot 2026-07-21</p>
        <a href="#top">Back to top ↑</a>
      </footer>
    </main>
  );
}
