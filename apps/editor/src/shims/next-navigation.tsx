import { useMemo } from "react";
import {
	useNavigate,
	useParams as useTanstackParams,
	useRouter as useTanstackRouter,
} from "@tanstack/react-router";

function navigateToUrl({
	navigate,
	url,
	replace,
}: {
	navigate: ReturnType<typeof useNavigate>;
	url: string;
	replace: boolean;
}) {
	const editorMatch = url.match(/^\/editor\/([^/?#]+)$/);
	if (editorMatch) {
		void navigate({
			to: "/editor/$projectId",
			params: { projectId: editorMatch[1] },
			replace,
		});
		return;
	}

	void navigate({ to: url, replace });
}

export function useRouter() {
	const navigate = useNavigate();

	// Stable reference — EditorProvider (and others) depend on this in useEffect deps.
	return useMemo(
		() => ({
			push: (url: string) => {
				navigateToUrl({ navigate, url, replace: false });
			},
			replace: (url: string) => {
				navigateToUrl({ navigate, url, replace: true });
			},
			back: () => {
				window.history.back();
			},
		}),
		[navigate],
	);
}

export function useParams<
	T extends Record<string, string | undefined> = Record<
		string,
		string | undefined
	>,
>(): T {
	const params = useTanstackParams({ strict: false }) as Record<
		string,
		string | undefined
	>;

	return {
		...params,
		project_id: params.projectId ?? params.project_id,
	} as unknown as T;
}

export function usePathname(): string {
	const router = useTanstackRouter();
	return router.state.location.pathname;
}

export function useSearchParams(): URLSearchParams {
	const router = useTanstackRouter();
	return new URLSearchParams(router.state.location.searchStr);
}

export function notFound(): never {
	throw new Error("Not found");
}
