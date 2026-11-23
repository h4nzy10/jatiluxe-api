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

  if (nama !== undefined && nama !== "") {
    fields.push("nama = ?");
    values.push(nama);
  }
  if (email !== undefined && email !== "") {
    fields.push("email = ?");
    values.push(email);
  }
  if (password !== undefined && password !== "") {
    fields.push("password = ?");
    values.push(password);
  }
  if (no_hp !== undefined && no_hp !== "") {
    fields.push("no_hp = ?");
    values.push(no_hp);
  }
  if (alamat !== undefined && alamat !== "") {
    fields.push("alamat = ?");
    values.push(alamat);
  }
  if (profile !== undefined && profile !== "") {
    fields.push("profile = ?");
    values.push(profile);
  }

  if (fields.length === 0) {
    return res.status(400).json({
      success: false,
      message: "You need to update at least 1 fields.",
    });
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
