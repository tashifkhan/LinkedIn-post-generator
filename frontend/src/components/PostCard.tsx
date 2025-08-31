import React, { useCallback, useState } from "react";
import type { GeneratedPost } from "../types";
import { motion } from "framer-motion";

interface PostCardProps {
	post: GeneratedPost;
	onCopy?: () => void;
	onUpdate?: (p: GeneratedPost) => void;
}

export const PostCard: React.FC<PostCardProps> = ({
	post,
	onCopy,
	onUpdate,
}) => {
	const BASE_URL =
		import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api";

	const [isEditing, setIsEditing] = useState(false);
	const [editedText, setEditedText] = useState(post.text);
	const [editedHashtags, setEditedHashtags] = useState(
		(post.hashtags || []).join(", ")
	);
	const [editedCTA, setEditedCTA] = useState(post.cta_suggestion || "");
	const [saving, setSaving] = useState(false);
	const [localToast, setLocalToast] = useState("");

	const showLocalToast = useCallback((msg: string) => {
		setLocalToast(msg);
		setTimeout(() => setLocalToast(""), 2500);
	}, []);

	// Apply local save (no backend) — updates parent via onUpdate
	const saveEdit = async () => {
		setSaving(true);
		try {
			const payload: GeneratedPost = {
				...post,
				text: editedText,
				hashtags: editedHashtags
					.split(",")
					.map((s) => s.trim())
					.filter(Boolean),
				cta_suggestion: editedCTA,
			};

			// Notify parent immediately (local edit)
			onUpdate?.(payload);
			setIsEditing(false);
			showLocalToast("Post updated locally");
			setEditedText(payload.text);
			setEditedHashtags((payload.hashtags || []).join(", "));
			setEditedCTA(payload.cta_suggestion || "");
		} catch (e: any) {
			showLocalToast(e?.message || "Save failed");
		} finally {
			setSaving(false);
		}
	};

	// Call backend LLM to edit the post according to an instruction
	const [llmInstruction, setLlmInstruction] = useState("");
	const [llmRunning, setLlmRunning] = useState(false);

	const runLlmEdit = async () => {
		if (!llmInstruction.trim()) return showLocalToast("Provide an instruction");
		setLlmRunning(true);
		try {
			const res = await fetch(`${BASE_URL}/edit-post-llm`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					post: {
						...post,
						text: editedText,
						hashtags: editedHashtags
							.split(",")
							.map((s) => s.trim())
							.filter(Boolean),
						cta_suggestion: editedCTA,
					},
					instruction: llmInstruction,
				}),
			});
			if (!res.ok) {
				const t = await res.text();
				throw new Error(t || "LLM edit failed");
			}
			const updated: GeneratedPost = await res.json();
			// apply updated result
			onUpdate?.(updated);
			setEditedText(updated.text);
			setEditedHashtags((updated.hashtags || []).join(", "));
			setEditedCTA(updated.cta_suggestion || "");
			setIsEditing(false);
			showLocalToast("LLM edit applied");
		} catch (e: any) {
			showLocalToast(e?.message || "LLM edit failed");
		} finally {
			setLlmRunning(false);
		}
	};
	const stripMarkdown = (text: string) => {
		if (!text) return text;
		return text
			.replace(/\*\*(.+?)\*\*/g, "$1") // Remove **bold**
			.replace(/\*(.+?)\*/g, "$1") // Remove *italic*
			.replace(/_(.+?)_/g, "$1") // Remove _italic_
			.replace(/`(.+?)`/g, "$1") // Remove `code`
			.replace(/#{1,6}\s*/g, "") // Remove headers
			.replace(/\*+/g, "") // Remove remaining asterisks
			.trim();
	};

	const cleanHashtag = (tag: string) => {
		if (!tag) return tag;
		return tag
			.replace(/```json/g, "") // Remove ```json
			.replace(/```/g, "") // Remove ```
			.replace(/['"]/g, "") // Remove quotes
			.replace(/[#]/g, "") // Remove # symbols
			.replace(/\[|\]/g, "") // Remove brackets
			.trim();
	};

	const copyToClipboard = () => {
		const postText = `${stripMarkdown(post.text)}\n\n${
			post.hashtags?.map((h) => `#${cleanHashtag(h)}`).join(" ") || ""
		}\n\n${stripMarkdown(post.cta_suggestion || "")}`.trim();
		navigator.clipboard.writeText(postText);
		onCopy?.();
	};

	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className="relative card p-5 sm:p-6 hover:-translate-y-1 transition-all duration-300"
		>
			{/* Accent Bar */}
			<div className="absolute top-0 left-0 w-full h-1 rounded-t-[16px] bg-[color:var(--accent)]"></div>

			{/* Header with Project Title, Copy and Edit Buttons */}
			<div className="flex items-start justify-between mb-3">
				{post.github_project_name && (
					<h3 className="text-xl sm:text-2xl font-bold text-[color:var(--accent)]">
						{post.github_project_name}
					</h3>
				)}
				<div className="flex gap-2 ml-auto">
					<button
						onClick={copyToClipboard}
						className="btn-secondary text-xs px-3 py-1"
						title="Copy post to clipboard"
					>
						Copy
					</button>
					{!isEditing ? (
						<button
							onClick={() => setIsEditing(true)}
							className="btn-secondary text-xs px-3 py-1"
						>
							Edit
						</button>
					) : (
						<button
							onClick={() => {
								setIsEditing(false);
								setEditedText(post.text);
								setEditedHashtags((post.hashtags || []).join(", "));
								setEditedCTA(post.cta_suggestion || "");
							}}
							className="btn-secondary text-xs px-3 py-1"
						>
							Cancel
						</button>
					)}
				</div>
			</div>

			{/* Post Text or Edit Form */}
			{!isEditing ? (
				<p className="text-[color:var(--text-primary)] text-base sm:text-lg leading-relaxed whitespace-pre-wrap mb-4">
					{stripMarkdown(editedText || post.text)}
				</p>
			) : (
				<div className="mb-4">
					<textarea
						value={editedText}
						onChange={(e) => setEditedText(e.target.value)}
						rows={6}
						className="w-full p-3 rounded-md border border-[color:var(--card-border)] bg-[color:var(--bg-subtle)]"
					/>
					<input
						value={editedHashtags}
						onChange={(e) => setEditedHashtags(e.target.value)}
						className="w-full mt-2 p-2 rounded-md border border-[color:var(--card-border)]"
						placeholder="comma-separated hashtags"
					/>
					<input
						value={editedCTA}
						onChange={(e) => setEditedCTA(e.target.value)}
						className="w-full mt-2 p-2 rounded-md border border-[color:var(--card-border)]"
						placeholder="CTA suggestion"
					/>
					<div className="flex gap-2 mt-2">
						<button
							onClick={saveEdit}
							disabled={saving}
							className="btn-primary text-sm"
						>
							{saving ? "Saving..." : "Save"}
						</button>
						<button
							onClick={() => {
								setIsEditing(false);
							}}
							className="btn-secondary text-sm"
						>
							Close
						</button>
					</div>
					{localToast && (
						<div className="text-sm text-[color:var(--text-secondary)] mt-2">
							{localToast}
						</div>
					)}
					{/* LLM Edit UI */}
					<div className="mt-3">
						<label className="text-sm text-[color:var(--text-secondary)]">
							Edit with LLM
						</label>
						<div className="flex gap-2 mt-2">
							<input
								value={llmInstruction}
								onChange={(e) => setLlmInstruction(e.target.value)}
								placeholder="Instruction for LLM (e.g. make punchier, shorten)"
								className="flex-1 p-2 rounded-md border border-[color:var(--card-border)]"
							/>
							<button
								onClick={runLlmEdit}
								disabled={llmRunning}
								className="btn-secondary"
							>
								{llmRunning ? "Running…" : "Run"}
							</button>
						</div>
					</div>
				</div>
			)}

			{/* Hashtags */}
			{post.hashtags && post.hashtags.length > 0 && (
				<div className="mb-4 flex flex-wrap gap-2">
					{post.hashtags.map((tag, i) => (
						<span key={i} className="tag">
							#{cleanHashtag(tag)}
						</span>
					))}
				</div>
			)}

			{/* CTA */}
			{post.cta_suggestion && (
				<div className="mb-3">
					<span className="text-sm font-semibold text-[color:var(--accent)]">
						CTA:
					</span>{" "}
					<span className="italic text-[color:var(--text-secondary)]">
						{stripMarkdown(post.cta_suggestion)}
					</span>
				</div>
			)}

			{/* Token Info */}
			{post.token_info && (
				<div className="text-xs text-[color:var(--text-secondary)] mt-2">
					<span className="font-semibold">Tokens:</span> Prompt{" "}
					{post.token_info.prompt_tokens}, Completion{" "}
					{post.token_info.completion_tokens}
					{post.token_info.total_cost &&
						` • Cost: $${post.token_info.total_cost.toFixed(4)}`}
				</div>
			)}

			{/* Sources */}
			{post.sources && post.sources.length > 0 && (
				<div className="mt-4 text-sm text-[color:var(--text-secondary)]">
					<p className="font-semibold mb-1 text-[color:var(--accent)]">
						Sources:
					</p>
					<ul className="list-disc list-inside space-y-1">
						{post.sources.map((source, i) => (
							<li key={i}>
								<a
									href={source.link}
									target="_blank"
									rel="noopener noreferrer"
									className="text-[color:var(--accent)] hover:underline"
								>
									{source.title}
								</a>
							</li>
						))}
					</ul>
				</div>
			)}
		</motion.div>
	);
};
