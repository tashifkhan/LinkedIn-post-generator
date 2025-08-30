import asyncio
import json
from datetime import datetime

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from app.models import PostGenerationRequest, StreamingEvent
from app.agent import post_generator_agent

app = FastAPI(title="LinkedIn Post Generator API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/api/generate-posts-stream", response_class=StreamingResponse)
async def generate_linkedin_posts_stream(request: PostGenerationRequest):
    async def event_generator():
        # initial_state is a plain dict compatible with the agent runner's expectations
        initial_state = {
            "request": request,
            "current_step_message": "Initialization complete.",
            "should_search": False,
            "search_results": [],
            "planning_output": {},
            "github_project_data": None,
            "drafted_posts": [],
            "final_posts_data": [],
            "messages": [],
        }

        posts_emitted = 0

        try:
            async for s in post_generator_agent.astream(initial_state):
                current_node_name = None
                node_output_state = None

                if "__end__" in s:
                    current_node_name = "__end__"
                    node_output_state = s["__end__"]
                elif s:
                    current_node_name = list(s.keys())[0]
                    node_output_state = s.get(current_node_name)

                if node_output_state and "current_step_message" in node_output_state:
                    progress_message = node_output_state["current_step_message"]
                    event = StreamingEvent(
                        type="PROGRESS",
                        message=progress_message,
                        timestamp=datetime.now().isoformat(),
                    ).model_dump_json()
                    yield f"data: {event}\n\n"
                    await asyncio.sleep(0.02)

                if (
                    current_node_name == "github_scrape"
                    and node_output_state
                    and node_output_state.get("github_project_data")
                ):
                    event = StreamingEvent(
                        type="PROGRESS",
                        message=f"GitHub project details gathered.",
                        payload=node_output_state["github_project_data"],
                        timestamp=datetime.now().isoformat(),
                    ).model_dump_json()
                    yield f"data: {event}\n\n"
                    await asyncio.sleep(0.02)

                if (
                    current_node_name == "guardrails"
                    and node_output_state
                    and node_output_state.get("final_posts_data")
                ):
                    new_posts = node_output_state["final_posts_data"][posts_emitted:]
                    for post in new_posts:
                        event = StreamingEvent(
                            type="POST_GENERATED",
                            message=f"Post generated",
                            payload=post.model_dump(),
                            timestamp=datetime.now().isoformat(),
                        ).model_dump_json()
                        yield f"data: {event}\n\n"
                        posts_emitted += 1
                        await asyncio.sleep(0.02)

            event = StreamingEvent(
                type="COMPLETE",
                message="All posts processed successfully.",
                timestamp=datetime.now().isoformat(),
            ).model_dump_json()
            yield f"data: {event}\n\n"

        except Exception as e:
            event = StreamingEvent(
                type="ERROR",
                message=f"Internal Server Error: {str(e)}",
                timestamp=datetime.now().isoformat(),
            ).model_dump_json()
            yield f"data: {event}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        app,
        host="0.0.0.0",
        port=8000,
    )
