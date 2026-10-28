<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		api,
		formatIpi,
		formatPro,
		formatShare,
		parseCodes,
		partyName,
		type PartyMeta
	} from '#lib/api.js';

	interface Ranked extends PartyMeta {
		rank: number;
		name: string;
	}

	type SortKey =
		'rank' | 'name' | 'role' | 'ipi' | 'pro' | 'num_works' | 'total_shares' | 'avg_share';

	// numeric fields default to descending (biggest first), text fields to ascending
	const sortFields: { key: SortKey; label: string; desc: boolean }[] = [
		{ key: 'rank', label: 'Rank', desc: false },
		{ key: 'total_shares', label: 'Total share', desc: true },
		{ key: 'avg_share', label: 'Avg share', desc: true },
		{ key: 'num_works', label: 'Works', desc: true },
		{ key: 'name', label: 'Name', desc: false },
		{ key: 'role', label: 'Role', desc: false },
		{ key: 'ipi', label: 'IPI', desc: false },
		{ key: 'pro', label: 'PRO', desc: false }
	];

	const placeholder = 'USUM71703861, USRC11700675, …';

	let input = $state('');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let results = $state<{ isrcs: string[]; parties: Ranked[] } | null>(null);
	let ctrl: AbortController | null = null;

	let sortKey = $state<SortKey>('rank');
	let desc = $state(false);
	let role = $state<'all' | 'writer' | 'publisher'>('all');
	let filter = $state('');
	let expanded = $state<number | null>(null);
	const codes = $derived(parseCodes(input));

	async function search(e?: SubmitEvent) {
		e?.preventDefault();
		if (!codes.length) return;
		ctrl?.abort();
		ctrl = new AbortController();
		const sent = codes;
		loading = true;
		error = null;
		try {
			const parties = await api.topParties(sent, ctrl.signal);
			results = {
				isrcs: sent,
				parties: parties.map((p, i) => ({
					...p,
					isrcs: p.isrcs.map((c) => c.trim()),
					rank: i + 1,
					name: partyName(p.info)
				}))
			};
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			error = (err as Error).message;
			results = null;
		}
		loading = false;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) search();
	}

	function setSort(f: (typeof sortFields)[number]) {
		if (sortKey === f.key) desc = !desc;
		else {
			sortKey = f.key;
			desc = f.desc;
		}
	}

	function sortValue(p: Ranked, key: SortKey): string | number | null {
		switch (key) {
			case 'name':
				return p.name.toLowerCase();
			case 'role':
				return p.info.role;
			case 'ipi':
				return p.info.ipi_name_num;
			case 'pro':
				return p.info.pro == null ? null : formatPro(p.info.pro);
			default:
				return p[key];
		}
	}

	const shown = $derived.by(() => {
		if (!results) return [];
		const q = filter.trim().toLowerCase();
		const rows = results.parties.filter(
			(p) =>
				(role === 'all' || p.info.role === role) &&
				(!q || p.name.toLowerCase().includes(q) || formatIpi(p.info.ipi_name_num).includes(q))
		);
		const dir = desc ? -1 : 1;
		return rows.sort((a, b) => {
			const x = sortValue(a, sortKey);
			const y = sortValue(b, sortKey);
			// missing values always sink to the bottom
			if (x == null || y == null) return x == null ? (y == null ? a.rank - b.rank : 1) : -1;
			if (x === y) return a.rank - b.rank;
			return (x < y ? -1 : 1) * dir;
		});
	});
</script>

<svelte:head>
	<title>Top parties · MLC Reader</title>
</svelte:head>

<h1 class="mb-2 text-4xl">Top parties</h1>
<p class="mb-8 max-w-xl text-stone-600">
	Paste a list of ISRCs, separated by commas, to rank the writers and publishers behind them.
</p>

<form onsubmit={search} class="mb-8">
	<textarea
		bind:value={input}
		{onkeydown}
		rows="4"
		{placeholder}
		class="mb-3 w-full rounded-lg border border-stone-300 bg-white px-4 py-3 font-mono text-sm shadow-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
	></textarea>
	<div class="flex items-center gap-4">
		<span class="text-sm text-stone-500">{codes.length} ISRC{codes.length === 1 ? '' : 's'}</span>
		<button
			type="submit"
			disabled={!codes.length || loading}
			class="ml-auto rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
		>
			{loading ? 'Ranking…' : 'Rank parties'}
		</button>
	</div>
</form>

