const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const prisma = new PrismaClient();

async function testAllRoles() {
  const user = await prisma.user.findFirst({
    include: { memberships: true }
  });
  if (!user) {
    console.error("User tidak ditemukan di DB");
    process.exit(1);
  }
  const workspaceId = user.memberships?.[0]?.workspaceId;
  const secret = process.env.JWT_SECRET || "klir-dev-secure-jwt-key-edfd6f65-139a-4566-a373";
  const token = jwt.sign({ userId: user.id }, secret, { expiresIn: "7d" });

  const roles = [
    { role: "CEO", prompt: "Berikan ringkasan prioritas bisnis minggu ini." },
    { role: "MARKETING", prompt: "Buatkan 3 ide konten TikTok untuk produk makanan ringan." },
    { role: "FINANCE", prompt: "Bagaimana cara menjaga arus kas operasional tetap positif?" },
    { role: "MANAGER", prompt: "Bagaimana cara evaluasi kinerja mingguan tim?" },
    { role: "MANAGER_OPS", prompt: "Buatkan checklist kebersihan dan keamanan gudang harian." },
    { role: "SEKRETARIS", prompt: "Buatkan draf email konfirmasi jadwal meeting internal." }
  ];

  console.log("Mulai pengujian 6 role AI Assistant untuk user " + user.email + "...");

  for (const item of roles) {
    const start = Date.now();
    try {
      const res = await fetch("http://localhost:3000/api/v1/brain/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + token
        },
        body: JSON.stringify({
          workspaceId,
          message: item.prompt,
          userName: user.fullName || "Mecca",
          userRole: item.role,
          workspaceName: "AniTech"
        })
      });
      const duration = Date.now() - start;
      const json = await res.json();
      const text = json.data?.text || "";
      const isOk = res.status === 200 && json.success && text.length > 20;
      console.log("[" + item.role + "] " + (isOk ? "PASS" : "FAIL") + " (" + duration + "ms) | Model: " + (json.data?.model || json.data?.provider) + " | Length: " + text.length + " chars");
      if (!isOk) {
        console.error("Detail error:", json);
      }
    } catch (err) {
      console.error("[" + item.role + "] EXCEPTION:", err.message);
    }
  }
  await prisma.$disconnect();
}

testAllRoles().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
