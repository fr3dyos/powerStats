import type { Metadata } from "next";
import "./globals.css";

import { I18nProvider } from "@/app/_components/I18nProvider";
import { ThemeProvider } from "@/app/_components/ThemeProvider";
import { getDictionary } from "@/utils/i18n";
import { resolveLocale } from "@/utils/i18n-server";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await resolveLocale();
  const dict = getDictionary(locale);
  return {
    title:
      locale === "en"
        ? "PowerStats — Ultimate Frisbee Tournament Statistics"
        : locale === "es"
          ? "PowerStats — Estadísticas de Torneos de Ultimate Frisbee"
          : "PowerStats — Estatísticas de Torneios de Ultimate Frisbee",
    description:
      dict.navigation?.tournaments
        ? "Live scoring, brackets, round-robin scheduling, and player/team analytics for Ultimate Frisbee tournaments."
        : "Live scoring, brackets, round-robin scheduling, and player/team analytics for Ultimate Frisbee tournaments.",
  };
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await resolveLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        {/* Inline no-flash script: apply the saved theme before first paint. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var m=document.cookie.match(/(?:^|; )ps_theme=([^;]*)/);var t=m&&m[1]==="light"?"light":"dark";document.documentElement.setAttribute("data-theme",t);document.documentElement.style.colorScheme=t;}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <I18nProvider locale={locale}>{children}</I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
