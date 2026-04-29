import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
} from "firebase/firestore";
import { db } from "../firebase";
import { CourseSuggestion, Program, Syllabus } from "../types";
import { generateSyllabus, suggestCourses } from "../api";

export default function ProgramDetailPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const [program, setProgram] = useState<Program | null>(null);
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [suggestions, setSuggestions] = useState<CourseSuggestion[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const [generating, setGenerating] = useState<string | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualCredits, setManualCredits] = useState(3);

  useEffect(() => {
    if (!programId) return;
    (async () => {
      const snap = await getDoc(doc(db, "programs", programId));
      if (snap.exists())
        setProgram({ ...(snap.data() as Program), id: snap.id });
    })();

    const q = query(
      collection(db, "programs", programId, "syllabi"),
      orderBy("updatedAt", "desc")
    );
    return onSnapshot(
      q,
      (snap) => {
        setSyllabi(snap.docs.map((d) => ({ ...(d.data() as Syllabus), id: d.id })));
      },
      (err) => console.error("syllabi snapshot error", err)
    );
  }, [programId]);

  const requestSuggestions = async () => {
    if (!programId) return;
    setSuggesting(true);
    try {
      const list = await suggestCourses(programId, 12);
      setSuggestions(list);
    } catch (e) {
      alert("Lỗi gợi ý: " + (e as Error).message);
    } finally {
      setSuggesting(false);
    }
  };

  const generate = async (course: {
    code: string;
    name: string;
    credits?: number;
  }) => {
    if (!programId) return;
    setGenerating(course.code);
    try {
      const { id } = await generateSyllabus(programId, course, true);
      if (id) navigate(`/programs/${programId}/syllabi/${id}`);
    } catch (e) {
      alert("Lỗi sinh đề cương: " + (e as Error).message);
    } finally {
      setGenerating(null);
    }
  };

  const removeSyllabus = async (id: string) => {
    if (!programId) return;
    if (!confirm("Xoá đề cương này?")) return;
    await deleteDoc(doc(db, "programs", programId, "syllabi", id));
  };

  if (!program) return <div className="p-4 text-slate-500">Đang tải...</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link to="/" className="text-sm text-slate-500 hover:text-indigo-600">
            ← Danh sách chương trình
          </Link>
          <h1 className="text-2xl font-semibold mt-1">{program.name}</h1>
          <p className="text-slate-600 text-sm whitespace-pre-wrap mt-2">
            {program.description}
          </p>
        </div>
        <Link to={`/programs/${program.id}/edit`} className="btn-secondary shrink-0">
          Chỉnh sửa chương trình
        </Link>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">PLO ({program.plos.length})</h2>
        <ul className="space-y-1 text-sm">
          {program.plos.map((p) => (
            <li key={p.code}>
              <span className="font-medium text-indigo-700">{p.code}</span>:{" "}
              {p.description}
            </li>
          ))}
        </ul>
      </div>

      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Gợi ý học phần bằng AI</h2>
          <button
            className="btn-primary"
            onClick={requestSuggestions}
            disabled={suggesting}
          >
            {suggesting ? "Đang gợi ý..." : "Gợi ý học phần"}
          </button>
        </div>
        {suggestions.length > 0 && (
          <div className="grid gap-3 md:grid-cols-2">
            {suggestions.map((s) => (
              <div
                key={s.code}
                className="border border-slate-200 rounded-md p-3 text-sm"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-semibold text-indigo-700">
                      {s.code} — {s.name}
                    </div>
                    <div className="text-xs text-slate-500">
                      {s.credits} TC · PLO: {s.mappedPlos.join(", ")}
                    </div>
                  </div>
                  <button
                    className="btn-secondary text-xs"
                    disabled={generating === s.code}
                    onClick={() => generate(s)}
                  >
                    {generating === s.code ? "Đang tạo..." : "Sinh đề cương"}
                  </button>
                </div>
                <p className="mt-2 text-slate-600">{s.rationale}</p>
              </div>
            ))}
          </div>
        )}

        <div className="border-t border-slate-100 pt-4">
          <h3 className="font-medium mb-2">Hoặc nhập thủ công</h3>
          <div className="grid grid-cols-12 gap-2">
            <input
              className="input col-span-3"
              placeholder="Mã (vd: CS101)"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <input
              className="input col-span-6"
              placeholder="Tên học phần"
              value={manualName}
              onChange={(e) => setManualName(e.target.value)}
            />
            <input
              className="input col-span-1"
              type="number"
              min={1}
              max={10}
              value={manualCredits}
              onChange={(e) => setManualCredits(Number(e.target.value))}
            />
            <button
              className="btn-primary col-span-2"
              disabled={generating === manualCode || !manualCode || !manualName}
              onClick={() =>
                generate({
                  code: manualCode.trim(),
                  name: manualName.trim(),
                  credits: manualCredits,
                })
              }
            >
              {generating === manualCode ? "Đang tạo..." : "Sinh đề cương"}
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-3">
          Đề cương đã lưu ({syllabi.length})
        </h2>
        {syllabi.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có đề cương nào. Hãy gợi ý hoặc nhập học phần để bắt đầu.
          </p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {syllabi.map((s) => (
              <li key={s.id} className="py-2 flex justify-between items-center">
                <Link
                  to={`/programs/${program.id}/syllabi/${s.id}`}
                  className="hover:text-indigo-700"
                >
                  <span className="font-medium">{s.code}</span> — {s.name}
                  <span className="text-xs text-slate-500 ml-2">
                    ({s.credits} TC · {s.clos?.length ?? 0} CLO)
                  </span>
                </Link>
                <button
                  className="btn-danger text-xs"
                  onClick={() => removeSyllabus(s.id!)}
                >
                  Xoá
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
