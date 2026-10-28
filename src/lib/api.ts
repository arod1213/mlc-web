// Thin client for the mlc-reader API (see src/bin/api.rs in the Rust crate).
// Browser calls same-origin `/api/...`; `src/routes/api/[...path]` proxies to API_URL.

const BASE = '';

export type Role = 'publisher' | 'writer';

export interface Party {
	id: number;
	first_name: string | null;
	last_name: string;
	ipi_name_num: number | null;
	pro: unknown;
	role: Role | null;
}

export interface Share {
	id: string;
	party_id: number;
	role: string;
	rights_type: string | null;
	share: number;
	preceding_id: string | null;
}

export interface PartyInfo {
	id: number;
	full_name: string;
	ipi: number | null;
	pro: unknown;
	shares: Share[];
}

export interface Release {
	id: number;
	title: string;
	artist_name: string;
	label_name: string;
	distro_name: string;
	isrc: string | null;
	release_date: string | null;
}

export interface WorkInfo {
	id: string;
	title: string;
	duration_ms: number | null;
	iswc: string | null;
	in_dispute: boolean;
	total_shares: number;
	releases: Release[];
	parties: PartyInfo[];
}

export type WorkIdentifier = 'isrc' | 'iswc';

export interface PartyCollaborators {
	/** parties linked through the chain of title */
	represented: {
		writers: Party[];
		publishers: Party[];
	};
	/** writers who share works with this party */
	collaborators: Party[];
}

/** A party's aggregate shares across the works matched by a set of ISRCs. */
export interface PartyMeta {
	info: Party;
	isrcs: string[];
	num_works: number;
	total_shares: number;
	avg_share: number;
}

export interface PartyWorksQuery {
	/** only works this other party also holds shares in */
	with_id?: number;
	in_dispute?: boolean;
	/** capped at 200 server-side */
	limit?: number;
	page?: number;
	/** include parties and releases on each work */
	is_deep?: boolean;
}

interface Envelope<T> {
	success: boolean;
	message?: string;
	data?: T;
	error?: string;
}

export class ApiError extends Error {
	constructor(
		public status: number,
		message: string
	) {
		super(message);
	}
}

async function request<T>(path: string, init?: RequestInit, f: typeof fetch = fetch): Promise<T> {
	let res: Response;
	try {
		res = await f(`${BASE}/api${path}`, init);
	} catch (e) {
		if (e instanceof DOMException && e.name === 'AbortError') throw e;
		throw new ApiError(0, `Could not reach API at ${BASE}`);
	}
	const body = (await res.json().catch(() => null)) as Envelope<T> | null;
	if (!res.ok || !body?.success) {
		const msg = [body?.message, body?.error].filter(Boolean).join(': ') || res.statusText;
		throw new ApiError(res.status, msg);
	}
	return body.data as T;
}

function qs(params: object): string {
	const sp = new URLSearchParams();
	for (const [k, v] of Object.entries(params)) if (v != null) sp.set(k, String(v));
	const s = sp.toString();
	return s ? `?${s}` : '';
}

function post<T>(path: string, body: unknown, signal?: AbortSignal) {
	return request<T>(path, {
		method: 'POST',
		headers: { 'content-type': 'application/json' },
		body: JSON.stringify(body),
		signal
	});
}

export const api = {
	searchParties: (key: string, signal?: AbortSignal) =>
		request<Party[]>(`/parties/${encodeURIComponent(key)}`, { signal }),
	party: (id: string | number, f?: typeof fetch) => request<Party>(`/party/${id}`, undefined, f),
	partyCollaborators: (id: string | number, f?: typeof fetch) =>
		request<PartyCollaborators>(`/party/${id}/collaborators`, undefined, f),
	partyWorks: (id: string | number, query: PartyWorksQuery = {}, f?: typeof fetch) =>
		request<WorkInfo[]>(`/party/${id}/works${qs(query)}`, undefined, f),
	work: (id: string, f?: typeof fetch) =>
		request<WorkInfo[]>(`/work/${encodeURIComponent(id)}`, undefined, f),
	searchWorks: (codes: string[], method: WorkIdentifier, signal?: AbortSignal) =>
		post<Record<string, WorkInfo[]>>('/works', { codes, method }, signal),
	searchWorksByName: (title: string, artist?: string, signal?: AbortSignal) =>
		request<WorkInfo[]>(`/works/name${qs({ title, artist })}`, { signal }),
	topParties: (isrcs: string[], signal?: AbortSignal) =>
		post<PartyMeta[]>('/works/top-parties', { isrcs }, signal)
};

// ---- input helpers ----

/** Work searches return one row per linked resource/release; keep the first of each work. */
export function uniqueWorks(works: WorkInfo[]): WorkInfo[] {
	const seen = new Set<string>();
	return works.filter((w) => !seen.has(w.id) && seen.add(w.id));
}

/** Split pasted codes on newlines/commas/whitespace, strip separators, uppercase, dedupe. */
export function parseCodes(input: string): string[] {
	return [
		...new Set(
			input
				.split(/[\s,;]+/)
				.map((c) => c.replace(/[-.]/g, '').toUpperCase())
				.filter(Boolean)
		)
	];
}

// ---- formatting helpers ----

export function partyName(p: Pick<Party, 'first_name' | 'last_name'>): string {
	return [p.first_name, p.last_name].filter((s) => s && s.trim()).join(' ') || 'Unnamed party';
}

/** IPI name numbers are 11 digits, zero-padded. */
export function formatIpi(ipi: number | null | undefined): string {
	return ipi == null ? '—' : String(ipi).padStart(11, '0');
}

/** The PRO is a TisSocietyCode whose serialized shape we don't rely on. */
export function formatPro(pro: unknown): string {
	if (pro == null) return '—';
	if (typeof pro === 'string' || typeof pro === 'number') return String(pro);
	return JSON.stringify(pro);
}

/** "ComposerLyricist" -> "Composer Lyricist" */
export function humanize(s: string | null | undefined): string {
	if (!s) return '—';
	return s.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
}

export function formatDuration(ms: number | null): string {
	if (ms == null) return '—';
	const total = Math.round(ms / 1000);
	return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export function formatShare(n: number): string {
	return `${Number.isInteger(n) ? n : n.toFixed(2)}%`;
}
