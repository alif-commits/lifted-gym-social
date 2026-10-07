import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LIFTED",
    short_name: "LIFTED",
    description: "The social workout log.",
    start_url: "/feed",
    display: "standalone",
    background_color: "#0a0b0d",
    theme_color: "#0a0b0d",
    icons: [{ src: "/icon", sizes: "any", type: "image/png" }],
  };
}
