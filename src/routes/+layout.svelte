<script lang="ts">
	import './layout.css';
	import favicon from '#lib/assets/favicon.svg';
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import { ChartColumn, Disc3, UsersRound } from '@lucide/svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	const links = [
		{ href: resolve('/search/party'), label: 'Parties', icon: UsersRound },
		{ href: resolve('/search/work'), label: 'Works', icon: Disc3 },
		{ href: resolve('/search/top-parties'), label: 'Top parties', icon: ChartColumn }
	];
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<title>PubAdmin</title>
</svelte:head>

<div class="flex min-h-screen flex-col text-stone-900">
	<div
		class="bg-stone-900 py-1.5 text-center font-mono text-[0.65rem] tracking-[0.25em] text-stone-300 uppercase"
	>
		PubAdmin · Public Works Data
	</div>

	<header class="border-b border-stone-900">
		<nav class="mx-auto flex max-w-5xl flex-wrap items-end gap-x-8 gap-y-3 px-4 pt-6 pb-0">
			<a href={resolve('/search/party')} class="group mb-3 flex items-baseline gap-1">
				<span class="font-display text-3xl leading-none font-medium tracking-tight">PubAdmin</span
				>
				<span class="text-3xl leading-none text-accent transition-transform group-hover:-rotate-12"
					>●</span
				>
			</a>
			<div class="flex gap-1 sm:ml-auto">
				{#each links as link (link.href)}
					{@const active = page.url.pathname.startsWith(link.href)}
					<a
						href={link.href}
						class="-mb-px flex items-center gap-2 rounded-t-md border border-b-0 px-3.5 py-2 font-mono text-xs tracking-wider uppercase transition-colors"
						class:border-stone-900={active}
						class:bg-white={active}
						class:text-stone-900={active}
						class:border-transparent={!active}
						class:text-stone-500={!active}
						class:hover:text-stone-900={!active}
						aria-current={active ? 'page' : undefined}
					>
						<link.icon size={14} strokeWidth={1.75} />
						{link.label}
					</a>
				{/each}
			</div>
		</nav>
	</header>

	<main class="mx-auto w-full max-w-5xl flex-1 px-4 py-10">
		{@render children()}
	</main>

	<footer class="border-t border-stone-200">
		<div
			class="mx-auto flex max-w-5xl justify-between px-4 py-4 font-mono text-[0.65rem] tracking-widest text-stone-400 uppercase"
		>
			<span>PubAdmin</span>
			<span>BWARM catalogue</span>
		</div>
	</footer>
</div>
