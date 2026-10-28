<script lang="ts">
	import { resolve } from '$app/paths';
	import { Dialog } from 'bits-ui';
	import { ArrowRight, Layers, X } from '@lucide/svelte';
	import WorkList from '#lib/WorkList.svelte';
	import { api, formatIpi, formatPro, partyName, type Party, type WorkInfo } from '#lib/api.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const PAGE_SIZE = 50;

	let filter = $state('');
	let dispute = $state<'all' | 'yes' | 'no'>('all');
	let withParty = $state<Party | null>(null);
	// collaborator picked from the list, awaiting a choice in the dialog
	let picked = $state<Party | null>(null);

	// collaborators arrive all at once; render them in batches as the box scrolls
	const COLLAB_BATCH = 30;
	let collabShown = $state(COLLAB_BATCH);

	function infiniteScroll(sentinel: HTMLElement, total: number) {
		const observer = new IntersectionObserver(
			([entry]) => {
				if (entry.isIntersecting && collabShown < total) collabShown += COLLAB_BATCH;
			},
			{ root: sentinel.parentElement, rootMargin: '0px 0px 120px 0px' }
		);
		observer.observe(sentinel);
		return {
			update(next: number) {
				total = next;
			},
			destroy: () => observer.disconnect()
		};
	}
	let dialogOpen = $state(false);

	function pick(p: Party) {
		picked = p;
		dialogOpen = true;
	}

	function showShared() {
		withParty = picked;
		dialogOpen = false;
	}

	let works = $state<WorkInfo[]>([]);
	let page = $state(0);
	let hasMore = $state(false);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let ctrl: AbortController | null = null;

	// navigating to another party reuses this component, so reset the filters
	$effect.pre(() => {
		void data.id;
		filter = '';
		dispute = 'all';
		withParty = null;
		picked = null;
		collabShown = COLLAB_BATCH;
	});

	async function load(next: number) {
		ctrl?.abort();
		const c = (ctrl = new AbortController());
		loading = true;
		error = null;
		try {
			const batch = await api.partyWorks(
				data.id,
				{
					limit: PAGE_SIZE,
					page: next,
					is_deep: true,
					in_dispute: dispute === 'all' ? undefined : dispute === 'yes',
					with_id: withParty?.id
				},
				(input, init) => fetch(input, { ...init, signal: c.signal })
			);
			if (c.signal.aborted) return;
			works = next === 0 ? batch : [...works, ...batch];
			page = next;
			hasMore = batch.length === PAGE_SIZE;
		} catch (e) {
			if (c.signal.aborted) return;
			error = (e as Error).message;
		}
		loading = false;
	}

	// refetch from the first page whenever the party or a server-side filter changes
	$effect(() => {
		void [data.id, dispute, withParty];
		works = [];
		load(0);
		return () => ctrl?.abort();
	});

	const q = $derived(filter.trim().toLowerCase());
	const shown = $derived(
		q
			? works.filter((w) => w.title.toLowerCase().includes(q) || w.iswc?.toLowerCase().includes(q))
			: works
	);
</script>

