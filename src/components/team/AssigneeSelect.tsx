"use client";

// Dropdown of team members for assigning a property/lead. Assignment is
// responsibility-only: everyone in the team still sees the record.

import { useEffect, useMemo, useState } from "react";
import { Dropdown, type DropdownOption } from "@/src/components/ui";
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

	const options = useMemo<DropdownOption[]>(
		() => [
			{ value: "", label: "Unassigned" },
			...members.map((m) => ({
				value: m.user_id,
				label: `${m.display_name || m.email}${m.role === "owner" ? " (owner)" : ""}`,
			})),
		],
		[members],
	);

	return (
		<Dropdown
			options={options}
			value={value ?? ""}
			onChange={(v) => onChange(v || null)}
		/>
	);
}
