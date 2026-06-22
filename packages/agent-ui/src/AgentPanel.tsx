"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Bot, Send, Sparkles, X } from "lucide-react";
import {
	AgentRuntime,
	AGENT_PRESETS,
	buildProjectContext,
	formatContextForPrompt,
	loadAgentSession,
	loadAgentSettings,
	saveAgentSession,
	saveAgentSettings,
	hasOpenRouterKey,
	type AgentMessage,
	type AgentSettings,
	type PendingAction,
	type AgentEvent,
} from "@trimy/agent";
import { executeAgentTool } from "@/agent-bridge/tools";
import { usePanelStore } from "@/editor/panel-store";
import { useEditor } from "@/editor/use-editor";
import { getCachedTranscript } from "@/agent-bridge/tools";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils/ui";

function ApiKeyBanner({ onOpenSettings }: { onOpenSettings: () => void }) {
	return (
		<div className="bg-accent/50 border-b px-3 py-2 text-xs text-muted-foreground">
			<p>OpenRouter API key required.</p>
			<Button variant="link" className="h-auto p-0 text-xs" onClick={onOpenSettings}>
				Open AI Settings
			</Button>
		</div>
	);
}

function PendingActionCard({
	action,
	onApprove,
	onCancel,
}: {
	action: PendingAction;
	onApprove: () => void;
	onCancel: () => void;
}) {
	return (
		<div className="border border-amber-500/40 bg-amber-500/10 rounded-lg p-3 text-xs space-y-2">
			<p className="font-medium text-amber-200">{action.summary}</p>
			<ul className="text-muted-foreground space-y-0.5">
				{action.details.map((d) => (
					<li key={d}>• {d}</li>
				))}
			</ul>
			<div className="flex gap-2 pt-1">
				<Button size="sm" className="h-7 text-xs" onClick={onApprove}>
					Approve
				</Button>
				<Button size="sm" variant="outline" className="h-7 text-xs" onClick={onCancel}>
					Cancel
				</Button>
			</div>
		</div>
	);
}

function MessageBubble({ message }: { message: AgentMessage }) {
	const isUser = message.role === "user";
	return (
		<div
			className={cn(
				"rounded-lg px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap",
				isUser ? "bg-primary/20 ml-4" : "bg-muted/40 mr-2",
			)}
		>
			{message.content}
			{message.toolCalls && message.toolCalls.length > 0 && (
				<div className="mt-1 text-[10px] text-muted-foreground">
					Tools: {message.toolCalls.map((t) => t.name).join(", ")}
				</div>
			)}
		</div>
	);
}

