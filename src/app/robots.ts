import type { MetadataRoute } from "next";
import { getSiteUrl } from "@/src/lib/siteUrl";

const SITE = getSiteUrl();

// Public marketing/legal pages are indexable; the app itself is auth-gated
// and has no business being crawled.
export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{
				userAgent: "*",
				allow: ["/$", "/login", "/signup", "/kullanim-kosullari", "/gizlilik-politikasi", "/kvkk-aydinlatma"],
				disallow: ["/"],
			},
		],
		sitemap: `${SITE}/sitemap.xml`,
	};
}
