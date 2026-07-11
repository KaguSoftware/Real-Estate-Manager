"use client";

// Dropdown of team members for assigning a property/lead. Assignment is
// responsibility-only: everyone in the team still sees the record.

import { useEffect, useState } from "react";
import { Select } from "@/src/components/ui";
import { listTeamMembers, type TeamMember } from "@/src/lib/db/teams";

interface Props {
	value: string | null;
	onChange: (userId: string | null) => void;
}

export function AssigneeSelect({ value, onChange }: Props) {
	const [members, setMembers] = useState<TeamMember[]>([]);

	useEffect(() => {
		listTeamMembers().then(setMembers).catch(() => setMembers([]));
	}, []);

	return (
		<Select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)}>
			<option value="">Unassigned</option>
			{members.map((m) => (
				<option key={m.user_id} value={m.user_id}>
					{m.display_name || m.email}
					{m.role === "owner" ? " (owner)" : ""}
				</option>
			))}
		</Select>
	);
}
