import React, { useState } from "react";

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

		try {
			const apiResponse = await fetch("/api/generate-image", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify(formData),
			});

			if (!apiResponse.ok) {
				throw new Error(`HTTP error! status: ${apiResponse.status}`);
			}

			const data: ImageGenerationResponse = await apiResponse.json();
			setResponse(data);

			if (!data.success) {
				setError(data.error_message || "Failed to generate image");
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "An error occurred");
		} finally {
			setLoading(false);
		}
	};

	return (
		<div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
			<h2 className="text-3xl font-bold text-gray-800 mb-6">
				AI Image Generator
			</h2>

			<form onSubmit={handleSubmit} className="space-y-6 mb-8">
				<div>
					<label
						htmlFor="prompt"
						className="block text-sm font-medium text-gray-700 mb-2"
					>
						Image Description *
					</label>
					<textarea
						id="prompt"
						name="prompt"
						value={formData.prompt}
						onChange={handleInputChange}
						required
						rows={3}
						className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						placeholder="Describe the image you want to generate... (e.g., 'A beautiful sunset over mountains')"
					/>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					<div>
						<label
							htmlFor="model"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							AI Model
						</label>
						<select
							id="model"
							name="model"
							value={formData.model}
							onChange={handleInputChange}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="gemini-2.5-flash-image-preview">
								Gemini 2.5 Flash
							</option>
						</select>
					</div>

					<div>
						<label
							htmlFor="style"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Style (Optional)
						</label>
						<input
							type="text"
							id="style"
							name="style"
							value={formData.style}
							onChange={handleInputChange}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
							placeholder="e.g., cyberpunk, watercolor, realistic"
						/>
					</div>

					<div>
						<label
							htmlFor="size"
							className="block text-sm font-medium text-gray-700 mb-2"
						>
							Size
						</label>
						<select
							id="size"
							name="size"
							value={formData.size}
							onChange={handleInputChange}
							className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
						>
							<option value="small">Small</option>
							<option value="medium">Medium</option>
							<option value="large">Large</option>
						</select>
					</div>
				</div>

				<button
					type="submit"
					disabled={loading || !formData.prompt.trim()}
					className="w-full bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
				>
					{loading ? "Generating Image..." : "Generate Image"}
				</button>
			</form>

			{error && (
				<div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
					<p className="text-red-800">{error}</p>
				</div>
			)}

			{response && response.success && response.image_data && (
				<div className="space-y-4">
					<div className="bg-gray-50 p-4 rounded-md">
						<h3 className="text-lg font-semibold text-gray-800 mb-2">
							Generated Image
						</h3>
						<p className="text-sm text-gray-600 mb-2">
							<strong>Prompt:</strong> {response.prompt_used}
						</p>
						<p className="text-sm text-gray-600 mb-2">
							<strong>Model:</strong> {response.model_used}
						</p>
						<p className="text-sm text-gray-600">
							<strong>Generated:</strong>{" "}
							{new Date(response.timestamp).toLocaleString()}
						</p>
					</div>

					<div className="flex justify-center">
						<img
							src={`data:image/png;base64,${response.image_data}`}
							alt="Generated image"
							className="max-w-full h-auto rounded-lg shadow-lg"
							style={{ maxHeight: "600px" }}
						/>
					</div>

					<div className="flex justify-center space-x-4">
						<button
							onClick={() => {
								const link = document.createElement("a");
								link.href = `data:image/png;base64,${response.image_data}`;
								link.download = `generated-image-${Date.now()}.png`;
								link.click();
							}}
							className="bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition-colors"
						>
							Download Image
						</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default ImageGenerator;
