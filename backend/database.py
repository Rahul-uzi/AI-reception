"""
database.py — Async SQLite database layer for AI Receptionist
Tables: users, calls, contacts, knowledge, memories
"""
import uuid
import json
import asyncio
import aiosqlite
from datetime import datetime

DB_PATH = "receptionist.db"


# ── Schema ────────────────────────────────────────────────────────
SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    email       TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name        TEXT NOT NULL,
    role        TEXT NOT NULL DEFAULT 'viewer',   -- admin | manager | viewer
    avatar      TEXT,
    phone       TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS calls (
    id          TEXT PRIMARY KEY,
    phone       TEXT,
    timestamp   TEXT,
    duration    TEXT,
    status      TEXT DEFAULT 'Completed',
    summary     TEXT,
    sentiment   TEXT,
    outcome     TEXT,
    actions     TEXT,    -- JSON array
    transcript  TEXT     -- JSON array of {role, text, time}
);

CREATE TABLE IF NOT EXISTS contacts (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    phone       TEXT,
    email       TEXT,
    company     TEXT,
    notes       TEXT,
    call_count  INTEGER DEFAULT 0,
    last_call   TEXT,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge (
    id          TEXT PRIMARY KEY,
    title       TEXT NOT NULL,
    content     TEXT NOT NULL,
    category    TEXT DEFAULT 'General',
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS memories (
    id          TEXT PRIMARY KEY,
    call_id     TEXT,
    summary     TEXT NOT NULL,
    keywords    TEXT,   -- comma-separated
    created_at  TEXT NOT NULL
);
"""


async def init_db():
    """Initialize DB schema and create default admin user if none exists."""
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.executescript(SCHEMA)
        await db.commit()

        # Seed default users if empty
        cursor = await db.execute("SELECT COUNT(*) FROM users")
        count = (await cursor.fetchone())[0]
        if count == 0:
            from auth import hash_password
            now = datetime.now().isoformat()
            seed_users = [
                (str(uuid.uuid4()), "admin@demo.com",   hash_password("admin123"),   "Admin User",   "admin",   now, now),
                (str(uuid.uuid4()), "manager@demo.com", hash_password("manager123"), "Manager User", "manager", now, now),
                (str(uuid.uuid4()), "viewer@demo.com",  hash_password("viewer123"),  "Viewer User",  "viewer",  now, now),
            ]
            await db.executemany(
                "INSERT INTO users (id,email,password_hash,name,role,created_at,updated_at) VALUES (?,?,?,?,?,?,?)",
                seed_users
            )

            # Seed default knowledge base
            seed_knowledge = [
                (str(uuid.uuid4()), "Office Hours",
                 "We are open Monday to Friday, 9 AM to 6 PM. Closed on weekends and public holidays.",
                 "General", now, now),
                (str(uuid.uuid4()), "Appointment Booking",
                 "To book an appointment, callers need to provide their name, preferred date and time, and the reason for the visit.",
                 "Appointments", now, now),
                (str(uuid.uuid4()), "Pricing & Fees",
                 "Our standard consultation fee is $50. We accept all major credit cards and insurance plans.",
                 "Billing", now, now),
                (str(uuid.uuid4()), "Location & Landmarks",
                 "We are located at 123 Business Way, Suite 100. We are right next to the Big Blue Mall and across from the City Central Park.",
                 "General", now, now),
                (str(uuid.uuid4()), "Emergency Information",
                 "If you have an emergency after hours, please call 911 or visit the nearest clinic immediately.",
                 "Policy", now, now),
            ]
            await db.executemany(
                "INSERT INTO knowledge (id,title,content,category,created_at,updated_at) VALUES (?,?,?,?,?,?)",
                seed_knowledge
            )
            await db.commit()
            print("DB initialized with demo users: admin@demo.com/admin123, manager@demo.com/manager123, viewer@demo.com/viewer123")


# ── Users ─────────────────────────────────────────────────────────
async def get_user_by_email(email: str):
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE email=?", (email,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def get_user_by_id(user_id: str):
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM users WHERE id=?", (user_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def get_all_users():
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT id,email,name,role,avatar,phone,created_at,updated_at FROM users ORDER BY created_at")
        rows = await cursor.fetchall()
        return [dict(r) for r in rows]

async def create_user(email, password_hash, name, role="viewer", phone=None, avatar=None):
    now = datetime.now().isoformat()
    uid = str(uuid.uuid4())
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute(
            "INSERT INTO users (id,email,password_hash,name,role,avatar,phone,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (uid, email, password_hash, name, role, avatar, phone, now, now)
        )
        await db.commit()
    return await get_user_by_id(uid)

async def update_user(user_id: str, **fields):
    """Update any user fields. Only updates provided fields."""
    allowed = {"name", "email", "password_hash", "role", "avatar", "phone"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    if not updates:
        return await get_user_by_id(user_id)
    updates["updated_at"] = datetime.now().isoformat()
    set_clause = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [user_id]
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute(f"UPDATE users SET {set_clause} WHERE id=?", values)
        await db.commit()
    return await get_user_by_id(user_id)

async def delete_user(user_id: str):
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute("DELETE FROM users WHERE id=?", (user_id,))
        await db.commit()


# ── Calls ─────────────────────────────────────────────────────────
async def save_call(call_data: dict):
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute(
            """INSERT OR REPLACE INTO calls
               (id,phone,timestamp,duration,status,summary,sentiment,outcome,actions,transcript)
               VALUES (?,?,?,?,?,?,?,?,?,?)""",
            (
                call_data["id"],
                call_data.get("phone", ""),
                call_data.get("timestamp", datetime.now().isoformat()),
                call_data.get("duration", "0:00"),
                call_data.get("status", "Completed"),
                call_data.get("summary", ""),
                call_data.get("sentiment", "neutral"),
                call_data.get("outcome", "Unknown"),
                json.dumps(call_data.get("actions", [])),
                json.dumps(call_data.get("transcript", []))
            )
        )
        await db.commit()

async def get_all_calls():
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM calls ORDER BY timestamp DESC")
        rows = await cursor.fetchall()
        result = []
        for r in rows:
            d = dict(r)
            d["actions"]    = json.loads(d["actions"] or "[]")
            d["transcript"] = json.loads(d["transcript"] or "[]")
            result.append(d)
        return result

async def get_call_by_id(call_id: str):
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM calls WHERE id=?", (call_id,))
        row = await cursor.fetchone()
        if not row:
            return None
        d = dict(row)
        d["actions"]    = json.loads(d["actions"] or "[]")
        d["transcript"] = json.loads(d["transcript"] or "[]")
        return d


async def delete_call(call_id: str):
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute("DELETE FROM calls WHERE id=?", (call_id,))
        await db.commit()


# ── Contacts ──────────────────────────────────────────────────────
async def get_all_contacts():
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM contacts ORDER BY name")
        return [dict(r) for r in await cursor.fetchall()]

async def create_contact(data: dict):
    now = datetime.now().isoformat()
    uid = str(uuid.uuid4())
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute(
            "INSERT INTO contacts (id,name,phone,email,company,notes,call_count,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?)",
            (uid, data["name"], data.get("phone",""), data.get("email",""),
             data.get("company",""), data.get("notes",""), 0, now, now)
        )
        await db.commit()
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM contacts WHERE id=?", (uid,))
        return dict(await cursor.fetchone())

async def update_contact(contact_id: str, data: dict):
    now = datetime.now().isoformat()
    allowed = {"name","phone","email","company","notes"}
    updates = {k: v for k, v in data.items() if k in allowed}
    updates["updated_at"] = now
    set_clause = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [contact_id]
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute(f"UPDATE contacts SET {set_clause} WHERE id=?", values)
        await db.commit()

async def delete_contact(contact_id: str):
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute("DELETE FROM contacts WHERE id=?", (contact_id,))
        await db.commit()


# ── Knowledge ─────────────────────────────────────────────────────
async def get_all_knowledge():
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM knowledge ORDER BY category, title")
        return [dict(r) for r in await cursor.fetchall()]

async def create_knowledge(data: dict):
    now = datetime.now().isoformat()
    uid = str(uuid.uuid4())
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute(
            "INSERT INTO knowledge (id,title,content,category,created_at,updated_at) VALUES (?,?,?,?,?,?)",
            (uid, data["title"], data["content"], data.get("category","General"), now, now)
        )
        await db.commit()
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM knowledge WHERE id=?", (uid,))
        return dict(await cursor.fetchone())

async def update_knowledge(item_id: str, data: dict):
    now = datetime.now().isoformat()
    allowed = {"title","content","category"}
    updates = {k: v for k, v in data.items() if k in allowed}
    updates["updated_at"] = now
    set_clause = ", ".join(f"{k}=?" for k in updates)
    values = list(updates.values()) + [item_id]
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute(f"UPDATE knowledge SET {set_clause} WHERE id=?", values)
        await db.commit()

async def delete_knowledge(item_id: str):
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute("DELETE FROM knowledge WHERE id=?", (item_id,))
        await db.commit()


# ── Memories (AI Context) ─────────────────────────────────────────
async def save_memory(call_id: str, summary: str, keywords: list):
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        await db.execute(
            "INSERT INTO memories (id,call_id,summary,keywords,created_at) VALUES (?,?,?,?,?)",
            (str(uuid.uuid4()), call_id, summary, ",".join(keywords), datetime.now().isoformat())
        )
        await db.commit()

async def get_recent_memories(limit=5):
    """Get most recent memory summaries to inject into AI context."""
    async with aiosqlite.connect(DB_PATH, timeout=30) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute(
            "SELECT * FROM memories ORDER BY created_at DESC LIMIT ?", (limit,)
        )
        return [dict(r) for r in await cursor.fetchall()]

async def get_knowledge_for_ai():
    """Get all knowledge base items to inject into AI system prompt."""
    items = await get_all_knowledge()
    if not items:
        return ""
    lines = ["\\n\\n--- Knowledge Base ---"]
    for item in items:
        lines.append(f"[{item['category']}] {item['title']}: {item['content']}")
    return "\\n".join(lines)
