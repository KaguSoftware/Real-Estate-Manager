import { redirect } from "next/navigation";
import { createClient, getUserId } from "@/src/lib/supabase/server";
import { ProjectDetail } from "@/src/components/projects/ProjectDetail";

export default async function ProjectDetailPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const supabase = await createClient();
	const userId = await getUserId(supabase);
	if (!userId) redirect("/");

	const { id } = await params;

	// ProjectDetail renders its own AppShell (top bar + drawer).
	return <ProjectDetail projectId={id} />;
}
