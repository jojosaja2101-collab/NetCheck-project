"use strict";

/* =====================================
   NETCHECK — MAIN SCRIPT
   Tanpa database, data tersimpan di sesi
===================================== */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const state = {
  ping: null,
  download: null,
  upload: null,
  ip: null,
  history: [],
  testing: false,
  toastTimer: null,
  hasResult: false
};

const pageTitles = {
  home: "Dashboard",
  speed: "Tes Kecepatan",
  analysis: "Analisis Aplikasi",
  troubleshoot: "Solusi Jaringan",
  result: "Hasil Terakhir"
};

function setText(selector, value) {
  const element = $(selector);
  if (element) element.textContent = value;
}

function showToast(message) {
  const toast = $("#toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}

function formatNumber(value, digits = 2) {
  return Number.isFinite(value) ? value.toFixed(digits) : "—";
}

function formatMbps(value) {
  return Number.isFinite(value) ? `${value.toFixed(2)} Mbps` : "Belum tersedia";
}

function setConnectionText(message) {
  setText("#connectionText", message);
}

/* =====================================
   NAVIGATION & MOBILE MENU
===================================== */

function closeSidebar() {
  $("#sidebar")?.classList.remove("open");
  $("#sidebarOverlay")?.classList.remove("show");
  $("#menuToggle")?.setAttribute("aria-expanded", "false");
}

function openPage(pageName) {
  if (!pageTitles[pageName]) return;

  const target = $(`#page-${pageName}`);
  if (!target) {
    showToast("Halaman tidak ditemukan: " + pageName);
    return;
  }

  $$(".page").forEach((page) => page.classList.remove("active"));
  target.classList.add("active");

  $$(".nav-link").forEach((button) => {
    const active = button.dataset.page === pageName;
    button.classList.toggle("active", active);
    if (active) button.setAttribute("aria-current", "page");
    else button.removeAttribute("aria-current");
  });

  setText("#pageTitle", pageTitles[pageName]);
  closeSidebar();

  // Gambar ulang grafik setelah halaman tampil.
  requestAnimationFrame(() => {
    if (pageName === "home") drawChart($("#homeChart"), state.history);
    if (pageName === "speed") drawChart($("#speedChart"), state.history);
  });

  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-page]");
  if (nav) {
    event.preventDefault();
    openPage(nav.dataset.page);
    return;
  }

  const go = event.target.closest("[data-go]");
  if (go) {
    event.preventDefault();
    openPage(go.dataset.go);
  }
});

$("#menuToggle")?.addEventListener("click", () => {
  const sidebar = $("#sidebar");
  const overlay = $("#sidebarOverlay");
  if (!sidebar) return;

  const opening = !sidebar.classList.contains("open");
  sidebar.classList.toggle("open", opening);
  overlay?.classList.toggle("show", opening);
  $("#menuToggle")?.setAttribute("aria-expanded", String(opening));
});

$("#sidebarClose")?.addEventListener("click", closeSidebar);
$("#sidebarOverlay")?.addEventListener("click", closeSidebar);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeSidebar();
});

/* =====================================
   CANVAS GRAPHS
===================================== */

