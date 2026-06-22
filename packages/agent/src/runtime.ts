import { nanoid } from "nanoid";
import {
	aggregateBatchTools,
	buildPendingAction,
	getToolCategory,
	requiresConfirm,
} from "./confirm-gate";
import { formatContextForPrompt } from "./context-builder";
import { AGENT_SYSTEM_PROMPT } from "./system-prompt";
import { TOOL_DEFINITIONS } from "./tool-schemas";
import type {
	AgentEvent,
	AgentMessage,
	AgentSettings,
	PendingAction,
	ToolName,
	ToolResult,
} from "./types";

export interface AgentRuntimeCallbacks {
	onEvent: (event: AgentEvent) => void;
	executeTool: (name: ToolName, args: Record<string, unknown>) => Promise<ToolResult>;
	getContextJson: () => string;
}

interface OpenRouterMessage {
	role: "system" | "user" | "assistant" | "tool";
	content?: string | null;
	tool_calls?: Array<{
		id: string;
		type: "function";
		function: { name: string; arguments: string };
	}>;
	tool_call_id?: string;
	name?: string;
}

export class AgentRuntime {
	private messages: AgentMessage[] = [];
	private pendingAction: PendingAction | null = null;
	private aborted = false;
	private running = false;

	constructor(
		private settings: AgentSettings,
		private callbacks: AgentRuntimeCallbacks,
		initialMessages: AgentMessage[] = [],
	) {
		this.messages = [...initialMessages];
	}

	setSettings(settings: AgentSettings): void {
		this.settings = settings;
	}

	getMessages(): AgentMessage[] {
		return [...this.messages];
	}

	getPendingAction(): PendingAction | null {
		return this.pendingAction;
	}

	abort(): void {
		this.aborted = true;
	}

	async sendMessage(userMessage: string): Promise<void> {
		if (this.running) return;
		this.running = true;
		this.aborted = false;

		const userMsg: AgentMessage = {
			id: nanoid(),
			role: "user",
			content: userMessage,
			timestamp: Date.now(),
		};
		this.messages.push(userMsg);

		try {
			await this.runAgentLoop();
		} catch (error) {
			this.callbacks.onEvent({
				type: "error",
				message: error instanceof Error ? error.message : "Agent failed",
			});
		} finally {
			this.running = false;
		}
	}

	async confirmAction({
		actionId,
		approved,
		editMessage,
	}: {
		actionId: string;
		approved: boolean;
		editMessage?: string;
	}): Promise<void> {
		if (!this.pendingAction || this.pendingAction.id !== actionId) {
			return;
		}

		const action = this.pendingAction;
		this.pendingAction = null;

		if (!approved) {
			if (editMessage) {
				await this.sendMessage(editMessage);
			}
			return;
		}

		for (const tool of action.tools) {
			if (this.aborted) break;
			this.callbacks.onEvent({
				type: "tool_start",
				name: tool.name,
				args: tool.args,
			});
			const result = await this.callbacks.executeTool(tool.name, {
				...tool.args,
				_skipConfirm: true,
			});
			this.callbacks.onEvent({ type: "tool_end", name: tool.name, result });
		}

		await this.runAgentLoop("Batch edits applied. Summarize what changed.");
	}

	private toolResultsBuffer: OpenRouterMessage[] = [];

