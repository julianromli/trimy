import {
	useNavigate,
	useParams as useTanstackParams,
	useRouter as useTanstackRouter,
} from "@tanstack/react-router";

export function useRouter() {
	const navigate = useNavigate();

	return {
		push: (url: string) => {
			void navigate({ to: url });
		},
		replace: (url: string) => {
			void navigate({ to: url, replace: true });
		},
		back: () => {
			window.history.back();
		},
	};
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