export function AgentPanel() {
	const editor = useEditor();
	const projectId = useEditor((e) => e.project.getActiveOrNull()?.metadata.id);
	const { agentCollapsed, toggleAgentCollapsed } = usePanelStore();
	const [settings, setSettings] = useState<AgentSettings>(() => loadAgentSettings());
	const [serverKeyConfigured, setServerKeyConfigured] = useState(false);
	const [messages, setMessages] = useState<AgentMessage[]>([]);
	const [input, setInput] = useState("");
	const [streaming, setStreaming] = useState("");
	const [isRunning, setIsRunning] = useState(false);
	const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
	const [activeTool, setActiveTool] = useState<string | null>(null);
	const [showSettings, setShowSettings] = useState(false);
	const runtimeRef = useRef<AgentRuntime | null>(null);
	const listRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		if (!projectId) return;
		setMessages(loadAgentSession(projectId));
	}, [projectId]);

	useEffect(() => {
		fetch("/api/agent/status")
			.then((r) => r.json())
			.then((data: { openRouter?: boolean }) => {
				setServerKeyConfigured(Boolean(data.openRouter));
			})
			.catch(() => setServerKeyConfigured(false));
	}, []);

	useEffect(() => {
		const handler = (e: KeyboardEvent) => {
			if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "j") {
				e.preventDefault();
				toggleAgentCollapsed();
			}
		};
		window.addEventListener("keydown", handler);
		return () => window.removeEventListener("keydown", handler);
	}, [toggleAgentCollapsed]);

	const getContextJson = useCallback(() => {
		const bridge = window.__agentBridge;
		if (!bridge?.ready) return "{}";
		const state = bridge.getState();
		const transcript = getCachedTranscript(state.projectId);
		const context = buildProjectContext({
			state,
			editor: bridge.getEditor(),
			transcript,
		});
		return formatContextForPrompt(context);
	}, [editor]);

	const onEvent = useCallback(
		(event: AgentEvent) => {
			if (event.type === "token") {
				setStreaming((s) => s + event.delta);
			}
			if (event.type === "tool_start") {
				setActiveTool(event.name);
			}
			if (event.type === "tool_end") {
				setActiveTool(null);
			}
			if (event.type === "pending_action") {
				setPendingAction(event.action);
				setIsRunning(false);
			}
			if (event.type === "done") {
				setStreaming((current) => {
					if (current) {
						setMessages((prev) => {
							const next = [
								...prev,
								{
									id: event.messageId,
									role: "assistant" as const,
									content: current,
									timestamp: Date.now(),
								},
							];
							if (projectId) saveAgentSession(projectId, next);
							return next;
						});
					}
					return "";
				});
				setIsRunning(false);
			}
			if (event.type === "error") {
				setMessages((prev) => {
					const next = [
						...prev,
						{
							id: `err-${Date.now()}`,
							role: "system" as const,
							content: event.message,
							timestamp: Date.now(),
						},
					];
					if (projectId) saveAgentSession(projectId, next);
					return next;
				});
				setIsRunning(false);
			}
		},
		[projectId],
	);

	const send = useCallback(
		async (text: string) => {
			if (!text.trim() || isRunning) return;
			const trimmed = text.trim();
			setInput("");
			setIsRunning(true);
			setStreaming("");
			setPendingAction(null);

			const userMsg: AgentMessage = {
				id: `u-${Date.now()}`,
				role: "user",
				content: trimmed,
				timestamp: Date.now(),
			};
			setMessages((prev) => {
				const next = [...prev, userMsg];
				if (projectId) saveAgentSession(projectId, next);
				return next;
			});

			const runtime = new AgentRuntime(
				settings,
				{
					onEvent,
					executeTool: executeAgentTool,
					getContextJson,
				},
				messages,
			);
			runtimeRef.current = runtime;
			await runtime.sendMessage(trimmed);
		},
		[isRunning, messages, onEvent, projectId, settings, getContextJson],
	);

	const handleApprove = async () => {
		if (!pendingAction || !runtimeRef.current) return;
		setIsRunning(true);
		await runtimeRef.current.confirmAction({
			actionId: pendingAction.id,
			approved: true,
		});
		setPendingAction(null);
	};

	const handleCancel = async () => {
		if (!pendingAction || !runtimeRef.current) return;
		await runtimeRef.current.confirmAction({
			actionId: pendingAction.id,
			approved: false,
		});
		setPendingAction(null);
	};

	const saveKey = (key: string) => {
		const next = saveAgentSettings({ openRouterApiKey: key });
		setSettings(next);
		setShowSettings(false);
	};

	if (agentCollapsed) {
		return (
			<div className="flex h-full flex-col items-center border-l bg-background/80 py-2">
				<Button
					variant="ghost"
					size="icon"
					className="h-8 w-8"
					onClick={toggleAgentCollapsed}
					title="Open Agent (Ctrl+J)"
				>
					<Bot className="h-4 w-4" />
				</Button>
			</div>
		);
	}

	const keyReady = hasOpenRouterKey(settings) || serverKeyConfigured;

	return (
		<div className="flex h-full min-h-0 flex-col border-l bg-background">
			<div className="flex items-center justify-between border-b px-3 py-2">
				<div className="flex items-center gap-2 text-sm font-medium">
					<Sparkles className="h-4 w-4 text-primary" />
					Trimy Agent
				</div>
				<Button variant="ghost" size="icon" className="h-7 w-7" onClick={toggleAgentCollapsed}>
					<X className="h-3.5 w-3.5" />
				</Button>
			</div>

			{!keyReady && !showSettings && (
				<ApiKeyBanner onOpenSettings={() => setShowSettings(true)} />
			)}

			{showSettings && (
				<div className="border-b p-3 space-y-2 text-xs">
					<label className="block text-muted-foreground">OpenRouter API Key</label>
					<input
						type="password"
						className="w-full rounded border bg-background px-2 py-1.5 text-xs"
						defaultValue={settings.openRouterApiKey}
						onBlur={(e) => saveKey(e.target.value)}
						placeholder="sk-or-..."
					/>
					<p className="text-muted-foreground">Chat: {settings.chatModel}</p>
					<p className="text-muted-foreground">Vision: {settings.visionModel}</p>
					<Button size="sm" variant="outline" className="h-7" onClick={() => setShowSettings(false)}>
						Done
					</Button>
				</div>
			)}

			<div className="flex flex-wrap gap-1 border-b px-2 py-2">
				{AGENT_PRESETS.map((preset) => (
					<button
						key={preset.id}
						type="button"
						disabled={!keyReady || isRunning}
						className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground hover:bg-muted disabled:opacity-40"
						onClick={() => send(preset.message)}
					>
						{preset.label}
					</button>
				))}
			</div>

			<div ref={listRef} className="flex-1 min-h-0 overflow-y-auto space-y-2 p-3">
				{messages.map((msg) => (
					<MessageBubble key={msg.id} message={msg} />
				))}
				{streaming && (
					<div className="rounded-lg bg-muted/40 mr-2 px-3 py-2 text-xs whitespace-pre-wrap">
						{streaming}
					</div>
				)}
				{activeTool && (
					<div className="text-[10px] text-muted-foreground animate-pulse">
						Running {activeTool}…
					</div>
				)}
				{pendingAction && (
					<PendingActionCard
						action={pendingAction}
						onApprove={handleApprove}
						onCancel={handleCancel}
					/>
				)}
			</div>

			<div className="border-t p-2">
				<form
					className="flex gap-2"
					onSubmit={(e) => {
						e.preventDefault();
						send(input);
					}}
				>
					<input
						value={input}
						onChange={(e) => setInput(e.target.value)}
						disabled={!keyReady || isRunning || Boolean(pendingAction)}
						placeholder={keyReady ? "Ask agent to edit…" : "Add API key first"}
						className="flex-1 rounded-md border bg-background px-2 py-1.5 text-xs"
					/>
					<Button
						type="submit"
						size="icon"
						className="h-8 w-8 shrink-0"
						disabled={!keyReady || isRunning || Boolean(pendingAction)}
					>
						<Send className="h-3.5 w-3.5" />
					</Button>
				</form>
			</div>
		</div>
	);
}
