import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Met-Shield | Spacecraft Heat Shield Simulator",
  description:
    "Real-time 3D visualization of spacecraft re-entry thermal dynamics powered by Physics-Informed Neural Networks and WebAssembly.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
