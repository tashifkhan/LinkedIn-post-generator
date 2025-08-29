import os
import re
import json
from typing import List, Optional, Dict, Any, TypedDict
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, SystemMessage, BaseMessage
from langgraph.graph import StateGraph, END
from dotenv import load_dotenv

load_dotenv()

from app.models import PostGenerationRequest, GeneratedPost, Source

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")


# --- LLM factory and robust caller (Google GenAI variant) ---
def create_llm_google_genai() -> Exception | ChatGoogleGenerativeAI:  # type: ignore
    if ChatGoogleGenerativeAI is not None:
        try:
            return ChatGoogleGenerativeAI(
                model="gemini-2.0-flash-lite",
                temperature=0.7,
                api_key=GOOGLE_API_KEY,
            )  # type: ignore

        except Exception:
            pass

    raise RuntimeError("No supported LLM client found. Install langchain chat models.")


llm = create_llm_google_genai()


def clean_post_content(content: str) -> str:
    """Clean up LLM output to remove explanatory text and return only the post content."""
    lines = content.strip().split("\n")

    # Remove common explanatory prefixes
    unwanted_prefixes = [
        "here's a linkedin post",
        "here is a linkedin post",
        "linkedin post:",
        "post:",
        "here's the post",
        "here is the post",
        "generated post:",
        "the post:",
        "below is",
        "here's what i",
    ]

    cleaned_lines = []
    for line in lines:
        line_lower = line.strip().lower()

        # Skip lines that are clearly explanatory
        if any(prefix in line_lower for prefix in unwanted_prefixes):
            continue

        # Skip lines that end with colons (likely headers)
        if line.strip().endswith(":") and len(line.strip()) < 50:
            continue

        cleaned_lines.append(line)

    # Join back and clean up extra whitespace
    result = "\n".join(cleaned_lines).strip()

    # Remove any remaining quotes around the entire content
    if result.startswith('"') and result.endswith('"'):
        result = result[1:-1]
    if result.startswith("'") and result.endswith("'"):
        result = result[1:-1]

    return result


async def call_llm(messages: List[BaseMessage] | str) -> str:
    """
    Robust wrapper to call the LLM. Accepts either a plain prompt string or a list of BaseMessage.
    Tries common langchain async call patterns.
    Returns the text content from the LLM.
    """
    if llm is None:
        if isinstance(messages, str):
            return f"[LLM MOCK] {messages}"

        else:
            joined = "\n".join(getattr(m, "content", str(m)) for m in messages)
            return f"[LLM MOCK] {joined}"

    if isinstance(messages, str):
        msgs = (
            [HumanMessage(content=messages)] if HumanMessage is not None else [messages]
        )
    else:
        msgs = messages

    try:
        if hasattr(llm, "agenerate"):
            resp = await llm.agenerate([[m for m in msgs]])  # type: ignore
            text = None

            try:
                text = resp.generations[0][0].text

            except Exception:
                text = str(resp)

            return text

        if hasattr(llm, "apredict"):
            if isinstance(messages, str):
                return await llm.apredict(messages)

            joined = "\n".join(getattr(m, "content", str(m)) for m in msgs)
            return await llm.apredict(joined)

        if callable(llm):
            try:
                resp = await llm(messages=msgs)  # type: ignore[arg-type]
                return getattr(resp, "content", str(resp))

            except Exception:
                pass

    except Exception as e:
        raise

    try:
        resp = llm(messages=msgs)  # type: ignore[arg-type]
        return getattr(resp, "content", str(resp))

    except Exception:
        return "[LLM ERROR]"


# --- Mock tools (allowed to be mock per your request) ---
def search_web_for_topic_info(query: str) -> str:
    return json.dumps(
        {
            "results": [
                {
                    "title": "Mock Result A",
                    "snippet": "Overview about the topic",
                    "link": "https://example.com/a",
                },
                {
                    "title": "Mock Result B",
                    "snippet": "More info",
                    "link": "https://example.com/b",
                },
            ]
        }
    )


def scrape_github_project_info(repo_url: str) -> str:
    match = re.match(r"https://github.com/([^/]+)/([^/]+)", repo_url)
    if not match:
        return json.dumps({"error": "Invalid GitHub URL"})
    owner, repo = match.groups()
    return json.dumps(
        {
            "project_name": repo.replace("-", " ").title(),
            "description": f"Mock description for {repo}",
            "main_technologies": ["Python", "FastAPI"],
            "stars": 123,
            "repo_link": repo_url,
        }
    )