{#snippet collaboratorList(title: string, parties: Party[])}
	{#if parties.length}
		<div>
			<h3 class="mb-2 text-xs tracking-wide text-stone-500 uppercase">{title}</h3>
			<ul class="flex flex-wrap gap-1.5">
				{#each parties as p, i (i)}
					<li>
						<button
							type="button"
							onclick={() => pick(p)}
							class="rounded-md border px-2.5 py-1 text-sm"
							class:border-stone-900={withParty?.id === p.id}
							class:bg-stone-900={withParty?.id === p.id}
							class:text-white={withParty?.id === p.id}
							class:border-stone-200={withParty?.id !== p.id}
							class:bg-white={withParty?.id !== p.id}
							class:hover:bg-stone-50={withParty?.id !== p.id}>{partyName(p)}</button
						>
					</li>
				{/each}
			</ul>
		</div>
	{/if}
{/snippet}

{#snippet collaboratorScroll(parties: Party[])}
	{#if parties.length}
		<div>
			<h3 class="mb-2 text-xs tracking-wide text-stone-500 uppercase">
				Collaborators <span class="normal-case">({parties.length})</span>
			</h3>
			<ul class="max-h-80 divide-y divide-stone-100 overflow-y-auto card">
				{#each parties.slice(0, collabShown) as p, i (i)}
					<li>
						<button
							type="button"
							onclick={() => pick(p)}
							class="flex w-full items-baseline gap-3 px-4 py-2 text-left text-sm"
							class:bg-stone-900={withParty?.id === p.id}
							class:text-white={withParty?.id === p.id}
							class:hover:bg-stone-50={withParty?.id !== p.id}
						>
							<span class="flex-1 truncate">{partyName(p)}</span>
							<span
								class="font-mono text-xs"
								class:text-stone-400={withParty?.id !== p.id}
								class:text-stone-300={withParty?.id === p.id}>{formatIpi(p.ipi_name_num)}</span
							>
						</button>
					</li>
				{/each}
				{#if collabShown < parties.length}
					<li use:infiniteScroll={parties.length} class="px-4 py-2 text-xs text-stone-400">
						Loading more…
					</li>
				{/if}
			</ul>
		</div>
	{/if}
{/snippet}

<Dialog.Root bind:open={dialogOpen}>
	<Dialog.Portal>
		<Dialog.Overlay class="dialog-overlay fixed inset-0 z-40 bg-stone-900/30 backdrop-blur-[2px]" />
		<Dialog.Content
			class="dialog-content fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 card p-0 shadow-xl outline-none"
		>
			{#if picked}
				<div class="flex items-center justify-between border-b border-stone-900 px-5 py-2">
					<span class="font-mono text-[0.65rem] tracking-widest text-stone-500 uppercase"
						>{picked.role ?? 'Party'} · IPI {formatIpi(picked.ipi_name_num)}</span
					>
					<Dialog.Close class="text-stone-500 hover:text-stone-900" aria-label="Close">
						<X size={16} />
					</Dialog.Close>
				</div>
				<div class="p-5">
					<Dialog.Title class="mb-5 font-display text-2xl leading-tight"
						>{partyName(picked)}</Dialog.Title
					>
					<div class="flex flex-col gap-2.5">
						<button
							type="button"
							onclick={showShared}
							class="flex items-center gap-2 rounded-md border border-stone-900 bg-stone-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
						>
							<Layers size={16} strokeWidth={1.75} />
							Works together
						</button>
						<a
							href={resolve('/party/[id]', { id: String(picked.id) })}
							onclick={() => (dialogOpen = false)}
							class="flex items-center gap-2 rounded-md border border-stone-900 bg-white px-4 py-2.5 text-sm hover:bg-stone-100"
						>
							<ArrowRight size={16} strokeWidth={1.75} />
							Go to party page
						</a>
					</div>
				</div>
			{/if}
		</Dialog.Content>
	</Dialog.Portal>
</Dialog.Root>

<svelte:head>
	{#await data.party then party}<title>{partyName(party)} · MLC Reader</title>{/await}
</svelte:head>

{#await data.party}
	<p class="text-sm text-stone-500">Loading party…</p>
{:then party}
	<p class="mb-1 text-xs tracking-wide text-stone-500 uppercase">{party.role ?? 'Party'}</p>
	<h1 class="mb-6 text-4xl">{partyName(party)}</h1>
	<dl class="mb-8 grid grid-cols-2 gap-4 card p-4 sm:grid-cols-4">
		<div>
			<dt class="text-xs text-stone-500">IPI name #</dt>
			<dd class="font-mono text-sm">{formatIpi(party.ipi_name_num)}</dd>
		</div>
		<div>
			<dt class="text-xs text-stone-500">PRO</dt>
			<dd class="text-sm">{formatPro(party.pro)}</dd>
		</div>
		<div>
			<dt class="text-xs text-stone-500">Role</dt>
			<dd class="text-sm capitalize">{party.role ?? '—'}</dd>
		</div>
		<div>
			<dt class="text-xs text-stone-500">Party ID</dt>
			<dd class="font-mono text-sm">{party.id}</dd>
		</div>
	</dl>
{:catch e}
	<p class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
		Couldn't load party: {e.message}
	</p>
{/await}

{#await data.collaborators then collab}
	{@const { represented, collaborators } = collab}
	{#if represented.writers.length || represented.publishers.length || collaborators.length}
		<h2 class="mb-4 text-2xl">Related parties</h2>
		<div class="mb-8 space-y-4">
			{@render collaboratorList('Publishers', represented.publishers)}
			{@render collaboratorList('Writers', represented.writers)}
			{@render collaboratorScroll(collaborators)}
		</div>
	{/if}
{:catch e}
	<p class="mb-8 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
		Couldn't load collaborators: {e.message}
	</p>
{/await}

<div class="mb-3 flex flex-wrap items-end justify-between gap-4">
	<h2 class="text-2xl">
		Works <span class="text-sm font-normal text-stone-500"
			>({works.length}{hasMore ? '+' : ''})</span
		>
	</h2>
	<div class="flex flex-wrap items-center gap-3">
		{#if withParty}
			<span
				class="flex items-center gap-1.5 rounded-md bg-stone-900 px-2.5 py-1 text-xs text-white"
			>
				Shared with {partyName(withParty)}
				<button type="button" onclick={() => (withParty = null)} aria-label="Clear">✕</button>
			</span>
		{/if}
		<div class="flex rounded-md border border-stone-300 bg-white p-0.5 text-sm">
			{#each [['all', 'All'], ['yes', 'In dispute'], ['no', 'Not disputed']] as [value, label] (value)}
				<button
					type="button"
					onclick={() => (dispute = value as typeof dispute)}
					class="rounded px-2.5 py-1"
					class:bg-stone-900={dispute === value}
					class:text-white={dispute === value}>{label}</button
				>
			{/each}
		</div>
		<input
			bind:value={filter}
			type="search"
			placeholder="Filter by title or ISWC"
			class="w-56 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm outline-none focus:border-stone-500"
		/>
	</div>
</div>

{#if error}
	<p class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
		Couldn't load works: {error}
	</p>
{:else if shown.length}
	<WorkList works={shown} />
{:else if loading}
	<p class="text-sm text-stone-500">Loading works…</p>
{:else}
	<p class="text-sm text-stone-500">No works.</p>
{/if}

{#if hasMore && !error}
	<div class="mt-4 flex justify-center">
		<button
			type="button"
			onclick={() => load(page + 1)}
			disabled={loading}
			class="rounded-md border border-stone-300 bg-white px-4 py-2 text-sm hover:bg-stone-50 disabled:opacity-40"
		>
			{loading ? 'Loading…' : 'Load more'}
		</button>
	</div>
{/if}
