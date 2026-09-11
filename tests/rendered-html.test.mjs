import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../out/", import.meta.url);
const sourceRoot = new URL("../", import.meta.url);

test("exports a GitHub Pages compatible calculator", async () => {
  const [html, pageSource] = await Promise.all([
    readFile(new URL("index.html", outputRoot), "utf8"),
    readFile(new URL("app/page.tsx", sourceRoot), "utf8"),
  ]);
  assert.match(html, /Doppler 空投计算器/);
  assert.match(html, /Points Lab/);
  assert.match(html, /\$XDP/);
  assert.match(html, /Aspecta 盘前 FDV/);
  assert.match(html, /固定参数/);
  assert.match(html, />1%<\/strong>/);
  assert.match(html, /10B(?:<!-- -->)? \$XDP/);
  assert.match(html, /100M(?:<!-- -->)? \$XDP/);
  assert.match(html, /\$0\.017065/);
  assert.match(html, /2,717/);
  assert.match(html, /最终分配/);
  assert.doesNotMatch(html, /value="200000000"|value="5"/);
  assert.match(html, /href="\/favicon\.svg"/);
  assert.match(html, /查询后将在这里显示最终排名/);
  assert.match(pageSource, /https:\/\/basescan\.org\/tx\//);
  assert.doesNotMatch(pageSource, /bscscan\.com/i);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships the final XDP allocation dataset", async () => {
  const [csv, summary] = await Promise.all([
    readFile(new URL("data/xdp_airdrop_allocations.csv", outputRoot), "utf8"),
    readFile(new URL("data/xdp_airdrop_summary.json", outputRoot), "utf8"),
  ]);

  assert.match(csv.replace(/^\uFEFF/, ""), /^"Rank","Address","XDP Allocation","Raw Amount","Block","Tx Hash"/);
  assert.equal(csv.trim().split(/\r?\n/).length, 2_718);
  const parsed = JSON.parse(summary);
  assert.equal(parsed.wallets, 2_717);
  assert.equal(parsed.unique_addresses, 2_717);
  assert.equal(parsed.transaction_count, 7);
  assert.equal(parsed.total_xdp_allocation, "70762272.527897447522955691");
  assert.match(csv, /"1","0x27206c6c93a396d35c2689211e4d4900a2b5bb1e","3810174\.281130738856518769"/);
  await assert.rejects(access(new URL("data/doppler_registered_addresses.csv", outputRoot)));
  await assert.rejects(access(new URL("data/doppler_registration_summary.json", outputRoot)));
  await access(new URL("_next/", outputRoot));
});
