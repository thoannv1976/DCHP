# DCHP — Trình tạo đề cương học phần tự động

Ứng dụng web sinh đề cương học phần (course syllabus) tự động bằng AI dựa trên
mô tả ngành đào tạo và chuẩn đầu ra chương trình (PLO). Đề cương được lưu vào
Firestore, có thể chỉnh sửa và cập nhật.

## Kiến trúc

- **Frontend**: React + TypeScript + Vite + Tailwind CSS, host trên Firebase
  Hosting (Google Cloud).
- **Backend**: Firebase Cloud Functions (Node.js 20 + TypeScript) gọi
  Anthropic Claude API để sinh gợi ý tên học phần và đề cương chi tiết.
- **Cơ sở dữ liệu**: Cloud Firestore (collections: `programs`, `syllabi`).
- **Lưu trữ tệp nguồn**: Firebase Storage (mô tả ngành, danh sách PLO dạng
  PDF/DOCX/TXT).

## Luồng sử dụng

1. **Tạo chương trình đào tạo**: nhập mô tả ngành và danh sách PLO, hoặc
   tải tệp nguồn (`.txt`, `.md`, `.pdf` đã trích xuất).
2. **Gợi ý học phần**: AI đề xuất danh sách học phần phù hợp với PLO, hoặc
   người dùng tự nhập tên học phần.
3. **Sinh đề cương**: AI tạo đề cương đầy đủ (thông tin chung, mô tả, mục
   tiêu, CLO, ma trận CLO–PLO, nội dung chi tiết, phương pháp giảng dạy,
   đánh giá, tài liệu tham khảo).
4. **Lưu vào CSDL**: đề cương được lưu vào Firestore, gắn với chương trình.
5. **Chỉnh sửa/cập nhật**: người dùng mở lại đề cương trong trình soạn thảo
   để sửa từng trường, thêm/xoá CLO, cập nhật nội dung.

## Phát triển

```bash
# frontend
cd web && npm install && npm run dev

# functions
cd functions && npm install && npm run build && npm run serve
```

Cấu hình Firebase trong `web/.env.local` và đặt `ANTHROPIC_API_KEY` cho
functions:

```bash
firebase functions:secrets:set ANTHROPIC_API_KEY
```

## Triển khai

```bash
firebase deploy
```