# --- Agent State ---
class AgentState(TypedDict):  # type: ignore
    request: PostGenerationRequest
    current_step_message: str
    should_search: bool
    search_results: Optional[List[Source]]
    planning_output: Optional[Dict[str, Any]]
    github_project_data: Optional[Dict[str, Any]]
    drafted_posts: List[str]
    final_posts_data: List[GeneratedPost]
    messages: List[Dict[str, Any]]


# --- Nodes ---
async def initial_plan_node(state: AgentState) -> AgentState:
    req = state["request"]
    state["current_step_message"] = "Starting planning phase..."

    system = (
        SystemMessage(content="You are an expert LinkedIn content planner.")
        if SystemMessage is not None
        else None
    )
    user_text = f"Topic: {req.topic}\nTone: {req.tone}\nAudience: {req.audience}\nLength: {req.length}\nMimic: {req.mimic_examples}"
    try:
        content = await call_llm(
            [
                m
                for m in ([system] if system else [])
                + ([HumanMessage(content=user_text)] if HumanMessage else [user_text])
            ]
        )
        try:
            plan = json.loads(content)

        except Exception:
            plan = {
                "key_messages": ["Intro, value, CTA"],
                "needs_web_search": False,
            }

    except Exception:
        plan = {
            "key_messages": ["Intro, value, CTA"],
            "needs_web_search": False,
        }

    state["planning_output"] = plan
    state["should_search"] = bool(plan.get("needs_web_search", False))
    state["current_step_message"] = "Planning complete."
    return state


async def web_search_node(state: AgentState) -> AgentState:
    if not state.get("should_search"):
        state["current_step_message"] = "Web search skipped."
        return state

    state["current_step_message"] = "Performing web search..."

    query = (state.get("planning_output") or {}).get("search_query") or state[
        "request"
    ].topic

    results_json = search_web_for_topic_info(query)
    results = json.loads(results_json).get("results", [])

    state["search_results"] = [
        Source(title=r["title"], link=r["link"]) for r in results
    ]
    state["current_step_message"] = (
        f"Web search complete. Found {len(results)} results."
    )
    return state


async def github_scrape_node(state: AgentState) -> AgentState:
    req = state["request"]
    if not req.github_project_url:
        state["current_step_message"] = "GitHub scraping skipped."
        return state

    state["current_step_message"] = (
        f"Scraping GitHub project {req.github_project_url}..."
    )

    data = json.loads(scrape_github_project_info(str(req.github_project_url)))

    if data.get("error"):
        state["current_step_message"] = f"GitHub scraping failed: {data['error']}"
    else:
        state["github_project_data"] = data
        state["current_step_message"] = (
            f"GitHub project '{data.get('project_name')}' scraped."
        )
    return state


async def draft_posts_node(state: AgentState) -> AgentState:
    req = state["request"]
    state["current_step_message"] = "Drafting LinkedIn posts..."
    posts: List[str] = []

    emoji_map = {
        0: "no emojis",
        1: "a few emojis",
        2: "moderate emojis",
        3: "many emojis",
    }
    emoji_guidance = emoji_map.get(req.emoji_level, "a few emojis")
    length_map = {
        "Short": "short (50-80 words)",
        "Medium": "medium (100-150 words)",
        "Long": "long (200+ words)",
        "Any": "appropriate length",
    }
    length_guidance = length_map.get(
        req.length if isinstance(req.length, str) else "Any"
    )

    for i in range(req.post_count):
        state["current_step_message"] = f"Drafting post {i+1} of {req.post_count}..."
        github_ctx = ""

        if state.get("github_project_data") and isinstance(
            state.get("github_project_data"), dict
        ):
            gp = state["github_project_data"]
            github_ctx = (
                f"\nProject: {gp.get('project_name')} - {gp.get('description')}\n"
            )

        prompt = f"Generate ONLY the LinkedIn post content ({length_guidance}) about {req.topic}. Tone: {req.tone or 'Professional'}. Audience: {req.audience or 'General'}. Use {emoji_guidance}. {github_ctx}\n\nIMPORTANT: Return ONLY the post text without any explanatory lines, introductions, or meta-commentary. Do not include lines like 'Here's a LinkedIn post about...' or similar. Just return the actual post content that would be posted directly to LinkedIn."
        content = await call_llm(prompt)

        # Clean up any unwanted explanatory text
        cleaned_content = clean_post_content(content)
        posts.append(cleaned_content)

    state["drafted_posts"] = posts
    state["current_step_message"] = "Drafts created."
    return state


