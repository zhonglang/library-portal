from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import urlparse

import psycopg
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic_settings import BaseSettings, SettingsConfigDict

STATIC = Path(__file__).resolve().parent / "static"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    library_user_id: str = ""
    database_host_alias: str = ""


def database_dsn(url: str, alias: str = "") -> str:
    if url.startswith("postgresql+psycopg://"):
        url = "postgresql://" + url.removeprefix("postgresql+psycopg://")
    alias = alias.strip() or os.environ.get("DATABASE_HOST_ALIAS", "").strip()
    if not alias:
        return url
    parsed = urlparse(url)
    host = parsed.hostname
    if host not in {"localhost", "127.0.0.1"}:
        return url
    marker = f"@{host}"
    netloc = parsed.netloc.replace(marker, f"@{alias}", 1) if marker in parsed.netloc else parsed.netloc.replace(host, alias, 1)
    return parsed._replace(netloc=netloc).geturl()


def load_items(settings: Settings) -> list[dict]:
    sql = """
        SELECT id, prefix, name, xunlei_url, quark_url, baidu_url
        FROM library_items
    """
    params: dict[str, int] = {}
    user_id = settings.library_user_id.strip()
    if user_id:
        sql += " WHERE user_id = %(user_id)s"
        params["user_id"] = int(user_id)
    with psycopg.connect(database_dsn(settings.database_url, settings.database_host_alias)) as conn:
        with conn.cursor() as cur:
            cur.execute(sql, params)
            columns = [column.name for column in cur.description]
            rows = [dict(zip(columns, row, strict=True)) for row in cur.fetchall()]
    return sorted(rows, key=lambda item: (int(item["prefix"]), item["prefix"]))


app = FastAPI(title="资源库", docs_url=None, redoc_url=None, openapi_url=None)
app.mount("/static", StaticFiles(directory=STATIC), name="static")


@app.get("/")
def index() -> FileResponse:
    return FileResponse(STATIC / "index.html")


@app.get("/api/items")
def items() -> JSONResponse:
    try:
        rows = load_items(Settings())
    except (psycopg.Error, ValueError) as exc:
        raise HTTPException(status_code=503, detail="暂时无法读取资源") from exc
    return JSONResponse(rows, headers={"Cache-Control": "no-store"})
