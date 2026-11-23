import { z } from "zod";

const editProfileSchema = z.object({
  nama: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional(),
  password: z.string().min(6).optional(),
  no_hp: z.string().trim().min(1).optional(),
  alamat: z.string().trim().min(1).optional(),
  profile: z.string().trim().min(1).optional()
})

export function validateEditProfile(req, res, next) {
  const parsed = editProfileSchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      message: "Invalid profile payload",
      details: parsed.error.flatten(),
    });
  }

  const data = parsed.data;
  const hasBodyField = Object.keys(data).length > 0;
  const hasProfileFile = Boolean(req.file);

  if (!hasBodyField && !hasProfileFile) {
    return res.status(400).json({
      message: "You need to update at least 1 field.",
    });
  }

  req.validatedBody = data;
  next();
}