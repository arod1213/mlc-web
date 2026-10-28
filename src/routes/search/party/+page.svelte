<script lang="ts">
	import { goto, replaceState } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { untrack } from 'svelte';
	import { api, formatIpi, formatPro, partyName, type Party } from '#lib/api.js';

	const DEBOUNCE_MS = 50;

	let query = $state(page.url.searchParams.get('q') ?? '');
	let results = $state<Party[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);

	// Digits only (ignoring separators) -> IPI lookup, otherwise a name search.
	// The API makes the same call server-side; we normalise so "00052-205-225" works.
	const digits = $derived(query.replace(/[\s.-]/g, ''));
	const mode = $derived(/^\d+$/.test(digits) ? 'ipi' : 'name');
	const key = $derived(mode === 'ipi' ? String(Number(digits)) : query.trim());

	// keep the query in the URL so back-navigation restores the search
	$effect(() => {
		const q = query;
		untrack(() => {
			const url = new URL(page.url.href);
			if (q) url.searchParams.set('q', q);
			else url.searchParams.delete('q');
			// same route, only the query string changes
			// eslint-disable-next-line svelte/no-navigation-without-resolve
			if (url.search !== page.url.search) replaceState(url, {});
		});
	});

	$effect(() => {
		const k = key;
		const minLen = mode === 'ipi' ? 1 : 2;

		if (k.length < minLen) {
			results = [];
			loading = false;
			error = null;
			return;
		}

		const ctrl = new AbortController();
		const timer = setTimeout(async () => {
			loading = true;
			try {
				results = await api.searchParties(k, ctrl.signal);
				error = null;
			} catch (e) {
				if (ctrl.signal.aborted) return;
				error = (e as Error).message;
				results = [];
			}
			loading = false;
		}, DEBOUNCE_MS);

		return () => {
			clearTimeout(timer);
			ctrl.abort();
		};
	});

	function open(p: Party) {
		goto(resolve('/party/[id]', { id: String(p.id) }));
	}
</script>

<h1 class="mb-2 text-4xl">Search parties</h1>
<p class="mb-8 max-w-xl text-stone-600">
	Search writers and publishers by name or IPI name number.
</p>

<div class="relative mb-6">
	<!-- svelte-ignore a11y_autofocus -->
	<input
		bind:value={query}
		autofocus
		type="search"
		placeholder="e.g. James Smith or 52205225"
		class="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 pr-24 shadow-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
	/>
	{#if query.trim()}
		<span
			class="absolute top-1/2 right-3 -translate-y-1/2 rounded bg-stone-100 px-2 py-0.5 text-xs font-medium tracking-wide text-stone-600 uppercase"
		>
			{mode === 'ipi' ? 'IPI' : 'Name'}
		</span>
	{/if}
</div>

{#if error}
	<p class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
{:else if results.length}
	<p class="mb-2 text-xs text-stone-500">
		{results.length} result{results.length === 1 ? '' : 's'}{loading ? ' · updating…' : ''}
	</p>
	<ul class="divide-y divide-stone-200 overflow-hidden card">
		{#each results as p (p.id)}
			<li>
				<button
					type="button"
					onclick={() => open(p)}
					class="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-stone-50"
				>
					<span class="flex-1 font-medium">{partyName(p)}</span>
					{#if p.role}
						<span class="text-xs text-stone-500 capitalize">{p.role}</span>
					{/if}
					<span class="w-28 text-right font-mono text-xs text-stone-500">
						{formatIpi(p.ipi_name_num)}
					</span>
					<span class="w-16 text-right text-xs text-stone-500">{formatPro(p.pro)}</span>
				</button>
			</li>
		{/each}
	</ul>
{:else if loading}
	<p class="text-sm text-stone-500">Searching…</p>
{:else if key.length >= (mode === 'ipi' ? 1 : 2)}
	<p class="text-sm text-stone-500">No parties found.</p>
{/if}