function drawChart(canvas, values) {
  if (!canvas) return;

  const rect = canvas.getBoundingClientRect();
  // Jangan menggambar pada canvas yang masih tersembunyi.
  if (rect.width < 20) return;

  const width = rect.width;
  const height = Number(canvas.getAttribute("height")) || 220;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.height = `${height}px`;

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const pad = { left: 38, right: 12, top: 17, bottom: 28 };
  const plotW = Math.max(10, width - pad.left - pad.right);
  const plotH = Math.max(10, height - pad.top - pad.bottom);
  const samples = values.slice(-30);
  const maxValue = Math.max(10, ...samples.map((item) => item.speed || 0));
  const topValue = Math.ceil(maxValue / 10) * 10 || 10;

  ctx.font = "10px Segoe UI, Arial";
  ctx.lineWidth = 1;

  for (let i = 0; i <= 4; i++) {
    const y = pad.top + (plotH * i) / 4;
    const label = Math.round(topValue * (1 - i / 4));

    ctx.strokeStyle = "rgba(155,180,210,.12)";
    ctx.beginPath();
    ctx.moveTo(pad.left, y);
    ctx.lineTo(width - pad.right, y);
    ctx.stroke();

    ctx.fillStyle = "#8191a7";
    ctx.textAlign = "right";
    ctx.fillText(String(label), pad.left - 8, y + 3);
  }

  if (!samples.length) {
    ctx.fillStyle = "#8292a8";
    ctx.textAlign = "center";
    ctx.fillText("Belum ada data pengukuran", width / 2, height / 2);
    ctx.textAlign = "left";
    ctx.fillText("Mbps", 5, 12);
    return;
  }

  const points = samples.map((item, index) => ({
    x: pad.left + (
      samples.length === 1 ? plotW / 2 : (plotW * index) / (samples.length - 1)
    ),
    y: pad.top + plotH - ((item.speed || 0) / topValue) * plotH
  }));

  const gradient = ctx.createLinearGradient(0, pad.top, 0, height - pad.bottom);
  gradient.addColorStop(0, "rgba(56,217,255,.25)");
  gradient.addColorStop(1, "rgba(56,217,255,0)");

  ctx.beginPath();
  ctx.moveTo(points[0].x, height - pad.bottom);
  points.forEach((point) => ctx.lineTo(point.x, point.y));
  ctx.lineTo(points[points.length - 1].x, height - pad.bottom);
  ctx.closePath();
  ctx.fillStyle = gradient;
  ctx.fill();

  ctx.beginPath();
  points.forEach((point, index) => {
    if (index === 0) ctx.moveTo(point.x, point.y);
    else ctx.lineTo(point.x, point.y);
  });
  ctx.strokeStyle = "#38d9ff";
  ctx.lineWidth = 2.5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  ctx.stroke();

  const last = points[points.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
  ctx.fillStyle = "#38d9ff";
  ctx.fill();

  ctx.fillStyle = "#8191a7";
  ctx.textAlign = "left";
  ctx.fillText("Awal", pad.left, height - 7);
  ctx.textAlign = "right";
  ctx.fillText("Terbaru", width - pad.right, height - 7);
}

function updateHistory(speed) {
  if (!Number.isFinite(speed)) return;

  state.history.push({ speed, time: Date.now() });
  state.history = state.history.slice(-30);

  drawChart($("#speedChart"), state.history);
  drawChart($("#homeChart"), state.history);

  setText("#chartNote",
    `Titik grafik: ${state.history.length}. Sampel terakhir ${speed.toFixed(2)} Mbps.`);
  setText("#homeChartNote",
    `Sampel download terakhir: ${speed.toFixed(2)} Mbps.`);
}

window.addEventListener("resize", () => {
  drawChart($("#homeChart"), state.history);
  drawChart($("#speedChart"), state.history);
});

/* =====================================
   APP ANALYSIS
===================================== */

const appData = [
  { name: "WhatsApp", file: "whatsaap.jpeg", category: "Pesan", kind: "daily", min: .2, ideal: 1 },
  { name: "YouTube", file: "youtube.jpeg", category: "Video", kind: "daily", min: 1, ideal: 8 },
  { name: "Instagram", file: "ig.jpeg", category: "Media sosial", kind: "daily", min: 1, ideal: 5 },
  { name: "TikTok", file: "tt.jpeg", category: "Video pendek", kind: "daily", min: 1, ideal: 5 },
  { name: "Telegram", file: "Telegram.jpeg", category: "Pesan", kind: "daily", min: .2, ideal: 1 },
  { name: "Discord", file: "discord.jpeg", category: "Komunikasi", kind: "daily", min: .5, ideal: 2 },
  { name: "Zoom", file: "Zoom.jpg", category: "Video konferensi", kind: "daily", min: 1.5, ideal: 4 },
  { name: "Google Meet", file: "Google Meet.jpg", category: "Video konferensi", kind: "daily", min: 1.5, ideal: 4 },
  { name: "Spotify", file: "Spotify.jpeg", category: "Musik", kind: "daily", min: .2, ideal: 1 },
  { name: "Netflix", file: "ntf.jpeg", category: "Streaming", kind: "daily", min: 3, ideal: 15 },
  { name: "Google Classroom", file: "Google Clasroom.jpg", category: "Pendidikan", kind: "daily", min: .5, ideal: 2 },
  { name: "Chrome", file: "chrom.jpeg", category: "Browsing", kind: "daily", min: .5, ideal: 3 },

  { name: "Mobile Legends", file: "ml.jpg", category: "MOBA", kind: "game", min: 1, ideal: 5 },
  { name: "Free Fire", file: "ff.jpg", category: "Battle royale", kind: "game", min: 1, ideal: 5 },
  { name: "PUBG Mobile", file: "pubg.jpg", category: "Battle royale", kind: "game", min: 2, ideal: 8 },
  { name: "Valorant", file: "valo.jpg", category: "FPS", kind: "game", min: 3, ideal: 10 },
  { name: "Roblox", file: "roblok.jpg", category: "Sandbox", kind: "game", min: 1, ideal: 5 },
  { name: "Genshin Impact", file: "gsn.jpg", category: "Action RPG", kind: "game", min: 3, ideal: 10 },
  { name: "Minecraft", file: "mc.jpg", category: "Sandbox", kind: "game", min: 1, ideal: 5 },
  { name: "Dota 2", file: "dota.jpg", category: "MOBA", kind: "game", min: 3, ideal: 10 },
  { name: "Counter-Strike", file: "ck.jpg", category: "FPS", kind: "game", min: 5, ideal: 15 },
  { name: "Apex Legends", file: "apex.jpg", category: "Battle royale", kind: "game", min: 5, ideal: 20 }
];

let analyzedSpeed = null;

function getAppAssessment(app, speed) {
  if (!Number.isFinite(speed) || speed < 0) {
    return {
      status: "unknown",
      label: "Belum dianalisis",
      detail: "Masukkan kecepatan download untuk melihat perkiraan."
    };
  }

  if (speed < app.min) {
    return {
      status: "bad",
      label: "Kurang memadai",
      detail: `Di bawah perkiraan kebutuhan ${app.min} Mbps. Aplikasi mungkin lambat atau terputus.`
    };
  }

  if (speed < app.ideal) {
    return {
      status: "medium",
      label: "Bisa digunakan",
      detail: "Kemungkinan bisa berjalan, tetapi kualitas dapat turun jika jaringan ramai."
    };
  }

  return {
    status: "good",
    label: "Cukup memadai",
    detail: "Download memenuhi perkiraan dasar. Ping dan kestabilan tetap berpengaruh."
  };
}

function renderApps() {
  const daily = $("#dailyApps");
  const games = $("#gameApps");
  if (!daily || !games) return;

  daily.replaceChildren();
  games.replaceChildren();

  appData.forEach((app) => {
    const card = document.createElement("article");
    card.className = "app-card";

    const top = document.createElement("div");
    top.className = "app-card-top";

    const logoWrap = document.createElement("div");
    logoWrap.className = "app-logo-wrap";

    const img = document.createElement("img");
    img.className = "app-logo";
    img.src = `assets/${app.file}`;
    img.alt = app.name;
    img.loading = "lazy";

    const fallback = document.createElement("span");
    fallback.className = "app-fallback";
    fallback.hidden = true;
    fallback.textContent = app.name.slice(0, 2).toUpperCase();

    img.addEventListener("error", () => {
      img.hidden = true;
      fallback.hidden = false;
    });

    logoWrap.append(img, fallback);

    const titleWrap = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = app.name;
    const category = document.createElement("div");
    category.className = "app-category";
    category.textContent = app.category;
    titleWrap.append(title, category);
    top.append(logoWrap, titleWrap);

    const status = document.createElement("div");
    status.className = "app-status unknown";
    status.textContent = "Belum dianalisis";

    const detail = document.createElement("p");
    detail.textContent = "Masukkan kecepatan download untuk memeriksa perkiraan.";

    card.append(top, status, detail);
    (app.kind === "daily" ? daily : games).appendChild(card);
  });

  setText("#dailyCount", `${appData.filter(a => a.kind === "daily").length} APLIKASI`);
  setText("#gameCount", `${appData.filter(a => a.kind === "game").length} GAME`);

  if (Number.isFinite(analyzedSpeed)) analyzeApps(analyzedSpeed);
}

function analyzeApps(speed) {
  if (!Number.isFinite(speed) || speed < 0) return;
  analyzedSpeed = speed;

  const cards = $$(".app-card");
  appData.forEach((app, index) => {
    const card = cards[index];
    if (!card) return;

    const result = getAppAssessment(app, speed);
    const badge = card.querySelector(".app-status");
    const detail = card.querySelector("p");

    if (badge) {
      badge.className = `app-status ${result.status}`;
      badge.textContent = result.label;
    }
    if (detail) detail.textContent = result.detail;
  });

  setText("#analysisSource",
    `Analisis menggunakan download ${speed.toFixed(2)} Mbps. Ini perkiraan, bukan jaminan aplikasi berjalan.`);
}

function updateAppAnalysisFromTest(speed) {
  const input = $("#manualSpeed");
  if (input) input.value = speed.toFixed(2);
  analyzeApps(speed);
}

$("#analysisForm")?.addEventListener("submit", (event) => {
  event.preventDefault();
  const raw = $("#manualSpeed")?.value.trim() ?? "";
  const speed = Number(raw);

  if (raw === "" || !Number.isFinite(speed) || speed < 0 || speed > 100000) {
    showToast("Masukkan angka download yang valid.");
    return;
  }

  analyzeApps(speed);
  showToast("Analisis aplikasi diperbarui.");
});

/* =====================================
   TROUBLESHOOTING LIBRARY
===================================== */

const troubleData = [
  {
    title: "Wi-Fi lemah atau sinyal buruk",
    category: "Wi-Fi • Sinyal",
    icon: "⌁",
    symptom: "Sinyal sedikit, koneksi putus-putus, atau internet lambat di lokasi tertentu.",
    steps: [
      "Dekatkan perangkat ke router atau access point.",
      "Hindari penghalang tebal dan perangkat elektronik yang mengganggu sinyal.",
      "Bandingkan jaringan 2,4 GHz dan 5 GHz sesuai jarak serta kemampuan perangkat.",
      "Periksa posisi access point dan jumlah perangkat yang terhubung."
    ],
    check: "Uji lagi di dekat router. Jika hanya lokasi tertentu bermasalah, periksa jangkauan dan penempatan access point."
  },
  {
    title: "Terhubung ke Wi-Fi tetapi tidak ada internet",
    category: "Wi-Fi • Akses internet",
    icon: "⌁",
    symptom: "Wi-Fi terhubung, tetapi halaman web tidak terbuka.",
    steps: [
      "Pastikan layanan ISP atau paket internet aktif.",
      "Coba internet dari perangkat lain pada jaringan yang sama.",
      "Mulai ulang router sesuai panduan perangkat.",
      "Jika berwenang, periksa kabel WAN dan lampu indikator router."
    ],
    check: "Jika semua perangkat terdampak, periksa router, jalur WAN, atau layanan ISP."
  },
  {
    title: "Internet lambat",
    category: "Kecepatan • Bandwidth",
    icon: "↘",
    symptom: "Video sering menurun kualitasnya, unduhan lama, atau halaman lambat dibuka.",
    steps: [
      "Jeda unduhan besar dan streaming yang tidak diperlukan.",
      "Periksa jumlah perangkat yang menggunakan jaringan bersamaan.",
      "Ulangi tes kecepatan pada waktu berbeda.",
      "Bandingkan Wi-Fi dengan kabel LAN jika memungkinkan."
    ],
    check: "Jika kecepatan tetap rendah, catat hasil tes dan hubungi penyedia layanan."
  },
  {
    title: "Tidak bisa tersambung ke Wi-Fi",
    category: "Wi-Fi • Autentikasi",
    icon: "⊘",
    symptom: "Nama jaringan terlihat, tetapi perangkat gagal terhubung atau terus meminta sandi.",
    steps: [
      "Pastikan nama jaringan dan kata sandi benar.",
      "Matikan lalu aktifkan kembali Wi-Fi.",
      "Lupakan jaringan lalu sambungkan kembali.",
      "Minta administrator memeriksa batas klien atau pemblokiran perangkat."
    ],
    check: "Jika semua perangkat gagal tersambung, periksa keamanan Wi-Fi, DHCP, dan status access point."
  },
  {
    title: "DNS atau website tidak ditemukan",
    category: "DNS • Domain",
    icon: "⌘",
    symptom: "Sebagian website gagal dibuka walaupun koneksi terlihat aktif.",
    steps: [
      "Coba beberapa website untuk memastikan masalah bukan hanya pada satu situs.",
      "Periksa pengaturan DNS perangkat atau router jika diizinkan.",
      "Mulai ulang browser dan perangkat setelah perubahan konfigurasi.",
      "Administrator dapat memeriksa cache DNS dan akses ke server DNS."
    ],
    check: "Jika alamat IP bisa dijangkau tetapi domain gagal diterjemahkan, periksa konfigurasi DNS."
  },
  {
    title: "Kabel LAN tidak terdeteksi",
    category: "Ethernet • Kabel",
    icon: "▰",
    symptom: "Status Ethernet terputus atau lampu port tidak menyala.",
    steps: [
      "Pastikan konektor RJ45 terpasang kuat pada kedua ujung kabel.",
      "Coba kabel dan port lain yang diketahui berfungsi.",
      "Periksa indikator port komputer dan switch.",
      "Gunakan LAN tester jika tersedia untuk memeriksa susunan kabel."
    ],
    check: "Jika kabel dan port lain juga gagal, periksa adaptor jaringan dan konfigurasi interface."
  },
  {
    title: "IP address bermasalah",
    category: "IP • DHCP",
    icon: "#",
    symptom: "Perangkat tidak mendapat alamat IP yang benar atau terjadi konflik IP.",
    steps: [
      "Periksa IP address, subnet mask, gateway, dan DNS.",
      "Pastikan DHCP server aktif dan memiliki alamat yang tersedia.",
      "Pastikan IP statis tidak sama dengan perangkat lain.",
      "Minta administrator memeriksa pool DHCP dan VLAN bila digunakan."
    ],
    check: "IP yang tidak sesuai subnet atau gateway dapat membuat perangkat gagal mengakses jaringan lain."
  },
  {
    title: "Ping tinggi atau tidak stabil",
    category: "Latency • Gaming",
    icon: "◷",
    symptom: "Game terasa terlambat merespons atau panggilan video mengalami jeda.",
    steps: [
      "Kurangi aktivitas download dan upload besar.",
      "Dekatkan perangkat ke router atau gunakan kabel LAN.",
      "Pilih server aplikasi atau game yang lebih dekat jika tersedia.",
      "Ulangi pengukuran pada waktu berbeda."
    ],
    check: "Download tinggi tidak menjamin ping rendah. Jarak server, kepadatan jaringan, dan routing juga berpengaruh."
  },
  {
    title: "MikroTik tidak membagikan internet",
    category: "MikroTik • Routing",
    icon: "⚙",
    symptom: "Klien terhubung ke LAN atau hotspot tetapi tidak dapat mengakses internet.",
    steps: [
      "Periksa status interface WAN dan LAN.",
      "Periksa alamat IP, default route, dan gateway sesuai topologi.",
      "Uji koneksi router ke gateway sesuai prosedur administrator.",
      "Periksa DNS, DHCP, NAT, firewall, dan hotspot bila digunakan."
    ],
    check: "Periksa secara berurutan. Jangan mengubah firewall atau NAT tanpa memahami dampaknya."
  },
  {
    title: "Hotspot meminta login berulang",
    category: "MikroTik • Hotspot",
    icon: "▣",
    symptom: "Halaman login muncul lagi atau akses tidak aktif setelah login.",
    steps: [
      "Pastikan username dan kata sandi benar.",
      "Periksa masa aktif, kuota, dan status akun.",
      "Pastikan waktu perangkat dan konfigurasi hotspot sesuai.",
      "Administrator dapat memeriksa sesi aktif, profil, DHCP, dan aturan hotspot."
    ],
    check: "Jika satu akun bermasalah, periksa profilnya. Jika semua akun terdampak, periksa konfigurasi hotspot."
  }
];

function renderTroubleshooting(filter = "") {
  const grid = $("#troubleGrid");
  if (!grid) return;

  const query = filter.trim().toLowerCase();
  grid.replaceChildren();

  const matches = troubleData.filter((item) =>
    `${item.title} ${item.category} ${item.symptom} ${item.steps.join(" ")} ${item.check}`
      .toLowerCase().includes(query)
  );

  if (!matches.length) {
    const empty = document.createElement("article");
    empty.className = "panel empty-state";
    const heading = document.createElement("h3");
    heading.textContent = "Masalah tidak ditemukan";
    const paragraph = document.createElement("p");
    paragraph.textContent = "Coba kata kunci lain seperti DNS, Wi-Fi, kabel, IP, atau MikroTik.";
    empty.append(heading, paragraph);
    grid.appendChild(empty);
    return;
  }

  matches.forEach((item) => {
    const card = document.createElement("article");
    card.className = "trouble-card";

    const toggle = document.createElement("button");
    toggle.className = "trouble-toggle";
    toggle.type = "button";
    toggle.setAttribute("aria-expanded", "false");

    const icon = document.createElement("span");
    icon.className = "trouble-icon";
    icon.textContent = item.icon;

    const titleWrap = document.createElement("span");
    titleWrap.className = "trouble-title";
    const title = document.createElement("strong");
    title.textContent = item.title;
    const category = document.createElement("small");
    category.textContent = item.category;
    titleWrap.append(title, category);

    const arrow = document.createElement("span");
    arrow.className = "trouble-arrow";
    arrow.textContent = "⌄";
    toggle.append(icon, titleWrap, arrow);

    const detail = document.createElement("div");
    detail.className = "trouble-detail";

    const addTextSection = (headingText, bodyText) => {
      const heading = document.createElement("h4");
      heading.textContent = headingText;
      const body = document.createElement("p");
      body.textContent = bodyText;
      detail.append(heading, body);
    };

    addTextSection("GEJALA", item.symptom);

    const solutionTitle = document.createElement("h4");
    solutionTitle.textContent = "LANGKAH PENANGANAN";
    const list = document.createElement("ol");

    item.steps.forEach((step) => {
      const li = document.createElement("li");
      li.textContent = step;
      list.appendChild(li);
    });

    detail.append(solutionTitle, list);
    addTextSection("PEMERIKSAAN LANJUTAN", item.check);

    toggle.addEventListener("click", () => {
      const isOpen = card.classList.toggle("open");
      toggle.setAttribute("aria-expanded", String(isOpen));
    });

    card.append(toggle, detail);
    grid.appendChild(card);
  });
}

$("#troubleSearch")?.addEventListener("input", (event) => {
  renderTroubleshooting(event.target.value);
});

/* =====================================
   INTERNET SPEED TEST
   Layanan eksternal; perlu koneksi aktif.
===================================== */

const TEST_BASE = "https://speed.cloudflare.com";

async function timedFetch(url, options = {}, timeoutMs = 20000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Layanan pengujian mengembalikan HTTP ${response.status}.`);
    }
    return response;
  } catch (error) {
    if (error.name === "AbortError") {
      throw new Error("Waktu pengujian habis. Coba lagi.");
    }
    if (error instanceof TypeError) {
      throw new Error("Layanan tidak dapat diakses. Periksa internet atau pemblokiran browser.");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function measurePing() {
  const samples = [];

  for (let i = 0; i < 3; i++) {
    const start = performance.now();
    const response = await timedFetch(
      `${TEST_BASE}/__down?bytes=0&nc=${Date.now()}-${i}`,
      { method: "GET" },
      12000
    );
    await response.arrayBuffer();
    samples.push(performance.now() - start);
  }

  samples.sort((a, b) => a - b);
  return samples[1];
}

async function measureDownload(onProgress) {
  const sizes = [1000000, 3000000, 5000000];
  const measurements = [];
  let completedBytes = 0;

  for (const size of sizes) {
    const start = performance.now();
    const response = await timedFetch(
      `${TEST_BASE}/__down?bytes=${size}&nc=${Date.now()}`,
      { method: "GET" },
      30000
    );

    const data = await response.arrayBuffer();
    const elapsed = (performance.now() - start) / 1000;
    const actualBytes = data.byteLength;

    if (!actualBytes || elapsed <= 0) {
      throw new Error("Tidak ada data download yang diterima.");
    }

    const mbps = (actualBytes * 8) / elapsed / 1000000;
    measurements.push(mbps);
    completedBytes += actualBytes;
    onProgress(mbps, completedBytes);
  }

  measurements.sort((a, b) => a - b);
  return measurements[Math.floor(measurements.length / 2)];
}

async function measureUpload() {
  const size = 1000000;
  const bytes = new Uint8Array(size);

  if (window.crypto?.getRandomValues) {
    for (let offset = 0; offset < size; offset += 65536) {
      window.crypto.getRandomValues(
        bytes.subarray(offset, Math.min(offset + 65536, size))
      );
    }
  } else {
    bytes.fill(1);
  }

  const start = performance.now();
  const response = await timedFetch(
    `${TEST_BASE}/__up?nc=${Date.now()}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/octet-stream" },
      body: bytes
    },
    30000
  );

  await response.arrayBuffer();
  const elapsed = (performance.now() - start) / 1000;
  if (elapsed <= 0) throw new Error("Waktu pengukuran upload tidak valid.");

  return (size * 8) / elapsed / 1000000;
}

