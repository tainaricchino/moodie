import { Barlow, Barlow_Semi_Condensed } from "next/font/google";
import "./globals.css";

const sans = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const display = Barlow_Semi_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata = {
  title: "Moodie",
  description: "Acervo cromático de referências.",
};

export default function RootLayout({ children }) {
  return (
    <html
      lang="pt-BR"
      className={`${sans.variable} ${display.variable} bg-ink`}
    >
      <body className="bg-ink font-sans text-highlight antialiased">{children}</body>
    </html>
  );
}
