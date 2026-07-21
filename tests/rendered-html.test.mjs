import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const outputRoot = new URL("../out/", import.meta.url);

test("exports a GitHub Pages compatible calculator", async () => {
  const html = await readFile(new URL("index.html", outputRoot), "utf8");
  assert.match(html, /Doppler 空投计算器/);
  assert.match(html, /Points Lab/);
  assert.match(html, /\$XDP/);
  assert.match(html, /value="200000000"/);
  assert.match(html, /value="5"/);
  assert.match(html, /href="\/favicon\.svg"/);
  assert.match(html, /查询后将在这里显示排名/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("ships the complete points snapshot", async () => {
  const [csv, summary] = await Promise.all([
    readFile(new URL("data/doppler_points_results.csv", outputRoot), "utf8"),
    readFile(new URL("data/doppler_points_summary.json", outputRoot), "utf8"),
  ]);

  assert.match(csv.replace(/^\uFEFF/, ""), /^rank,chain,address,/);
  assert.equal(csv.trim().split(/\r?\n/).length, 12_581);
  assert.equal(JSON.parse(summary).wallets, 12_580);
  await access(new URL("_next/", outputRoot));
});
