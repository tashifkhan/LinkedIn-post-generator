import { useCallback, useState, useRef } from "react";
import "./index.css";
import { PostInputForm } from "./components/PostInputForm";
import { PostCard } from "./components/PostCard";
import { Loader } from "./components/Loader";
import { Toast } from "./components/Toast";
import type {
	PostGenerationRequest,
	GeneratedPost,
	StreamingEvent,
} from "./types";

const BASE_URL = process.env.BACKEND_URL || "http://localhost:8000/api";

function App() {
	const [isLoading, setIsLoading] = useState(false);
	const [events, setEvents] = useState<StreamingEvent[]>([]);
	const [posts, setPosts] = useState<GeneratedPost[]>([]);
	const [toastMessage, setToastMessage] = useState("");
	const [showToast, setShowToast] = useState(false);
	const abortRef = useRef<AbortController | null>(null);

	const showToastMessage = useCallback((message: string) => {
		setToastMessage(message);
		setShowToast(true);
	}, []);

	const pushEvent = useCallback((ev: StreamingEvent) => {
		setEvents((s) => [...s, ev]);
	}, []);

	const pushPost = useCallback((p: GeneratedPost) => {
		setPosts((s) => [...s, p]);
	}, []);

	const handleSubmit = async (data: PostGenerationRequest) => {
		setEvents([]);
		setPosts([]);
		setIsLoading(true);

		const controller = new AbortController();
		abortRef.current = controller;

		try {
			const res = await fetch(`${BASE_URL}/generate-posts-stream`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(data),
				signal: controller.signal,
			});

			if (!res.ok || !res.body) {
				const text = await res.text();
				pushEvent({
					type: "ERROR",
					message: `Server error: ${res.status} ${text}`,
				});
				setIsLoading(false);
				return;
			}

			const reader = res.body.getReader();
			const decoder = new TextDecoder();
			let buffer = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;
				buffer += decoder.decode(value, { stream: true });

				let parts = buffer.split("\n\n");
				buffer = parts.pop() || "";

				for (const part of parts) {
					const lines = part.split("\n").map((l) => l.trim());
					const dataLines = lines.filter((l) => l.startsWith("data:"));
					if (dataLines.length === 0) continue;
					const jsonText = dataLines
						.map((l) => l.replace(/^data:\s?/, ""))
						.join("\n");
					try {
						const parsed: StreamingEvent = JSON.parse(jsonText);
						pushEvent(parsed);
						if (parsed.type === "POST_GENERATED" && parsed.payload) {
							pushPost(parsed.payload as GeneratedPost);
						}
						if (parsed.type === "COMPLETE" || parsed.type === "ERROR") {
							setIsLoading(false);
							controller.abort();
							break;
						}
					} catch (e) {
						pushEvent({
							type: "ERROR",
							message: `Failed to parse event: ${e}`,
						});
					}
				}
			}

			setIsLoading(false);
		} catch (err: any) {
			if (err.name === "AbortError") {
				pushEvent({ type: "PROGRESS", message: "Stream aborted." });
			} else {
				pushEvent({ type: "ERROR", message: String(err) });
			}
			setIsLoading(false);
		} finally {
			abortRef.current = null;
		}
	};

	const handleCancel = () => {
		if (abortRef.current) abortRef.current.abort();
		setIsLoading(false);
	};

	return (
		<div className="min-h-screen">
			<header className="header-blur sticky top-0 z-20">
				<div className="app-container flex items-center justify-between py-3 sm:py-4">
					<h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight section-title">
						LinkedIn Post Generator
					</h1>
					<div className="hidden md:flex items-center gap-2 text-xs sm:text-sm text-[color:var(--text-secondary)]">
						<span>AI-powered</span>
						<span aria-hidden>•</span>
						<span>Mobile friendly</span>
					</div>
				</div>
			</header>

			<main className="app-container">
				<div className="grid grid-cols-1 xl:grid-cols-5 gap-6 lg:gap-8 py-6">
					{/* Left Panel - Form */}
					<div className="xl:col-span-2 sticky-panel">
						<PostInputForm onSubmit={handleSubmit} isLoading={isLoading} />
						{isLoading && (
							<button
								onClick={handleCancel}
								className="btn-primary w-full mt-4"
							>
								Cancel
							</button>
						)}
					</div>

					{/* Right Panel - Results */}
					<div className="xl:col-span-3 space-y-6 lg:space-y-8">
						<div className="card p-5 sm:p-6">
							<h2 className="text-lg sm:text-xl font-semibold mb-3 section-title">
								Generation Progress
							</h2>
							{isLoading && (
								<div className="mb-4">
									<Loader />
								</div>
							)}
							<div className="space-y-3">
								{events.map((ev, i) => (
									<div
										key={i}
										className="p-3 rounded-lg border border-[color:var(--card-border)] bg-[color:rgba(0,0,0,0.25)]"
									>
										<div className="font-medium text-[color:var(--accent)]">
											{ev.type}
										</div>
										{ev.message && (
											<div className="text-[color:var(--text-secondary)]">
												{ev.message}
											</div>
										)}
									</div>
								))}
							</div>
						</div>

						{/* Final Output Summary */}
						{posts.length > 0 && (
							<div className="card p-5 sm:p-6">
								<div className="flex items-center justify-between mb-4">
									<h2 className="text-lg sm:text-xl font-semibold section-title">
										Final Results ({posts.length} posts)
									</h2>
									<div className="flex gap-2">
										<button
											onClick={() => {
												const allText = posts
													.map(
														(p, i) =>
															`Post ${i + 1}:\n${p.text}\n\nHashtags: ${
																p.hashtags?.map((h) => `#${h}`).join(" ") ||
																"None"
															}\nCTA: ${p.cta_suggestion || "None"}\n\n---\n`
													)
													.join("\n");
												navigator.clipboard.writeText(allText);
												showToastMessage("All posts copied to clipboard!");
											}}
											className="btn-secondary text-sm"
										>
											Copy All
										</button>
										<button
											onClick={() => {
												const data = {
													generated_at: new Date().toISOString(),
													posts: posts,
													total_posts: posts.length,
												};
												const blob = new Blob([JSON.stringify(data, null, 2)], {
													type: "application/json",
												});
												const url = URL.createObjectURL(blob);
												const a = document.createElement("a");
												a.href = url;
												a.download = `linkedin-posts-${
													new Date().toISOString().split("T")[0]
												}.json`;
												a.click();
												URL.revokeObjectURL(url);
												showToastMessage("Posts exported as JSON!");
											}}
											className="btn-secondary text-sm"
										>
											Export JSON
										</button>
									</div>
								</div>
								<div className="text-sm text-[color:var(--text-secondary)] mb-4">
									Generation completed successfully. {posts.length} unique posts
									created.
								</div>
							</div>
						)}

						<div>
							<h2 className="text-lg sm:text-xl font-semibold mb-3 section-title">
								Generated Posts
							</h2>
							{posts.length === 0 && !isLoading && (
								<div className="card p-8 text-center">
									<div className="text-[color:var(--text-secondary)] mb-2">
										No posts generated yet
									</div>
									<div className="text-sm text-[color:var(--text-secondary)]">
										Fill out the form and click "Generate LinkedIn Posts" to get
										started
									</div>
								</div>
							)}
							<div className="grid grid-cols-1 gap-5 sm:gap-6">
								{posts.map((p, i) => (
									<PostCard
										key={i}
										post={p}
										onCopy={() =>
											showToastMessage(`Post ${i + 1} copied to clipboard!`)
										}
									/>
								))}
							</div>
						</div>
					</div>
				</div>
			</main>

			<Toast
				message={toastMessage}
				isVisible={showToast}
				onClose={() => setShowToast(false)}
				type="success"
			/>
		</div>
	);
}

export default App;
