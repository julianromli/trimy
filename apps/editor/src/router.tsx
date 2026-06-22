import {
	createRootRoute,
	createRoute,
	createRouter,
	Navigate,
	Outlet,
} from "@tanstack/react-router";
import { AppShell } from "./app-shell";
import EditorPage from "@/app/editor/[project_id]/page";
import ProjectsPage from "@/app/projects/page";

const rootRoute = createRootRoute({
	component: () => (
		<AppShell>
			<Outlet />
		</AppShell>
	),
});

const indexRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/",
	component: () => <Navigate to="/projects" replace />,
});

const projectsRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/projects",
	component: ProjectsPage,
});

const editorRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/editor/$projectId",
	component: EditorPage,
});

const routeTree = rootRoute.addChildren([
	indexRoute,
	projectsRoute,
	editorRoute,
]);

export const router = createRouter({
	routeTree,
	defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
