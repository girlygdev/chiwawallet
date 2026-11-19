import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito } from "next/font/google";
import { ThemeWatcher } from "@/components/theme/theme-watcher";
import { THEME_SCRIPT } from "@/lib/theme";
import "./globals.css";

// latin-ext is needed for the peso sign (₱), which is not in the latin subset.
const fredoka = Fredoka({
  variable: "--font-fredoka",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600"],
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Chiwawallet",
  description:
    "Sit. Stay. Save. A budgeting app that plans your money by payday.",
};

// viewport-fit=cover lets pages draw under the iPhone home bar, so the bottom
// bar can pad itself with env(safe-area-inset-bottom).
export const viewport: Viewport = { viewportFit: "cover" };

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the theme script below adds "dark" to this
    // element before React loads, which React would otherwise report as a
    // mismatch. It only applies to this element's own attributes.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${fredoka.variable} ${nunito.variable} h-full antialiased`}
    >
      <head>
        {/* Sets light or dark before the page draws, so there's no flash. */}
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ThemeWatcher />
      </body>
    </html>
  );
}
