const { PrismaClient } = require("@prisma/client");
const jwt = require("jsonwebtoken");
const prisma = new PrismaClient();

async function deepAudit() {
  console.log("=== MEMULAI AUDIT SISTEM KLIR LENGKAP ===");
  const user = await prisma.user.findFirst({
    include: { memberships: true }
  });
  if (!user) {
    console.error("Gagal: User DB kosong");
    process.exit(1);
  }
  const workspaceId = user.memberships?.[0]?.workspaceId;
  const secret = process.env.JWT_SECRET || "klir-dev-secure-jwt-key-edfd6f65-139a-4566-a373";
  const token = jwt.sign({ userId: user.id }, secret, { expiresIn: "7d" });

  const headers = {
    "Content-Type": "application/json",
    "Authorization": "Bearer " + token
  };

  const results = [];

  // TEST 1: Video Gating di /api/v1/media/generate
  console.log("\n--- 1. AUDIT VIDEO GATING & PERMISSION (CEO/Marketing vs Finance/Manager/Ops/Sekretaris) ---");
  const videoRoles = [
    { role: "executive", expectedForbidden: false },
    { role: "marketing", expectedForbidden: false },
    { role: "finance", expectedForbidden: true },
    { role: "manager", expectedForbidden: true },
    { role: "manager-ops", expectedForbidden: true },
    { role: "sekretaris", expectedForbidden: true }
  ];

  for (const vr of videoRoles) {
    const res = await fetch("http://localhost:3000/api/v1/media/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({
        kind: "video",
        prompt: "Test video generation prompt",
        role: vr.role,
        dryRun: true
      })
    });
    const json = await res.json();
    const isForbidden = res.status === 403;
    const ok = vr.expectedForbidden ? isForbidden : (!isForbidden || json.error?.code !== "FORBIDDEN");
    results.push({ name: "Video Gating " + vr.role, pass: ok, detail: "Status " + res.status + (isForbidden ? " (403 Blocked)" : " (Allowed)") });
    console.log("Role [" + vr.role + "] -> Status: " + res.status + " | Expected Blocked: " + vr.expectedForbidden + " | Result: " + (ok ? "PASS" : "FAIL"));
  }

  // TEST 2: Image Generation diizinkan untuk semua role (dryRun = 0 kredit)
  console.log("\n--- 2. AUDIT IMAGE GATING (Semua role WAJIB bisa generate gambar) ---");
  for (const vr of videoRoles) {
    const res = await fetch("http://localhost:3000/api/v1/media/generate", {
      method: "POST",
      headers,
      body: JSON.stringify({
        kind: "image",
        prompt: "Kopi susu gula aren aesthetic",
        role: vr.role,
        dryRun: true
      })
    });
    const json = await res.json();
    const isForbidden = res.status === 403 && json.error?.code === "FORBIDDEN";
    const ok = !isForbidden;
    results.push({ name: "Image Access " + vr.role, pass: ok, detail: "Status " + res.status });
    console.log("Image Role [" + vr.role + "] -> Status: " + res.status + " | Result: " + (ok ? "PASS" : "FAIL (Blocked)"));
  }

  // TEST 3: Intent Kalkulasi HPP Deterministik
  console.log("\n--- 3. AUDIT INTENT KALKULASI HPP DETERMINISTIK ---");
  const hppRes = await fetch("http://localhost:3000/api/v1/brain/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({
      workspaceId,
      message: "Tolong hitung HPP untuk produk keripik singkong: bahan baku 5000, tenaga kerja 2000, overhead 1000, jumlah unit 100",
      userName: "Mecca",
      userRole: "CEO",
      workspaceName: "AniTech"
    })
  });
  const hppJson = await hppRes.json();
  const hppOk = hppRes.status === 200 && hppJson.success && (hppJson.data?.text?.includes("HPP") || hppJson.data?.text?.includes("Harga Pokok"));
  results.push({ name: "HPP Deterministic Intent", pass: hppOk, detail: "Status: " + hppRes.status });
  console.log("HPP Intent -> Status: " + hppRes.status + " | Result: " + (hppOk ? "PASS" : "FAIL"));

  // TEST 4: Intent Simulasi Pinjaman KUR
  console.log("\n--- 4. AUDIT INTENT SIMULASI KUR ---");
  const kurRes = await fetch("http://localhost:3000/api/v1/brain/chat", {
    method: "POST",
    headers,
    body: JSON.stringify({
      workspaceId,
      message: "Simulasi pinjaman KUR plafon 50 juta tenor 24 bulan",
      userName: "Mecca",
      userRole: "CEO",
      workspaceName: "AniTech"
    })
  });
  const kurJson = await kurRes.json();
  const kurOk = kurRes.status === 200 && kurJson.success && (kurJson.data?.text?.includes("KUR") || kurJson.data?.text?.includes("Cicilan"));
  results.push({ name: "KUR Simulation Intent", pass: kurOk, detail: "Status: " + kurRes.status });
  console.log("KUR Intent -> Status: " + kurRes.status + " | Result: " + (kurOk ? "PASS" : "FAIL"));

  // TEST 5: Media Models Catalog Endpoint
  console.log("\n--- 5. AUDIT MEDIA MODELS CATALOG ENDPOINT ---");
  for (const kind of ["image", "video", "audio"]) {
    const catRes = await fetch("http://localhost:3000/api/v1/media/models?kind=" + kind, { headers });
    const catJson = await catRes.json();
    const catOk = catRes.status === 200 && Array.isArray(catJson.data);
    results.push({ name: "Media Catalog " + kind, pass: catOk, detail: "Models count: " + (catJson.data?.length || 0) });
    console.log("Catalog [" + kind + "] -> Models: " + (catJson.data?.length || 0) + " | Result: " + (catOk ? "PASS" : "FAIL"));
  }

  // TEST 6: Financial Health & Context Ingestion
  console.log("\n--- 6. AUDIT DATA HEALTH & BRAIN CONTEXT ---");
  const finRes = await fetch("http://localhost:3000/api/v1/kas/financial-health", { headers });
  const finJson = await finRes.json();
  const finOk = finRes.status === 200 && (finJson.success || finJson.status === "ok" || typeof finJson.score !== "undefined");
  results.push({ name: "Financial Health API", pass: finOk, detail: "Status " + finRes.status });
  console.log("Financial Health -> Status: " + finRes.status + " | Result: " + (finOk ? "PASS" : "FAIL"));

  const ctxRes = await fetch("http://localhost:3000/api/v1/brain/context", { headers });
  const ctxJson = await ctxRes.json();
  const ctxOk = ctxRes.status === 200 && (ctxJson.success || ctxJson.context || ctxJson.data);
  results.push({ name: "Brain Context API", pass: ctxOk, detail: "Status " + ctxRes.status });
  console.log("Brain Context -> Status: " + ctxRes.status + " | Result: " + (ctxOk ? "PASS" : "FAIL"));

  console.log("\n=======================================================");
  console.log("RINGKASAN AUDIT HASIL AKHIR:");
  const total = results.length;
  const passed = results.filter(r => r.pass).length;
  console.log("TOTAL TESTS: " + total + " | PASSED: " + passed + " | FAILED: " + (total - passed));
  console.log("=======================================================");

  await prisma.$disconnect();
  if (passed !== total) {
    process.exit(1);
  }
}

deepAudit().catch(err => {
  console.error("FATAL ERROR IN DEEP AUDIT:", err);
  process.exit(1);
});
