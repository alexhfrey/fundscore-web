import type { Metadata } from "next";
import { Inter, Source_Serif_4, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

// Display face for the marketing surface — an editorial serif, because the
// product's argument is a document, not a pitch.
const sourceSerif = Source_Serif_4({
  variable: "--font-display",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

// Utility face for filed data: as-of stamps, basis points, form numbers.
const plexMono = IBM_Plex_Mono({
  variable: "--font-data",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "FundScore.ai — What you actually get for a fund's fee",
  description:
    "See what you actually get for a fund's fee versus its closest passive alternative: holdings, fees, exposures, and skill evidence from SEC filings.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${sourceSerif.variable} ${plexMono.variable}`}
    >
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
