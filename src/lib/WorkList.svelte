<script lang="ts">
	import { goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { formatShare, type WorkInfo } from '#lib/api.js';

	let { works }: { works: WorkInfo[] } = $props();

	const showParties = $derived(works.some((w) => w.parties.length));

	function open(w: WorkInfo) {
		goto(resolve(`/work?id=${encodeURIComponent(w.id)}`));
	}
</script>

<div class="overflow-x-auto card">
	<table class="w-full text-sm">
		<thead class="bg-stone-50 text-left text-xs tracking-wide text-stone-500 uppercase">
			<tr>
				<th class="px-4 py-2 font-medium">Title</th>
				<th class="px-4 py-2 font-medium">ISWC</th>
				{#if showParties}<th class="px-4 py-2 font-medium">Parties</th>{/if}
				<th class="px-4 py-2 text-right font-medium">Shares</th>
			</tr>
		</thead>
		<tbody class="divide-y divide-stone-200">
			{#each works as w, i (i)}
				<tr class="cursor-pointer hover:bg-stone-50" onclick={() => open(w)}>
					<td class="px-4 py-2.5">
						<a href={resolve(`/work?id=${encodeURIComponent(w.id)}`)} class="font-medium"
							>{w.title}</a
						>
						{#if w.in_dispute}
							<span class="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs text-amber-800"
								>Dispute</span
							>
						{/if}
					</td>
					<td class="px-4 py-2.5 font-mono text-xs text-stone-600">{w.iswc ?? '—'}</td>
					{#if showParties}
						<td class="max-w-xs truncate px-4 py-2.5 text-stone-600">
							{w.parties.map((p) => p.full_name).join(', ')}
						</td>
					{/if}
					<td
						class="px-4 py-2.5 text-right tabular-nums"
						class:text-amber-700={w.total_shares < 100}
					>
						{formatShare(w.total_shares)}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
</div>
