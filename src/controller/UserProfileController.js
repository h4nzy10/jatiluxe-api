export async function AddProfile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        message: "No file uploaded or invalid file format!",
      });
    }
    const profileUrl = req.file.path || req.file.url;

    const [result] = await pool.query(
      "UPDATE users SET profile = ? WHERE id_user = ?",
      [profileUrl, req.user.id],
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        message: "User not found!",
      });
    }
    res.status(200).json({
      message: "Profile picture successfully uploaded!",
      profile_picture: profileUrl,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to update profile picture!",
      error: error.message,
    });
  }
}

export async function GetProfile(req, res) {
  try {
    const [profile] = await pool.query(
      "SELECT profile, nama, email, password, role, no_hp, alamat FROM users WHERE id_user = ?",
      [req.user.id],
    );
    if (!profile.length) {
      return res.status(404).json({ error: "User not found" });
    }
    return res.status(200).json({
      message: "successfuly get profile",
      user: profile[0],
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      message: "Failed to get profile!",
      error: error,
    });
  }
}

export async function EditProfile(req, res) {
  const userId = req.user.id;
  const { nama, email, password, no_hp, alamat, profile } = req.body;

  let fields = [];
  let values = [];

  if (nama !== undefined) {
    fields.push("nama = ?");
    values.push(nama);
  }
  if (email !== undefined) {
    fields.push("email = ?");
    values.push(email);
  }
  if (password !== undefined) {
    fields.push("password = ?");
    values.push(password);
  }
  if (no_hp !== undefined) {
    fields.push("no_hp = ?");
    values.push(no_hp);
  }
  if (alamat !== undefined) {
    fields.push("alamat = ?");
    values.push(alamat);
  }
  if (profile !== undefined) {
    fields.push("profile = ?");
    values.push(profile);
  }
  values.push(userId);
  try {
    const query = `UPDATE users SET ${fields.join(", ")} WHERE id_user = ?`;

    const [result] = await pool.execute(query, values);

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }
    res.status(200).json({
      success: true,
      message: "Profile successfuly updated!",
    });
  } catch (error) {
    console.error("Failed to update profile:", error);
    res.status(500).json({
      success: false,
      message: "Server error.",
    });
  }
}
