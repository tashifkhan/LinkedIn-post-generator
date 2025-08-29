import React from "react";
import type { GeneratedPost } from "../types";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";

interface PostCardProps {
	post: GeneratedPost;
	onCopy?: () => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onCopy }) => {
	const copyToClipboard = () => {
		const postText = `${post.text}\n\n${
			post.hashtags?.map((h) => `#${h}`).join(" ") || ""
		}\n\n${post.cta_suggestion || ""}`.trim();
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
			<div className="text-[color:var(--text-primary)] text-base sm:text-lg leading-relaxed mb-4 prose prose-invert max-w-none">
				<ReactMarkdown
					components={{
						p: ({ children }) => <p className="mb-3 last:mb-0">{children}</p>,
						strong: ({ children }) => (
							<strong className="font-semibold text-[color:var(--accent)]">
								{children}
							</strong>
						),
						em: ({ children }) => <em className="italic">{children}</em>,
						ul: ({ children }) => (
							<ul className="list-disc list-inside mb-3 space-y-1">
								{children}
							</ul>
						),
						ol: ({ children }) => (
							<ol className="list-decimal list-inside mb-3 space-y-1">
								{children}
							</ol>
						),
						li: ({ children }) => (
							<li className="text-[color:var(--text-primary)]">{children}</li>
						),
						h1: ({ children }) => (
							<h1 className="text-xl font-bold mb-2 text-[color:var(--accent)]">
								{children}
							</h1>
						),
						h2: ({ children }) => (
							<h2 className="text-lg font-semibold mb-2 text-[color:var(--accent)]">
								{children}
							</h2>
						),
						h3: ({ children }) => (
							<h3 className="text-base font-medium mb-2 text-[color:var(--accent)]">
								{children}
							</h3>
						),
						blockquote: ({ children }) => (
							<blockquote className="border-l-4 border-[color:var(--accent)] pl-4 italic text-[color:var(--text-secondary)] mb-3">
								{children}
							</blockquote>
						),
						code: ({ children }) => (
							<code className="bg-[color:rgba(255,255,255,0.1)] px-1 py-0.5 rounded text-sm font-mono">
								{children}
							</code>
						),
					}}
				>
					{post.text}
				</ReactMarkdown>
			</div>

			{/* Hashtags */}
			{post.hashtags && post.hashtags.length > 0 && (
				<div className="mb-4 flex flex-wrap gap-2">
					{post.hashtags.map((tag, i) => (
						<span key={i} className="tag">
							#{tag}
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
						{post.cta_suggestion}
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
