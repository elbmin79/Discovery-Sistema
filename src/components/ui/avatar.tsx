import Image from "next/image";
import { initials, studentPhoto } from "@/lib/school";
import type { Student } from "@/lib/types";

const SIZES = {
  sm: "h-9 w-9 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
  xl: "h-20 w-20 text-xl",
  "2xl": "h-28 w-28 text-2xl md:h-32 md:w-32",
  "3xl": "h-36 w-36 text-4xl xl:h-44 xl:w-44",
};

export function Avatar({
  name,
  accent,
  photoUrl,
  size = "md",
}: {
  name: string;
  accent?: string;
  photoUrl?: string;
  size?: keyof typeof SIZES;
}) {
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${SIZES[size]}`}
      style={{ background: accent ?? "#1B4D3E" }}
      aria-hidden
    >
      {photoUrl ? (
        <Image src={photoUrl} alt="" fill unoptimized className="object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center font-semibold text-paper">
          {initials(name)}
        </span>
      )}
    </div>
  );
}

export function StudentAvatar({
  student,
  size = "md",
}: {
  student: Student;
  size?: keyof typeof SIZES;
}) {
  return (
    <Avatar
      name={`${student.firstName} ${student.lastName}`}
      accent={student.accent}
      photoUrl={studentPhoto(student)}
      size={size}
    />
  );
}
