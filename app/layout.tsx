import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Doppler 空投计算器 | Points Lab",
  description: "查询 Doppler 最终 $XDP 分配数量、排名与链上交易，并按 Aspecta 盘前 FDV 换算参考价值。",
  keywords: ["Doppler", "XDP", "Airdrop", "Final Allocation", "Base", "Aspecta"],
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
        <meta property="og:type" content="website" />
        <meta property="og:title" content="Doppler 空投计算器 | Points Lab" />
        <meta property="og:description" content="查询 Base 地址的最终 $XDP 分配，并按 Aspecta 盘前 FDV 换算参考价值。" />
        <meta property="og:image" content={`${basePath}/og.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${basePath}/og.png`} />
      </head>
      <body>{children}</body>
    </html>
  );
}
