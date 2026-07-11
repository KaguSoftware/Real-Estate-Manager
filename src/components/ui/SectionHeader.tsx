"use client";
import { LucideIcon } from "lucide-react";

export const SectionHeader = ({
	title,
	icon: Icon,
}: {
	title: string;
	icon: LucideIcon;
}) => {
	return (
		<div className="flex items-center gap-3 mb-6 border-b border-base-300 pb-4">
			<div className="p-2 bg-base-200 rounded-lg text-base-content/50">
				<Icon size={18} />
			</div>
			<h2 className="text-sm font-black uppercase tracking-[0.2em] text-base-content">
				{title}
			</h2>
		</div>
	);
};
