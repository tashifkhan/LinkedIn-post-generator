from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO
from dotenv import load_dotenv
import os
import base64
import asyncio
from typing import Optional
from .models import ImageGenerationRequest, ImageGenerationResponse

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")

client = genai.Client()


async def generate_image(request: ImageGenerationRequest) -> ImageGenerationResponse:
    """
    Generate an image based on the provided prompt using Google's Gemini API.
    
    Args:
        request: ImageGenerationRequest containing the prompt and generation parameters
        
    Returns:
        ImageGenerationResponse with the generated image data or error information
    """
    try:
        # Build the prompt with optional style enhancement
        prompt = request.prompt
        if request.style:
            prompt = f"{prompt} in {request.style} style"
        
        # Add size preference to prompt if specified
        if request.size and request.size != "medium":
            size_descriptions = {
                "small": "small, compact",
                "large": "large, detailed, high resolution"
            }
            if request.size in size_descriptions:
                prompt = f"{prompt}, {size_descriptions[request.size]}"
        
        # Generate the image
        response = client.models.generate_content(
            model=request.model,
            contents=[prompt],
        )
        
        # Process the response
        for part in response.candidates[0].content.parts:
            if part.inline_data is not None:
                # Convert image to base64 for API response
                image = Image.open(BytesIO(part.inline_data.data))
                
                # Convert to base64
                buffer = BytesIO()
                image.save(buffer, format="PNG")
                image_base64 = base64.b64encode(buffer.getvalue()).decode('utf-8')
                
                return ImageGenerationResponse(
                    success=True,
                    image_data=image_base64,
                    prompt_used=prompt,
                    model_used=request.model
                )
        
        # If no image data found in response
        return ImageGenerationResponse(
            success=False,
            error_message="No image data received from the model",
            prompt_used=prompt,
            model_used=request.model
        )
        
    except Exception as e:
        return ImageGenerationResponse(
            success=False,
            error_message=f"Error generating image: {str(e)}",
            prompt_used=request.prompt,
            model_used=request.model
        )


# Legacy function for backward compatibility
async def generate_sample_image() -> ImageGenerationResponse:
    """
    Generate a sample image using the original prompt.
    This is kept for backward compatibility.
    """
    sample_request = ImageGenerationRequest(
        prompt="Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme"
    )
    return await generate_image(sample_request)
