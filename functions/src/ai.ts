import Anthropic from "@anthropic-ai/sdk";
import * as logger from "firebase-functions/logger";
import { Program, CourseSuggestion, Syllabus } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

function client(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not configured");
  }
  return new Anthropic({ apiKey });
}

function extractJson<T>(text: string): T {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const startArr = raw.indexOf("[");
  const first =
    start === -1 ? startArr : startArr === -1 ? start : Math.min(start, startArr);
  const last = Math.max(raw.lastIndexOf("}"), raw.lastIndexOf("]"));
  if (first === -1 || last === -1) {
    logger.error("AI response had no JSON", { preview: text.slice(0, 500) });
    throw new Error("AI không trả về JSON hợp lệ");
  }
  try {
    return JSON.parse(raw.slice(first, last + 1)) as T;
  } catch (e) {
    logger.error("JSON.parse failed", {
      preview: raw.slice(first, Math.min(first + 800, last + 1)),
      err: (e as Error).message,
    });
    throw new Error(`Không parse được JSON từ AI: ${(e as Error).message}`);
  }
}

const SUGGEST_SYSTEM = `Bạn là chuyên gia thiết kế chương trình đào tạo đại học tại Việt Nam.
Nhiệm vụ: từ mô tả ngành và danh sách chuẩn đầu ra chương trình (PLO), đề xuất
một danh sách học phần (course) phù hợp giúp người học đạt được toàn bộ PLO.
Ưu tiên các học phần có mã ngắn gọn, tên rõ ràng, số tín chỉ hợp lý (1–4 TC),
và phải mapping học phần với các PLO mà nó hỗ trợ.
Trả về CHỈ JSON đúng schema, KHÔNG kèm chú thích, KHÔNG dùng code fence.`;

const SYLLABUS_SYSTEM = `Bạn là chuyên gia biên soạn đề cương học phần (syllabus)
theo chuẩn AUN-QA / Bộ GD&ĐT Việt Nam. Mỗi đề cương gồm:
- Thông tin chung (mã, tên tiếng Việt/Anh, số tín chỉ, học phần tiên quyết).
- Mô tả học phần và mục tiêu học phần.
- Chuẩn đầu ra học phần (CLO) với mức Bloom, mapping rõ tới PLO.
- Ma trận CLO–PLO (mức 1/2/3).
- Nội dung chi tiết theo chương, kèm số giờ và mapping CLO.
- Phương pháp giảng dạy & học tập.
- Phương pháp đánh giá: tỷ trọng tổng phải = 100%, mapping CLO.
- Tài liệu tham khảo (chính, bổ sung).
Viết bằng tiếng Việt học thuật, súc tích. Trả về CHỈ JSON đúng schema,
KHÔNG kèm chú thích, KHÔNG dùng code fence.`;

function collectText(blocks: { type: string }[]): string {
  return blocks
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("\n");
}

export async function suggestCourses(
  program: Program,
  count = 12
): Promise<CourseSuggestion[]> {
  const ploLines = program.plos
    .map((p) => `- ${p.code}: ${p.description}`)
    .join("\n");

  const userPrompt = `Ngành: ${program.name}

Mô tả ngành:
${program.description}

Chuẩn đầu ra chương trình (PLO):
${ploLines}

Hãy đề xuất khoảng ${count} học phần cốt lõi. Trả về JSON với schema:
{
  "courses": [
    {
      "code": "string (vd: CS101)",
      "name": "string (tiếng Việt)",
      "credits": number,
      "rationale": "string (ngắn gọn vì sao cần học phần này)",
      "mappedPlos": ["PLO1", "PLO2"]
    }
  ]
}`;

  logger.info("suggestCourses calling Anthropic", { model: MODEL });
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 4096,
    system: SUGGEST_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = collectText(resp.content);
  const parsed = extractJson<{ courses?: CourseSuggestion[] }>(text);
  return parsed.courses ?? [];
}

function normalizeSyllabus(raw: Partial<Syllabus>, fallback: { code: string; name: string; credits?: number }): Syllabus {
  return {
    code: raw.code || fallback.code,
    name: raw.name || fallback.name,
    nameEn: raw.nameEn ?? "",
    credits: typeof raw.credits === "number" ? raw.credits : fallback.credits ?? 3,
    prerequisites: raw.prerequisites ?? "",
    description: raw.description ?? "",
    objectives: raw.objectives ?? "",
    clos: Array.isArray(raw.clos) ? raw.clos : [],
    cloPloMatrix: raw.cloPloMatrix ?? {},
    chapters: Array.isArray(raw.chapters) ? raw.chapters : [],
    teachingMethods: Array.isArray(raw.teachingMethods) ? raw.teachingMethods : [],
    assessments: Array.isArray(raw.assessments) ? raw.assessments : [],
    references: Array.isArray(raw.references) ? raw.references : [],
    programId: "",
    ownerUid: "",
  };
}

export async function generateSyllabus(
  program: Program,
  course: { code: string; name: string; credits?: number }
): Promise<Syllabus> {
  const ploLines = program.plos
    .map((p) => `- ${p.code}: ${p.description}`)
    .join("\n");

  const userPrompt = `Ngành: ${program.name}
Mô tả ngành:
${program.description}

Chuẩn đầu ra chương trình (PLO):
${ploLines}

Học phần cần soạn đề cương:
- Mã: ${course.code}
- Tên: ${course.name}
${course.credits ? `- Số tín chỉ gợi ý: ${course.credits}` : ""}

Hãy sinh đề cương đầy đủ. Trả về JSON với schema:
{
  "code": "string",
  "name": "string",
  "nameEn": "string",
  "credits": number,
  "prerequisites": "string",
  "description": "string (3-6 câu)",
  "objectives": "string",
  "clos": [
    { "code": "CLO1", "description": "string", "bloomLevel": "Apply", "mappedPlos": ["PLO1"] }
  ],
  "cloPloMatrix": { "CLO1": { "PLO1": 2, "PLO3": 1 } },
  "chapters": [
    { "title": "string", "hours": number, "content": "string", "mappedClos": ["CLO1"] }
  ],
  "teachingMethods": ["string"],
  "assessments": [
    { "type": "Chuyên cần", "weight": 10, "mappedClos": ["CLO1"], "description": "string" }
  ],
  "references": [
    { "title": "string", "authors": "string", "year": 2023, "publisher": "string", "type": "main" }
  ]
}

Yêu cầu:
- Tổng "weight" của assessments phải bằng 100.
- Mọi CLO phải được map tới ít nhất một PLO có sẵn.
- Số giờ chương phải hợp lý so với số tín chỉ (1 TC ≈ 15 tiết LT).`;

  logger.info("generateSyllabus calling Anthropic", { model: MODEL, course: course.code });
  const resp = await client().messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SYLLABUS_SYSTEM,
    messages: [{ role: "user", content: userPrompt }],
  });

  const text = collectText(resp.content);
  const parsed = extractJson<Partial<Syllabus>>(text);
  return normalizeSyllabus(parsed, course);
}
