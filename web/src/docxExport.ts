import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from "docx";
import { saveAs } from "file-saver";
import { Syllabus } from "./types";

const FONT = "Times New Roman";
const SIZE_BODY = 26; // 13pt (docx half-points)
const SIZE_H1 = 32; // 16pt
const SIZE_H2 = 28; // 14pt
const COLOR_HEADER = "1F3864";

function textRun(text: string, bold = false, size = SIZE_BODY): TextRun {
  return new TextRun({ text, bold, font: FONT, size });
}

function p(text: string, opts: { bold?: boolean; align?: AlignmentType } = {}): Paragraph {
  return new Paragraph({
    alignment: opts.align,
    spacing: { after: 120 },
    children: [textRun(text, opts.bold)],
  });
}

function h1(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    alignment: AlignmentType.CENTER,
    spacing: { before: 240, after: 240 },
    children: [
      new TextRun({ text, bold: true, font: FONT, size: SIZE_H1, color: COLOR_HEADER }),
    ],
  });
}

function h2(text: string): Paragraph {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 240, after: 120 },
    children: [
      new TextRun({ text, bold: true, font: FONT, size: SIZE_H2, color: COLOR_HEADER }),
    ],
  });
}

function bullet(text: string): Paragraph {
  return new Paragraph({
    numbering: { reference: "bullet-list", level: 0 },
    spacing: { after: 80 },
    children: [textRun(text)],
  });
}

function multilineParagraphs(text: string): Paragraph[] {
  if (!text?.trim()) return [p("(chưa có nội dung)")];
  return text
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => p(line));
}

const FULL_BORDER = {
  top: { style: BorderStyle.SINGLE, size: 4, color: "888888" },
  bottom: { style: BorderStyle.SINGLE, size: 4, color: "888888" },
  left: { style: BorderStyle.SINGLE, size: 4, color: "888888" },
  right: { style: BorderStyle.SINGLE, size: 4, color: "888888" },
};

function cell(text: string, opts: { bold?: boolean; widthPct?: number } = {}): TableCell {
  return new TableCell({
    width: opts.widthPct
      ? { size: opts.widthPct, type: WidthType.PERCENTAGE }
      : undefined,
    children: text
      .split(/\r?\n/)
      .map((line) => p(line, { bold: opts.bold })),
  });
}

function table(rows: TableRow[]): Table {
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: FULL_BORDER,
    rows,
  });
}

function infoTable(s: Syllabus): Table {
  const row = (label: string, value: string) =>
    new TableRow({
      children: [
        cell(label, { bold: true, widthPct: 30 }),
        cell(value || "—", { widthPct: 70 }),
      ],
    });
  return table([
    row("Tên học phần (tiếng Việt)", s.name),
    row("Tên học phần (tiếng Anh)", s.nameEn || ""),
    row("Mã học phần", s.code),
    row("Số tín chỉ", String(s.credits ?? "")),
    row("Học phần tiên quyết", s.prerequisites || "Không"),
  ]);
}

function closTable(s: Syllabus): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell("Mã CLO", { bold: true, widthPct: 12 }),
      cell("Mô tả chuẩn đầu ra", { bold: true, widthPct: 58 }),
      cell("Bloom", { bold: true, widthPct: 14 }),
      cell("PLO", { bold: true, widthPct: 16 }),
    ],
  });
  const rows = s.clos.map(
    (c) =>
      new TableRow({
        children: [
          cell(c.code),
          cell(c.description),
          cell(c.bloomLevel || ""),
          cell(c.mappedPlos.join(", ")),
        ],
      })
  );
  return table([header, ...rows]);
}

function matrixTable(s: Syllabus): Table | null {
  const matrix = s.cloPloMatrix;
  if (!matrix || Object.keys(matrix).length === 0) return null;

  const ploSet = new Set<string>();
  for (const row of Object.values(matrix)) {
    for (const ploCode of Object.keys(row)) ploSet.add(ploCode);
  }
  const plos = Array.from(ploSet).sort();
  const cloCodes = Object.keys(matrix).sort();

  const header = new TableRow({
    tableHeader: true,
    children: [
      cell("CLO \\ PLO", { bold: true }),
      ...plos.map((pl) => cell(pl, { bold: true })),
    ],
  });
  const rows = cloCodes.map(
    (clo) =>
      new TableRow({
        children: [
          cell(clo, { bold: true }),
          ...plos.map((pl) => cell(matrix[clo]?.[pl] ? String(matrix[clo][pl]) : "")),
        ],
      })
  );
  return table([header, ...rows]);
}

