"""Local image/video generation client for the OpenAI Next compatible gateway.

No third-party packages are required. Keep the API key in a local .env file.
"""

from __future__ import annotations

import argparse
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
OUTPUTS = ROOT / "outputs"


def load_env() -> None:
    """Load simple KEY=value entries without overwriting real environment vars."""
    for path in (ROOT / ".env.local", ROOT / ".env"):
        if not path.exists():
            continue
        for raw in path.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def setting(name: str, fallback: str = "") -> str:
    value = os.getenv(name, fallback).strip()
    if not value:
        raise SystemExit(f"缺少环境变量 {name}，请填写 .env.local")
    return value.rstrip("/")


def request_json(url: str, method: str = "GET", payload: dict[str, Any] | None = None) -> Any:
    key = setting("CREDIT_MEDIA_API_KEY", os.getenv("AI_API_KEY", ""))
    body = None
    headers = {"Authorization": f"Bearer {key}", "Accept": "application/json"}
    if payload is not None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=120) as response:
            raw = response.read()
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise SystemExit(f"接口返回 HTTP {error.code}: {detail[:1000]}") from error
    except urllib.error.URLError as error:
        raise SystemExit(f"无法连接接口: {error.reason}") from error
    try:
        return json.loads(raw.decode("utf-8"))
    except json.JSONDecodeError as error:
        raise SystemExit(f"接口没有返回 JSON: {raw[:300]!r}") from error


def first_value(data: Any, *keys: str) -> Any:
    if isinstance(data, dict):
        for key in keys:
            if data.get(key) not in (None, ""):
                return data[key]
        for value in data.values():
            found = first_value(value, *keys)
            if found not in (None, ""):
                return found
    elif isinstance(data, list):
        for value in data:
            found = first_value(value, *keys)
            if found not in (None, ""):
                return found
    return None


def download(url: str, target: Path) -> None:
    key = os.getenv("CREDIT_MEDIA_API_KEY", os.getenv("AI_API_KEY", ""))
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}"})
    try:
        with urllib.request.urlopen(request, timeout=300) as response:
            target.write_bytes(response.read())
    except urllib.error.HTTPError as error:
        raise SystemExit(f"下载媒体失败 HTTP {error.code}") from error


def save_image(response: Any, output: Path) -> None:
    encoded = first_value(response, "b64_json", "base64")
    url = first_value(response, "url", "image_url", "download_url")
    if encoded:
        output.write_bytes(base64.b64decode(encoded))
    elif url:
        download(str(url), output)
    else:
        raise SystemExit(f"响应里没有图片 URL 或 base64 数据: {json.dumps(response, ensure_ascii=False)[:1000]}")


def make_image(args: argparse.Namespace) -> None:
    base = setting("CREDIT_MEDIA_API_BASE_URL", os.getenv("AI_API_BASE_URL", "https://api.openai-next.com"))
    payload: dict[str, Any] = {"model": args.model, "prompt": args.prompt}
    if args.size:
        payload["size"] = args.size
    if args.quality:
        payload["quality"] = args.quality
    response = request_json(f"{base}/v1/images/generations", "POST", payload)
    OUTPUTS.mkdir(exist_ok=True)
    output = Path(args.output) if args.output else OUTPUTS / "image.png"
    save_image(response, output)
    print(f"图片已保存: {output.resolve()}")


def make_video(args: argparse.Namespace) -> None:
    base = setting("CREDIT_MEDIA_API_BASE_URL", os.getenv("AI_API_BASE_URL", "https://api.openai-next.com"))
    payload: dict[str, Any] = {"model": args.model, "content": args.prompt}
    if args.duration:
        payload["duration"] = args.duration
    if args.ratio:
        payload["ratio"] = args.ratio
    response = request_json(f"{base}/seedance/api/v3/content/generations/tasks", "POST", payload)
    task_id = first_value(response, "id", "task_id", "taskId")
    if not task_id:
        raise SystemExit(f"提交成功但没有找到任务 ID: {json.dumps(response, ensure_ascii=False)[:1000]}")
    print(f"任务已提交: {task_id}")
    for _ in range(args.timeout // args.interval):
        time.sleep(args.interval)
        status = request_json(f"{base}/seedance/api/v3/content/generations/tasks/{urllib.parse.quote(str(task_id))}")
        state = str(first_value(status, "status", "state") or "").lower()
        print(f"状态: {state or 'unknown'}")
        if state in {"succeeded", "success", "completed", "done", "finished"} or first_value(status, "video_url", "url", "download_url"):
            url = first_value(status, "video_url", "url", "download_url")
            if not url:
                raise SystemExit(f"任务完成但没有找到视频地址: {json.dumps(status, ensure_ascii=False)[:1000]}")
            OUTPUTS.mkdir(exist_ok=True)
            output = Path(args.output) if args.output else OUTPUTS / f"{task_id}.mp4"
            download(str(url), output)
            print(f"视频已保存: {output.resolve()}")
            return
        if state in {"failed", "error", "cancelled", "canceled"}:
            raise SystemExit(f"视频任务失败: {json.dumps(status, ensure_ascii=False)[:1000]}")
    raise SystemExit(f"超过 {args.timeout} 秒仍未完成，可用任务 ID {task_id} 继续查询")


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(description="大唐西市本地生图/生视频工具")
    sub = root.add_subparsers(dest="command", required=True)
    image = sub.add_parser("image", help="调用图片生成 API")
    image.add_argument("prompt")
    image.add_argument("--model", default=os.getenv("IMAGE_MODEL", "gpt-image-2"))
    image.add_argument("--size", default="1024x1024")
    image.add_argument("--quality", default="auto")
    image.add_argument("--output")
    image.set_defaults(func=make_image)
    video = sub.add_parser("video", help="调用 Seedance 视频任务 API")
    video.add_argument("prompt")
    video.add_argument("--model", default=os.getenv("VIDEO_MODEL", "doubao-seedance-2-0-260128"))
    video.add_argument("--duration", type=int)
    video.add_argument("--ratio")
    video.add_argument("--interval", type=int, default=10)
    video.add_argument("--timeout", type=int, default=900)
    video.add_argument("--output")
    video.set_defaults(func=make_video)
    return root


if __name__ == "__main__":
    load_env()
    args = parser().parse_args()
    args.func(args)
