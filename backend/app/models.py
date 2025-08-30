from pydantic import BaseModel, Field, HttpUrl
from typing import List, Optional, Dict, Any, Literal
from datetime import datetime


# --- Request Body for Backend ---
class PostGenerationRequest(BaseModel):
    topic: str
    tone: Optional[str] = None
    audience: Optional[List[str]] = None
    length: Optional[Literal["Short", "Medium", "Long", "Any"]] = "Medium"
    hashtags_option: Optional[str] = "suggest"
    cta_text: Optional[str] = None
    mimic_examples: Optional[str] = None
    language: Optional[str] = None
    post_count: int = Field(default=3, ge=1, le=5)
    emoji_level: int = Field(default=1, ge=0, le=3)
    github_project_url: Optional[HttpUrl] = None


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., description="Text description of the image to generate")
    model: Optional[str] = Field(
        default="gemini-2.5-flash-image-preview",
        description="AI model to use for image generation",
    )
    style: Optional[str] = Field(
        default=None, description="Artistic style for the image"
    )
    size: Optional[Literal["small", "medium", "large"]] = Field(
        default="medium", description="Image size preference"
    )


class ImageGenerationResponse(BaseModel):
    success: bool
    image_data: Optional[str] = None  # Base64 encoded image
    image_url: Optional[str] = None
    error_message: Optional[str] = None
    prompt_used: str
    model_used: str
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())


class Source(BaseModel):
    title: str
    link: str


class GeneratedPost(BaseModel):
    text: str
    hashtags: Optional[List[str]] = None
    cta_suggestion: Optional[str] = None
    token_info: Optional[Dict[str, Any]] = None
    sources: Optional[List[Source]] = None
    github_project_name: Optional[str] = None


class StreamingEvent(BaseModel):
    type: str
    message: Optional[str] = None
    payload: Optional[Any] = None
    timestamp: str = Field(default_factory=lambda: datetime.now().isoformat())
