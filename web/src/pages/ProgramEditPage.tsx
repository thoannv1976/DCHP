import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { addDoc, collection, doc, getDoc, setDoc } from "firebase/firestore";
import { ref as sref, uploadBytes } from "firebase/storage";
import { db, storage } from "../firebase";
import { useAuth } from "../auth";
import { PLO, Program } from "../types";

const emptyPlo = (): PLO => ({ code: "", description: "" });

async function readTextFile(file: File): Promise<string> {
  if (file.type.startsWith("text/") || /\.(txt|md|csv)$/i.test(file.name)) {
    return await file.text();
  }
  return "";
}

function parsePlosFromText(text: string): PLO[] {
  const out: PLO[] = [];
  const lines = text.split(/\r?\n/);
  const re = /^\s*(PLO\s*\d+|CDR\s*\d+)[:\.\-\s]+(.+)$/i;
  for (const ln of lines) {
    const m = ln.match(re);
    if (m) {
      out.push({
        code: m[1].replace(/\s+/g, "").toUpperCase(),
        description: m[2].trim(),
      });
    }
  }
  return out;
}

export default function ProgramEditPage() {
  const { programId } = useParams();
  const isEdit = !!programId;
  const navigate = useNavigate();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [plos, setPlos] = useState<PLO[]>([emptyPlo()]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(isEdit);

  useEffect(() => {
    if (!isEdit || !programId) return;
    (async () => {
      const snap = await getDoc(doc(db, "programs", programId));
      if (snap.exists()) {
        const p = snap.data() as Program;
        setName(p.name);
        setDescription(p.description);
        setPlos(p.plos.length ? p.plos : [emptyPlo()]);
      }
      setLoading(false);
    })();
  }, [isEdit, programId]);

  const handleFiles = async (selected: FileList | null) => {
    if (!selected) return;
    const list = Array.from(selected);
    setFiles(list);
    let merged = description;
    const parsed: PLO[] = [];
    for (const f of list) {
      const txt = await readTextFile(f);
      if (txt) {
        merged = merged ? `${merged}\n\n${txt}` : txt;
        parsed.push(...parsePlosFromText(txt));
      }
    }
    if (merged !== description) setDescription(merged);
    if (parsed.length) {
      setPlos((cur) => {
        const existing = new Set(cur.filter((p) => p.code).map((p) => p.code));
        const merged = [...cur.filter((p) => p.code || p.description)];
        for (const p of parsed) if (!existing.has(p.code)) merged.push(p);
        return merged.length ? merged : [emptyPlo()];
      });
    }
  };

  const submit = async () => {
    if (!user) return;
    if (!name.trim()) return alert("Vui lòng nhập tên ngành");
    const cleanedPlos = plos.filter((p) => p.code.trim() && p.description.trim());
    if (cleanedPlos.length === 0) return alert("Vui lòng nhập ít nhất một PLO");

    setSaving(true);
    try {
      const now = Date.now();
      const payload: Omit<Program, "id"> = {
        name: name.trim(),
        description: description.trim(),
        plos: cleanedPlos,
        ownerUid: user.uid,
        updatedAt: now,
      };

      let id = programId;
      if (isEdit && programId) {
        await setDoc(doc(db, "programs", programId), payload, { merge: true });
      } else {
        const ref = await addDoc(collection(db, "programs"), {
          ...payload,
          createdAt: now,
        });
        id = ref.id;
      }

      if (id && files.length) {
        for (const f of files) {
          await uploadBytes(
            sref(storage, `programs/${user.uid}/${id}/${Date.now()}-${f.name}`),
            f
          );
        }
      }

      navigate(`/programs/${id}`);
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="p-4 text-slate-500">Đang tải...</div>;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-semibold">
        {isEdit ? "Cập nhật chương trình" : "Tạo chương trình đào tạo"}
      </h1>

      <div className="card space-y-4">
        <div>
          <label className="label">Tên ngành đào tạo *</label>
          <input
            className="input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Vd: Công nghệ thông tin"
          />
        </div>

        <div>
          <label className="label">Mô tả ngành *</label>
          <textarea
            className="input min-h-[140px]"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Mô tả mục tiêu, định hướng đào tạo, vị trí việc làm..."
          />
        </div>

        <div>
          <label className="label">Tải tệp nguồn (txt/md, tuỳ chọn)</label>
          <input
            type="file"
            multiple
            accept=".txt,.md,.csv,text/plain"
            onChange={(e) => handleFiles(e.target.files)}
            className="text-sm"
          />
          <p className="text-xs text-slate-500 mt-1">
            Hệ thống sẽ tự động trích các dòng dạng "PLO1: ..." để điền vào danh sách bên dưới.
          </p>
        </div>
      </div>

      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Chuẩn đầu ra chương trình (PLO)</h2>
          <button
            className="btn-secondary text-xs"
            onClick={() => setPlos((p) => [...p, emptyPlo()])}
          >
            + Thêm PLO
          </button>
        </div>
        {plos.map((p, i) => (
          <div key={i} className="grid grid-cols-12 gap-2 items-start">
            <input
              className="input col-span-2"
              placeholder="PLO1"
              value={p.code}
              onChange={(e) =>
                setPlos((cur) =>
                  cur.map((x, j) => (j === i ? { ...x, code: e.target.value } : x))
                )
              }
            />
            <input
              className="input col-span-9"
              placeholder="Mô tả PLO"
              value={p.description}
              onChange={(e) =>
                setPlos((cur) =>
                  cur.map((x, j) =>
                    j === i ? { ...x, description: e.target.value } : x
                  )
                )
              }
            />
            <button
              className="btn-secondary col-span-1"
              onClick={() => setPlos((cur) => cur.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <button className="btn-primary" disabled={saving} onClick={submit}>
          {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo chương trình"}
        </button>
        <button className="btn-secondary" onClick={() => navigate(-1)}>
          Huỷ
        </button>
      </div>
    </div>
  );
}
