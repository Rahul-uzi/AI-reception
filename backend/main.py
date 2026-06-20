"""
main.py — FastAPI backend for AI Receptionist

ROOT CAUSE OF 0:00 / "In Progress" stuck calls (now fixed):
  runner.stop() (from agent.py's watch_connection) and agent_task.cancel()
  (from websocket_endpoint's monitoring loop) fire at the same time.
  The pipeline ends normally via runner.stop(), bringing run_agent to its
  finally block. Then agent_task.cancel() delivers CancelledError exactly
  during `await on_call_end(...)`. CancelledError is BaseException — NOT
  caught by `except Exception` in agent.py — silently aborting the save.
  Neither finally block printed anything because both were interrupted.

FIXES:
  1. agent.py finally: asyncio.create_task(on_call_end(...)) — immune to
     task cancellation, no await needed.
  2. main.py monitoring loop: save BEFORE calling agent_task.cancel() so
     the save happens in a guaranteed non-cancelled execution context.
  3. call_ended flag: prevents double-saves across all three save points.
  4. websocket_endpoint finally: no await, only create_task (fallback).
  5. _deleted_call_ids: prevents re-insertion of deleted calls.
  6. MIN_CALL_DURATION: junk <10s calls are auto-discarded.
"""
import os
os.environ["TRANSFORMERS_VERBOSITY"] = "error"
import json
import uuid
import signal
import asyncio
import httpx
from datetime import datetime
from fastapi import FastAPI, WebSocket, Depends, HTTPException, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv
from contextlib import asynccontextmanager

# ══════════════════════════════════════════════════════════════════
# WINDOWS PROCESS TERMINATION HELPER
# ══════════════════════════════════════════════════════════════════
if os.name == "nt":
    import ctypes
    from ctypes import wintypes

    # Keep a reference to the handler callback to prevent garbage collection
    _ctrl_handler_ref = None

    def install_windows_ctrl_handler():
        global _ctrl_handler_ref
        
        # Define the callback type
        # HandlerRoutine: BOOL WINAPI HandlerRoutine(DWORD dwCtrlType);
        HandlerRoutine = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.DWORD)
        
        def ctrl_handler(ctrl_type):
            # 0: CTRL_C_EVENT, 1: CTRL_BREAK_EVENT, 2: CTRL_CLOSE_EVENT
            if ctrl_type in (0, 1, 2):
                print("\n[STOP] Force exit (Ctrl+C)")
                # Terminate the parent process (Uvicorn master) to prevent terminal freeze
                try:
                    ppid = os.getppid()
                    if ppid > 1:
                        os.kill(ppid, 9)  # 9 is SIGKILL / terminate
                except Exception:
                    pass
                # Terminate this process immediately
                os._exit(0)
                return True
            return False

        _ctrl_handler_ref = HandlerRoutine(ctrl_handler)
        kernel32 = ctypes.windll.kernel32
        # SetConsoleCtrlHandler(handler, add=True)
        if not kernel32.SetConsoleCtrlHandler(_ctrl_handler_ref, True):
            print("[WARN] Failed to register Windows console control handler.")

    try:
        install_windows_ctrl_handler()
    except Exception as e:
        print(f"[WARN] Failed to install Windows console control handler: {e}")


from database import (
    init_db, save_call, get_all_calls, get_call_by_id, delete_call,
    get_all_users, get_user_by_email, create_user, update_user, delete_user,
    get_all_contacts, create_contact, update_contact, delete_contact,
    get_all_knowledge, create_knowledge, update_knowledge, delete_knowledge,
    save_memory, get_recent_memories,
)
from auth import (
    hash_password, verify_password, create_token,
    get_current_user, require_admin, require_manager, require_viewer
)
from agent import run_agent

load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# Prevent re-insertion of deleted calls by live sessions.
_deleted_call_ids: set = set()

# Calls shorter than this (seconds) are discarded as junk/accidental.
MIN_CALL_DURATION = 10


