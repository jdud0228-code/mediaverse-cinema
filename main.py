import os, json, hmac, hashlib, secrets, sqlite3, time
from urllib.parse import parse_qsl
from pathlib import Path
from fastapi import FastAPI, HTTPException, Header
from fastapi.middleware.cors import CORSMiddlewar
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN", "")
DB_PATH = os.getenv("DATABASE_PATH", "mediaverse.sqlite3")
CATALOG_PATH = Path(__file__).with_name("catalog.json")
EXAMPLE_PATH = Path(__file__).with_name("catalog.example.json")
app = FastAPI(title="MediaVerse API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://mediaverse-cinema.onrender.com",
    ],
    allow_credentials=False,
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "X-Telegram-Init-Data"],
)

def db():
    con = sqlite3.connect(DB_PATH)
    con.row_factory = sqlite3.Row
    return con

def init_db():
    with db() as con:
        con.execute("""CREATE TABLE IF NOT EXISTS users(
            telegram_id INTEGER PRIMARY KEY, username TEXT, first_name TEXT, created_at INTEGER)""")
        con.execute("""CREATE TABLE IF NOT EXISTS favorites(
            telegram_id INTEGER, item_id TEXT, created_at INTEGER,
            PRIMARY KEY(telegram_id,item_id))""")
        con.execute("""CREATE TABLE IF NOT EXISTS history(
            id INTEGER PRIMARY KEY AUTOINCREMENT, telegram_id INTEGER, item_id TEXT, opened_at INTEGER)""")
init_db()

def catalog():
    path = CATALOG_PATH if CATALOG_PATH.exists() else EXAMPLE_PATH
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        data = []
    # Don't expose internal license notes to clients.
    return [{k:v for k,v in x.items() if k != "license_note"} for x in data]

def validate_init_data(init_data: str):
    if not BOT_TOKEN:
        raise HTTPException(503, "BOT_TOKEN is not configured")
    try:
        pairs = dict(parse_qsl(init_data, keep_blank_values=True))
        received_hash = pairs.pop("hash")
        auth_date = int(pairs.get("auth_date", "0"))
        if abs(int(time.time()) - auth_date) > 86400:
            raise ValueError("stale initData")
        data_check = "\n".join(f"{k}={v}" for k,v in sorted(pairs.items()))
        secret_key = hmac.new(b"WebAppData", BOT_TOKEN.encode(), hashlib.sha256).digest()
        expected = hmac.new(secret_key, data_check.encode(), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(expected, received_hash):
            raise ValueError("bad hash")
        user = json.loads(pairs["user"])
        return user
    except Exception:
        raise HTTPException(401, "Invalid Telegram initData")

def current_user(x_telegram_init_data: str = Header(default="")):
    if not x_telegram_init_data:
        raise HTTPException(401, "Open this Mini App from Telegram")
    user = validate_init_data(x_telegram_init_data)
    tid = int(user["id"])
    with db() as con:
        con.execute("INSERT INTO users(telegram_id,username,first_name,created_at) VALUES(?,?,?,?) "
                    "ON CONFLICT(telegram_id) DO UPDATE SET username=excluded.username, first_name=excluded.first_name",
                    (tid, user.get("username"), user.get("first_name",""), int(time.time())))
    return {"id":tid, "username":user.get("username"), "first_name":user.get("first_name","")}

class FavoriteBody(BaseModel):
    item_id: str
class HistoryBody(BaseModel):
    item_id: str

@app.get("/api/health")
def health():
    return {"ok": True, "service":"MediaVerse API"}

@app.get("/api/catalog")
def get_catalog():
    return catalog()

@app.get("/api/me")
def me(x_telegram_init_data: str = Header(default="")):
    return current_user(x_telegram_init_data)

@app.get("/api/favorites")
def favorites(x_telegram_init_data: str = Header(default="")):
    user=current_user(x_telegram_init_data)
    with db() as con:
        rows=con.execute("SELECT item_id FROM favorites WHERE telegram_id=? ORDER BY created_at DESC",(user["id"],)).fetchall()
    return [r["item_id"] for r in rows]

@app.post("/api/favorites")
def add_favorite(body: FavoriteBody, x_telegram_init_data: str = Header(default="")):
    user=current_user(x_telegram_init_data)
    if body.item_id not in {x["id"] for x in catalog()}: raise HTTPException(404,"Unknown item")
    with db() as con:
        con.execute("INSERT OR IGNORE INTO favorites(telegram_id,item_id,created_at) VALUES(?,?,?)",(user["id"],body.item_id,int(time.time())))
    return {"ok":True}

@app.delete("/api/favorites/{item_id}")
def delete_favorite(item_id: str, x_telegram_init_data: str = Header(default="")):
    user=current_user(x_telegram_init_data)
    with db() as con: con.execute("DELETE FROM favorites WHERE telegram_id=? AND item_id=?",(user["id"],item_id))
    return {"ok":True}

@app.get("/api/history")
def history(x_telegram_init_data: str = Header(default="")):
    user=current_user(x_telegram_init_data)
    with db() as con:
        rows=con.execute("SELECT item_id FROM history WHERE telegram_id=? GROUP BY item_id ORDER BY MAX(opened_at) DESC LIMIT 100",(user["id"],)).fetchall()
    return [r["item_id"] for r in rows]

@app.post("/api/history")
def add_history(body: HistoryBody, x_telegram_init_data: str = Header(default="")):
    user=current_user(x_telegram_init_data)
    if body.item_id not in {x["id"] for x in catalog()}: raise HTTPException(404,"Unknown item")
    with db() as con: con.execute("INSERT INTO history(telegram_id,item_id,opened_at) VALUES(?,?,?)",(user["id"],body.item_id,int(time.time())))
    return {"ok":True}
