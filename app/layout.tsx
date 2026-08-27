import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export const metadata: Metadata = {
  title: "Doppler 空投计算器 | Points Lab",
  description: "查询已登记的 Doppler 地址、积分与排名，并按 Aspecta 盘前 FDV 和固定 1% 空投比例估算 $XDP。",
  keywords: ["Doppler", "Airdrop", "Points", "XRPL", "Ethereum"],
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
        <meta property="og:description" content="查询已登记地址，并按 Aspecta 盘前 FDV 与固定 1% 比例估算 $XDP 空投。" />
        <meta property="og:image" content={`${basePath}/og.png`} />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${basePath}/og.png`} />
      </head>
      <body>{children}</body>
    </html>
  );
}