	private async runAgentLoop(followUp?: string): Promise<void> {
		const maxRounds = 10;

		for (let round = 0; round < maxRounds; round++) {
			if (this.aborted) break;

			const orMessages = this.buildOpenRouterMessages(followUp);
			followUp = undefined;

			const response = await this.callOpenRouter(orMessages);
			const choice = response.choices?.[0];
			if (!choice) break;

			const assistantMessage = choice.message;
			const toolCalls = assistantMessage.tool_calls ?? [];

			if (toolCalls.length === 0) {
				const content = assistantMessage.content ?? "";
				const msg: AgentMessage = {
					id: nanoid(),
					role: "assistant",
					content,
					timestamp: Date.now(),
				};
				this.messages.push(msg);
				this.callbacks.onEvent({ type: "token", delta: content });
				this.callbacks.onEvent({ type: "done", messageId: msg.id });
				this.toolResultsBuffer = [];
				return;
			}

			const assistantToolMsg: AgentMessage = {
				id: nanoid(),
				role: "assistant",
				content: assistantMessage.content ?? "",
				timestamp: Date.now(),
				toolCalls: toolCalls.map((tc) => ({
					id: tc.id,
					name: tc.function.name as ToolName,
					args: JSON.parse(tc.function.arguments || "{}"),
				})),
			};
			this.messages.push(assistantToolMsg);

			const roundToolResults: OpenRouterMessage[] = [];

			for (const toolCall of toolCalls) {
				if (this.aborted) break;

				const name = toolCall.function.name as ToolName;
				const args = JSON.parse(toolCall.function.arguments || "{}") as Record<
					string,
					unknown
				>;

				this.callbacks.onEvent({ type: "tool_start", name, args });

				const result = await this.callbacks.executeTool(name, args);
				this.callbacks.onEvent({ type: "tool_end", name, result });

				if (result.pendingAction) {
					this.pendingAction = result.pendingAction;
					this.callbacks.onEvent({
						type: "pending_action",
						action: result.pendingAction,
					});
					return;
				}

				roundToolResults.push({
					role: "tool",
					tool_call_id: toolCall.id,
					name,
					content: JSON.stringify(result),
				});
			}

			this.toolResultsBuffer.push(...roundToolResults);
		}

		this.callbacks.onEvent({
			type: "error",
			message: "Agent reached max tool rounds",
		});
	}

	private buildOpenRouterMessages(followUp?: string): OpenRouterMessage[] {
		const context = this.callbacks.getContextJson();
		const messages: OpenRouterMessage[] = [
			{
				role: "system",
				content: `${AGENT_SYSTEM_PROMPT}\n\nCurrent project context:\n${context}`,
			},
		];

		for (const msg of this.messages) {
			if (msg.role === "user") {
				messages.push({ role: "user", content: msg.content });
			} else if (msg.role === "assistant") {
				if (msg.toolCalls && msg.toolCalls.length > 0) {
					messages.push({
						role: "assistant",
						content: msg.content || null,
						tool_calls: msg.toolCalls.map((tc) => ({
							id: (tc as { id?: string }).id ?? `call_${msg.id}_${tc.name}`,
							type: "function" as const,
							function: {
								name: tc.name,
								arguments: JSON.stringify(tc.args),
							},
						})),
					});
				} else {
					messages.push({ role: "assistant", content: msg.content });
				}
			}
		}

		messages.push(...this.toolResultsBuffer);

		if (followUp) {
			messages.push({ role: "user", content: followUp });
		}

		return messages;
	}

	private async callOpenRouter(messages: OpenRouterMessage[]): Promise<{
		choices?: Array<{
			message: {
				content?: string | null;
				tool_calls?: Array<{
					id: string;
					type: "function";
					function: { name: string; arguments: string };
				}>;
			};
		}>;
	}> {
		const response = await fetch("/api/agent/openrouter", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				model: this.settings.chatModel,
				messages,
				tools: TOOL_DEFINITIONS,
				tool_choice: "auto",
				stream: false,
			}),
		});

		if (!response.ok) {
			const text = await response.text();
			throw new Error(`OpenRouter error ${response.status}: ${text}`);
		}

		return response.json();
	}
}

export function wrapToolResultWithConfirm({
	name,
	args,
	result,
}: {
	name: ToolName;
	args: Record<string, unknown>;
	result: ToolResult;
}): ToolResult {
	if (args._skipConfirm) {
		return result;
	}

	const category = getToolCategory(name);
	if (category !== "batch_mutation") {
		return result;
	}

	const affectedRegions =
		(result.data as { regions?: unknown[] })?.regions?.length ??
		(result.data as { hits?: unknown[] })?.hits?.length ??
		(result.data as { count?: number })?.count ??
		0;

	const removedDurationSec =
		(result.data as { totalDurationSeconds?: number })?.totalDurationSeconds ?? 0;

	if (!requiresConfirm({ toolName: name, affectedRegions, removedDurationSec })) {
		return result;
	}

	const tools = [{ name, args }];
	const { affectedRegions: aggRegions, removedDurationSec: aggDuration } =
		aggregateBatchTools(tools);

	const pendingAction = buildPendingAction({
		id: nanoid(),
		tools,
		summary: `Confirm batch edit: ${name}`,
		details: [
			`${affectedRegions} regions affected`,
			`~${Math.round(removedDurationSec)}s to remove`,
		],
		affectedRegions: aggRegions || affectedRegions,
		removedDurationSec: aggDuration || removedDurationSec,
	});

	return {
		ok: true,
		requiresConfirm: true,
		pendingAction,
		data: result.data,
	};
}
