import React from "react";
import type { GeneratedPost } from "../types";

interface PostCardProps {
	post: GeneratedPost;
}

export const PostCard: React.FC<PostCardProps> = ({ post }) => {
	return (
		<div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
			{post.github_project_name && (
				<h3 className="text-xl font-semibold text-blue-700 mb-2">
					Project: {post.github_project_name}
				</h3>
			)}
			<p className="text-gray-800 text-base leading-relaxed whitespace-pre-wrap mb-4">
				{post.text}
			</p>
			{post.hashtags && post.hashtags.length > 0 && (
				<div className="mb-2">
					<span className="font-semibold text-gray-700">Hashtags: </span>
					{post.hashtags.map((tag, i) => (
						<span
							key={i}
							className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full mr-2 mb-1"
						>
							#{tag}
						</span>
					))}
				</div>
			)}
			{post.cta_suggestion && (
				<p className="text-sm text-gray-600 italic mb-2">
					<span className="font-semibold">CTA:</span> {post.cta_suggestion}
				</p>
			)}
			{post.token_info && (
				<div className="text-xs text-gray-500">
					Tokens: Prompt {post.token_info.prompt_tokens}, Completion{" "}
					{post.token_info.completion_tokens}
					{post.token_info.total_cost &&
						`, Cost: $${post.token_info.total_cost.toFixed(4)}`}
				</div>
			)}
			{post.sources && post.sources.length > 0 && (
				<div className="mt-2 text-xs text-gray-600">
					<p className="font-semibold">Sources:</p>
					<ul className="list-disc list-inside pl-2">
						{post.sources.map((source, i) => (
							<li key={i}>
								<a
									href={source.link}
									target="_blank"
									rel="noopener noreferrer"
									className="text-blue-500 hover:underline"
								>
									{source.title}
								</a>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
};
