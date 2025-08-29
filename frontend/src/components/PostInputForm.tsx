import React, { useState } from "react";
import type { PostGenerationRequest } from "../types";

interface PostInputFormProps {
	onSubmit: (data: PostGenerationRequest) => void;
	isLoading: boolean;
}

export const PostInputForm: React.FC<PostInputFormProps> = ({
	onSubmit,
	isLoading,
}) => {
	const [topic, setTopic] = useState<string>("");
	const [tone, setTone] = useState<string>("Professional");
	const [audience, setAudience] = useState<string[]>([]);
	const [length, setLength] =
		useState<PostGenerationRequest["length"]>("Medium");
	const [hashtagsOption, setHashtagsOption] = useState<"suggest" | "none">(
		"suggest"
	);
	const [ctaText, setCtaText] = useState<string>("");
	const [mimicExamples, setMimicExamples] = useState<string>("");
	const [language, setLanguage] = useState<string>("English");
	const [postCount, setPostCount] = useState<number>(3);
	const [emojiLevel, setEmojiLevel] = useState<number>(1);
	const [githubProjectUrl, setGithubProjectUrl] = useState<string>("");

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const requestData: PostGenerationRequest = {
			topic,
			tone: tone === "Any" ? undefined : tone,
			audience: audience.length ? audience : undefined,
			length: length === "Any" ? undefined : length,
			hashtags_option: hashtagsOption,
			cta_text: ctaText || undefined,
			mimic_examples: mimicExamples || undefined,
			language,
			post_count: postCount,
			emoji_level: emojiLevel,
			github_project_url: githubProjectUrl || undefined,
		};
		onSubmit(requestData);
	};

	const emojiLevelLabels: { [key: number]: string } = {
		0: "None",
		1: "Few",
		2: "Moderate",
		3: "Many",
	};

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			<div>
				<label
					htmlFor="topic"
					className="block text-sm font-medium text-gray-700"
				>
					Topic (Required):
				</label>
				<input
					type="text"
					id="topic"
					value={topic}
					onChange={(e) => setTopic(e.target.value)}
					required
					className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>

			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				<div>
					<label
						htmlFor="tone"
						className="block text-sm font-medium text-gray-700"
					>
						Tone:
					</label>
					<select
						id="tone"
						value={tone}
						onChange={(e) => setTone(e.target.value)}
						className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option>Professional</option>
						<option>Casual</option>
						<option>Enthusiastic</option>
						<option>Informative</option>
						<option>Persuasive</option>
						<option>Any</option>
					</select>
				</div>

				<div>
					<label
						htmlFor="length"
						className="block text-sm font-medium text-gray-700"
					>
						Length:
					</label>
					<select
						id="length"
						value={length}
						onChange={(e) =>
							setLength(e.target.value as PostGenerationRequest["length"])
						}
						className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option>Short</option>
						<option>Medium</option>
						<option>Long</option>
						<option>Any</option>
					</select>
				</div>

				<div>
					<label
						htmlFor="postCount"
						className="block text-sm font-medium text-gray-700"
					>
						Number of Posts:
					</label>
					<input
						type="number"
						id="postCount"
						value={postCount}
						onChange={(e) =>
							setPostCount(Math.max(1, parseInt(e.target.value, 10) || 1))
						}
						min="1"
						max="5"
						className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
					/>
				</div>

				<div>
					<label
						htmlFor="hashtagsOption"
						className="block text-sm font-medium text-gray-700"
					>
						Hashtags:
					</label>
					<select
						id="hashtagsOption"
						value={hashtagsOption}
						onChange={(e) =>
							setHashtagsOption(e.target.value as "suggest" | "none")
						}
						className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option value="suggest">Suggest based on topic</option>
						<option value="none">No hashtags</option>
					</select>
				</div>

				<div>
					<label
						htmlFor="language"
						className="block text-sm font-medium text-gray-700"
					>
						Language:
					</label>
					<select
						id="language"
						value={language}
						onChange={(e) => setLanguage(e.target.value)}
						className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
					>
						<option>English</option>
						<option>Spanish</option>
						<option>French</option>
					</select>
				</div>

				<div className="md:col-span-full lg:col-span-1">
					<label
						htmlFor="emojiLevel"
						className="block text-sm font-medium text-gray-700"
					>
						Emojis:{" "}
						<span className="font-semibold">
							{emojiLevelLabels[emojiLevel]}
						</span>
					</label>
					<input
						type="range"
						id="emojiLevel"
						min="0"
						max="3"
						step="1"
						value={emojiLevel}
						onChange={(e) => setEmojiLevel(parseInt(e.target.value, 10))}
						className="mt-1 w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer range-lg dark:bg-gray-700"
					/>
					<div className="flex justify-between text-xs text-gray-500 mt-1">
						<span>None</span>
						<span>Few</span>
						<span>Moderate</span>
						<span>Many</span>
					</div>
				</div>
			</div>

			<div>
				<label
					htmlFor="audience"
					className="block text-sm font-medium text-gray-700"
				>
					Audience (select all that apply):
				</label>
				<div className="mt-1 grid grid-cols-2 sm:grid-cols-3 gap-2">
					{[
						"Founders",
						"Engineers",
						"Marketing Pros",
						"Students",
						"Recruiters",
						"HR Managers",
					].map((aud) => (
						<div key={aud} className="flex items-center">
							<input
								type="checkbox"
								id={`audience-${aud}`}
								value={aud}
								checked={audience.includes(aud)}
								onChange={(e) => {
									if (e.target.checked) {
										setAudience([...audience, aud]);
									} else {
										setAudience(audience.filter((a) => a !== aud));
									}
								}}
								className="focus:ring-blue-500 h-4 w-4 text-blue-600 border-gray-300 rounded"
							/>
							<label
								htmlFor={`audience-${aud}`}
								className="ml-2 text-sm text-gray-700"
							>
								{aud}
							</label>
						</div>
					))}
				</div>
			</div>

			<div>
				<label
					htmlFor="ctaText"
					className="block text-sm font-medium text-gray-700"
				>
					Custom Call to Action (Optional):
				</label>
				<input
					type="text"
					id="ctaText"
					value={ctaText}
					onChange={(e) => setCtaText(e.target.value)}
					placeholder="e.g., 'Learn more on our website!'"
					className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>

			<div>
				<label
					htmlFor="githubProjectUrl"
					className="block text-sm font-medium text-gray-700"
				>
					GitHub Project URL (Optional - if posting about your project):
				</label>
				<input
					type="url"
					id="githubProjectUrl"
					value={githubProjectUrl}
					onChange={(e) => setGithubProjectUrl(e.target.value)}
					placeholder="e.g., https://github.com/username/my-awesome-project"
					className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
				/>
			</div>

			<div>
				<label
					htmlFor="mimicExamples"
					className="block text-sm font-medium text-gray-700"
				>
					Examples to Mimic (Optional, paste a few sentences or a full post for
					style analysis):
				</label>
				<textarea
					id="mimicExamples"
					value={mimicExamples}
					onChange={(e) => setMimicExamples(e.target.value)}
					rows={4}
					placeholder="e.g., 'I really like the engaging tone of this post: [Paste example here]'"
					className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 focus:ring-blue-500 focus:border-blue-500"
				></textarea>
			</div>

			<button
				type="submit"
				disabled={isLoading || !topic.trim()}
				className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-lg font-medium text-white ${
					isLoading || !topic.trim()
						? "bg-blue-400 cursor-not-allowed"
						: "bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
				}`}
			>
				{isLoading ? "Generating..." : "Generate LinkedIn Posts"}
			</button>
		</form>
	);
};