async def refine_posts_node(state: AgentState) -> AgentState:
    req = state["request"]
    drafted = state.get("drafted_posts", [])
    final: List[GeneratedPost] = []
    gp_name = None

    if state.get("github_project_data") and isinstance(
        state.get("github_project_data"), dict
    ):
        gp_name = state["github_project_data"].get("project_name")

    state["current_step_message"] = "Refining posts..."

    for i, text in enumerate(drafted):
        state["current_step_message"] = f"Refining post {i+1}..."
        hashtags: List[str] = []

        if req.hashtags_option == "suggest":
            resp = await call_llm(f"Suggest 3 hashtags (as JSON array) for: {text}")

            try:
                hashtags = json.loads(resp)

            except Exception:
                hashtags = [h.strip() for h in resp.split(",")[:3] if h.strip()]

        cta = req.cta_text or await call_llm(f"Suggest a concise CTA for: {text}")

        final.append(
            GeneratedPost(
                text=text,
                hashtags=hashtags,
                cta_suggestion=cta,
                token_info={"prompt_tokens": 0, "completion_tokens": 0},
                github_project_name=gp_name,
            )
        )

    state["final_posts_data"] = final
    state["current_step_message"] = "Posts refined."
    return state


async def quality_guardrails_node(state: AgentState) -> AgentState:
    posts = state.get("final_posts_data", [])
    moderated: List[GeneratedPost] = []
    state["current_step_message"] = "Applying guardrails..."

    for i, p in enumerate(posts):
        state["current_step_message"] = f"Moderating post {i+1}..."

        if any(bad in p.text.lower() for bad in ["badword"]):
            continue

        if any(
            existing.text.strip().lower() == p.text.strip().lower()
            for existing in moderated
        ):
            continue

        moderated.append(p)

    state["final_posts_data"] = moderated
    state["current_step_message"] = "Guardrails complete."
    return state


def create_post_generator_graph():
    # Use langgraph if available; otherwise provide a simple sequential runner object
    if StateGraph is None:
        # Fallback: simple runner that exposes astream(initial_state)
        class SimpleRunner:
            async def astream(self, initial_state: AgentState):
                state = initial_state
                state = await initial_plan_node(state)
                yield {"plan": state}
                if state.get("should_search"):
                    state = await web_search_node(state)
                    yield {"search": state}
                if state["request"].github_project_url:
                    state = await github_scrape_node(state)
                    yield {"github_scrape": state}
                state = await draft_posts_node(state)
                yield {"draft": state}
                state = await refine_posts_node(state)
                yield {"refine": state}
                state = await quality_guardrails_node(state)
                yield {"guardrails": state}
                yield {"__end__": state}

        return SimpleRunner()

    workflow = StateGraph(AgentState)
    workflow.add_node("plan", initial_plan_node)
    workflow.add_node("search", web_search_node)
    workflow.add_node("github_scrape", github_scrape_node)
    workflow.add_node("draft", draft_posts_node)
    workflow.add_node("refine", refine_posts_node)
    workflow.add_node("guardrails", quality_guardrails_node)
    workflow.set_entry_point("plan")

    workflow.add_conditional_edges(
        "plan",
        lambda state: (
            "search"
            if state.get("should_search")
            else ("github_scrape" if state["request"].github_project_url else "draft")
        ),
        {"search": "search", "github_scrape": "github_scrape", "draft": "draft"},
    )

    workflow.add_conditional_edges(
        "search",
        lambda state: (
            "github_scrape" if state["request"].github_project_url else "draft"
        ),
        {"github_scrape": "github_scrape", "draft": "draft"},
    )
    workflow.add_edge("github_scrape", "draft")
    workflow.add_edge("draft", "refine")
    workflow.add_edge("refine", "guardrails")
    workflow.add_edge("guardrails", END)

    return workflow.compile()


post_generator_agent = create_post_generator_graph()
