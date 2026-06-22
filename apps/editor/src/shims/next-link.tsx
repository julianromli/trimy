import { Link as RouterLink } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type NextLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
	href: string;
	children?: ReactNode;
};

function resolveLinkTarget(href: string) {
	const editorMatch = href.match(/^\/editor\/([^/?#]+)$/);
	if (editorMatch) {
		return {
			to: "/editor/$projectId" as const,
			params: { projectId: editorMatch[1] },
		};
	}

	return { to: href };
}

export default function Link({ href, children, ...props }: NextLinkProps) {
	const target = resolveLinkTarget(href);
	return (
		<RouterLink {...target} {...props}>
			{children}
		</RouterLink>
	);
}
