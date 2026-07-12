import { redirect } from "next/navigation";

// Kiracılar merged into the unified Müşteriler page; keep old links working.
export default async function TenantsPage({
	searchParams,
}: {
	searchParams: Promise<{ new?: string }>;
}) {
	const params = await searchParams;
	redirect(params.new ? "/leads?new=tenant" : "/leads");
}
