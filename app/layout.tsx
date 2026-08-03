import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PowerStats — Ultimate Frisbee Tournament Statistics",
  description:
    "Live scoring, brackets, round-robin scheduling, and player/team analytics for Ultimate Frisbee tournaments.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
