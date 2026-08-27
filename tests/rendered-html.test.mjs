import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../out/", import.meta.url);

test("exports a GitHub Pages compatible calculator", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");
  assert.match(html, /Doppler 空投计算器/);
  assert.match(html, /Points Lab/);
  assert.match(html, /\$XDP/);
  assert.match(html, /Aspecta 盘前 FDV/);
  assert.match(html, /固定参数/);
  assert.match(html, />1%<\/strong>/);
  assert.match(html, /10B \$XDP/);
  assert.match(html, /100M \$XDP/);
  assert.match(html, /\$0\.017065/);
  assert.match(html, /2,646/);
  assert.doesNotMatch(html, /value="200000000"|value="5"/);
  assert.match(html, /href="\/favicon\.svg"/);
  assert.match(html, /查询后将在这里显示排名/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships the confirmed registration snapshot", async () => {
  const [csv, summary] = await Promise.all([
    readFile(new URL("data/doppler_registered_addresses.csv", outputRoot), "utf8"),
    readFile(new URL("data/doppler_registration_summary.json", outputRoot), "utf8"),
  ]);

  assert.match(csv.replace(/^\uFEFF/, ""), /^source_rank,blockchain,earning_address,/);
  assert.equal(csv.trim().split(/\r?\n/).length, 2_647);
  const parsed = JSON.parse(summary);
  assert.equal(parsed.wallets, 2_646);
  assert.equal(parsed.receiving_addresses, 2_377);
  assert.equal(parsed.status_counts.query_errors, 400);
  assert.equal(parsed.all_seasons_total_dp, "7900775154.031064013103315");
  await assert.rejects(access(new URL("data/doppler_points_results.csv", outputRoot)));
  await assert.rejects(access(new URL("data/doppler_points_summary.json", outputRoot)));
  await access(new URL("_next/", outputRoot));
});