# ══════════════════════════════════════════════════════════════════
# LIFESPAN
# ══════════════════════════════════════════════════════════════════
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Register signal handlers to force exit on Ctrl+C (SIGINT/SIGTERM)
    # This prevents the process from freezing on Windows when stopping.
    def _force_exit(signum, frame):
        print("\n[STOP] Force exit (Ctrl+C)")
        os._exit(0)

    try:
        signal.signal(signal.SIGINT,  _force_exit)
        signal.signal(signal.SIGTERM, _force_exit)
    except ValueError:
        # Raised if signal.signal is called from a thread other than the main thread
        pass

    await init_db()
    stuck_analyzing = []
    try:
        calls = await get_all_calls()
        for c in calls:
            if c.get("status") == "In Progress":
                print(f"[CLEANUP] Cleaning stale In-Progress call: {c['id']}")
                c["status"]  = "Incomplete"
                c["summary"] = "Call was interrupted."
                await save_call(c)
            elif (c.get("summary") == "Analyzing call..."
                  or c.get("outcome") == "Analyzing..."):
                # Analysis task was killed when server restarted.
                # Collect so we can re-run after startup.
                stuck_analyzing.append(c)
                print(f"[RE-ANALYSIS] Queued for re-analysis: {c['id']}")
    except Exception as e:
        print(f"Startup cleanup error: {e}")

    print("[OK] DB ready")

    # ── Schedule re-analysis BEFORE yield (runs during startup) ─────
    # Tasks created here run on the live event loop while the app serves
    # requests. The 3-second sleep lets the server fully initialize first.
    if stuck_analyzing:
        print(f"[RE-ANALYSIS] Scheduling re-analysis for {len(stuck_analyzing)} stuck call(s)...")

        async def _reanalyze_all_stuck(calls_to_fix):
            await asyncio.sleep(3)
            for c in calls_to_fix:
                log = c.get("transcript") or []
                if isinstance(log, str):
                    try: log = json.loads(log)
                    except: log = []
                dur = c.get("duration", "0:00")
                print(f"[RE-ANALYSIS] Re-analyzing stuck call {c['id']} | {len(log)} msgs | duration={dur}")
                try:
                    await _do_analysis(dict(c), list(log), c["id"])
                except Exception as e:
                    print(f"[ERROR] Re-analysis failed for {c['id']}: {e}")

        asyncio.create_task(_reanalyze_all_stuck(stuck_analyzing))

    yield  # ── App runs here ────────────────────────────────────────
    print("Shutting down")
    os._exit(0)


app = FastAPI(title="AI Receptionist API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
)


# ══════════════════════════════════════════════════════════════════
# AUTH
# ══════════════════════════════════════════════════════════════════
class LoginRequest(BaseModel):
    email: str
    password: str

@app.post("/auth/login")
async def login(body: LoginRequest):
    user = await get_user_by_email(body.email)
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(401, "Invalid email or password")
    return {
        "token": create_token(user["id"], user["role"]),
        "user":  {k: v for k, v in user.items() if k != "password_hash"}
    }

@app.get("/auth/me")
async def me(current_user: dict = Depends(get_current_user)):
    return {k: v for k, v in current_user.items() if k != "password_hash"}

class UpdateProfileRequest(BaseModel):
    name: Optional[str]             = None
    email: Optional[str]            = None
    role: Optional[str]             = None
    phone: Optional[str]            = None
    avatar: Optional[str]           = None
    current_password: Optional[str] = None
    new_password: Optional[str]     = None

@app.put("/auth/me")
async def update_profile(body: UpdateProfileRequest, current_user: dict = Depends(get_current_user)):
    updates = {}
    if body.name:   updates["name"]   = body.name
    if body.email:  updates["email"]  = body.email
    if body.phone:  updates["phone"]  = body.phone
    if body.avatar: updates["avatar"] = body.avatar
    if body.role and body.role.lower() in ("admin", "manager", "viewer"):
        updates["role"] = body.role.lower()
    if body.new_password:
        if not body.current_password:
            raise HTTPException(400, "Current password required")
        if not verify_password(body.current_password, current_user["password_hash"]):
            raise HTTPException(400, "Current password is incorrect")
        updates["password_hash"] = hash_password(body.new_password)
    updated = await update_user(current_user["id"], **updates)
    return {k: v for k, v in updated.items() if k != "password_hash"}


