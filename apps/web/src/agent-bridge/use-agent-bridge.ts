"use client";

import { useEffect } from "react";
import { useEditor } from "@/editor/use-editor";
import { mountAgentBridge } from "./index";

export function useAgentBridge(): void {
	const editor = useEditor();

	useEffect(() => {
		return mountAgentBridge(editor);
	}, [editor]);
}
