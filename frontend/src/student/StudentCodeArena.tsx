import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import API_BASE_URL from "../config";
import { getValidSession } from "../utils/session";

type Problem = { id: number; title: string; description: string; test_cases: string };
type TestSummary = { id: number; title: string; time_limit: number };
type Started = { id: number; title: string; time_limit: number; problems: Problem[] };

const headers = () => {
  const session = getValidSession();
  return session?.token ? { Authorization: `Bearer ${session.token}` } : {};
};

const StudentCodeArena = () => {
  const [tests, setTests] = useState<TestSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [passKey, setPassKey] = useState("");
  const [picked, setPicked] = useState<number | null>(null);
  const [active, setActive] = useState<Started | null>(null);
  const [index, setIndex] = useState(0);
  const [code, setCode] = useState("print('hello')\n");
  const [output, setOutput] = useState("Run the official tests. The score is stored on the server.");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/code-tests`, { headers: headers() })
      .then((res) => { setTests(Array.isArray(res.data) ? res.data : []); setStatus("ready"); })
      .catch(() => setStatus("error"));
  }, []);

  const start = async (event: FormEvent) => {
    event.preventDefault();
    if (!picked) return;
    setBusy(true);
    setMessage("");
    try {
      const body = new FormData();
      body.append("pass_key", passKey);
      const res = await axios.post(`${API_BASE_URL}/code-tests/${picked}/start`, body, { headers: headers() });
      setActive(res.data);
      setIndex(0);
      setOutput("Sample cases are visible. Hidden cases are graded on the server when you run.");
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setMessage(typeof detail === "string" ? detail : "That pass key was not accepted.");
    } finally {
      setBusy(false);
    }
  };

  const problem = active?.problems[index];

  const run = async () => {
    if (!active || !problem) return;
    setBusy(true);
    setOutput("Running official tests…");
    try {
      const res = await axios.post(`${API_BASE_URL}/execute`, {
        source_code: code,
        language_id: 71,
        test_cases: [],
        code_test_id: active.id,
        problem_id: problem.id,
      }, { headers: headers() });
      const passed = res.data?.stats?.passed ?? 0;
      const total = res.data?.stats?.total ?? 0;
      if (res.data?.error) setOutput(String(res.data.error));
      else setOutput(total > 0 && passed === total ? `Passed ${passed}/${total}. This problem counts toward the score.` : `Passed ${passed}/${total}. Hidden cases stay hidden.`);
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail || err.response?.data?.error : "";
      setOutput(typeof detail === "string" && detail ? detail : "The compiler could not run this code.");
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/code-tests/submit`, {
        test_id: active.id,
        time_taken: "Finished",
      }, { headers: headers() });
      setMessage(`Submitted. Score ${res.data?.score ?? 0}, problems solved ${res.data?.problems_solved ?? 0}.`);
      setActive(null);
      setTests((rows) => rows.filter((row) => row.id !== active.id));
    } catch (err: unknown) {
      const detail = axios.isAxiosError(err) ? err.response?.data?.detail : "";
      setMessage(typeof detail === "string" ? detail : "The test could not be submitted.");
    } finally {
      setBusy(false);
    }
  };

  if (active && problem) {
    return (
      <div>
        <h1 className="text-3xl font-semibold">{active.title}</h1>
        <p className="mt-2 text-sm iq-muted">{problem.title}. Time limit {active.time_limit} minutes. The score uses server runs, including hidden cases.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          {active.problems.map((item, itemIndex) => (
            <button key={item.id} type="button" onClick={() => setIndex(itemIndex)} className={`rounded-full border px-3 py-1 text-sm ${itemIndex === index ? "iq-accent" : "iq-line"}`}>{item.title}</button>
          ))}
        </div>
        <pre className="mt-4 whitespace-pre-wrap rounded-2xl border iq-line p-4 text-sm">{problem.description}</pre>
        <textarea value={code} onChange={(event) => setCode(event.target.value)} rows={14} className="mt-4 w-full rounded-xl border iq-line iq-surface px-3 py-3 font-mono text-sm" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={run} className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold disabled:opacity-50">Run official tests</button>
          <button type="button" disabled={busy} onClick={finish} className="rounded-full border iq-line px-4 py-2 text-sm font-semibold">Submit test</button>
        </div>
        <pre className="mt-4 whitespace-pre-wrap rounded-2xl border iq-line p-4 text-sm">{output}</pre>
        {message && <p className="mt-3 text-sm iq-muted">{message}</p>}
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold">Code arena</h1>
      <p className="mt-2 max-w-2xl text-sm iq-muted">Open a challenge with the pass key from your instructor. Sample cases are shown. Hidden cases are graded on the server.</p>
      {status === "loading" && <p className="mt-6 text-sm iq-muted">Loading challenges…</p>}
      {status === "error" && <p className="mt-6 text-sm iq-muted">Challenges could not be loaded.</p>}
      {status === "ready" && tests.length === 0 && <p className="mt-6 text-sm iq-muted">No open challenges. Finished tests stay with your instructor.</p>}
      <ul className="mt-6 space-y-3">
        {tests.map((test) => (
          <li key={test.id} className="rounded-2xl border iq-line p-4">
            <p className="font-semibold">{test.title}</p>
            <p className="text-sm iq-muted">{test.time_limit} minutes</p>
            {picked === test.id && (
              <form onSubmit={start} className="mt-3 flex flex-wrap gap-2">
                <input value={passKey} onChange={(event) => setPassKey(event.target.value)} placeholder="Pass key" className="rounded-xl border iq-line iq-surface px-3 py-2 text-sm" />
                <button disabled={busy} className="rounded-full iq-accent-bg px-4 py-2 text-sm font-semibold">Start</button>
              </form>
            )}
            {picked !== test.id && <button type="button" onClick={() => { setPicked(test.id); setPassKey(""); setMessage(""); }} className="mt-3 text-sm iq-link">Enter pass key</button>}
          </li>
        ))}
      </ul>
      {message && <p className="mt-4 text-sm iq-muted">{message}</p>}
    </div>
  );
};

export default StudentCodeArena;
