import os
import json
import warnings
import asyncio

# Suppress transformers noise before any AI imports
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
os.environ["TOKENIZERS_PARALLELISM"] = "false"

# Suppress the spurious transformers/PyTorch warning
warnings.filterwarnings("ignore", message=".*PyTorch.*")

from dotenv import load_dotenv

from pipecat.frames.frames import (
    EndFrame,
    InputAudioRawFrame,
    OutputTransportMessageFrame,
    OutputAudioRawFrame,
    TTSAudioRawFrame,
    TTSStartedFrame,
    TTSStoppedFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
    ErrorFrame,
    TextFrame,
    TranscriptionFrame
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineTask
from pipecat.processors.aggregators.llm_response_universal import (
    LLMAssistantAggregator,
    LLMContext,
    LLMUserAggregator
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.serializers.base_serializer import FrameSerializer
from pipecat.services.openai.llm import OpenAILLMService
from pipecat.services.groq.stt import GroqSTTService
from pipecat.services.elevenlabs.tts import ElevenLabsTTSService
from pipecat.transports.websocket.fastapi import (
    FastAPIWebsocketParams,
    FastAPIWebsocketTransport
)
from pipecat.serializers.twilio import TwilioFrameSerializer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.processors.audio.vad_processor import VADProcessor
from pipecat.frames.frames import ErrorFrame

load_dotenv()


# ── Serializer ────────────────────────────────────────────────
class AudioJSONSerializer(FrameSerializer):
    async def serialize(self, frame):
        if isinstance(frame, (OutputAudioRawFrame, TTSAudioRawFrame)):
            return frame.audio
        return None

    async def deserialize(self, data):
        if isinstance(data, bytes):
            return InputAudioRawFrame(audio=data, sample_rate=16000, num_channels=1)
        if isinstance(data, str):
            try:
                msg = json.loads(data)
                if msg.get("type") == "end_call":
                    return EndFrame()
            except Exception:
                pass
        return None

from pipecat.frames.frames import LLMContextFrame, LLMRunFrame, TextFrame, LLMFullResponseEndFrame

# ── UI Updaters ────────────────────────────────────────────────
class UserWSUpdater(FrameProcessor):
    def __init__(self, websocket):
        super().__init__()
        self.websocket = websocket

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame):
            print(f"DEBUG: [WS] Sending User Transcript: {frame.text}")
            try:
                await self.websocket.send_text(json.dumps({
                    "type": "transcript", "role": "user", "text": frame.text
                }))
            except: pass
        await self.push_frame(frame, direction)

class KnowledgeRetriever(FrameProcessor):
    def __init__(self, context: LLMContext, knowledge_items: list):
        super().__init__()
        self.context = context
        self.knowledge_items = knowledge_items
        self.current_knowledge = set()

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame):
            text = frame.text.lower()
            new_info = []
            for item in self.knowledge_items:
                keywords = item["title"].lower().split() + item["category"].lower().split()
                if any(kw in text for kw in keywords if len(kw) > 3) or item["title"].lower() in text:
                    if item["id"] not in self.current_knowledge:
                        self.current_knowledge.add(item["id"])
                        new_info.append(f"[{item['category']}] {item['title']}: {item['content']}")
            if new_info:
                rag_context = "\n\n--- Retrieved Knowledge ---\n" + "\n".join(new_info)
                self.context.messages[0]["content"] += rag_context
                print(f"🧠 RAG: Injected {len(new_info)} relevant articles into context.")
        await self.push_frame(frame, direction)

class AIWSUpdater(FrameProcessor):
    def __init__(self, websocket):
        super().__init__()
        self.websocket = websocket
        self.ai_text_buffer = ""

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame):
            self.ai_text_buffer = ""
        if isinstance(frame, TextFrame):
            self.ai_text_buffer += frame.text
        elif isinstance(frame, LLMFullResponseEndFrame):
            if self.ai_text_buffer.strip():
                greeting_text = "Hello! I'm Beney, your AI receptionist. How can I help you today?"
                clean_text = self.ai_text_buffer.replace(greeting_text, "").strip()
                display_text = clean_text if clean_text else self.ai_text_buffer.strip()
                print(f"DEBUG: [WS] Sending Full AI Transcript: {display_text}")
                try:
                    await self.websocket.send_text(json.dumps({
                        "type": "transcript", "role": "ai", "text": display_text
                    }))
                except: pass

                full_text_lower = display_text.lower()
                hangup_phrases = ["goodbye", "have a good day", "have a great day", "bye for now", "end the call now", "hanging up", "bye."]
                if any(phrase in full_text_lower for phrase in hangup_phrases):
                    print(f"👋 AI Hang-up Detected: {display_text}")
                    try:
                        await self.websocket.send_text(json.dumps({"type": "hangup"}))
                    except: pass
                    async def delayed_end():
                        await asyncio.sleep(2)
                        await self.push_frame(EndFrame())
                    asyncio.create_task(delayed_end())
            self.ai_text_buffer = ""
        elif isinstance(frame, ErrorFrame):
            print(f"🚨 PIPECAT ERROR: {frame.error}")

