import type { MetadataRoute } from "next";

/**
 * PWA manifest: installable app shell. Local-mode design works fully
 * offline once the service worker has cached the shell (sw.js).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Forge Labels — vial label design studio",
    short_name: "Forge Labels",
    description:
      "Design, preview, and print professional labels for research and pharma-style vials.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#fbfaf8",
    theme_color: "#4f3ba8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