async function getPublicIP() {
  const response = await timedFetch(
    `https://api.ipify.org?format=json&nc=${Date.now()}`,
    { method: "GET" },
    10000
  );
  const result = await response.json();
  return result.ip || null;
}

function setMetricDisplays() {
  const metrics = {
    "#homePing": formatNumber(state.ping, 0),
    "#homeDownload": formatNumber(state.download),
    "#homeUpload": formatNumber(state.upload),
    "#homeIP": state.ip || "Tidak tersedia",
    "#speedPing": formatNumber(state.ping, 0),
    "#speedDownload": formatNumber(state.download),
    "#speedUpload": formatNumber(state.upload),
    "#speedIP": state.ip || "Tidak tersedia",
    "#resultPing": formatNumber(state.ping, 0),
    "#resultDownload": formatNumber(state.download),
    "#resultUpload": formatNumber(state.upload),
    "#resultIP": state.ip || "Tidak tersedia"
  };

  Object.entries(metrics).forEach(([selector, value]) => setText(selector, value));
}

function setTestStage(stage, message) {
  setText("#testStatus", stage);
  setText("#testMessage", message);
}

function setGauge(value, label) {
  setText("#liveSpeed", formatNumber(value, label === "PING" ? 0 : 2));
  setText("#gaugeLabel", label);

  const maxGauge = label === "PING" ? 300 : 500;
  const safeValue = Number.isFinite(value) ? Math.max(0, value) : 0;
  const angle = 280 * Math.min(safeValue / maxGauge, 1);
  const ring = $(".gauge-ring");

  if (ring) {
    ring.style.background =
      `conic-gradient(from 220deg, #38d9ff 0deg, #38d9ff ${angle}deg, #26394c ${angle}deg, #26394c 280deg, transparent 281deg)`;
  }
}

