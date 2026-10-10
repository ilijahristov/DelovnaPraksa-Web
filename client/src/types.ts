export type Role = 'STUDENT' | 'PROFESSOR';

export type User = { id: number; name: string; email: string; role: Role };

export type CourseSummary = {
  id: number;
  code: string;
  title: string;
  description: string;
  createdAt: string;
  owner: { id: number; name: string };
};

export type Material = { id: number; title: string; url: string; createdAt: string };

export type CourseDetail = CourseSummary & {
  materials: Material[];
  enrolledCount: number;
  isOwner: boolean;
  isEnrolled: boolean;
};

export type EnrolledStudent = { id: number; name: string; email: string; enrolledAt: string };

export type StudentAccount = {
  id: number;
  name: string;
  email: string;
  createdAt: string;
  courseCount: number;
};
