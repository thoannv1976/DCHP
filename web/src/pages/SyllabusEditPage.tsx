import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import {
  AssessmentItem,
  ChapterTopic,
  CLO,
  Reference,
  Syllabus,
} from "../types";
import { exportSyllabusToDocx } from "../docxExport";

function uid(prefix: string, list: { code?: string }[]): string {
  let n = list.length + 1;
  while (list.some((x) => x.code === `${prefix}${n}`)) n++;
  return `${prefix}${n}`;
}

export default function SyllabusEditPage() {
  const { programId, syllabusId } = useParams();
  const navigate = useNavigate();
  const [s, setS] = useState<Syllabus | null>(null);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const exportDocx = async () => {
    if (!s) return;
    setExporting(true);
    try {
      await exportSyllabusToDocx(s);
    } catch (e) {
      alert("Lỗi xuất DOCX: " + (e as Error).message);
    } finally {
      setExporting(false);
    }
  };

  useEffect(() => {
    if (!programId || !syllabusId) return;
    (async () => {
      const snap = await getDoc(
        doc(db, "programs", programId, "syllabi", syllabusId)
      );
      if (snap.exists()) setS({ ...(snap.data() as Syllabus), id: snap.id });
    })();
  }, [programId, syllabusId]);

  const update = <K extends keyof Syllabus>(key: K, value: Syllabus[K]) => {
    setS((cur) => (cur ? { ...cur, [key]: value } : cur));
  };

  const save = async () => {
    if (!s || !programId || !syllabusId) return;
    setSaving(true);
    try {
      const payload = { ...s, updatedAt: Date.now() };
      delete (payload as { id?: string }).id;
      await setDoc(
        doc(db, "programs", programId, "syllabi", syllabusId),
        payload,
        { merge: true }
      );
      alert("Đã lưu đề cương");
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (!s) return <div className="p-4 text-slate-500">Đang tải...</div>;

  const totalAssessmentWeight = s.assessments.reduce(
    (acc, a) => acc + (Number(a.weight) || 0),
    0
  );

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <Link
          to={`/programs/${programId}`}
          className="text-sm text-slate-500 hover:text-indigo-600"
        >
          ← Quay lại chương trình
        </Link>
        <div className="flex gap-2">
          <button className="btn-secondary" onClick={() => navigate(-1)}>
            Đóng
          </button>
          <button className="btn-secondary" disabled={exporting} onClick={exportDocx}>
            {exporting ? "Đang xuất..." : "⬇ Xuất DOCX"}
          </button>
          <button className="btn-primary" disabled={saving} onClick={save}>
            {saving ? "Đang lưu..." : "Lưu đề cương"}
          </button>
        </div>
      </div>

      <section className="card space-y-3">
        <h2 className="font-semibold text-lg">1. Thông tin chung</h2>
        <div className="grid grid-cols-12 gap-3">
          <div className="col-span-3">
            <label className="label">Mã học phần</label>
            <input
              className="input"
              value={s.code}
              onChange={(e) => update("code", e.target.value)}
            />
          </div>
          <div className="col-span-7">
            <label className="label">Tên học phần</label>
            <input
              className="input"
              value={s.name}
              onChange={(e) => update("name", e.target.value)}
            />
          </div>
          <div className="col-span-2">
            <label className="label">Số tín chỉ</label>
            <input
              type="number"
              className="input"
              value={s.credits}
              onChange={(e) => update("credits", Number(e.target.value))}
            />
          </div>
          <div className="col-span-8">
            <label className="label">Tên tiếng Anh</label>
            <input
              className="input"
              value={s.nameEn ?? ""}
              onChange={(e) => update("nameEn", e.target.value)}
            />
          </div>
          <div className="col-span-4">
            <label className="label">Học phần tiên quyết</label>
            <input
              className="input"
              value={s.prerequisites ?? ""}
              onChange={(e) => update("prerequisites", e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-lg">2. Mô tả & mục tiêu</h2>
        <div>
          <label className="label">Mô tả học phần</label>
          <textarea
            className="input min-h-[100px]"
            value={s.description}
            onChange={(e) => update("description", e.target.value)}
          />
        </div>
        <div>
          <label className="label">Mục tiêu học phần</label>
          <textarea
            className="input min-h-[100px]"
            value={s.objectives}
            onChange={(e) => update("objectives", e.target.value)}
          />
        </div>
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">3. Chuẩn đầu ra (CLO)</h2>
          <button
            className="btn-secondary text-xs"
            onClick={() =>
              update("clos", [
                ...s.clos,
                {
                  code: uid("CLO", s.clos),
                  description: "",
                  bloomLevel: "",
                  mappedPlos: [],
                },
              ])
            }
          >
            + Thêm CLO
          </button>
        </div>
        {s.clos.map((c, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-start">
            <input
              className="input col-span-2"
              value={c.code}
              onChange={(e) => {
                const v = e.target.value;
                update(
                  "clos",
                  s.clos.map((x, j) =>
                    j === i ? { ...x, code: v } : x
                  ) as CLO[]
                );
              }}
            />
            <input
              className="input col-span-6"
              placeholder="Mô tả"
              value={c.description}
              onChange={(e) => {
                const v = e.target.value;
                update(
                  "clos",
                  s.clos.map((x, j) =>
                    j === i ? { ...x, description: v } : x
                  ) as CLO[]
                );
              }}
            />
            <input
              className="input col-span-2"
              placeholder="Bloom (Apply…)"
              value={c.bloomLevel ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                update(
                  "clos",
                  s.clos.map((x, j) =>
                    j === i ? { ...x, bloomLevel: v } : x
                  ) as CLO[]
                );
              }}
            />
            <input
              className="input col-span-1"
              placeholder="PLO1,PLO2"
              value={c.mappedPlos.join(",")}
              onChange={(e) => {
                const v = e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean);
                update(
                  "clos",
                  s.clos.map((x, j) =>
                    j === i ? { ...x, mappedPlos: v } : x
                  ) as CLO[]
                );
              }}
            />
            <button
              className="btn-secondary col-span-1"
              onClick={() =>
                update(
                  "clos",
                  s.clos.filter((_, j) => j !== i)
                )
              }
            >
              ×
            </button>
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">4. Nội dung chi tiết</h2>
          <button
            className="btn-secondary text-xs"
            onClick={() =>
              update("chapters", [
                ...s.chapters,
                { title: "", hours: 0, content: "", mappedClos: [] },
              ])
            }
          >
            + Thêm chương
          </button>
        </div>
        {s.chapters.map((ch, i) => (
          <div key={i} className="border border-slate-200 rounded-md p-3 space-y-2">
            <div className="grid grid-cols-12 gap-2">
              <input
                className="input col-span-7"
                placeholder="Tên chương"
                value={ch.title}
                onChange={(e) => {
                  const v = e.target.value;
                  update(
                    "chapters",
                    s.chapters.map((x, j) =>
                      j === i ? { ...x, title: v } : x
                    ) as ChapterTopic[]
                  );
                }}
              />
              <input
                type="number"
                className="input col-span-2"
                placeholder="Giờ"
                value={ch.hours}
                onChange={(e) => {
                  const v = Number(e.target.value);
                  update(
                    "chapters",
                    s.chapters.map((x, j) =>
                      j === i ? { ...x, hours: v } : x
                    ) as ChapterTopic[]
                  );
                }}
              />
              <input
                className="input col-span-2"
                placeholder="CLO1,CLO2"
                value={ch.mappedClos.join(",")}
                onChange={(e) => {
                  const v = e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  update(
                    "chapters",
                    s.chapters.map((x, j) =>
                      j === i ? { ...x, mappedClos: v } : x
                    ) as ChapterTopic[]
                  );
                }}
              />
              <button
                className="btn-secondary col-span-1"
                onClick={() =>
                  update(
                    "chapters",
                    s.chapters.filter((_, j) => j !== i)
                  )
                }
              >
                ×
              </button>
            </div>
            <textarea
              className="input min-h-[80px]"
              placeholder="Nội dung chi tiết"
              value={ch.content}
              onChange={(e) => {
                const v = e.target.value;
                update(
                  "chapters",
                  s.chapters.map((x, j) =>
                    j === i ? { ...x, content: v } : x
                  ) as ChapterTopic[]
                );
              }}
            />
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <h2 className="font-semibold text-lg">5. Phương pháp giảng dạy</h2>
        <textarea
          className="input min-h-[80px]"
          value={s.teachingMethods.join("\n")}
          placeholder="Mỗi phương pháp một dòng"
          onChange={(e) =>
            update(
              "teachingMethods",
              e.target.value.split("\n").map((x) => x.trim()).filter(Boolean)
            )
          }
        />
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">
            6. Phương pháp đánh giá
            <span
              className={`ml-2 text-sm ${
                totalAssessmentWeight === 100 ? "text-green-600" : "text-red-600"
              }`}
            >
              (Tổng: {totalAssessmentWeight}%)
            </span>
          </h2>
          <button
            className="btn-secondary text-xs"
            onClick={() =>
              update("assessments", [
                ...s.assessments,
                { type: "", weight: 0, mappedClos: [], description: "" },
              ])
            }
          >
            + Thêm
          </button>
        </div>
        {s.assessments.map((a, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              className="input col-span-2"
              placeholder="Loại"
              value={a.type}
              onChange={(e) => {
                const v = e.target.value;
                update(
                  "assessments",
                  s.assessments.map((x, j) =>
                    j === i ? { ...x, type: v } : x
                  ) as AssessmentItem[]
                );
              }}
            />
            <input
              type="number"
              className="input col-span-1"
              placeholder="%"
              value={a.weight}
              onChange={(e) => {
                const v = Number(e.target.value);
                update(
                  "assessments",
                  s.assessments.map((x, j) =>
                    j === i ? { ...x, weight: v } : x
                  ) as AssessmentItem[]
                );
              }}
            />
            <input
              className="input col-span-2"
              placeholder="CLO"
              value={a.mappedClos.join(",")}
              onChange={(e) => {
                const v = e.target.value
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean);
                update(
                  "assessments",
                  s.assessments.map((x, j) =>
                    j === i ? { ...x, mappedClos: v } : x
                  ) as AssessmentItem[]
                );
              }}
            />
            <input
              className="input col-span-6"
              placeholder="Mô tả"
              value={a.description}
              onChange={(e) => {
                const v = e.target.value;
                update(
                  "assessments",
                  s.assessments.map((x, j) =>
                    j === i ? { ...x, description: v } : x
                  ) as AssessmentItem[]
                );
              }}
            />
            <button
              className="btn-secondary col-span-1"
              onClick={() =>
                update(
                  "assessments",
                  s.assessments.filter((_, j) => j !== i)
                )
              }
            >
              ×
            </button>
          </div>
        ))}
      </section>

      <section className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg">7. Tài liệu tham khảo</h2>
          <button
            className="btn-secondary text-xs"
            onClick={() =>
              update("references", [
                ...s.references,
                { title: "", authors: "", type: "main" },
              ])
            }
          >
            + Thêm
          </button>
        </div>
        {s.references.map((r, i) => (
          <div key={i} className="grid grid-cols-12 gap-2">
            <input
              className="input col-span-5"
              placeholder="Tên tài liệu"
              value={r.title}
              onChange={(e) => {
                const v = e.target.value;
                update(
                  "references",
                  s.references.map((x, j) =>
                    j === i ? { ...x, title: v } : x
                  ) as Reference[]
                );
              }}
            />
            <input
              className="input col-span-3"
              placeholder="Tác giả"
              value={r.authors}
              onChange={(e) => {
                const v = e.target.value;
                update(
                  "references",
                  s.references.map((x, j) =>
                    j === i ? { ...x, authors: v } : x
                  ) as Reference[]
                );
              }}
            />
            <input
              className="input col-span-1"
              type="number"
              placeholder="Năm"
              value={r.year ?? ""}
              onChange={(e) => {
                const v = Number(e.target.value);
                update(
                  "references",
                  s.references.map((x, j) =>
                    j === i ? { ...x, year: v } : x
                  ) as Reference[]
                );
              }}
            />
            <input
              className="input col-span-2"
              placeholder="NXB"
              value={r.publisher ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                update(
                  "references",
                  s.references.map((x, j) =>
                    j === i ? { ...x, publisher: v } : x
                  ) as Reference[]
                );
              }}
            />
            <select
              className="input col-span-1"
              value={r.type}
              onChange={(e) => {
                const v = e.target.value as "main" | "supplementary";
                update(
                  "references",
                  s.references.map((x, j) =>
                    j === i ? { ...x, type: v } : x
                  ) as Reference[]
                );
              }}
            >
              <option value="main">Chính</option>
              <option value="supplementary">Bổ sung</option>
            </select>
          </div>
        ))}
      </section>

      <div className="flex justify-end">
        <button className="btn-primary" disabled={saving} onClick={save}>
          {saving ? "Đang lưu..." : "Lưu đề cương"}
        </button>
      </div>
    </div>
  );
}