function saveResult() {
  state.hasResult = true;
  if ($("#noResult")) $("#noResult").hidden = true;
  if ($("#resultContent")) $("#resultContent").hidden = false;

  const download = state.download;
  const ping = state.ping;
  let grade = "Koneksi perlu diperiksa";
  let description = "Belum semua pengukuran berhasil. Periksa koneksi dan ulangi tes.";

  if (download !== null && ping !== null && download >= 25 && ping < 60) {
    grade = "Koneksi cukup baik";
    description = "Hasil pengukuran menunjukkan bandwidth memadai dan respons relatif cepat.";
  } else if (download !== null && ping !== null && download >= 5 && ping < 120) {
    grade = "Koneksi untuk penggunaan harian";
    description = "Koneksi mungkin memadai untuk banyak kegiatan, tergantung kebutuhan aplikasi.";
  } else if (download !== null && download > 0) {
    grade = "Koneksi terbatas";
    description = "Beberapa aplikasi mungkin membutuhkan waktu lebih lama atau kualitas lebih rendah.";
  } else if (ping !== null && ping < 100) {
    grade = "Respons jaringan terukur";
    description = "Ping berhasil diukur, tetapi kecepatan download belum tersedia.";
  }

  setText("#resultGrade", grade);
  setText("#resultDescription", description);

  const tips = [];
  if (state.download !== null && state.download < 5) {
    tips.push("Dekatkan perangkat ke router dan kurangi aktivitas internet lain saat pengujian.");
  }
  if (state.ping !== null && state.ping >= 100) {
    tips.push("Coba gunakan jaringan lebih stabil atau server yang lebih dekat.");
  }
  if (state.upload !== null && state.upload < 1) {
    tips.push("Upload rendah dapat memengaruhi panggilan video dan pengiriman file besar.");
  }
  if (state.ping === null) {
    tips.push("Ping belum berhasil diukur. Ulangi tes dan periksa apakah layanan pengujian dapat diakses.");
  }
  if (state.download === null) {
    tips.push("Download belum berhasil diukur. Periksa koneksi dan coba ulangi pengujian.");
  }
  if (tips.length === 0) {
    tips.push("Ulangi tes pada waktu berbeda untuk membandingkan hasil.");
    tips.push("Periksa ping dan kestabilan koneksi, bukan download saja.");
  }

  const list = $("#resultTips");
  if (list) {
    list.replaceChildren();
    tips.forEach((tip) => {
      const li = document.createElement("li");
      li.textContent = tip;
      list.appendChild(li);
    });
  }

  setMetricDisplays();
}

