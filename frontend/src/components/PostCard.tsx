import React from "react";
import type { GeneratedPost } from "../types";
import { motion } from "framer-motion";

interface PostCardProps {
	post: GeneratedPost;
	onCopy?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onCopy }) => {
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

			{/* Header with Project Title and Copy Button */}
			<div className="flex items-start justify-between mb-3">
				{post.github_project_name && (
					<h3 className="text-xl sm:text-2xl font-bold text-[color:var(--accent)]">
						{post.github_project_name}
					</h3>
				)}
				<button
					onClick={copyToClipboard}
					className="btn-secondary text-xs px-3 py-1 ml-auto"
					title="Copy post to clipboard"
				>
					Copy
				</button>
			</div>

			{/* Post Text */}
			<p className="text-[color:var(--text-primary)] text-base sm:text-lg leading-relaxed whitespace-pre-wrap mb-4">
				{stripMarkdown(post.text)}
			</p>

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
