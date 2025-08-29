import { useCallback, useState, useRef } from "react";
import "./index.css";
import { PostInputForm } from "./components/PostInputForm";
import { PostCard } from "./components/PostCard";
import { Loader } from "./components/Loader";
import type {
	PostGenerationRequest,
	GeneratedPost,
	StreamingEvent,
} from "./types";

function App() {
	const [isLoading, setIsLoading] = useState(false);
	const [events, setEvents] = useState<StreamingEvent[]>([]);
	const [posts, setPosts] = useState<GeneratedPost[]>([]);
	const abortRef = useRef<AbortController | null>(null);

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
			const res = await fetch("/api/generate-posts-stream", {
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
			<div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-950 to-black text-gray-100 p-6">
				<div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">
					{/* Left Panel */}
					<div className="lg:col-span-1">
						<h1 className="text-3xl font-extrabold mb-6 text-cyan-300">
							LinkedIn Post Generator
						</h1>
						<PostInputForm onSubmit={handleSubmit} isLoading={isLoading} />
						{isLoading && (
							<button
								onClick={handleCancel}
								className="mt-4 w-full bg-red-500 hover:bg-red-600 text-white py-2 rounded-lg shadow-md transition-all"
							>
								Cancel
							</button>
						)}
					</div>

					{/* Right Panel */}
					<div className="lg:col-span-2 space-y-8">
						<div className="bg-white/10 backdrop-blur-md p-6 rounded-2xl shadow-md border border-white/10">
							<h2 className="text-xl font-semibold mb-3 text-cyan-300">
								Generation Progress
							</h2>
							{isLoading && <Loader />}
							<div className="space-y-3">
								{events.map((ev, i) => (
									<div
										key={i}
										className="p-3 bg-black/30 rounded-lg shadow-sm text-sm border border-white/10"
									>
										<div className="font-medium text-cyan-400">{ev.type}</div>
										{ev.message && (
											<div className="text-gray-300">{ev.message}</div>
										)}
									</div>
								))}
							</div>
						</div>

						<div>
							<h2 className="text-xl font-semibold mb-3 text-cyan-300">
								Generated Posts
							</h2>
							<div className="grid grid-cols-1 gap-6">
								{posts.map((p, i) => (
									<PostCard key={i} post={p} />
								))}
							</div>
						</div>
					</div>
				</div>
			</div>
		);
}

export default App;
