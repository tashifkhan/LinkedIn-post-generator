import os
import re
import json
from typing import List, Optional, Dict, Any, TypedDict
from datetime import datetime
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain.schema import HumanMessage, SystemMessage, AIMessage, BaseMessage
from langgraph.graph import StateGraph, END
from langchain.chat_models import ChatGoogleGemini
from dotenv import load_dotenv

load_dotenv()

from app.models import PostGenerationRequest, GeneratedPost, Source


# --- LLM factory and robust caller (Google GenAI variant) ---
def create_llm_google_genai() -> Exception | ChatGoogleGenerativeAI:  # type: ignore
    if ChatGoogleGemini is not None:
        try:
            return ChatGoogleGenerativeAI(
                temperature=0.7,
            )  # type: ignore

        except Exception:
            pass

    if ChatGoogleGenerativeAI is not None:
        return ChatGoogleGenerativeAI(
            temperature=0.7,
        )  # type: ignore

    raise RuntimeError("No supported LLM client found. Install langchain chat models.")


llm = create_llm_google_genai()


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

        prompt = f"Write a LinkedIn post ({length_guidance}) about {req.topic}. Tone: {req.tone or 'Professional'}.\
              Audience: {req.audience or 'General'}. Use {emoji_guidance}. {github_ctx}"
        content = await call_llm(prompt)
        posts.append(content)

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

import os
import re
import json
from typing import List, Optional, Dict, Any, TypedDict, Annotated
from datetime import datetime

from dotenv import load_dotenv

load_dotenv()

# Try to import langchain and langgraph. The environment should have these installed.
try:
    from langchain.chat_models import ChatOpenAI
    from langchain.schema import HumanMessage, SystemMessage, AIMessage
except Exception:
    ChatOpenAI = None

try:
    # langgraph imports
    from langgraph.graph import StateGraph, END
    from langgraph.graph.message import add_messages
except Exception:
    StateGraph = None
    END = None

try:
    # If a Gemini chat client is available in langchain
    from langchain.chat_models import ChatGoogleGemini
except Exception:
    ChatGoogleGemini = None

from app.models import PostGenerationRequest, GeneratedPost, Source


# --- LLM wrapper ---
def create_llm():
    # Prefer Gemini if available
    if ChatGoogleGemini is not None:
        try:
            api_key = os.environ.get("GOOGLE_API_KEY")
            return ChatGoogleGemini(temperature=0.7)
        except Exception:
            pass

    if ChatOpenAI is not None:
        api_key = os.environ.get("OPENAI_API_KEY")
        return ChatOpenAI(temperature=0.7)

    raise RuntimeError("No supported LLM client found. Install langchain chat models.")


