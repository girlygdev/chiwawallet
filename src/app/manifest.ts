import type { MetadataRoute } from "next";

// The web app manifest (docs/icons/README.md). Android builds the installed
// app's launch screen from these icons and colours; without a manifest it
// stretched the small favicon, which looked pixelated. The Serwist service
// worker comes in Week 8.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chiwawallet",
    short_name: "Chiwawallet",
    description: "Sit. Stay. Save. Budget by payday.",
    start_url: "/",
    display: "standalone",
    // Mint behind the launch icon, Wallet Green for the status bar.
    background_color: "#E8F6EE",
    theme_color: "#1F9D55",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
