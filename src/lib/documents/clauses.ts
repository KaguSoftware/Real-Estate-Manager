// Clause-template resolution: a team's saved template overrides the built-in
// standard clause set; absent (or empty) template falls back to the defaults.
// Deliberately react-pdf-free so both UI (settings card, wizard) and the PDF
// sections can import it.

import { RENTAL_STANDARD_CLAUSES } from "@/src/lib/pdf/rentalClauses";
import { SALES_STANDARD_CLAUSES } from "@/src/lib/pdf/salesClauses";
import type { TemplateKind } from "./placeholders";

/** Built-in defaults per kind (raw clause templates with {tokens}). */
export function defaultClauses(kind: TemplateKind): string[] {
	return kind === "rental" ? [...RENTAL_STANDARD_CLAUSES] : [...SALES_STANDARD_CLAUSES];
}

/**
 * Pick the clause set to use for a new document: the team's template when it
 * has at least one non-blank clause, else the built-in defaults. Blank rows
 * are dropped; clause text is trimmed.
 */
export function resolveClauseTemplates(
	kind: TemplateKind,
	teamClauses: string[] | null | undefined,
): string[] {
	const cleaned = (teamClauses ?? [])
		.map((c) => (typeof c === "string" ? c.trim() : ""))
		.filter(Boolean);
	return cleaned.length > 0 ? cleaned : defaultClauses(kind);
}