async function startSpeedTest() {
  if (state.testing) return;

  state.testing = true;
  const button = $("#startTest");
  if (button) {
    button.disabled = true;
    button.textContent = "Pengujian berjalan...";
  }

  setConnectionText("Sedang menguji");
  setGauge(0, "PING");
  setTestStage("MENGUJI RESPONS", "Menghubungi layanan pengujian...");

  state.ping = null;
  state.download = null;
  state.upload = null;
  state.ip = null;
  state.history = [];
  state.hasResult = false;

  setMetricDisplays();
  drawChart($("#speedChart"), []);
  drawChart($("#homeChart"), []);

  const failures = [];

  try {
    try {
      state.ping = await measurePing();
      setGauge(state.ping, "PING");
      setMetricDisplays();
    } catch (error) {
      failures.push("Ping: " + error.message);
    }

    try {
      setTestStage("MENGUJI DOWNLOAD", "Mengunduh data uji untuk memperkirakan kecepatan...");
      state.download = await measureDownload((speed) => {
        setGauge(speed, "DOWNLOAD");
        updateHistory(speed);
      });
      setGauge(state.download, "DOWNLOAD");
      setMetricDisplays();
      updateAppAnalysisFromTest(state.download);
    } catch (error) {
      failures.push("Download: " + error.message);
    }

    try {
      setTestStage("MENGUJI UPLOAD", "Mengirim data uji ke layanan pengukuran...");
      state.upload = await measureUpload();
      setGauge(state.upload, "UPLOAD");
      setMetricDisplays();
    } catch (error) {
      failures.push("Upload: " + error.message);
    }

    try {
      setTestStage("MEMERIKSA IP PUBLIK", "Mengambil alamat IP publik...");
      state.ip = await getPublicIP();
      setMetricDisplays();
    } catch (error) {
      failures.push("IP: " + error.message);
    }

    const gotAnyMeasurement =
      state.ping !== null || state.download !== null || state.upload !== null;

    if (gotAnyMeasurement) {
      saveResult();
      setConnectionText("Tes selesai");
      setTestStage(
        failures.length ? "TES SELESAI SEBAGIAN" : "PENGUJIAN SELESAI",
        failures.length
          ? "Sebagian pengukuran gagal. Hasil yang berhasil tetap ditampilkan."
          : "Hasil tes diperbarui. Buka halaman Hasil Terakhir untuk melihat ringkasan."
      );
      showToast(
        failures.length
          ? "Sebagian tes gagal. Hasil yang berhasil tetap ditampilkan."
          : "Tes kecepatan selesai."
      );
    } else {
      setConnectionText("Tes gagal");
      setTestStage("TES GAGAL", "Layanan pengukuran tidak dapat diakses. Periksa internet dan coba lagi.");
      showToast("Tes gagal. Browser atau jaringan mungkin memblokir layanan tes.");
    }
  } catch (error) {
    // Pengaman jika terjadi error yang tidak terduga.
    setConnectionText("Tes gagal");
    setTestStage("TERJADI KESALAHAN", error.message || "Terjadi kesalahan saat pengujian.");
    showToast("Terjadi kesalahan saat tes. Silakan coba lagi.");
  } finally {
    if (button) {
      button.disabled = false;
      button.innerHTML = 'Ulangi Pengujian <span>↻</span>';
    }
    state.testing = false;
  }
}

