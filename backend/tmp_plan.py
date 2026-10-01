import asyncio, re, sys
if sys.platform.startswith("win"):
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
import urllib.request
from sqlalchemy import text
from database import engine

DOCS = {
    270001: "1K2VNfY92rLzGemdu_Yaj2qnP5LCigGyt",
    300001: "13xEex0etDRz89mSHiM4Pi6tewg7PLfXI",
    300002: "1UXWlnK9Ycg3RbqaOW6bWD8sfqSLwVMxA",
    330001: "1OY1qBckTLDY7O7nh7x_I1WfYe2kXY1Kr",
}
STOP = {"for","and","the","of","to","with","a","an","in","on","using","into","from"}

def tokens(s):
    s = (s or "").lower().replace("+", " ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return {w for w in s.split() if w not in STOP and len(w) > 1}

def fit(module_title, chunk_title, chunk_body):
    mt = tokens(module_title)
    if not mt:
        return 0
    return len(mt & tokens(chunk_title + " " + (chunk_body or ""))) / len(mt)

def blocks(text_value):
    lines = text_value.replace("\ufeff", "").replace("\r", "").split("\n")
    heads = [i for i, line in enumerate(lines) if re.match(r"^(Session|Module|Hands-on|Final Capstone)\b", line.strip())]
    out = []
    for idx, start in enumerate(heads):
        end = heads[idx + 1] if idx + 1 < len(heads) else len(lines)
        title = lines[start].strip()
        body_lines = [x.rstrip() for x in lines[start + 1:end]]
        body = "\n".join(body_lines).strip()
        bullets = []
        for line in body_lines:
            cleaned = re.sub(r"^[\*\-\u2022]+\s*", "", line.strip())
            if line.strip().startswith(("*", "-", "\u2022")) and len(cleaned) > 2:
                bullets.append(cleaned[:250])
        out.append({"title": title, "body": body, "bullets": bullets})
    return out

def is_extra(title):
    return title.startswith("Hands-on") or title.startswith("Final Capstone")

def is_case(title):
    t = title.lower()
    return "case study" in t or "capstone" in t

def plan(modules, chunks):
    idx = 0
    rows = []
    for i, mod in enumerate(modules):
        while idx < len(chunks) and is_extra(chunks[idx]["title"]) and not is_case(mod[2]):
            if rows:
                rows[-1]["extra"].append(chunks[idx])
            idx += 1
        if idx >= len(chunks):
            rows.append({"mod": mod, "chunk": None, "extra": [], "score": 0})
            continue
        score = fit(mod[2], chunks[idx]["title"], chunks[idx]["body"])
        if score < 0.5 and not (is_case(mod[2]) and is_extra(chunks[idx]["title"]) and score >= 0.4):
            rows.append({"mod": mod, "chunk": None, "extra": [], "score": round(score, 2)})
            continue
        chunk = chunks[idx]
        idx += 1
        extras = []
        nxt = modules[i + 1][2] if i + 1 < len(modules) else ""
        while idx < len(chunks) and is_extra(chunks[idx]["title"]) and (not nxt or not is_case(nxt) or fit(nxt, chunks[idx]["title"], chunks[idx]["body"]) < 0.4):
            extras.append(chunks[idx])
            idx += 1
        rows.append({"mod": mod, "chunk": chunk, "extra": extras, "score": round(score, 2)})
    return rows

async def main():
    async with engine.connect() as conn:
        mods = (await conn.execute(text("""
            SELECT course_id, id, title FROM modules
            WHERE course_id IN (270001,300001,300002,330001)
            ORDER BY course_id, `order`, id
        """))).all()
    by = {}
    for row in mods:
        by.setdefault(row[0], []).append(row)
    for course_id, items in by.items():
        raw = urllib.request.urlopen(f"https://docs.google.com/document/d/{DOCS[course_id]}/export?format=txt").read().decode("utf-8", "replace")
        rows = plan(items, blocks(raw))
        hits = sum(1 for r in rows if r["chunk"])
        lessons = 0
        print("\nCOURSE", course_id, "matched", hits, "/", len(items))
        for r in rows:
            if not r["chunk"]:
                print("  MISS", r["score"], r["mod"][2][:60])
                continue
            bullets = list(r["chunk"]["bullets"])
            for extra in r["extra"]:
                bullets.extend(extra["bullets"])
            lessons += max(1, len(bullets))
            print(f"  {r['score']:4} {r['mod'][2][:42]:42} <= {r['chunk']['title'][:42]} bullets {len(bullets)}")
        print("  lessons", lessons)
    await engine.dispose()
asyncio.run(main())
