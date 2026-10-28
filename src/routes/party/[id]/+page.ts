import { api } from '#lib/api.js';
import type { PageLoad } from './$types';

export const load: PageLoad = ({ params, fetch }) => ({
	id: params.id,
	party: api.party(params.id, fetch),
	collaborators: api.partyCollaborators(params.id, fetch)
});
