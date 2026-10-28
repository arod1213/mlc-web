import type { RequestHandler } from './$types';

function upstreamBase(): string {
	const raw = process.env.API_URL ?? process.env.VITE_API_URL ?? 'http://localhost:8008';
	return raw.replace(/\/$/, '');
}

function jsonError(status: number, error: string) {
	return Response.json({ success: false, error }, { status });
}

const proxy: RequestHandler = async ({ request, params, url }) => {
	const path = params.path;
	if (!path) return jsonError(404, 'Not found');

	const base = upstreamBase();
	const target = `${base}/api/${path}${url.search}`;
	const headers = new Headers();
	const contentType = request.headers.get('content-type');
	if (contentType) headers.set('content-type', contentType);
	const accept = request.headers.get('accept');
	if (accept) headers.set('accept', accept);

	const init: RequestInit = { method: request.method, headers };
	if (request.method !== 'GET' && request.method !== 'HEAD') {
		init.body = await request.arrayBuffer();
	}

	let upstream: Response;
	try {
		upstream = await fetch(target, init);
	} catch (e) {
		const reason = e instanceof Error ? e.message : String(e);
		return jsonError(502, `Upstream API unreachable at ${target}: ${reason}`);
	}

	const out = new Headers();
	const upstreamType = upstream.headers.get('content-type');
	if (upstreamType) out.set('content-type', upstreamType);

	return new Response(upstream.body, {
		status: upstream.status,
		statusText: upstream.statusText,
		headers: out
	});
};

export const GET = proxy;
export const POST = proxy;
export const PUT = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