function chaptersTable(s: Syllabus): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell("STT", { bold: true, widthPct: 6 }),
      cell("Nội dung", { bold: true, widthPct: 64 }),
      cell("Số giờ", { bold: true, widthPct: 12 }),
      cell("CLO", { bold: true, widthPct: 18 }),
    ],
  });
  const rows = s.chapters.map(
    (ch, i) =>
      new TableRow({
        children: [
          cell(String(i + 1)),
          cell(`${ch.title}\n${ch.content}`),
          cell(String(ch.hours ?? "")),
          cell(ch.mappedClos.join(", ")),
        ],
      })
  );
  return table([header, ...rows]);
}

function assessmentsTable(s: Syllabus): Table {
  const header = new TableRow({
    tableHeader: true,
    children: [
      cell("Hình thức", { bold: true, widthPct: 22 }),
      cell("Tỷ trọng (%)", { bold: true, widthPct: 12 }),
      cell("CLO", { bold: true, widthPct: 16 }),
      cell("Mô tả", { bold: true, widthPct: 50 }),
    ],
  });
  const rows = s.assessments.map(
    (a) =>
      new TableRow({
        children: [
          cell(a.type),
          cell(String(a.weight ?? "")),
          cell(a.mappedClos.join(", ")),
          cell(a.description),
        ],
      })
  );
  const total = s.assessments.reduce((acc, a) => acc + (Number(a.weight) || 0), 0);
  rows.push(
    new TableRow({
      children: [
        cell("TỔNG", { bold: true }),
        cell(`${total}%`, { bold: true }),
        cell(""),
        cell(""),
      ],
    })
  );
  return table([header, ...rows]);
}

function referencesParagraphs(s: Syllabus): Paragraph[] {
  const out: Paragraph[] = [];
  const main = s.references.filter((r) => r.type === "main");
  const supp = s.references.filter((r) => r.type === "supplementary");
  if (main.length) {
    out.push(p("Tài liệu chính:", { bold: true }));
    main.forEach((r, i) =>
      out.push(
        bullet(
          `[${i + 1}] ${r.authors ? r.authors + ". " : ""}${r.title}${r.year ? " (" + r.year + ")" : ""}${r.publisher ? ". " + r.publisher : ""}.`
        )
      )
    );
  }
  if (supp.length) {
    out.push(p("Tài liệu tham khảo bổ sung:", { bold: true }));
    supp.forEach((r, i) =>
      out.push(
        bullet(
          `[${i + 1}] ${r.authors ? r.authors + ". " : ""}${r.title}${r.year ? " (" + r.year + ")" : ""}${r.publisher ? ". " + r.publisher : ""}.`
        )
      )
    );
  }
  if (!out.length) out.push(p("(Chưa cập nhật)"));
  return out;
}

export async function exportSyllabusToDocx(s: Syllabus): Promise<void> {
  const matrix = matrixTable(s);

  const children: (Paragraph | Table)[] = [
    h1("ĐỀ CƯƠNG HỌC PHẦN"),
    h1(`${s.code} — ${s.name}`),

    h2("1. Thông tin chung"),
    infoTable(s),

    h2("2. Mô tả học phần"),
    ...multilineParagraphs(s.description),

    h2("3. Mục tiêu học phần"),
    ...multilineParagraphs(s.objectives),

    h2("4. Chuẩn đầu ra học phần (CLO)"),
    closTable(s),
  ];

  if (matrix) {
    children.push(h2("5. Ma trận CLO – PLO"));
    children.push(matrix);
  }

  children.push(
    h2(`${matrix ? "6" : "5"}. Nội dung chi tiết`),
    chaptersTable(s),
    h2(`${matrix ? "7" : "6"}. Phương pháp giảng dạy & học tập`),
    ...(s.teachingMethods.length
      ? s.teachingMethods.map(bullet)
      : [p("(Chưa cập nhật)")]),
    h2(`${matrix ? "8" : "7"}. Phương pháp đánh giá`),
    assessmentsTable(s),
    h2(`${matrix ? "9" : "8"}. Tài liệu tham khảo`),
    ...referencesParagraphs(s)
  );

  const doc = new Document({
    creator: "DCHP",
    title: `Đề cương ${s.code}`,
    styles: {
      default: {
        document: { run: { font: FONT, size: SIZE_BODY } },
      },
    },
    numbering: {
      config: [
        {
          reference: "bullet-list",
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.LEFT,
              style: { paragraph: { indent: { left: 360, hanging: 240 } } },
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });

  const blob = await Packer.toBlob(doc);
  const safe = `${s.code || "syllabus"}_${(s.name || "").replace(/[^\p{L}\p{N}_-]+/gu, "_").slice(0, 60)}`;
  saveAs(blob, `${safe || "de_cuong"}.docx`);
}