$("#startTest")?.addEventListener("click", startSpeedTest);
$("#runAgain")?.addEventListener("click", () => openPage("speed"));

$("#copyResult")?.addEventListener("click", async () => {
  if (!state.hasResult) {
    showToast("Belum ada hasil untuk disalin.");
    return;
  }

  const summary = [
    "Ringkasan Tes NetCheck",
    `Ping: ${formatNumber(state.ping, 0)} ms`,
    `Download: ${formatMbps(state.download)}`,
    `Upload: ${formatMbps(state.upload)}`,
    `IP publik: ${state.ip || "Tidak tersedia"}`,
    "Catatan: hasil dipengaruhi kondisi jaringan dan layanan pengujian."
  ].join("\n");

  try {
    if (!navigator.clipboard?.writeText) {
      throw new Error("Clipboard tidak tersedia");
    }
    await navigator.clipboard.writeText(summary);
    showToast("Ringkasan hasil berhasil disalin.");
  } catch {
    // Fallback untuk browser yang tidak mengizinkan Clipboard API.
    const area = document.createElement("textarea");
    area.value = summary;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();

    let copied = false;
    try { copied = document.execCommand("copy"); } catch { copied = false; }
    area.remove();

    showToast(copied
      ? "Ringkasan hasil berhasil disalin."
      : "Penyalinan otomatis gagal. Silakan catat hasil secara manual.");
  }
});

/* =====================================
   INITIALIZATION
===================================== */

function initialize() {
  renderApps();
  renderTroubleshooting();
  drawChart($("#homeChart"), []);
  drawChart($("#speedChart"), []);
  setMetricDisplays();

  // Pastikan hanya Dashboard yang tampil saat pertama dibuka.
  $$(".page").forEach((page) => {
    page.classList.toggle("active", page.id === "page-home");
  });

  setText("#pageTitle", "Dashboard");
}

initialize();