# ══════════════════════════════════════════════════════════════════
# USERS
# ══════════════════════════════════════════════════════════════════
class CreateUserRequest(BaseModel):
    email: str; password: str; name: str
    role: str = "viewer"; phone: Optional[str] = None

class UpdateUserRequest(BaseModel):
    name: Optional[str] = None; email: Optional[str] = None
    role: Optional[str] = None; phone: Optional[str] = None
    password: Optional[str] = None

@app.get("/users", dependencies=[Depends(require_admin)])
async def list_users(): return await get_all_users()

@app.post("/users", dependencies=[Depends(require_admin)])
async def add_user(body: CreateUserRequest):
    if await get_user_by_email(body.email): raise HTTPException(409, "Email in use")
    if body.role not in ("admin","manager","viewer"): raise HTTPException(400, "Bad role")
    user = await create_user(body.email, hash_password(body.password), body.name, body.role, body.phone)
    return {k: v for k, v in user.items() if k != "password_hash"}

@app.put("/users/{user_id}", dependencies=[Depends(require_admin)])
async def edit_user(user_id: str, body: UpdateUserRequest):
    updates = {}
    if body.name:     updates["name"]         = body.name
    if body.email:    updates["email"]         = body.email
    if body.role:     updates["role"]          = body.role
    if body.phone:    updates["phone"]         = body.phone
    if body.password: updates["password_hash"] = hash_password(body.password)
    updated = await update_user(user_id, **updates)
    return {k: v for k, v in updated.items() if k != "password_hash"}

@app.delete("/users/{user_id}", dependencies=[Depends(require_admin)])
async def remove_user(user_id: str, current_user: dict = Depends(get_current_user)):
    if user_id == current_user["id"]: raise HTTPException(400, "Cannot delete yourself")
    await delete_user(user_id); return {"ok": True}


# ══════════════════════════════════════════════════════════════════
# CALLS
# ══════════════════════════════════════════════════════════════════
@app.get("/calls", dependencies=[Depends(require_viewer)])
async def get_calls(): return await get_all_calls()

@app.get("/calls/{call_id}", dependencies=[Depends(require_viewer)])
async def get_call(call_id: str):
    call = await get_call_by_id(call_id)
    if not call: raise HTTPException(404, "Not found")
    return call

@app.delete("/calls/{call_id}", dependencies=[Depends(require_manager)])
async def remove_call(call_id: str):
    _deleted_call_ids.add(call_id)   # Block live session from re-inserting
    await delete_call(call_id)
    return {"message": "Call deleted"}

@app.get("/stats", dependencies=[Depends(require_viewer)])
async def get_stats():
    calls = await get_all_calls()
    if not calls:
        return {"total":0,"answered":0,"avg_duration":"00:00","resolution_rate":0,
                "today":0,"sentiment":{"positive":0,"neutral":0,"negative":0},"by_outcome":[]}
    today     = datetime.now().date().isoformat()
    completed = [c for c in calls if c.get("status") == "Completed"]
    total_s   = sum(_dur_to_secs(c.get("duration","0:00")) for c in completed)
    avg_s     = total_s // len(completed) if completed else 0
    sentiment = {"positive":0,"neutral":0,"negative":0}
    for c in calls:
        s = (c.get("sentiment") or "neutral").lower()
        if s in sentiment: sentiment[s] += 1
    oc = {}
    for c in calls: oc[c.get("outcome","Unknown")] = oc.get(c.get("outcome","Unknown"),0)+1
    return {
        "total": len(calls), "answered": len(completed),
        "avg_duration": f"{avg_s//60:02d}:{avg_s%60:02d}",
        "resolution_rate": round(len(completed)/len(calls)*100),
        "today": sum(1 for c in calls if (c.get("timestamp","")).startswith(today)),
        "sentiment": sentiment,
        "by_outcome": sorted([{"label":k,"count":v} for k,v in oc.items()],key=lambda x:-x["count"])
    }

