import { Link as RouterLink } from "@tanstack/react-router";
import type { AnchorHTMLAttributes, ReactNode } from "react";

type NextLinkProps = Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> & {
	href: string;
	children?: ReactNode;
};

export default function Link({ href, children, ...props }: NextLinkProps) {
	return (
		<RouterLink to={href} {...props}>
			{children}
		</RouterLink>
	);
}
