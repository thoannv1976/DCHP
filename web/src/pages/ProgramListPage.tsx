import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  where,
} from "firebase/firestore";
import { db } from "../firebase";
import { useAuth } from "../auth";
import { Program } from "../types";

export default function ProgramListPage() {
  const { user } = useAuth();
  const [programs, setPrograms] = useState<Program[]>([]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "programs"),
      where("ownerUid", "==", user.uid),
      orderBy("updatedAt", "desc")
    );
    return onSnapshot(q, (snap) => {
      setPrograms(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Program) })));
    });
  }, [user]);

  const remove = async (id: string) => {
    if (!confirm("Xoá chương trình này và toàn bộ đề cương bên trong?")) return;
    await deleteDoc(doc(db, "programs", id));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Chương trình đào tạo</h1>
        <Link to="/programs/new" className="btn-primary">
          + Tạo chương trình
        </Link>
      </div>

      {programs.length === 0 ? (
        <div className="card text-center text-slate-500">
          Chưa có chương trình nào. Hãy tạo chương trình đầu tiên để bắt đầu.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {programs.map((p) => (
            <div key={p.id} className="card flex flex-col">
              <Link to={`/programs/${p.id}`} className="flex-1">
                <h3 className="font-semibold text-lg text-indigo-700">{p.name}</h3>
                <p className="text-sm text-slate-600 mt-2 line-clamp-3">
                  {p.description}
                </p>
                <p className="text-xs text-slate-400 mt-3">
                  {p.plos?.length ?? 0} PLO
                </p>
              </Link>
              <div className="mt-3 pt-3 border-t border-slate-100 flex gap-2">
                <Link to={`/programs/${p.id}/edit`} className="btn-secondary text-xs">
                  Sửa
                </Link>
                <button onClick={() => remove(p.id)} className="btn-danger text-xs">
                  Xoá
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