def _dur_to_secs(dur: str) -> int:
    try:
        parts = dur.split(":"); return int(parts[0])*60 + int(parts[1])
    except: return 0


# ══════════════════════════════════════════════════════════════════
# ANALYTICS
# ══════════════════════════════════════════════════════════════════
@app.get("/analytics", dependencies=[Depends(require_viewer)])
async def get_analytics():
    calls = await get_all_calls()
    days  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"]
    by_day = {d:{"calls":0,"resolved":0} for d in days}
    for c in calls:
        ts = c.get("timestamp","")
        if ts:
            try:
                idx  = datetime.fromisoformat(ts).weekday()
                name = days[(idx+1)%7]
                by_day[name]["calls"] += 1
                if c.get("status") == "Completed": by_day[name]["resolved"] += 1
            except: pass
    sentiment = {"positive":0,"neutral":0,"negative":0}
    for c in calls:
        s = (c.get("sentiment") or "neutral").lower()
        if s in sentiment: sentiment[s] += 1
    oc    = {}
    for c in calls: oc[c.get("outcome","Unknown")] = oc.get(c.get("outcome","Unknown"),0)+1
    total = len(calls) or 1
    completed = [c for c in calls if c.get("status")=="Completed"]
    avg_s = (sum(_dur_to_secs(c.get("duration","0:00")) for c in completed) // len(completed)) if completed else 0
    return {
        "totalCalls":     len(calls),
        "avgDuration":    f"{avg_s//60:02d}:{avg_s%60:02d}",
        "resolutionRate": round(len(completed)/total*100),
        "satisfaction":   round(sentiment["positive"]/total*100),
        "byDay":          [{"day":d,"calls":by_day[d]["calls"],"resolved":by_day[d]["resolved"]} for d in days],
        "byOutcome":      [{"name":k,"value":round(v/total*100)} for k,v in oc.items()],
        "byHour":         [{"hour":f"{i:02d}:00","calls":0} for i in range(24)],
        "memories":       await get_recent_memories(5)
    }


# ══════════════════════════════════════════════════════════════════
# CONTACTS
# ══════════════════════════════════════════════════════════════════
class ContactBody(BaseModel):
    name: str; phone: Optional[str]=None; email: Optional[str]=None
    company: Optional[str]=None; notes: Optional[str]=None

@app.get("/contacts",                    dependencies=[Depends(require_viewer)])
async def list_contacts(): return await get_all_contacts()

@app.post("/contacts",                   dependencies=[Depends(require_manager)])
async def add_contact(body: ContactBody): return await create_contact(body.model_dump())

@app.put("/contacts/{cid}",              dependencies=[Depends(require_manager)])
async def edit_contact(cid: str, body: ContactBody):
    await update_contact(cid, body.model_dump()); return {"ok":True}

@app.delete("/contacts/{cid}",           dependencies=[Depends(require_manager)])
async def remove_contact(cid: str): await delete_contact(cid); return {"ok":True}


# ══════════════════════════════════════════════════════════════════
# KNOWLEDGE BASE
# ══════════════════════════════════════════════════════════════════
class KnowledgeBody(BaseModel):
    title: str; content: str; category: Optional[str]="General"

@app.get("/knowledge",                   dependencies=[Depends(require_viewer)])
async def list_knowledge(): return await get_all_knowledge()

@app.post("/knowledge",                  dependencies=[Depends(require_manager)])
async def add_knowledge(body: KnowledgeBody): return await create_knowledge(body.model_dump())

@app.put("/knowledge/{kid}",             dependencies=[Depends(require_manager)])
async def edit_knowledge(kid: str, body: KnowledgeBody):
    await update_knowledge(kid, body.model_dump()); return {"ok":True}

@app.delete("/knowledge/{kid}",          dependencies=[Depends(require_manager)])
async def remove_knowledge(kid: str): await delete_knowledge(kid); return {"ok":True}


# ══════════════════════════════════════════════════════════════════
# SETTINGS
# ══════════════════════════════════════════════════════════════════
_settings_cache = {
    "profile":       {"name":"Admin","email":"admin@demo.com","role":"Admin"},
    "receptionist":  {"name":"AI Receptionist",
                      "greeting":"Hello! I'm Beney, your AI receptionist. How can I help you today?",
                      "language":"en-US","voiceSpeed":1.0,"voicePitch":1.0},
    "notifications": {"email":True,"sms":False,"callSummary":True,"escalation":True},
    "integration":   {"webhookUrl":"","apiKey":""}
}

@app.get("/settings", dependencies=[Depends(require_viewer)])
async def get_settings(current_user: dict = Depends(get_current_user)):
    _settings_cache["profile"] = {
        "name":current_user["name"],"email":current_user["email"],
        "role":current_user["role"].capitalize()
    }
    return _settings_cache

@app.put("/settings", dependencies=[Depends(require_admin)])
async def save_settings(data: dict): _settings_cache.update(data); return _settings_cache


# ══════════════════════════════════════════════════════════════════
# AI SUMMARY HELPER
# ══════════════════════════════════════════════════════════════════
async def generate_voice_summary(transcript_text: str) -> dict:
    if not transcript_text or not GROQ_API_KEY:
        return {"summary":"No transcript.","sentiment":"neutral","actions":[],"outcome":"Incomplete"}
    prompt = f"""Analyze this phone call transcript and return JSON only.
Be sensitive to caller frustration or dissatisfaction.

Fields:
1. "summary": 1-2 sentence summary.
2. "sentiment": "negative" if ANY frustration/complaint, "positive" if explicitly happy, else "neutral".
3. "actions": list of tasks requested.
4. "outcome": short label e.g. "Appointment Booked", "Complaint", "Inquiry".
5. "keywords": list of 3-5 topic words.

Transcript:
{transcript_text}

JSON Output:"""
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json={"model":"llama-3.3-70b-versatile",
                      "messages":[{"role":"user","content":prompt}],
                      "response_format":{"type":"json_object"}},
                timeout=15.0
            )
            return json.loads(resp.json()["choices"][0]["message"]["content"])
    except Exception as e:
        print(f"Summary error: {e}")
        return {"summary":"Could not analyze.","sentiment":"neutral","actions":[],"outcome":"Error","keywords":[]}


