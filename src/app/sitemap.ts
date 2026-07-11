import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "https://kagu.app";

export default function sitemap(): MetadataRoute.Sitemap {
	return [
		{ url: `${SITE}/`, changeFrequency: "weekly", priority: 1 },
		{ url: `${SITE}/signup`, changeFrequency: "monthly", priority: 0.8 },
		{ url: `${SITE}/login`, changeFrequency: "monthly", priority: 0.5 },
		{ url: `${SITE}/kullanim-kosullari`, changeFrequency: "yearly", priority: 0.3 },
		{ url: `${SITE}/gizlilik-politikasi`, changeFrequency: "yearly", priority: 0.3 },
		{ url: `${SITE}/kvkk-aydinlatma`, changeFrequency: "yearly", priority: 0.3 },
	];
}