# --- Tools (mock implementations) ---
def search_web_for_topic_info(query: str) -> str:
    # Return mock JSON string
    return json.dumps(
        {
            "results": [
                {
                    "title": "Mock Result 1",
                    "snippet": "Mock snippet 1",
                    "link": "https://example.com/1",
                },
                {
                    "title": "Mock Result 2",
                    "snippet": "Mock snippet 2",
                    "link": "https://example.com/2",
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
            "stars": 100,
            "repo_link": repo_url,
        }
    )


# --- Agent State Definition ---
class AgentState(TypedDict):
    request: PostGenerationRequest
    current_step_message: str
    should_search: bool
    search_results: Optional[List[Source]]
    planning_output: Optional[Dict[str, Any]]
    github_project_data: Optional[Dict[str, Any]]
    drafted_posts: List[str]
    final_posts_data: List[GeneratedPost]
    messages: (
        Annotated[List[dict], add_messages]
        if "add_messages" in globals()
        else List[dict]
    )


# Create the LLM instance at import time (will raise if not installed)
llm = create_llm()


async def initial_plan_node(state: AgentState) -> AgentState:
    req = state["request"]
    state["current_step_message"] = "Starting planning phase..."

    system = SystemMessage(content="You are an expert LinkedIn content planner.")
    user = HumanMessage(
        content=f"Topic: {req.topic}\nTone: {req.tone}\nAudience: {req.audience}\nLength: {req.length}\nMimic: {req.mimic_examples}"
    )

    try:
        resp = await llm.apredict(messages=[system, user])
        content = resp.content if hasattr(resp, "content") else str(resp)
        # Expect JSON from the LLM; fallback to a simple plan
        try:
            plan = json.loads(content)
        except Exception:
            plan = {"key_messages": ["Do intro, value, CTA"], "needs_web_search": False}
    except Exception:
        plan = {"key_messages": ["Do intro, value, CTA"], "needs_web_search": False}

    state["planning_output"] = plan
    state["should_search"] = plan.get("needs_web_search", False)
    state["current_step_message"] = (
        "Planning complete. Deciding on external data sources..."
    )
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
        state["current_step_message"] = "GitHub scraping skipped (no URL)."
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
    planning_output = state.get("planning_output") or {}
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
        prompt_system = SystemMessage(content="You are a skilled LinkedIn post writer.")
        github_ctx = ""
        if state.get("github_project_data"):
            gp = state["github_project_data"]
            github_ctx = f"\nGitHub Project: {gp.get('project_name')} - {gp.get('description')}\nTechnologies: {', '.join(gp.get('main_technologies', []))}\n"

        user_msg = HumanMessage(
            content=(
                f"Generate a LinkedIn post ({length_guidance}) about: {req.topic}. Tone: {req.tone or 'Professional'}. Audience: {req.audience or 'General'}. Use {emoji_guidance}. {github_ctx}"
            )
        )

        try:
            resp = await llm.apredict(messages=[prompt_system, user_msg])
            content = resp.content if hasattr(resp, "content") else str(resp)
        except Exception:
            content = f"Generated post about {req.topic}."

        posts.append(content)

    state["drafted_posts"] = posts
    state["current_step_message"] = "Initial drafts created."
    return state


async def refine_posts_node(state: AgentState) -> AgentState:
    req = state["request"]
    drafted = state.get("drafted_posts", [])
    final: List[GeneratedPost] = []
    gp_name = None
    if state.get("github_project_data"):
        gp = state["github_project_data"]
        if isinstance(gp, dict):
            gp_name = gp.get("project_name")

    state["current_step_message"] = "Refining posts..."

    for i, text in enumerate(drafted):
        state["current_step_message"] = f"Refining post {i+1}..."
        hashtags: List[str] = []
        if req.hashtags_option == "suggest":
            try:
                resp = await llm.apredict(
                    messages=[
                        SystemMessage(content="You are a hashtag expert."),
                        HumanMessage(content=f"Suggest 3 hashtags for: {text}"),
                    ]
                )
                hashtags = (
                    json.loads(resp.content)
                    if resp and hasattr(resp, "content")
                    else []
                )
            except Exception:
                hashtags = (
                    [
                        t.strip()
                        for t in (
                            resp.content if hasattr(resp, "content") else str(resp)
                        ).split(",")[:3]
                    ]
                    if resp
                    else []
                )

        cta = (
            req.cta_text
            or (
                await llm.apredict(
                    messages=[
                        SystemMessage(content="You are a CTA expert."),
                        HumanMessage(content=f"Suggest a CTA for: {text}"),
                    ]
                )
            ).content
        )

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
    state["current_step_message"] = "Posts refined with hashtags and CTAs."
    return state


async def quality_guardrails_node(state: AgentState) -> AgentState:
    posts = state.get("final_posts_data", [])
    moderated: List[GeneratedPost] = []
    state["current_step_message"] = "Applying guardrails..."
    for i, p in enumerate(posts):
        state["current_step_message"] = f"Moderating post {i+1}..."
        # Simple profanity mock check
        if any(bad in p.text.lower() for bad in ["badword"]):
            continue
        if any(
            existing.text.strip().lower() == p.text.strip().lower()
            for existing in moderated
        ):
            continue
        moderated.append(p)

    state["final_posts_data"] = moderated
    state["current_step_message"] = "Quality guardrails applied."
    return state


def create_post_generator_graph():
    if StateGraph is None:
        raise RuntimeError("langgraph not available in environment")

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
import re
import json
from typing import List, Optional, TypedDict, Dict, Any, Annotated
from datetime import datetime


# Lightweight mock LLM interface to simulate Gemini responses.
class GeminiMock:
    def __init__(self, model: str = "gemini-1-mock", temperature: float = 0.7):
        self.model = model
        self.temperature = temperature

    async def ainvoke(self, prompt: str):
        # Return a simple object with .content for compatibility
        class Msg:
            def __init__(self, content):
                self.content = content

        # Basic heuristics to simulate different nodes
        lower = prompt.lower()
        if "create a detailed plan" in lower or "create a detailed plan" in prompt:
            content = json.dumps(
                {
                    "key_messages": ["Key point 1", "Key point 2"],
                    "structure_ideas": ["Hook, Value, CTA"],
                    "keywords": ["AI", "product"],
                    "needs_web_search": False,
                    "search_query": "",
                }
            )
            return Msg(content)

        if (
            "suggest 3-5 highly relevant hashtags" in lower
            or "you are a linkedin hashtag expert" in lower
        ):
            return Msg(json.dumps(["AI", "Tech", "Product"]))

        if "you are a linkedin cta expert" in lower:
            return Msg("Learn more")

        # Default: return a simple drafted post text
        # Use some markers to incorporate emoji guidance, length, and github context if present in prompt
        emoji_text = (
            "🙂"
            if "few" in lower
            else "" if "no emojis" in lower else "🚀✨" if "many" in lower else "👍"
        )
        if "github project details" in lower:
            # Attempt to extract a project name from prompt
            m = re.search(r"project name: (.+?)\\n", prompt, re.IGNORECASE)
            project = m.group(1) if m else "Your Project"
            draft = f"Announcing {project}! {emoji_text} Here are a few thoughts about it..."
            return Msg(draft)

        return Msg(
            f"Generated LinkedIn post about the topic. {emoji_text} (mock response)"
        )


# Mock tools
def search_web_for_topic_info(query: str) -> str:
    # Return a mock JSON string similar to a real search result
    return json.dumps(
        {
            "results": [
                {
                    "title": "Example Result",
                    "snippet": "This is a mock snippet.",
                    "link": "https://example.com",
                }
            ]
        }
    )


def scrape_github_project_info(repo_url: str) -> str:
    match = re.match(r"https://github.com/([^/]+)/([^/]+)", repo_url)
    if not match:
        return json.dumps({"error": "Invalid GitHub URL"})
    owner, repo = match.groups()
    data = {
        "project_name": repo.replace("-", " ").title(),
        "description": f"A mock description for {repo} by {owner}.",
        "main_technologies": ["Python", "FastAPI"],
        "stars": 42,
        "repo_link": repo_url,
    }
    return json.dumps(data)


from app.models import PostGenerationRequest, GeneratedPost, Source


class AgentState(TypedDict):
    request: PostGenerationRequest
    current_step_message: str
    should_search: bool
    search_results: Optional[List[Source]]
    planning_output: Optional[Dict[str, Any]]
    github_project_data: Optional[Dict[str, Any]]
    drafted_posts: List[str]
    final_posts_data: List[GeneratedPost]
    messages: List[Dict[str, Any]]


gemini = GeminiMock()


async def initial_plan_node(state: AgentState) -> AgentState:
    request = state["request"]
    state["current_step_message"] = "Starting planning phase..."
    prompt = f"Create a detailed plan for Topic: {request.topic}"
    resp = await gemini.ainvoke(prompt)
    try:
        plan = json.loads(resp.content)
    except Exception:
        plan = {"key_messages": ["Default"], "needs_web_search": False}
    state["planning_output"] = plan
    state["should_search"] = plan.get("needs_web_search", False)
    state["current_step_message"] = (
        "Planning complete. Deciding on external data sources..."
    )
    return state


async def web_search_node(state: AgentState) -> AgentState:
    if not state.get("should_search"):
        state["current_step_message"] = "Web search skipped as not required."
        return state
    state["current_step_message"] = (
        "Performing web search for up-to-date information..."
    )
    planning_output = state.get("planning_output") or {}
    query = planning_output.get("search_query") or state["request"].topic
    results_json = search_web_for_topic_info(query)
    results = json.loads(results_json).get("results", [])
    sources = [Source(title=r["title"], link=r["link"]) for r in results]
    state["search_results"] = sources
    state["current_step_message"] = (
        f"Web search complete. Found {len(sources)} relevant sources."
    )
    return state


async def github_scrape_node(state: AgentState) -> AgentState:
    request = state["request"]
    if not request.github_project_url:
        state["current_step_message"] = (
            "GitHub project scraping skipped (no URL provided)."
        )
        return state
    state["current_step_message"] = (
        f"Scraping GitHub project details from {request.github_project_url}..."
    )
    scrape_json = scrape_github_project_info(str(request.github_project_url))
    data = json.loads(scrape_json)
    if data.get("error"):
        state["current_step_message"] = f"GitHub scraping failed: {data['error']}"
    else:
        state["github_project_data"] = data
        state["current_step_message"] = (
            f"GitHub project '{data.get('project_name', 'Unknown')}' details scraped."
        )
    return state


async def draft_posts_node(state: AgentState) -> AgentState:
    request = state["request"]
    planning_output = state.get("planning_output", {})
    search_results = state.get("search_results", [])
    github_project_data = state.get("github_project_data")
    state["current_step_message"] = "Drafting LinkedIn posts..."

    emoji_guidance_map = {
        0: "no emojis",
        1: "a few relevant emojis",
        2: "a moderate number of relevant emojis",
        3: "many relevant and expressive emojis",
    }
    emoji_guidance = emoji_guidance_map.get(
        request.emoji_level, "a few relevant emojis"
    )

    length_guidance_map = {
        "Short": "brief (around 50-80 words)",
        "Medium": "medium length (around 100-150 words)",
        "Long": "detailed (around 200-250 words)",
        "Any": "appropriate length for LinkedIn",
    }
    length_key = request.length if isinstance(request.length, str) else None
    # Ensure length_key is a string key present in the guidance map
    if isinstance(length_key, str) and length_key in length_guidance_map:
        length_guidance = length_guidance_map[length_key]
    else:
        length_guidance = "appropriate length for LinkedIn"

    posts = []
    for i in range(request.post_count):
        state["current_step_message"] = (
            f"Drafting post {i+1} of {request.post_count}..."
        )
        github_context = ""
        if github_project_data:
            github_context = f"\n\n--- GitHub Project Details ---\nProject Name: {github_project_data.get('project_name')}\nDescription: {github_project_data.get('description')}\nTechnologies: {', '.join(github_project_data.get('main_technologies', []))}\nStars: {github_project_data.get('stars')}\nLink: {github_project_data.get('repo_link')}\n"

        prompt = f"You are a skilled LinkedIn post writer. Generate a single, distinct LinkedIn post draft that is {length_guidance} based on Topic: {request.topic}. Use {emoji_guidance}. {github_context}"
        resp = await gemini.ainvoke(prompt)
        posts.append(resp.content)

    state["drafted_posts"] = posts
    state["current_step_message"] = "All initial post drafts created."
    return state


async def refine_posts_node(state: AgentState) -> AgentState:
    request = state["request"]
    drafted = state.get("drafted_posts", [])
    final_posts: List[GeneratedPost] = []
    github_name = None
    gp = state.get("github_project_data")
    if gp and isinstance(gp, dict):
        github_name = gp.get("project_name")
    state["current_step_message"] = "Refining posts: adding hashtags and CTAs..."

    for i, text in enumerate(drafted):
        state["current_step_message"] = f"Refining post {i+1} of {len(drafted)}..."
        hashtags = []
        if request.hashtags_option == "suggest":
            # Ask gemini for hashtags (mocked)
            resp = await gemini.ainvoke(
                "Suggest hashtags for the following post: " + text
            )
            try:
                hashtags = json.loads(resp.content)
            except Exception:
                hashtags = [h.strip() for h in resp.content.split(",") if h.strip()]

        cta = (
            request.cta_text
            or (await gemini.ainvoke("Suggest a CTA for the post: " + text)).content
        )
        final_posts.append(
            GeneratedPost(
                text=text,
                hashtags=hashtags,
                cta_suggestion=cta,
                token_info={"prompt_tokens": 0, "completion_tokens": 0},
                github_project_name=github_name,
            )
        )

    state["final_posts_data"] = final_posts
    state["current_step_message"] = "Posts refined with hashtags and CTAs."
    return state


async def quality_guardrails_node(state: AgentState) -> AgentState:
    posts = state.get("final_posts_data", [])
    moderated: List[GeneratedPost] = []
    state["current_step_message"] = "Applying quality guardrails and final checks..."
    for i, post in enumerate(posts):
        state["current_step_message"] = (
            f"Running guardrails for post {i+1} of {len(posts)}..."
        )
        # Simple mock moderation: reject if contains banned words
        banned = ["badword"]
        if any(b in post.text.lower() for b in banned):
            continue
        # Dedup check
        if any(
            existing.text.strip().lower() == post.text.strip().lower()
            for existing in moderated
        ):
            continue
        moderated.append(post)

    state["final_posts_data"] = moderated
    state["current_step_message"] = "Quality guardrails applied. Final posts ready."
    return state


class SimpleGraphRunner:
    def __init__(self):
        pass

    async def astream(self, initial_state: AgentState):
        # Very simple sequential flow mimicking the LangGraph flow described
        state = initial_state
        # Plan
        state = await initial_plan_node(state)
        yield {"plan": state}

        # Search if needed
        if state.get("should_search"):
            state = await web_search_node(state)
            yield {"web_search": state}

        # Github
        if state["request"].github_project_url:
            state = await github_scrape_node(state)
            yield {"github_scrape": state}

        # Draft
        state = await draft_posts_node(state)
        yield {"draft": state}

        # Refine
        state = await refine_posts_node(state)
        yield {"refine": state}

        # Guardrails
        state = await quality_guardrails_node(state)
        yield {"guardrails": state}

        # End
        yield {"__end__": state}


post_generator_agent = SimpleGraphRunner()