# ══════════════════════════════════════════════════════════════════
# HELPERS shared by websocket handler
# ══════════════════════════════════════════════════════════════════
async def _do_analysis(entry: dict, log: list, call_id: str, websocket: WebSocket = None):
    """Run AI summary and save final call record. Always safe to create_task."""
    try:
        clean = [m for m in log if m["role"] in ("ai","user") and m["text"].strip()]
        text  = "\n".join(
            f"{'AI Receptionist' if m['role']=='ai' else 'Caller'}: {m['text']}"
            for m in clean
        )
        analysis = await generate_voice_summary(text)
        entry.update({
            "status":    "Completed",
            "summary":   analysis.get("summary",""),
            "sentiment": analysis.get("sentiment","neutral"),
            "outcome":   analysis.get("outcome","Completed"),
            "actions":   analysis.get("actions",[])
        })
        await save_call(entry)
        if analysis.get("summary"):
            kw = analysis.get("keywords",[])
            if isinstance(kw, str): kw = [k.strip() for k in kw.split(",")]
            await save_memory(call_id, analysis["summary"], kw)
        print(f"[OK] Analysis done for {call_id}")
        # Always try to notify — Pipecat may have closed transport but
        # the raw FastAPI WebSocket may still accept one last message.
        if websocket:
            print(f"[WS] Sending summary_ready for {call_id}")
            try:
                await websocket.send_text(json.dumps({"type": "summary_ready"}))
            except Exception as wse:
                print(f"[WARN] Failed to send summary_ready: {wse}")
    except BaseException as e:
        print(f"[ERROR] Analysis failed for {call_id}: {type(e).__name__}: {e}")
        # Re-raise CancelledError etc. — they are not real errors
        if isinstance(e, (asyncio.CancelledError, GeneratorExit, KeyboardInterrupt, SystemExit)):
            raise
        entry["status"]  = "Completed (No Summary)"
        entry["outcome"] = "Error"
        try:
            await save_call(entry)
        except Exception as se:
            print(f"[ERROR] Fallback save failed for {call_id}: {se}")
        # Always notify so client doesn't hang
        if websocket:
            try:
                await websocket.send_text(json.dumps({"type": "summary_ready"}))
            except:
                pass

