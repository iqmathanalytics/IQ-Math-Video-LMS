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
STOP = {"for","and","the","of","to","with","a","an","in","on","using","into","from","its"}

def tokens(s):
    s = (s or "").lower().replace("+", " ")
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return {w for w in s.split() if w not in STOP and len(w) > 1}

def blocks(text_value):
    lines = text_value.replace("\ufeff", "").replace("\r", "").split("\n")
    heads = [i for i, line in enumerate(lines) if re.match(r"^(Session|Module|Hands-on|Final Capstone)\b", line.strip())]
    out = []
    for idx, start in enumerate(heads):
        end = heads[idx + 1] if idx + 1 < len(heads) else len(lines)
        title = lines[start].strip()
        body = "\n".join(x.rstrip() for x in lines[start + 1:end]).strip()
        out.append((title, body))
    return out

def fit(module_title, chunk_title, chunk_body):
    mt = tokens(module_title)
    if not mt:
        return 0
    title_hit = len(mt & tokens(chunk_title)) / len(mt)
    body_hit = len(mt & tokens(chunk_body)) / len(mt)
    return max(title_hit, 0.55 * title_hit + 0.45 * body_hit)

def assign(modules, chunks):
    pointer = 0
    rows = []
    for index, mod in enumerate(modules):
        best_i, best = None, 0
        for i in range(pointer, len(chunks)):
            sc = fit(mod[1], chunks[i][0], chunks[i][1])
            if sc > best:
                best, best_i = sc, i
            if sc >= 0.6:
                break
        if best_i is None or best < 0.45:
            rows.append((mod, None, round(best, 2), ""))
            continue
        extras = []
        nxt = best_i + 1
        while nxt < len(chunks) and re.match(r"^(Hands-on|Final Capstone)", chunks[nxt][0]):
            later = modules[index + 1][1] if index + 1 < len(modules) else ""
            later_score = fit(later, chunks[nxt][0], chunks[nxt][1]) if later else 0
            own = fit(mod[1], chunks[nxt][0], chunks[nxt][1])
            if later and later_score > own:
                break
            extras.append(chunks[nxt])
            nxt += 1
        body = chunks[best_i][1]
        if extras:
            body = "\n\n".join([body] + [f"{t}\n{b}".strip() for t, b in extras])
        rows.append((mod, chunks[best_i][0], round(best, 2), body))
        pointer = nxt
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
        by.setdefault(row[0], []).append((row[1], row[2]))
    weak = 0
    for course_id, items in by.items():
        raw = urllib.request.urlopen(f"https://docs.google.com/document/d/{DOCS[course_id]}/export?format=txt").read().decode("utf-8", "replace")
        chosen = assign(items, blocks(raw))
        print("\nCOURSE", course_id)
        for mod, heading, score, body in chosen:
            if score < 0.6 or not heading:
                weak += 1
            print(f"  {score:4} {mod[1][:48]:48} <= {(heading or 'NONE')[:48]} body {len(body)}")
    print("weak", weak)
    await engine.dispose()
asyncio.run(main())
