import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import { setGlobalOptions } from "firebase-functions/v2";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import { suggestCourses, generateSyllabus } from "./ai";
import { Program, Syllabus, SyllabusTemplate } from "./types";

admin.initializeApp();
setGlobalOptions({ region: "asia-southeast1", maxInstances: 10 });

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

function requireAuth(auth: { uid?: string } | undefined): string {
  if (!auth?.uid) throw new HttpsError("unauthenticated", "Cần đăng nhập");
  return auth.uid;
}

async function loadProgram(uid: string, programId: string): Promise<Program> {
  const snap = await db.collection("programs").doc(programId).get();
  if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy chương trình");
  const data = snap.data() as Program;
  if (data.ownerUid !== uid) throw new HttpsError("permission-denied", "Không có quyền");
  return { ...data, id: snap.id };
}

async function loadTemplateContent(
  uid: string,
  programId: string,
  templateId: string
): Promise<string> {
  const snap = await db
    .collection("programs")
    .doc(programId)
    .collection("templates")
    .doc(templateId)
    .get();
  if (!snap.exists) throw new HttpsError("not-found", "Không tìm thấy mẫu đề cương");
  const tpl = snap.data() as SyllabusTemplate;
  if (tpl.ownerUid !== uid) throw new HttpsError("permission-denied", "Không có quyền");

  const bucket = admin.storage().bucket();
  const [buf] = await bucket.file(tpl.storagePath).download();
  return buf.toString("utf-8");
}

function toHttpsError(e: unknown, label: string): HttpsError {
  if (e instanceof HttpsError) return e;
  const msg = e instanceof Error ? e.message : String(e);
  logger.error(`${label} failed`, { error: msg, stack: (e as Error)?.stack });
  return new HttpsError("internal", `${label}: ${msg}`);
}

export const suggestCoursesFn = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 120 },
  async (req) => {
    try {
      const uid = requireAuth(req.auth);
      const { programId, count } = req.data as { programId: string; count?: number };
      const program = await loadProgram(uid, programId);
      const courses = await suggestCourses(program, count ?? 12);
      return { courses };
    } catch (e) {
      throw toHttpsError(e, "suggestCourses");
    }
  }
);

export const generateSyllabusFn = onCall(
  { secrets: [ANTHROPIC_API_KEY], timeoutSeconds: 300, memory: "1GiB" },
  async (req) => {
    try {
      const uid = requireAuth(req.auth);
      const { programId, course, save, templateId } = req.data as {
        programId: string;
        course: { code: string; name: string; credits?: number };
        save?: boolean;
        templateId?: string;
      };
      if (!course?.code || !course?.name) {
        throw new HttpsError("invalid-argument", "Thiếu mã/tên học phần");
      }

      const program = await loadProgram(uid, programId);
      const templateContent = templateId
        ? await loadTemplateContent(uid, programId, templateId)
        : undefined;
      const syllabus = await generateSyllabus(program, course, templateContent);

      const now = Date.now();
      const enriched: Syllabus = {
        ...syllabus,
        programId,
        ownerUid: uid,
        templateId: templateId ?? "",
        createdAt: now,
        updatedAt: now,
      };

      if (save !== false) {
        const ref = await db
          .collection("programs")
          .doc(programId)
          .collection("syllabi")
          .add(enriched);
        return { id: ref.id, syllabus: { ...enriched, id: ref.id } };
      }
      return { syllabus: enriched };
    } catch (e) {
      throw toHttpsError(e, "generateSyllabus");
    }
  }
);