def _schedule_save(entry: dict, log: list, call_id: str, duration_str: str, websocket: WebSocket = None):
    """Schedule the final save + analysis as independent tasks."""
    entry.update({
        "duration":   duration_str,
        "status":     "Completed",
        "transcript": list(log),
        "outcome":    "Analyzing...",
        "summary":    "Analyzing call..."
    })
    snap = dict(entry)
    log_snap = list(log)
    asyncio.create_task(save_call(snap))
    analysis_task = None
    if log_snap:
        analysis_task = asyncio.create_task(_do_analysis(snap, log_snap, call_id, websocket))
    else:
        # No transcript — nothing to analyze, just notify
        if websocket:
            async def send_ready():
                try:
                    await websocket.send_text(json.dumps({"type": "summary_ready"}))
                except:
                    pass
            analysis_task = asyncio.create_task(send_ready())
    print(f"[SAVE] Save scheduled for {call_id}. Duration: {duration_str}")
    return analysis_task


# ══════════════════════════════════════════════════════════════════
# TWILIO TELEPHONY INTEGRATION
# ══════════════════════════════════════════════════════════════════
@app.post("/twiml")
async def twilio_webhook(request: Request):
    """
    Twilio hits this endpoint when a user dials the phone number.
    We return TwiML instructing Twilio to stream audio to our WebSocket.
    """
    host = request.headers.get("host", "localhost:8000")
    # Determine the scheme (wss if https, else ws)
    scheme = "wss" if request.headers.get("x-forwarded-proto") == "https" else "ws"
    
    ws_url = f"{scheme}://{host}/ws/twilio"
    print(f"[TWILIO] Incoming call! Instructing Twilio to stream to {ws_url}")
    
    # Generate TwiML response
    twiml = f"""<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Connect>
        <Stream url="{ws_url}" />
    </Connect>
</Response>
"""
    return Response(content=twiml, media_type="application/xml")

@app.websocket("/ws/twilio")
async def twilio_websocket_endpoint(websocket: WebSocket):
    """
    Accepts the raw audio stream from Twilio and connects it to the Pipecat agent.
    """
    await websocket.accept()
    call_id = str(uuid.uuid4())
    start_time = datetime.now()
    print(f"[TWILIO WS] Connected: {call_id}")
    
    conversation_log: list = []
    call_active = True
    
    entry = {
        "id":        call_id,
        "phone":     "Twilio Caller",
        "timestamp": start_time.isoformat(),
        "duration":  "0:00",
        "status":    "In Progress",
        "transcript": [],
        "summary":   "Call in progress...",
        "sentiment": "neutral",
        "outcome":   "Active",
        "actions":   []
    }
    await save_call(entry)
    
    # Periodically update the dashboard with the live transcript
    async def sync_to_db():
        while True:
            await asyncio.sleep(5)
            if call_id in _deleted_call_ids: break
            if call_active:
                try:
                    entry["transcript"] = list(conversation_log)
                    await save_call(entry)
                except Exception:
                    pass
    
    sync_task = asyncio.create_task(sync_to_db())
    
    on_call_end_task = None
    analysis_task = None
    
    try:
        # Run the Pipecat agent specifically configured for Twilio
        on_call_end_task = await run_agent(
            websocket,
            conversation_log,
            call_id,
            start_time,
            entry,
            is_twilio=True
        )
    except Exception as e:
        print(f"[TWILIO WS] Error: {e}")
    finally:
        call_active = False
        sync_task.cancel()
        print(f"[TWILIO WS] Connection closed: {call_id}")
        
        duration = datetime.now() - start_time
        duration_str = f"{duration.seconds // 60}:{duration.seconds % 60:02d}"
        
        if duration.total_seconds() < MIN_CALL_DURATION:
            print(f"[TWILIO WS] Call {call_id} too short ({duration_str}), discarding.")
            _deleted_call_ids.add(call_id)
            await delete_call(call_id)
        else:
            if on_call_end_task:
                try:
                    await on_call_end_task
                except asyncio.CancelledError:
                    pass
                analysis_task = getattr(on_call_end_task, "analysis_task", None)
            
            if not analysis_task:
                analysis_task = _schedule_save(entry, conversation_log, call_id, duration_str, websocket=None)
                
            try:
                await analysis_task
            except Exception as e:
                print(f"[SAVE] Final save/analysis failed for {call_id}: {e}")

