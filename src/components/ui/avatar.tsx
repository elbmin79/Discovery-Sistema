"use client";

import { useState } from "react";
import Image from "next/image";
import { initials, studentFallbackPhoto, studentPhoto } from "@/lib/school";
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
  fallbackPhotoUrl,
  size = "md",
}: {
  name: string;
  accent?: string;
  photoUrl?: string;
  fallbackPhotoUrl?: string;
  size?: keyof typeof SIZES;
}) {
  const [failedPhotos, setFailedPhotos] = useState<string[]>([]);
  const visiblePhoto = [photoUrl, fallbackPhotoUrl].find(
    (candidate) => candidate && !failedPhotos.includes(candidate),
  );
  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-full ${SIZES[size]}`}
      style={{ background: accent ?? "#1B4D3E" }}
      aria-hidden
    >
      {visiblePhoto ? (
        <Image
          src={visiblePhoto}
          alt=""
          fill
          unoptimized
          onError={() => setFailedPhotos((current) => (
            current.includes(visiblePhoto) ? current : [...current, visiblePhoto]
          ))}
          className="object-cover"
        />
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
      name={`${student.lastName} ${student.firstName}`}
      accent={student.accent}
      photoUrl={studentPhoto(student)}
      fallbackPhotoUrl={studentFallbackPhoto(student)}
      size={size}
    />
  );
}
