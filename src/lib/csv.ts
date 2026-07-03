// Tiny CSV export helper. Prepends a UTF-8 BOM so Excel opens Turkish
// characters correctly, and quotes any field containing separators.

export type CsvValue = string | number | boolean | null | undefined;

function escapeCell(v: CsvValue): string {
	if (v == null) return "";
	const s = String(v);
	return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadCsv(
	filename: string,
	headers: string[],
	rows: CsvValue[][],
): void {
	const lines = [headers, ...rows].map((r) => r.map(escapeCell).join(","));
	const blob = new Blob(["﻿" + lines.join("\r\n")], {
		type: "text/csv;charset=utf-8;",
	});
	const url = URL.createObjectURL(blob);
	const a = document.createElement("a");
	a.href = url;
	a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
	document.body.appendChild(a);
	a.click();
	a.remove();
	URL.revokeObjectURL(url);
}