{#if error}
	<p class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
{:else if results}
	{#if results.parties.length}
		<div class="mb-4 space-y-3">
			<div class="flex flex-wrap items-center gap-2 text-sm">
				<span class="text-xs tracking-wide text-stone-500 uppercase">Sort</span>
				{#each sortFields as f (f.key)}
					<button
						type="button"
						onclick={() => setSort(f)}
						class="rounded-md border px-2.5 py-1"
						class:border-stone-900={sortKey === f.key}
						class:bg-stone-900={sortKey === f.key}
						class:text-white={sortKey === f.key}
						class:border-stone-300={sortKey !== f.key}
						class:bg-white={sortKey !== f.key}
						class:hover:bg-stone-100={sortKey !== f.key}
					>
						{f.label}{#if sortKey === f.key}<span class="ml-1">{desc ? '↓' : '↑'}</span>{/if}
					</button>
				{/each}
			</div>
			<div class="flex flex-wrap items-center gap-3">
				<div class="flex rounded-md border border-stone-300 bg-white p-0.5 text-sm">
					{#each [['all', 'All'], ['writer', 'Writers'], ['publisher', 'Publishers']] as [value, label] (value)}
						<button
							type="button"
							onclick={() => (role = value as typeof role)}
							class="rounded px-2.5 py-1"
							class:bg-stone-900={role === value}
							class:text-white={role === value}>{label}</button
						>
					{/each}
				</div>
				<input
					bind:value={filter}
					type="search"
					placeholder="Filter by name or IPI"
					class="w-56 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-stone-500"
				/>
				<span class="ml-auto text-sm text-stone-500">
					{shown.length} of {results.parties.length} parties · {results.isrcs.length} ISRC{results
						.isrcs.length === 1
						? ''
						: 's'}
				</span>
			</div>
		</div>

		<ul class="divide-y divide-stone-100 card">
			{#each shown as p, i (i)}
				{@const open = expanded === p.info.id}
				<li class:bg-stone-50={open}>
					<button
						type="button"
						onclick={() => (expanded = open ? null : p.info.id)}
						aria-expanded={open}
						class="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-stone-50"
					>
						<span class="w-8 shrink-0 text-xs text-stone-400 tabular-nums">#{p.rank}</span>
						<span class="min-w-0 flex-1">
							<span class="block truncate font-medium" title={p.name}>{p.name}</span>
							<span class="block text-xs text-stone-500">
								IPI <span class="font-mono">{formatIpi(p.info.ipi_name_num)}</span> · PRO {formatPro(
									p.info.pro
								)}
							</span>
						</span>
						<span class="hidden w-20 shrink-0 text-xs text-stone-500 capitalize sm:block"
							>{p.info.role ?? '—'}</span
						>
						<span class="w-20 shrink-0 text-right">
							<span class="block text-xs text-stone-500">Total</span>
							<span class="text-sm font-medium tabular-nums">{formatShare(p.total_shares)}</span>
						</span>
						<span class="w-20 shrink-0 text-right">
							<span class="block text-xs text-stone-500">Avg</span>
							<span class="text-sm tabular-nums">{formatShare(p.avg_share)}</span>
						</span>
						<span class="w-14 shrink-0 text-right">
							<span class="block text-xs text-stone-500">Works</span>
							<span class="text-sm tabular-nums">{p.num_works}</span>
						</span>
					</button>
					{#if open}
						<div class="px-4 pb-4 sm:pl-16">
							<div class="mb-2 flex items-baseline">
								<span class="text-xs tracking-wide text-stone-500 uppercase">
									{p.isrcs.length} ISRC{p.isrcs.length === 1 ? '' : 's'}
								</span>
								<a
									href={resolve('/party/[id]', { id: String(p.info.id) })}
									class="ml-auto text-sm text-stone-600 hover:text-stone-900 hover:underline"
									>Party page →</a
								>
							</div>
							<div class="flex flex-wrap gap-1.5">
								{#each p.isrcs as isrc, j (j)}
									<a
										href={resolve(`/work?isrc=${encodeURIComponent(isrc)}`)}
										class="rounded border border-stone-200 bg-white px-2 py-0.5 font-mono text-xs hover:border-stone-400"
										>{isrc}</a
									>
								{/each}
							</div>
						</div>
					{/if}
				</li>
			{/each}
		</ul>
		{#if !shown.length}
			<p class="text-sm text-stone-500">No parties match the filters.</p>
		{/if}
	{:else}
		<p class="text-sm text-stone-500">No parties found for those ISRCs.</p>
	{/if}
{/if}