# ══════════════════════════════════════════════════════════════════
# BROWSER VOICE WEBSOCKET
# ══════════════════════════════════════════════════════════════════
@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    call_id    = str(uuid.uuid4())
    start_time = datetime.now()
    print(f"[WS] New call: {call_id}")

    conversation_log: list = []
    call_active = True
    call_ended  = False   # Guards against double-saves

    entry = {
        "id":        call_id,
        "phone":     "+1 (555) 123-4567",
        "timestamp": start_time.isoformat(),
        "duration":  "0:00",
        "status":    "In Progress",
        "transcript": [],
        "summary":   "Call in progress...",
        "sentiment": "neutral",
        "outcome":   "Active",
        "actions":   []
    }
    await save_call(entry)
    print(f"[WS] Call {call_id} record created.")

    # ── Periodic live sync ────────────────────────────────────────
    async def sync_to_db():
        while True:
            await asyncio.sleep(5)
            if call_id in _deleted_call_ids: break
            if call_active:
                try:
                    entry["transcript"] = list(conversation_log)
                    await save_call(entry)
                except Exception as e:
                    print(f"sync error: {e}")

    sync_task = asyncio.create_task(sync_to_db())

    # ── Intercept send_text to capture transcript live ────────────
    _orig_send = websocket.send_text
    async def intercepting_send_text(data: str):
        try:
            msg = json.loads(data)
            if msg.get("type") == "transcript":
                conversation_log.append({
                    "role": msg["role"], "text": msg["text"],
                    "time": datetime.now().isoformat()
                })
                if call_active and call_id not in _deleted_call_ids:
                    entry["transcript"] = list(conversation_log)
                    asyncio.create_task(save_call(dict(entry)))
        except: pass
        try: await _orig_send(data)
        except: pass
    websocket.send_text = intercepting_send_text

    # ── on_call_end — called from agent.py's finally via create_task ──
    # We track both the on_call_end task AND the analysis sub-task.
    # The finally block awaits on_call_end_task to ensure on_call_end
    # has fully run (and set analysis_task) before we check analysis_task.
    on_call_end_task = None
    analysis_task    = None

    async def on_call_end(messages=None):
        nonlocal call_ended, analysis_task
        if call_ended:
            print(f"[INFO] on_call_end: {call_id} already saved — skipping.")
            return
        call_ended = True
        sync_task.cancel()

        duration_secs = (datetime.now() - start_time).seconds
        duration_str  = f"{duration_secs // 60}:{duration_secs % 60:02d}"

        if call_id in _deleted_call_ids:
            print(f"[DELETE] {call_id} deleted — skipping save.")
            return
        if duration_secs < MIN_CALL_DURATION:
            print(f"[SHORT] {call_id} too short ({duration_secs}s) — discarding.")
            _deleted_call_ids.add(call_id)
            asyncio.create_task(delete_call(call_id))
            # Notify client even for short calls so it doesn't hang
            try:
                await websocket.send_text(json.dumps({"type": "summary_ready"}))
            except:
                pass
            return

        analysis_task = _schedule_save(entry, conversation_log, call_id, duration_str, websocket)

    def _on_call_end_wrapper(messages=None):
        """Create on_call_end as a tracked task so finally block can await it."""
        nonlocal on_call_end_task
        on_call_end_task = asyncio.create_task(on_call_end(messages))
        return on_call_end_task

    # ── Main lifecycle ────────────────────────────────────────────
    agent_task = None
    try:
        knowledge_items = await get_all_knowledge()
        recent_memories = await get_recent_memories(3)

        agent_task = asyncio.create_task(run_agent(
            websocket, call_id,
            on_call_end=_on_call_end_wrapper,
            knowledge_items=knowledge_items,
            recent_memories=recent_memories
        ))

        # Monitor loop — runs in normal (non-cancelled) context
        while not agent_task.done():
            if websocket.client_state.value == 2:  # client disconnected
                print(f"[DISCONNECT] Disconnect detected for {call_id}.")

                # ── KEY FIX: Save HERE, before cancel ────────────────
                # This is a guaranteed normal execution context — no
                # cancellation risk. create_task schedules saves that
                # run on the event loop even after the agent is gone.
                if not call_ended and call_id not in _deleted_call_ids:
                    duration_secs = (datetime.now() - start_time).seconds
                    duration_str  = f"{duration_secs // 60}:{duration_secs % 60:02d}"
                    if duration_secs < MIN_CALL_DURATION:
                        print(f"[SHORT] {call_id} too short ({duration_secs}s) — discarding.")
                        call_ended = True
                        _deleted_call_ids.add(call_id)
                        asyncio.create_task(delete_call(call_id))
                    else:
                        call_ended = True
                        analysis_task = _schedule_save(entry, conversation_log, call_id, duration_str, websocket)

                agent_task.cancel()
                break
            await asyncio.sleep(1)

        # Wait for agent to fully finish (natural end or cancellation)
        try:
            await agent_task
        except (asyncio.CancelledError, Exception):
            pass

    except Exception as e:
        print(f"Call {call_id} outer exception: {e}")
    finally:
        # ── Step 1: Await on_call_end if it was triggered from agent.py ──
        # This ensures analysis_task is set before we check it below.
        if on_call_end_task is not None:
            try:
                await asyncio.wait_for(on_call_end_task, timeout=2.0)
            except Exception:
                pass

        # ── Step 2: Cancel sync, mark inactive ────────────────────────
        call_active = False
        sync_task.cancel()

        duration_secs = (datetime.now() - start_time).seconds
        duration_str  = f"{duration_secs // 60}:{duration_secs % 60:02d}"
        print(f"[CLOSE] Session {call_id} closed. Duration: {duration_str}")

        if call_ended:
            print(f"[INFO] Already saved {call_id}.")
        elif call_id in _deleted_call_ids:
            print(f"[DELETE] {call_id} deleted — no fallback save.")
        elif duration_secs < MIN_CALL_DURATION:
            print(f"[SHORT] {call_id} too short — fallback discard.")
            _deleted_call_ids.add(call_id)
            asyncio.create_task(delete_call(call_id))
            try:
                await websocket.send_text(json.dumps({"type": "summary_ready"}))
            except:
                pass
        else:
            # on_call_end never ran — schedule fallback save
            print(f"[FALLBACK] Fallback save for {call_id}.")
            analysis_task = _schedule_save(entry, conversation_log, call_id, duration_str, websocket)

        # ── Step 3: Await the analysis task ───────────────────────────
        # Keep the WebSocket alive until Groq finishes so summary_ready
        # can be delivered. Falls back to 15-second timeout.
        if analysis_task:
            print(f"[WS] Waiting for analysis to complete for {call_id}...")
            try:
                await asyncio.wait_for(analysis_task, timeout=15.0)
                print(f"[WS] Analysis complete for {call_id}.")
            except Exception as e:
                print(f"[WS] Timeout/Error waiting for analysis: {e}")


# ══════════════════════════════════════════════════════════════════
# ENTRY POINT
# ══════════════════════════════════════════════════════════════════
if __name__ == "__main__":
    import uvicorn

    def _force_exit(signum, frame):
        print("\n[STOP] Force exit (Ctrl+C)")
        os._exit(0)

    signal.signal(signal.SIGINT,  _force_exit)
    signal.signal(signal.SIGTERM, _force_exit)
    uvicorn.run(app, host="0.0.0.0", port=8000, timeout_graceful_shutdown=3)