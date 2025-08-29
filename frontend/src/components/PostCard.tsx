import React from "react";
import type { GeneratedPost } from "../types";
import { motion } from "framer-motion";

interface PostCardProps {
	post: GeneratedPost;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
	return (
		<motion.div
			initial={{ opacity: 0, y: 20 }}
			animate={{ opacity: 1, y: 0 }}
			transition={{ duration: 0.3 }}
			className="relative bg-white/80 backdrop-blur-md p-6 rounded-2xl shadow-lg border border-gray-200 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300"
		>
			{/* Gradient Accent Bar */}
			<div className="absolute top-0 left-0 w-full h-1 rounded-t-2xl bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>

			{/* Project Title */}
			{post.github_project_name && (
				<h3 className="text-2xl font-bold text-gray-900 mb-3">
					{post.github_project_name}
				</h3>
			)}

			{/* Post Text */}
			<p className="text-gray-800 text-lg leading-relaxed whitespace-pre-wrap mb-4">
				{post.text}
			</p>

			{/* Hashtags */}
			{post.hashtags && post.hashtags.length > 0 && (
				<div className="mb-4 flex flex-wrap gap-2">
					{post.hashtags.map((tag, i) => (
						<span
							key={i}
							className="inline-block bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs px-3 py-1 rounded-full shadow-sm"
						>
							#{tag}
						</span>
					))}
				</div>
			)}

			{/* CTA */}
			{post.cta_suggestion && (
				<div className="mb-3">
					<span className="text-sm font-semibold text-gray-700">CTA:</span>{" "}
					<span className="italic text-gray-600">{post.cta_suggestion}</span>
				</div>
			)}

			{/* Token Info */}
			{post.token_info && (
				<div className="text-xs text-gray-500 mt-2">
					<span className="font-semibold">Tokens:</span> Prompt{" "}
					{post.token_info.prompt_tokens}, Completion{" "}
					{post.token_info.completion_tokens}
					{post.token_info.total_cost &&
						` • Cost: $${post.token_info.total_cost.toFixed(4)}`}
				</div>
			)}

			{/* Sources */}
			{post.sources && post.sources.length > 0 && (
				<div className="mt-4 text-sm text-gray-700">
					<p className="font-semibold mb-1">Sources:</p>
					<ul className="list-disc list-inside space-y-1">
						{post.sources.map((source, i) => (
							<li key={i}>
								<a
									href={source.link}
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-600 hover:text-purple-600 hover:underline transition-colors"
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
