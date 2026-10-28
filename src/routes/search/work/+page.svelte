<script lang="ts">
	import WorkList from '#lib/WorkList.svelte';
	import { api, parseCodes, uniqueWorks, type WorkIdentifier, type WorkInfo } from '#lib/api.js';

	type Mode = 'codes' | 'title';

	let mode = $state<Mode>('title');
	let loading = $state(false);
	let error = $state<string | null>(null);
	let ctrl: AbortController | null = null;

	// ---- codes mode ----
	let input = $state('');
	let override = $state<WorkIdentifier | 'auto'>('auto');
	let codeResults = $state<{ codes: string[]; byCode: Record<string, WorkInfo[]> } | null>(null);

	const placeholder = 'USUM71703861\nT3101581748\n…';

	const codes = $derived(parseCodes(input));

	const isIswc = (c: string) => /^T\d{10}$/.test(c);
	const detected = $derived<WorkIdentifier>(codes.length && codes.every(isIswc) ? 'iswc' : 'isrc');
	const method = $derived(override === 'auto' ? detected : override);
	const mixed = $derived(codes.some(isIswc) && !codes.every(isIswc));

	// ---- title mode ----
	let title = $state('');
	let artist = $state('');
	let titleResults = $state<{ title: string; artist: string; works: WorkInfo[] } | null>(null);

	const canSearch = $derived(mode === 'codes' ? codes.length > 0 : title.trim().length > 0);

	function setMode(next: Mode) {
		if (next === mode) return;
		ctrl?.abort();
		mode = next;
		loading = false;
		error = null;
	}

	async function search(e?: SubmitEvent) {
		e?.preventDefault();
		if (!canSearch) return;
		ctrl?.abort();
		const c = (ctrl = new AbortController());
		loading = true;
		error = null;
		try {
			if (mode === 'codes') {
				const sent = codes;
				const byCode = await api.searchWorks(sent, method, c.signal);
				for (const k in byCode) byCode[k] = uniqueWorks(byCode[k]);
				codeResults = { codes: sent, byCode };
			} else {
				const t = title.trim();
				const a = artist.trim();
				const works = await api.searchWorksByName(t, a || undefined, c.signal);
				titleResults = { title: t, artist: a, works: uniqueWorks(works) };
			}
		} catch (err) {
			if ((err as Error).name === 'AbortError') return;
			error = (err as Error).message;
			if (mode === 'codes') codeResults = null;
			else titleResults = null;
		}
		loading = false;
	}

	function onkeydown(e: KeyboardEvent) {
		if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) search();
	}
</script>

<h1 class="mb-2 text-4xl">Search works</h1>
<p class="mb-6 max-w-xl text-stone-600">
	{mode === 'codes'
		? 'Paste a list of ISRCs or ISWCs — one per line, or separated by commas.'
		: 'Find works by title, optionally narrowed to an artist.'}
</p>

<div class="mb-4 flex rounded-md border border-stone-300 bg-white p-0.5 text-sm" role="tablist">
	{#each [['title', 'Title & artist'], ['codes', 'ISRC / ISWC list']] as [value, label] (value)}
		<button
			type="button"
			role="tab"
			aria-selected={mode === value}
			onclick={() => setMode(value as Mode)}
			class="rounded px-3 py-1"
			class:bg-stone-900={mode === value}
			class:text-white={mode === value}>{label}</button
		>
	{/each}
</div>

<form onsubmit={search} class="mb-8">
	{#if mode === 'codes'}
		<textarea
			bind:value={input}
			{onkeydown}
			rows="6"
			{placeholder}
			class="mb-3 w-full rounded-lg border border-stone-300 bg-white px-4 py-3 font-mono text-sm shadow-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
		></textarea>
	{:else}
		<div class="mb-3 grid gap-3 sm:grid-cols-[2fr_1fr]">
			<label class="block">
				<span class="mb-1 block text-xs tracking-wide text-stone-500 uppercase">Title</span>
				<input
					bind:value={title}
					type="search"
					placeholder="e.g. Cut to the Feeling"
					class="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 shadow-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
				/>
			</label>
			<label class="block">
				<span class="mb-1 block text-xs tracking-wide text-stone-500 uppercase"
					>Artist <span class="normal-case">(optional)</span></span
				>
				<input
					bind:value={artist}
					type="search"
					placeholder="e.g. Carly Rae Jepsen"
					class="w-full rounded-lg border border-stone-300 bg-white px-4 py-3 shadow-sm outline-none focus:border-stone-500 focus:ring-2 focus:ring-stone-200"
				/>
			</label>
		</div>
	{/if}

	<div class="flex flex-wrap items-center gap-4">
		{#if mode === 'codes'}
			<div class="flex rounded-md border border-stone-300 bg-white p-0.5 text-sm">
				{#each [['auto', `Auto (${detected.toUpperCase()})`], ['isrc', 'ISRC'], ['iswc', 'ISWC']] as [value, label] (value)}
					<button
						type="button"
						onclick={() => (override = value as typeof override)}
						class="rounded px-3 py-1"
						class:bg-stone-900={override === value}
						class:text-white={override === value}>{label}</button
					>
				{/each}
			</div>
			<span class="text-sm text-stone-500">{codes.length} code{codes.length === 1 ? '' : 's'}</span>
			{#if mixed}
				<span class="text-sm text-amber-700"
					>Mixed ISRCs and ISWCs — searching as {method.toUpperCase()}</span
				>
			{/if}
		{:else}
			<span class="text-sm text-stone-500">Titles match exactly, ignoring case.</span>
		{/if}
		<button
			type="submit"
			disabled={!canSearch || loading}
			class="ml-auto rounded-md bg-stone-900 px-4 py-2 text-sm font-medium text-white hover:bg-stone-700 disabled:opacity-40"
		>
			{loading ? 'Searching…' : 'Search'}
		</button>
	</div>
</form>

{#if error}
	<p class="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
{:else if mode === 'codes' && codeResults}
	{@const byCode = codeResults.byCode}
	{@const found = codeResults.codes.filter((c) => byCode[c]?.length)}
	{@const missing = codeResults.codes.filter((c) => !byCode[c]?.length)}
	<p class="mb-4 text-sm text-stone-500">
		Matched {found.length} of {codeResults.codes.length}.
	</p>
	{#each found as code, i (i)}
		<section class="mb-6">
			<h2 class="mb-2 font-mono text-sm font-medium">{code}</h2>
			<WorkList works={byCode[code]} />
		</section>
	{/each}
	{#if missing.length}
		<section>
			<h2 class="mb-2 text-sm font-medium text-stone-500">No match</h2>
			<p class="font-mono text-xs leading-relaxed text-stone-500">{missing.join(', ')}</p>
		</section>
	{/if}
{:else if mode === 'title' && titleResults}
	{#if titleResults.works.length}
		<p class="mb-4 text-sm text-stone-500">
			{titleResults.works.length} work{titleResults.works.length === 1 ? '' : 's'} titled “{titleResults.title}”{titleResults.artist
				? ` by ${titleResults.artist}`
				: ''}
		</p>
		<WorkList works={titleResults.works} />
	{:else}
		<p class="text-sm text-stone-500">
			No works titled “{titleResults.title}”{titleResults.artist
				? ` by ${titleResults.artist}`
				: ''}.
		</p>
	{/if}
{/if}
