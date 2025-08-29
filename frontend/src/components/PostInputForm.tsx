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
		<form
			onSubmit={handleSubmit}
			className="space-y-6 bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-md border border-white/10"
		>
			<div>
				<label
					htmlFor="topic"
					className="block text-sm font-medium text-gray-200"
				>
					Topic (Required):
				</label>
				<input
					type="text"
					id="topic"
					value={topic}
					onChange={(e) => setTopic(e.target.value)}
					required
					className="mt-1 block w-full border border-white/20 rounded-lg shadow-sm p-2 bg-black/30 text-gray-100 focus:ring-cyan-400 focus:border-cyan-400"
				/>
			</div>

			{/* Grid Inputs */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
				{/* Tone */}
				<div>
					<label
						htmlFor="tone"
						className="block text-sm font-medium text-gray-200"
					>
						Tone:
					</label>
					<select
						id="tone"
						value={tone}
						onChange={(e) => setTone(e.target.value)}
						className="mt-1 block w-full border border-white/20 rounded-lg shadow-sm p-2 bg-black/30 text-gray-100 focus:ring-cyan-400 focus:border-cyan-400"
					>
						<option>Professional</option>
						<option>Casual</option>
						<option>Enthusiastic</option>
						<option>Informative</option>
						<option>Persuasive</option>
						<option>Any</option>
					</select>
				</div>

				{/* Length */}
				<div>
					<label
						htmlFor="length"
						className="block text-sm font-medium text-gray-200"
					>
						Length:
					</label>
					<select
						id="length"
						value={length}
						onChange={(e) =>
							setLength(e.target.value as PostGenerationRequest["length"])
						}
						className="mt-1 block w-full border border-white/20 rounded-lg shadow-sm p-2 bg-black/30 text-gray-100 focus:ring-cyan-400 focus:border-cyan-400"
					>
						<option>Short</option>
						<option>Medium</option>
						<option>Long</option>
						<option>Any</option>
					</select>
				</div>

				{/* Post Count */}
				<div>
					<label
						htmlFor="postCount"
						className="block text-sm font-medium text-gray-200"
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
						className="mt-1 block w-full border border-white/20 rounded-lg shadow-sm p-2 bg-black/30 text-gray-100 focus:ring-cyan-400 focus:border-cyan-400"
					/>
				</div>

				{/* Hashtags */}
				<div>
					<label
						htmlFor="hashtagsOption"
						className="block text-sm font-medium text-gray-200"
					>
						Hashtags:
					</label>
					<select
						id="hashtagsOption"
						value={hashtagsOption}
						onChange={(e) =>
							setHashtagsOption(e.target.value as "suggest" | "none")
						}
						className="mt-1 block w-full border border-white/20 rounded-lg shadow-sm p-2 bg-black/30 text-gray-100 focus:ring-cyan-400 focus:border-cyan-400"
					>
						<option value="suggest">Suggest based on topic</option>
						<option value="none">No hashtags</option>
					</select>
				</div>

				{/* Language */}
				<div>
					<label
						htmlFor="language"
						className="block text-sm font-medium text-gray-200"
					>
						Language:
					</label>
					<select
						id="language"
						value={language}
						onChange={(e) => setLanguage(e.target.value)}
						className="mt-1 block w-full border border-white/20 rounded-lg shadow-sm p-2 bg-black/30 text-gray-100 focus:ring-cyan-400 focus:border-cyan-400"
					>
						<option>English</option>
						<option>Spanish</option>
						<option>French</option>
					</select>
				</div>

				{/* Emoji Level */}
				<div className="md:col-span-full lg:col-span-1">
					<label
						htmlFor="emojiLevel"
						className="block text-sm font-medium text-gray-200"
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
						className="mt-1 w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
					/>
				</div>
			</div>

			{/* Audience */}
			<div>
				<label
					htmlFor="audience"
					className="block text-sm font-medium text-gray-200"
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
								className="focus:ring-cyan-400 h-4 w-4 text-cyan-600 border-white/20 rounded"
							/>
							<label
								htmlFor={`audience-${aud}`}
								className="ml-2 text-sm text-gray-200"
							>
								{aud}
							</label>
						</div>
					))}
				</div>
			</div>

			{/* CTA */}
			<div>
				<label
					htmlFor="ctaText"
					className="block text-sm font-medium text-gray-200"
				>
					Custom Call to Action (Optional):
				</label>
				<input
					type="text"
					id="ctaText"
					value={ctaText}
					onChange={(e) => setCtaText(e.target.value)}
					placeholder="e.g., Learn more on our website!"
					className="mt-1 block w-full border border-white/20 rounded-lg shadow-sm p-2 bg-black/30 text-gray-100 focus:ring-cyan-400 focus:border-cyan-400"
				/>
			</div>

			{/* GitHub URL */}
			<div>
				<label
					htmlFor="githubProjectUrl"
					className="block text-sm font-medium text-gray-200"
				>
					GitHub Project URL (Optional):
				</label>
				<input
					type="url"
					id="githubProjectUrl"
					value={githubProjectUrl}
					onChange={(e) => setGithubProjectUrl(e.target.value)}
					placeholder="https://github.com/username/my-awesome-project"
					className="mt-1 block w-full border border-white/20 rounded-lg shadow-sm p-2 bg-black/30 text-gray-100 focus:ring-cyan-400 focus:border-cyan-400"
				/>
			</div>

			{/* Mimic Examples */}
			<div>
				<label
					htmlFor="mimicExamples"
					className="block text-sm font-medium text-gray-200"
				>
					Examples to Mimic (Optional):
				</label>
				<textarea
					id="mimicExamples"
					value={mimicExamples}
					onChange={(e) => setMimicExamples(e.target.value)}
					rows={4}
					placeholder="Paste example text here..."
					className="mt-1 block w-full border border-white/20 rounded-lg shadow-sm p-2 bg-black/30 text-gray-100 focus:ring-cyan-400 focus:border-cyan-400"
				></textarea>
			</div>

			{/* Submit */}
			<button
				type="submit"
				disabled={isLoading || !topic.trim()}
				className={`w-full py-3 px-4 rounded-lg text-lg font-semibold text-white shadow-md transition-all duration-300 ${
					isLoading || !topic.trim()
						? "bg-cyan-700/50 cursor-not-allowed"
						: "bg-gradient-to-r from-cyan-400 via-teal-500 to-blue-600 hover:shadow-lg hover:scale-[1.02]"
				}`}
			>
				{isLoading ? "Generating..." : "Generate LinkedIn Posts"}
			</button>
		</form>
	);
};
