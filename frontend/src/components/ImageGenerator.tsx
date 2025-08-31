import React, { useCallback, useRef, useState } from "react";

interface ImageGenerationRequest {
	prompt: string;
	model?: string;
	style?: string;
	size?: "small" | "medium" | "large";
}

interface ImageGenerationResponse {
	success: boolean;
	image_data?: string;
	image_url?: string;
	error_message?: string;
	prompt_used: string;
	model_used: string;
	timestamp: string;
}

const BASE_URL =
	import.meta.env.VITE_BACKEND_URL || "http://localhost:8000/api";

const ImageGenerator: React.FC = () => {
	const [formData, setFormData] = useState<ImageGenerationRequest>({
		prompt: "",
		model: "gemini-2.5-flash-image-preview",
		style: "",
		size: "medium",
	});

	const [response, setResponse] = useState<ImageGenerationResponse | null>(
		null
	);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [toastMessage, setToastMessage] = useState("");
	const [showToast, setShowToast] = useState(false);

	const abortRef = useRef<AbortController | null>(null);

	const showLocalToast = useCallback((msg: string) => {
		setToastMessage(msg);
		setShowToast(true);
		window.setTimeout(() => setShowToast(false), 3000);
	}, []);

	const handleInputChange = (
		e: React.ChangeEvent<
			HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
		>
	) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setLoading(true);
		setError(null);
		setResponse(null);

		const controller = new AbortController();
		abortRef.current = controller;

		try {
			const apiResponse = await fetch(`${BASE_URL}/generate-image`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(formData),
				signal: controller.signal,
			});

			if (!apiResponse.ok) {
				const text = await apiResponse.text();
				throw new Error(`HTTP ${apiResponse.status}: ${text}`);
			}

			const data: ImageGenerationResponse = await apiResponse.json();
			setResponse(data);

			if (!data.success) {
				setError(data.error_message || "Failed to generate image");
			} else {
				showLocalToast("Image generated");
			}
		} catch (err: any) {
			if (err.name === "AbortError") {
				setError("Image generation aborted.");
			} else {
				setError(err instanceof Error ? err.message : String(err));
			}
		} finally {
			setLoading(false);
			abortRef.current = null;
		}
	};

	const handleCancel = () => {
		if (abortRef.current) abortRef.current.abort();
		setLoading(false);
	};

	const downloadImage = (base64: string) => {
		const link = document.createElement("a");
		link.href = `data:image/png;base64,${base64}`;
		link.download = `generated-image-${Date.now()}.png`;
		link.click();
		showLocalToast("Image downloaded");
	};

	const copyImageDataUrl = async (base64: string) => {
		const dataUrl = `data:image/png;base64,${base64}`;
		try {
			await navigator.clipboard.writeText(dataUrl);
			showLocalToast("Image data URL copied to clipboard");
		} catch (e) {
			showLocalToast("Copy failed");
		}
	};

	return (
		<div className="card p-5 sm:p-6">
			<div className="flex items-center justify-between mb-4">
				<h2 className="text-lg sm:text-xl font-semibold section-title">
					Image Generator
				</h2>
				{loading && (
					<div className="text-sm text-[color:var(--text-secondary)]">
						Generating…
					</div>
				)}
			</div>

			<form onSubmit={handleSubmit} className="space-y-5">
				<div>
					<label className="block text-sm font-medium mb-2 text-[color:var(--text-secondary)]">
						Image Description *
					</label>
					<textarea
						id="prompt"
						name="prompt"
						value={formData.prompt}
						onChange={handleInputChange}
						required
						rows={3}
						className="w-full px-3 py-2 rounded-md border border-[color:var(--card-border)] bg-[color:var(--bg-subtle)] focus:outline-none"
						placeholder="Describe the image you want to generate..."
					/>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label className="block text-sm font-medium mb-2 text-[color:var(--text-secondary)]">
							AI Model
						</label>
						<select
							id="model"
							name="model"
							value={formData.model}
							onChange={handleInputChange}
							className="w-full px-3 py-2 rounded-md border border-[color:var(--card-border)] bg-[color:var(--bg-subtle)] focus:outline-none"
						>
							<option value="gemini-2.5-flash-image-preview">
								Gemini 2.5 Flash
							</option>
						</select>
					</div>

					<div>
						<label className="block text-sm font-medium mb-2 text-[color:var(--text-secondary)]">
							Style (optional)
						</label>
						<input
							type="text"
							id="style"
							name="style"
							value={formData.style}
							onChange={handleInputChange}
							className="w-full px-3 py-2 rounded-md border border-[color:var(--card-border)] bg-[color:var(--bg-subtle)] focus:outline-none"
							placeholder="e.g., cyberpunk, watercolor, realistic"
						/>
					</div>

					<div>
						<label className="block text-sm font-medium mb-2 text-[color:var(--text-secondary)]">
							Size
						</label>
						<select
							id="size"
							name="size"
							value={formData.size}
							onChange={handleInputChange}
							className="w-full px-3 py-2 rounded-md border border-[color:var(--card-border)] bg-[color:var(--bg-subtle)] focus:outline-none"
						>
							<option value="small">Small</option>
							<option value="medium">Medium</option>
							<option value="large">Large</option>
						</select>
					</div>
				</div>

				<div className="flex gap-2">
					<button
						type="submit"
						disabled={loading || !formData.prompt.trim()}
						className={`btn-primary w-full ${
							loading ? "opacity-50 cursor-not-allowed" : ""
						}`}
					>
						{loading ? "Generating Image..." : "Generate Image"}
					</button>
					{loading && (
						<button
							type="button"
							onClick={handleCancel}
							className="btn-secondary"
						>
							Cancel
						</button>
					)}
				</div>
			</form>

			{error && (
				<div className="mt-4 p-3 rounded-md border border-[color:var(--card-border)] bg-[color:rgba(255,0,0,0.03)] text-sm text-red-600">
					{error}
				</div>
			)}

			{response && response.success && response.image_data && (
				<div className="mt-6 space-y-4">
					<div className="card p-4">
						<div className="flex items-center justify-between mb-2">
							<div>
								<div className="font-medium text-[color:var(--accent)]">
									Generated Image
								</div>
								<div className="text-sm text-[color:var(--text-secondary)]">
									Prompt: {response.prompt_used}
								</div>
								<div className="text-sm text-[color:var(--text-secondary)]">
									Model: {response.model_used}
								</div>
							</div>
							<div className="text-sm text-[color:var(--text-secondary)]">
								{new Date(response.timestamp).toLocaleString()}
							</div>
						</div>
					</div>

					<div className="flex justify-center">
						<img
							src={`data:image/png;base64,${response.image_data}`}
							alt="Generated"
							className="max-w-full h-auto rounded-lg shadow-lg"
							style={{ maxHeight: 600 }}
						/>
					</div>

					<div className="flex gap-2">
						<button
							onClick={() => downloadImage(response.image_data!)}
							className="btn-secondary"
						>
							Download
						</button>
						<button
							onClick={() => copyImageDataUrl(response.image_data!)}
							className="btn-secondary"
						>
							Copy Data URL
						</button>
					</div>
				</div>
			)}

			{showToast && (
				<div className="fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg bg-green-600 text-white max-w-sm">
					<div className="flex items-center justify-between">
						<span className="text-sm font-medium">{toastMessage}</span>
						<button
							onClick={() => setShowToast(false)}
							className="ml-3 text-white hover:text-gray-200 text-lg leading-none"
						>
							×
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default ImageGenerator;
