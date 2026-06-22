export type TransportAdapter = (
	path: string,
	init?: RequestInit,
) => Promise<Response>;

let transportAdapter: TransportAdapter | null = null;

export function setTransportAdapter(adapter: TransportAdapter | null): void {
	transportAdapter = adapter;
}

export async function trimyFetch(
	path: string,
	init?: RequestInit,
): Promise<Response> {
	if (transportAdapter) {
		return transportAdapter(path, init);
	}
	return fetch(path, init);
}

export async function trimyFetchJson<T>(
	path: string,
	init?: RequestInit,
): Promise<T> {
	const response = await trimyFetch(path, init);
	if (!response.ok) {
		const text = await response.text();
		throw new Error(`${response.status}: ${text}`);
	}
	return response.json() as Promise<T>;
}
