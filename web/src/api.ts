import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { CourseSuggestion, Syllabus } from "./types";

export async function suggestCourses(
  programId: string,
  count = 12
): Promise<CourseSuggestion[]> {
  const fn = httpsCallable<
    { programId: string; count: number },
    { courses: CourseSuggestion[] }
  >(functions, "suggestCoursesFn");
  const res = await fn({ programId, count });
  return res.data.courses;
}

export async function generateSyllabus(
  programId: string,
  course: { code: string; name: string; credits?: number },
  save = true
): Promise<{ id?: string; syllabus: Syllabus }> {
  const fn = httpsCallable<
    {
      programId: string;
      course: { code: string; name: string; credits?: number };
      save: boolean;
    },
    { id?: string; syllabus: Syllabus }
  >(functions, "generateSyllabusFn");
  const res = await fn({ programId, course, save });
  return res.data;
}
