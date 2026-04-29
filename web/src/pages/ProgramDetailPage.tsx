import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "firebase/firestore";
import { ref as sref, uploadBytes, deleteObject } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../auth";
import { CourseSuggestion, Program, Syllabus, SyllabusTemplate } from "../types";
import { generateSyllabus, suggestCourses } from "../api";

const TEMPLATE_ACCEPT = ".txt,.md,.json,text/plain,text/markdown,application/json";

export default function ProgramDetailPage() {
  const { programId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [templates, setTemplates] = useState<SyllabusTemplate[]>([]);
  const [activeTemplateId, setActiveTemplateId] = useState<string>("");
  const [uploading, setUploading] = useState(false);
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

    const unsubSyllabi = onSnapshot(
      query(
        collection(db, "programs", programId, "syllabi"),
        orderBy("updatedAt", "desc")
      ),
      (snap) => {
        setSyllabi(snap.docs.map((d) => ({ ...(d.data() as Syllabus), id: d.id })));
      },
      (err) => console.error("syllabi snapshot error", err)
    );

    const unsubTemplates = onSnapshot(
      query(
        collection(db, "programs", programId, "templates"),
        orderBy("uploadedAt", "desc")
      ),
      (snap) => {
        const list = snap.docs.map(
          (d) => ({ ...(d.data() as SyllabusTemplate), id: d.id })
        );
        setTemplates(list);
        setActiveTemplateId((cur) =>
          cur && list.some((t) => t.id === cur) ? cur : list[0]?.id ?? ""
        );
      },
      (err) => console.error("templates snapshot error", err)
    );

    return () => {
      unsubSyllabi();
      unsubTemplates();
    };
  }, [programId]);

  const uploadTemplate = async (files: FileList | null) => {
    if (!files || !files.length || !programId || !user) return;
    setUploading(true);
    try {
      for (const f of Array.from(files)) {
        if (f.size > 1_500_000) {
          alert(`File "${f.name}" lớn hơn 1.5MB — vui lòng cắt ngắn.`);
          continue;
        }
        const docRef = await addDoc(
          collection(db, "programs", programId, "templates"),
          {
            programId,
            ownerUid: user.uid,
            name: f.name,
            storagePath: "",
            contentType: f.type || "text/plain",
            sizeBytes: f.size,
            uploadedAt: Date.now(),
          }
        );
        const path = `programs/${user.uid}/${programId}/templates/${docRef.id}-${f.name}`;
        await uploadBytes(sref(storage, path), f);
        await updateDoc(docRef, { storagePath: path });
      }
    } catch (e) {
      alert("Lỗi upload: " + (e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const removeTemplate = async (t: SyllabusTemplate) => {
    if (!programId) return;
    if (!confirm(`Xoá mẫu "${t.name}"?`)) return;
    try {
      if (t.storagePath) {
        await deleteObject(sref(storage, t.storagePath)).catch(() => {});
      }
      await deleteDoc(doc(db, "programs", programId, "templates", t.id));
    } catch (e) {
      alert("Lỗi xoá: " + (e as Error).message);
    }
  };

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
      const { id } = await generateSyllabus(programId, course, {
        save: true,
        templateId: activeTemplateId || undefined,
      });
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

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold">Mẫu đề cương ({templates.length})</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              AI sẽ học theo cấu trúc, văn phong, mức chi tiết của mẫu được chọn.
              Hỗ trợ .txt / .md / .json (≤ 1.5MB).
            </p>
          </div>
          <label className="btn-secondary cursor-pointer">
            <input
              type="file"
              multiple
              accept={TEMPLATE_ACCEPT}
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                uploadTemplate(e.target.files);
                e.target.value = "";
              }}
            />
            {uploading ? "Đang tải..." : "+ Tải mẫu"}
          </label>
        </div>

        {templates.length === 0 ? (
          <p className="text-sm text-slate-500">
            Chưa có mẫu nào. Tải lên một đề cương đã có để AI viết theo phong cách đó.
          </p>
        ) : (
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="radio"
                name="active-template"
                checked={activeTemplateId === ""}
                onChange={() => setActiveTemplateId("")}
              />
              <span className="text-slate-600">
                Không dùng mẫu — AI sinh theo phong cách mặc định
              </span>
            </label>
            {templates.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between text-sm border border-slate-200 rounded-md px-3 py-2"
              >
                <label className="flex items-center gap-2 flex-1 cursor-pointer">
                  <input
                    type="radio"
                    name="active-template"
                    checked={activeTemplateId === t.id}
                    onChange={() => setActiveTemplateId(t.id)}
                  />
                  <span className="font-medium">{t.name}</span>
                  <span className="text-xs text-slate-400">
                    {(t.sizeBytes / 1024).toFixed(1)} KB
                  </span>
                </label>
                <button
                  className="btn-danger text-xs"
                  onClick={() => removeTemplate(t)}
                >
                  Xoá
                </button>
              </div>
            ))}
          </div>
        )}
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
          {activeTemplateId && (
            <p className="text-xs text-slate-500 mt-2">
              Sẽ dùng mẫu:{" "}
              <span className="font-medium">
                {templates.find((t) => t.id === activeTemplateId)?.name}
              </span>
            </p>
          )}
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
