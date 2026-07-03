// Builders for PostgREST `.or()` filter strings.
//
// PostgREST parses the `.or()` argument itself: commas separate clauses and
// parentheses group them, so raw user input interpolated into the string can
// break the query (400s) or alter its meaning. Values are therefore
// double-quoted per PostgREST syntax, with embedded quotes/backslashes
// escaped, and LIKE wildcards in user input escaped so a search for "100%"
// matches literally.

/** Escape LIKE/ILIKE special characters so user input matches literally. */
function escapeLike(value: string): string {
	return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Quote a value for use inside a PostgREST filter string (e.g. `.or()`).
 * Double-quotes the value and escapes embedded `"` and `\`, so commas,
 * parentheses, and dots in user input are treated as literal characters.
 */
export function pgrestLiteral(value: string): string {
	return `"${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** A quoted `%value%` ILIKE pattern that matches the input literally. */
export function ilikeContains(value: string): string {
	return pgrestLiteral(`%${escapeLike(value)}%`);
}

/** `.or()` clause matching `needle` as a substring of any of `columns`. */
export function orIlikeAnyColumn(columns: string[], needle: string): string {
	const pattern = ilikeContains(needle);
	return columns.map((col) => `${col}.ilike.${pattern}`).join(",");
}

/** `.or()` clause matching any of `needles` as a substring of any of `columns`. */
export function orIlikeAnyValue(columns: string[], needles: string[]): string {
	return needles
		.flatMap((needle) => {
			const pattern = ilikeContains(needle);
			return columns.map((col) => `${col}.ilike.${pattern}`);
		})
		.join(",");
}
