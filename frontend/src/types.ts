// --- Request Body for Backend ---
export interface PostGenerationRequest {
	topic: string;
	tone?: string;
	audience?: string[];
	length?: 'Short' | 'Medium' | 'Long' | 'Any'; // Explicitly define expected values
	hashtags_option?: 'suggest' | 'none'; // 'suggest' or 'none'
	cta_text?: string;
	mimic_examples?: string;
	language?: string;
	post_count: number;
	emoji_level?: number; // New: 0 (None) to 3 (Many)
	github_project_url?: string; // New: Optional URL for GitHub project details
}

// --- Individual Generated Post Output ---
export interface GeneratedPost {
	text: string;
	hashtags?: string[];
	cta_suggestion?: string;
	token_info?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_cost?: number;
	};
	sources?: Array<{ title: string; link: string }>;
	github_project_name?: string;
}

// Streaming event types and basic event shape (kept minimal)
export type StreamingEventType = 'PROGRESS' | 'SEARCH_RESULT' | 'POST_GENERATED' | 'COMPLETE' | 'ERROR';

export interface StreamingEvent {
	type: StreamingEventType;
	message?: string;
	payload?: any;
	timestamp?: string;
}

// Local generation state used by the frontend UI
export interface GenerationState {
	isLoading: boolean;
	events: StreamingEvent[];
	posts: GeneratedPost[];
}