class StatusUpdater(FrameProcessor):
    def __init__(self, websocket):
        super().__init__()
        self.websocket = websocket

    async def process_frame(self, frame, direction):
        await super().process_frame(frame, direction)
        if isinstance(frame, UserStartedSpeakingFrame):
            print("👤 User started speaking")
            try: await self.websocket.send_text(json.dumps({"type": "status", "value": "listening"}))
            except: pass
        elif isinstance(frame, UserStoppedSpeakingFrame):
            print("👤 User stopped speaking")
            try: await self.websocket.send_text(json.dumps({"type": "status", "value": "idle"}))
            except: pass
        elif isinstance(frame, TTSStartedFrame):
            print("🔊 AI started speaking")
            try: await self.websocket.send_text(json.dumps({"type": "status", "value": "speaking"}))
            except: pass
        elif isinstance(frame, TTSStoppedFrame):
            print("🤫 AI stopped speaking")
            try: await self.websocket.send_text(json.dumps({"type": "status", "value": "idle"}))
            except: pass


# ── Main Agent ────────────────────────────────────────────────
async def run_agent(websocket, stream_id, on_call_end=None,
                    knowledge_items=None, recent_memories=None, is_twilio=False):
    if is_twilio:
        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_in_sample_rate=8000,
                audio_out_enabled=True,
                audio_out_sample_rate=8000,
                serializer=TwilioFrameSerializer(stream_id)
            )
        )
        sample_rate = 8000
    else:
        transport = FastAPIWebsocketTransport(
            websocket=websocket,
            params=FastAPIWebsocketParams(
                audio_in_enabled=True,
                audio_in_sample_rate=16000,
                audio_out_enabled=True,
                audio_out_sample_rate=16000,
                serializer=AudioJSONSerializer()
            )
        )
        sample_rate = 16000

    vad = VADProcessor(
        vad_analyzer=SileroVADAnalyzer(params=VADParams(
            min_volume=0.1,
            confidence=0.7,
            start_secs=0.2,
            stop_secs=0.5
        ))
    )

    stt = GroqSTTService(
        api_key=os.getenv("GROQ_API_KEY"),
        settings=GroqSTTService.Settings(model="whisper-large-v3-turbo")
    )

    groq_key = os.getenv("GROQ_API_KEY")
    llm = OpenAILLMService(
        api_key=groq_key,
        base_url="https://api.groq.com/openai/v1",
        settings=OpenAILLMService.Settings(model="llama-3.3-70b-versatile")
    )

    tts = ElevenLabsTTSService(
        api_key=os.getenv("ELEVENLABS_API_KEY"),
        sample_rate=sample_rate,
        settings=ElevenLabsTTSService.Settings(
            voice=os.getenv("ELEVENLABS_VOICE_ID", "pNInz6obpg8nEByWQX7d")
        )
    )

    memory_str = ""
    if recent_memories:
        lines = ["\n\nRecent call summaries (for context):"]
        for m in recent_memories:
            lines.append(f"- {m['summary']}")
        memory_str = "\n".join(lines)

    context = LLMContext(messages=[
        {
            "role": "system",
            "content": (
                "You are Beney, a professional AI Voice Receptionist on a live phone call. "
                "You can hear the caller's voice and respond with your own voice. "
                "Never claim to be text-based or say you cannot hear. "
                "Help callers with inquiries and booking appointments. "
                "Keep responses concise and conversational — no emojis, no markdown."
                + memory_str
            )
        }
    ])

    user_agg      = LLMUserAggregator(context)
    assistant_agg = LLMAssistantAggregator(context)
    user_ws       = UserWSUpdater(websocket)
    ai_ws         = AIWSUpdater(websocket)
    status_ws     = StatusUpdater(websocket)
    rag           = KnowledgeRetriever(context, knowledge_items or [])

    pipeline = Pipeline([
        transport.input(),
        vad,
        stt,
        user_ws,
        rag,
        user_agg,
        llm,
        ai_ws,
        tts,
        assistant_agg,
        status_ws,
        transport.output()
    ])

    task = PipelineTask(pipeline)

    @transport.event_handler("on_client_connected")
    async def on_client_connected(transport, client):
        greeting = "Hello! I'm Beney, your AI receptionist. How can I help you today?"
        try:
            await websocket.send_text(json.dumps({
                "type": "transcript", "role": "ai", "text": greeting
            }))
        except: pass
        await task.queue_frames([TextFrame(greeting)])

    try:
        runner = PipelineRunner()

        async def watch_connection():
            try:
                while True:
                    if websocket.client_state.value == 2:
                        print(f"📡 Socket disconnected for {stream_id}. Stopping runner...")
                        await runner.stop()
                        break
                    await asyncio.sleep(1)
            except:
                pass

        watcher = asyncio.create_task(watch_connection())
        await runner.run(task)
        watcher.cancel()

    except asyncio.CancelledError:
        print(f"📡 Agent for {stream_id} was cancelled.")
        try:
            await asyncio.wait_for(runner.stop(), timeout=1.0)
        except: pass
        # Do NOT re-raise — let the finally block run cleanly without
        # propagating the CancelledError into on_call_end.

    finally:
        # ── CRITICAL FIX ─────────────────────────────────────────────
        # _on_call_end_wrapper is a sync function that internally creates
        # an asyncio task for on_call_end and registers it so the
        # websocket_endpoint finally block can await it.
        # We call it directly (not via create_task) since it's synchronous.
        #
        # We do NOT await on_call_end here because of the CancelledError
        # race condition: if agent_task.cancel() fires while we are at
        # `await on_call_end(...)`, the CancelledError kills the save.
        if on_call_end:
            print(f"[END] End of Call for {stream_id}. Scheduling save...")
            try:
                on_call_end(context.messages)  # sync wrapper — creates task internally
            except Exception as e:
                print(f"[ERROR] Could not schedule on_call_end: {e}")

    return