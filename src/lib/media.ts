import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];

export function validateImage(file: File): string | null {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    return "Please choose a JPG, PNG, WEBP or GIF image.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "That image is larger than 15 MB. Please choose a smaller one.";
  }
  return null;
}

/** Downscale + re-encode in the browser to keep uploads small. */
export async function compressImage(file: File, maxSize = 1600, quality = 0.82): Promise<Blob> {
  if (typeof window === "undefined" || file.type === "image/gif") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxSize / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", quality),
    );
    return blob && blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

function randomName(ext = "jpg") {
  return `${crypto.randomUUID()}.${ext}`;
}

/** Upload a family image. Returns the storage path (never a public URL). */
export async function uploadFamilyImage(
  familyId: string,
  folder: string,
  file: File,
): Promise<string> {
  const problem = validateImage(file);
  if (problem) throw new Error(problem);
  const body = await compressImage(file);
  const path = `${familyId}/${folder}/${randomName()}`;
  const { error } = await supabase.storage
    .from("family-media")
    .upload(path, body, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error(error.message);
  return path;
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const problem = validateImage(file);
  if (problem) throw new Error(problem);
  const body = await compressImage(file, 600, 0.85);
  const path = `${userId}/${randomName()}`;
  const { error } = await supabase.storage
    .from("avatars")
    .upload(path, body, { contentType: "image/jpeg", upsert: true });
  if (error) throw new Error(error.message);
  return path;
}

async function sign(bucket: string, path: string) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, 60 * 60);
  if (error) return null;
  return data?.signedUrl ?? null;
}

export function useSignedUrl(path?: string | null, bucket: "family-media" | "avatars" = "family-media") {
  const query = useQuery({
    queryKey: ["signed-url", bucket, path],
    enabled: !!path,
    staleTime: 50 * 60 * 1000,
    queryFn: () => sign(bucket, path!),
  });
  return query.data ?? null;
}
