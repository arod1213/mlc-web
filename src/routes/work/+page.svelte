<script lang="ts">
	import { resolve } from '$app/paths';
	import {
		formatDuration,
		formatIpi,
		formatPro,
		formatShare,
		humanize,
		type PartyInfo,
		type Share,
		type WorkInfo
	} from '#lib/api.js';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	interface Node {
		share: Share;
		party: PartyInfo;
		children: Node[];
	}

	// Each share points at the share it derives from (admin -> publisher -> writer),
	// so build a forest rooted at shares with no (known) predecessor.
	function shareTree(work: WorkInfo): Node[] {
		// local scratch map, not reactive state
		// eslint-disable-next-line svelte/prefer-svelte-reactivity
		const nodes = new Map<string, Node>();
		for (const party of work.parties) {
			for (const share of party.shares) nodes.set(share.id, { share, party, children: [] });
		}
		const roots: Node[] = [];
		for (const node of nodes.values()) {
			const parent = node.share.preceding_id && nodes.get(node.share.preceding_id);
			if (parent && parent !== node) parent.children.push(node);
			else roots.push(node);
		}
		return roots;
	}

	function partyTotal(p: PartyInfo): number {
		return p.shares.reduce((sum, s) => sum + s.share, 0);
	}
</script>

{#snippet shareRow(node: Node, depth: number)}
	<tr class="hover:bg-stone-50">
		<td class="py-2 pr-4" style:padding-left="{1 + depth * 1.5}rem">
			{#if depth > 0}<span class="mr-1 text-stone-400">↳</span>{/if}
			<a
				href={resolve('/party/[id]', { id: String(node.party.id) })}
				class="font-medium hover:underline">{node.party.full_name}</a
			>
		</td>
		<td class="px-4 py-2 text-stone-600">{humanize(node.share.role)}</td>
		<td class="px-4 py-2 text-stone-600">{humanize(node.share.rights_type)}</td>
		<td class="px-4 py-2 font-mono text-xs text-stone-500">{formatIpi(node.party.ipi)}</td>
		<td class="px-4 py-2 text-right tabular-nums">{formatShare(node.share.share)}</td>
	</tr>
	{#each node.children as child, i (i)}
		{@render shareRow(child, depth + 1)}
	{/each}
{/snippet}

<svelte:head>
	{#await data.works then works}<title>{works[0]?.title} · PubAdmin</title>{/await}
</svelte:head>

{#await data.works}
	<p class="text-sm text-stone-500">Loading work…</p>
{:then works}
	{#each works as work, i (i)}
		<p class="mb-1 font-mono text-xs text-stone-500">{work.id}</p>
		<h1 class="mb-6 flex items-center gap-3 text-4xl">
			{work.title}
			{#if work.in_dispute}
				<span class="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"
					>In dispute</span
				>
			{/if}
		</h1>

		<dl class="mb-8 grid grid-cols-2 gap-4 card p-4 sm:grid-cols-4">
			<div>
				<dt class="text-xs text-stone-500">ISWC</dt>
				<dd class="font-mono text-sm">{work.iswc ?? '—'}</dd>
			</div>
			<div>
				<dt class="text-xs text-stone-500">Duration</dt>
				<dd class="text-sm">{formatDuration(work.duration_ms)}</dd>
			</div>
			<div>
				<dt class="text-xs text-stone-500">Total shares</dt>
				<dd class="text-sm tabular-nums" class:text-amber-700={work.total_shares < 100}>
					{formatShare(work.total_shares)}
				</dd>
			</div>
			<div>
				<dt class="text-xs text-stone-500">Parties</dt>
				<dd class="text-sm">{work.parties.length}</dd>
			</div>
		</dl>

		<h2 class="mb-4 text-2xl">Shares</h2>
		{#if work.parties.length}
			<div class="mb-8 overflow-x-auto card">
				<table class="w-full text-sm">
					<thead class="bg-stone-50 text-left text-xs tracking-wide text-stone-500 uppercase">
						<tr>
							<th class="py-2 pr-4 pl-4 font-medium">Party</th>
							<th class="px-4 py-2 font-medium">Role</th>
							<th class="px-4 py-2 font-medium">Rights</th>
							<th class="px-4 py-2 font-medium">IPI</th>
							<th class="px-4 py-2 text-right font-medium">Share</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-stone-100">
						{#each shareTree(work) as node, i (i)}
							{@render shareRow(node, 0)}
						{/each}
					</tbody>
				</table>
			</div>

			<h2 class="mb-4 text-2xl">Parties</h2>
			<div class="mb-8 grid gap-3 sm:grid-cols-2">
				{#each work.parties as p, i (i)}
					<a
						href={resolve('/party/[id]', { id: String(p.id) })}
						class="block card p-4 hover:border-stone-400"
					>
						<div class="mb-1 flex items-baseline justify-between gap-2">
							<span class="font-medium">{p.full_name}</span>
							<span class="text-sm tabular-nums">{formatShare(partyTotal(p))}</span>
						</div>
						<div class="text-xs text-stone-500">
							IPI {formatIpi(p.ipi)} · PRO {formatPro(p.pro)}
						</div>
						<div class="mt-2 flex flex-wrap gap-1">
							{#each p.shares as s, i (i)}
								<span class="rounded bg-stone-100 px-1.5 py-0.5 text-xs text-stone-600">
									{humanize(s.role)}{s.rights_type ? ` · ${humanize(s.rights_type)}` : ''}
								</span>
							{/each}
						</div>
					</a>
				{/each}
			</div>
		{:else}
			<p class="mb-8 text-sm text-stone-500">No shares on file.</p>
		{/if}

		<h2 class="mb-4 text-2xl">Releases</h2>
		{#if work.releases.length}
			<div class="overflow-x-auto card">
				<table class="w-full text-sm">
					<thead class="bg-stone-50 text-left text-xs tracking-wide text-stone-500 uppercase">
						<tr>
							<th class="px-4 py-2 font-medium">Title</th>
							<th class="px-4 py-2 font-medium">Artist</th>
							<th class="px-4 py-2 font-medium">ISRC</th>
							<th class="px-4 py-2 font-medium">Label</th>
							<th class="px-4 py-2 font-medium">Released</th>
						</tr>
					</thead>
					<tbody class="divide-y divide-stone-100">
						{#each work.releases as r, i (i)}
							<tr>
								<td class="px-4 py-2">{r.title}</td>
								<td class="px-4 py-2 text-stone-600">{r.artist_name}</td>
								<td class="px-4 py-2 font-mono text-xs text-stone-500">{r.isrc ?? '—'}</td>
								<td class="px-4 py-2 text-stone-600">{r.label_name}</td>
								<td class="px-4 py-2 text-stone-600">{r.release_date ?? '—'}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{:else}
			<p class="text-sm text-stone-500">No releases on file.</p>
		{/if}
	{/each}
{:catch e}
	<p class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
		{e.status === 404 ? 'Work not found.' : `Couldn't load work: ${e.message}`}
	</p>
{/await}
