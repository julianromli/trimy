import type { CSSProperties, ImgHTMLAttributes } from "react";
import { cn } from "@/utils/ui";

type ImageProps = ImgHTMLAttributes<HTMLImageElement> & {
	fill?: boolean;
	priority?: boolean;
	sizes?: string;
	quality?: number;
};

export default function Image({
	src,
	alt,
	fill,
	className,
	style,
	...props
}: ImageProps) {
	const resolvedSrc =
		typeof src === "string"
			? src
			: src && typeof src === "object" && "src" in src
				? String((src as { src: string }).src)
				: undefined;

	const mergedStyle: CSSProperties = fill
		? { position: "absolute", inset: 0, height: "100%", width: "100%", ...style }
		: style ?? {};

	return (
		<img
			src={resolvedSrc}
			alt={alt ?? ""}
			className={cn(fill && "object-cover", className)}
			style={mergedStyle}
			{...props}
		/>
	);
}
