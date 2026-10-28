import { api, ApiError, type WorkInfo } from '#lib/api.js';
import type { PageLoad } from './$types';

// /work?id=<work id>, or /work?isrc=<isrc> which is resolved to a work id first
export const load: PageLoad = ({ url, fetch }) => {
	const id = url.searchParams.get('id');
	const isrc = url.searchParams.get('isrc');
	return {
		works: id
			? api.work(id, fetch)
			: isrc
				? workByIsrc(isrc, fetch)
				: Promise.reject(new ApiError(400, 'Missing ?id or ?isrc'))
	};
};

async function workByIsrc(isrc: string, f: typeof fetch): Promise<WorkInfo[]> {
	const rows = (await api.searchWorks([isrc], 'isrc'))[isrc] ?? [];
	// one row per linked resource, so the same work repeats; take the most-linked one
	const counts: Record<string, number> = {};
	for (const w of rows) counts[w.id] = (counts[w.id] ?? 0) + 1;
	const best = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
	if (!best) throw new ApiError(404, `No work found for ISRC ${isrc}`);
	return api.work(best, f);
}
