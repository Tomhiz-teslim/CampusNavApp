const CLOUD_NAME = "gmrrkmhq";
const UPLOAD_PRESET = "campusnav_services";

export async function uploadImage(uri: string): Promise<string> {
  const form = new FormData();
  form.append("file", { uri, type: "image/jpeg", name: `service_${Date.now()}.jpg` } as any);
  form.append("upload_preset", UPLOAD_PRESET);

  const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, {
    method: "POST",
    body: form,
  });
  const json = await res.json();
  if (!res.ok || !json.secure_url) throw new Error(json?.error?.message ?? "Upload failed");
  return json.secure_url as string;
}