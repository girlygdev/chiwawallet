# Chiwawallet icons

## Where each file lives (Next.js App Router)

| File | Location | Used for |
| --- | --- | --- |
| `favicon.ico` | `src/app/favicon.ico` | Browser tab (older browsers) |
| `icon.svg` | `src/app/icon.svg` | Browser tab (modern browsers, sharp at any size) |
| `apple-icon.png` | `src/app/apple-icon.png` | iPhone/iPad "Add to Home Screen" |
| `icon-192.png`, `icon-512.png` | `public/icons/` | Android / PWA install icon |
| `icon-maskable-192.png`, `icon-maskable-512.png` | `public/icons/` | Android adaptive icon (circle, squircle, etc.) |
| `logo-mark.svg` | `public/` | The full logo mark for in-app use (login, splash, empty states) |

Next.js picks up `src/app/favicon.ico`, `src/app/icon.svg` and `src/app/apple-icon.png` automatically. No `<link>` tags needed. `preview.png` in this folder shows how the icons look in each place.

## app/manifest.ts

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chiwawallet",
    short_name: "Chiwawallet",
    description: "Sit. Stay. Save. Budget by payday.",
    start_url: "/",
    display: "standalone",
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
```

## Colors

Wallet Green `#1F9D55` · Deep Green `#157A41` · Mint `#E8F6EE` · Ink `#1C1C1E` · Coin Gold `#F4C430` · Ear Blush `#F0B49E`
