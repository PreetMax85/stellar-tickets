"use strict";

// ─── Pricing ──────────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  premium: { label: "Premium", price: 25, color: "#c084fc" },
  exec: { label: "Executive", price: 18, color: "#93c5fd" },
  normal: { label: "Normal", price: 12, color: "#6ee7b7" },
};

function getTier(seatId, total) {
  const third = Math.ceil(total / 3);
  const idx = seatId - 1;
  if (idx < third) return "premium";
  if (idx < third * 2) return "exec";
  return "normal";
}

// ─── State ────────────────────────────────────────────────────────────────────

const state = {
  accessToken: localStorage.getItem("accessToken") || null,
  user: JSON.parse(localStorage.getItem("user") || "null"),
  seats: [],
  myBookings: {}, // { [seatId]: bookingId }
  movies: [],
  featuredId: 1,
  isRefreshing: false,
};

// ─── API helper ───────────────────────────────────────────────────────────────

async function api(path, options = {}, _isRetry = false) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (state.accessToken)
    headers["Authorization"] = `Bearer ${state.accessToken}`;

  const res = await fetch(path, { ...options, headers });

  if (res.status === 401 && !_isRetry && !state.isRefreshing) {
    const refreshed = await silentRefresh();
    if (refreshed) return api(path, options, true);
    logout(false);
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw new Error(
      data.error || data.message || `Request failed (${res.status})`,
    );
  return data;
}

async function silentRefresh() {
  try {
    state.isRefreshing = true;
    const res = await fetch("/api/auth/refresh", { method: "POST" });
    if (!res.ok) return false;
    const body = await res.json();
    state.accessToken = body.data?.accessToken || null;
    if (state.accessToken) {
      localStorage.setItem("accessToken", state.accessToken);
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    state.isRefreshing = false;
  }
}

// ─── Auth ────────────────────────────────────────────────────────────────────

async function handleLogin(e) {
  e.preventDefault();
  const btn = document.getElementById("login-btn");
  btn.disabled = true;
  btn.textContent = "Signing in…";
  try {
    const res = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: document.getElementById("login-email").value.trim(),
        password: document.getElementById("login-password").value,
      }),
    });
    applyAuth(res.data);
    closeAuthModal();
    showToast(`Welcome back, ${state.user.name}!`, "success");
    await refreshSeats();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Sign In";
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const btn = document.getElementById("register-btn");
  btn.disabled = true;
  btn.textContent = "Creating account…";
  try {
    const res = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({
        name: document.getElementById("reg-name").value.trim(),
        email: document.getElementById("reg-email").value.trim(),
        password: document.getElementById("reg-password").value,
      }),
    });
    applyAuth(res.data);
    closeAuthModal();
    showToast(`Welcome to Stellar Tickets, ${state.user.name}!`, "success");
    await refreshSeats();
  } catch (err) {
    showToast(err.message, "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Create Account";
  }
}

function applyAuth(data) {
  state.accessToken = data.accessToken;
  state.user = data.user;
  localStorage.setItem("accessToken", data.accessToken);
  localStorage.setItem("user", JSON.stringify(data.user));
  renderNavbar();
}

function logout(showMessage = true) {
  state.accessToken = null;
  state.user = null;
  state.myBookings = {};
  localStorage.removeItem("accessToken");
  localStorage.removeItem("user");
  fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
  renderNavbar();
  renderSeats();
  renderTickets();
  if (showMessage) showToast("Signed out successfully", "info");
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function fetchMovies() {
  try {
    const res = await api("/api/movies");
    state.movies = res.data || [];
  } catch {
    state.movies = [];
  }
}
async function fetchSeats() {
  try {
    const res = await api("/api/bookings/seats");
    state.seats = res.data || [];
  } catch {
    state.seats = [];
  }
}
async function fetchMyBookings() {
  if (!state.accessToken) {
    state.myBookings = {};
    return;
  }
  try {
    const res = await api("/api/bookings/my-bookings");
    state.myBookings = (res.data || []).reduce((acc, b) => {
      if (b.status === "confirmed") acc[b.seat.id] = b.bookingId;
      return acc;
    }, {});
  } catch {
    state.myBookings = {};
  }
}
async function refreshSeats() {
  await Promise.all([fetchSeats(), fetchMyBookings()]);
  renderSeats();
  renderTickets();
}

// ─── Confirm Modal ────────────────────────────────────────────────────────────

function openConfirmModal({
  icon,
  title,
  subtitle,
  details,
  actionLabel,
  actionClass,
  onConfirm,
}) {
  document.getElementById("confirm-icon").textContent = icon;
  document.getElementById("confirm-title").textContent = title;
  document.getElementById("confirm-subtitle").textContent = subtitle;

  // Details rows
  const detailsEl = document.getElementById("confirm-details");
  detailsEl.innerHTML = details
    .map(
      ([label, value, valueColor]) => `
    <div style="display:flex;justify-content:space-between;align-items:center;">
      <span style="color:var(--muted);">${escHtml(label)}</span>
      <span style="font-weight:500;color:${valueColor || "var(--text)"};">${escHtml(String(value))}</span>
    </div>
  `,
    )
    .join("");

  const btn = document.getElementById("confirm-action-btn");
  btn.className = actionClass;
  btn.textContent = actionLabel;
  btn.onclick = () => {
    closeConfirmModal();
    onConfirm();
  };

  document.getElementById("confirm-modal").classList.add("open");
}

function closeConfirmModal() {
  document.getElementById("confirm-modal").classList.remove("open");
}

// ─── Seat interactions ────────────────────────────────────────────────────────

function handleSeatClick(seat) {
  if (!state.user) {
    showToast("Please sign in to book a seat", "info");
    openAuthModal();
    return;
  }
  if (seat.isBooked && !state.myBookings[seat.id]) return; // someone else's booked seat

  const total = state.seats.length;
  const tierKey = getTier(seat.id, total);
  const tier = TIER_CONFIG[tierKey];
  const movieTitle =
    state.movies.find((m) => m.id === state.featuredId)?.title ||
    "Featured Movie";
  const isMine = state.myBookings[seat.id] !== undefined;

  if (isMine) {
    openConfirmModal({
      icon: "🎟️",
      title: "Cancel Booking?",
      subtitle:
        "Your seat will be released and refunded. This cannot be undone.",
      details: [
        ["Movie", movieTitle, "var(--text)"],
        ["Seat", `#${seat.id}`, "var(--amber)"],
        ["Tier", tier.label, tier.color],
        ["Refund", `$${tier.price}`, "#6ee7b7"],
      ],
      actionLabel: `Cancel & Refund $${tier.price}`,
      actionClass: "btn-danger",
      onConfirm: () => cancelSeat(seat.id),
    });
  } else {
    openConfirmModal({
      icon: "🍿",
      title: "Confirm Booking",
      subtitle: "You're one step away from your seat. Enjoy the movie!",
      details: [
        ["Movie", movieTitle, "var(--text)"],
        ["Seat", `#${seat.id}`, "var(--amber)"],
        ["Tier", tier.label, tier.color],
        ["Total", `$${tier.price}`, "var(--amber)"],
      ],
      actionLabel: `Pay $${tier.price} & Book`,
      actionClass: "btn-primary",
      onConfirm: () => bookSeat(seat.id),
    });
  }
}

async function bookSeat(seatId) {
  try {
    await api("/api/bookings/book", {
      method: "POST",
      body: JSON.stringify({ seatId, movieId: state.featuredId }),
    });
    showToast(`Seat ${seatId} booked!`, "success");
    await refreshSeats();
  } catch (err) {
    showToast(err.message || "Could not book seat", "error");
  }
}

async function cancelSeat(seatId) {
  const bookingId = state.myBookings[seatId];
  if (!bookingId) return;
  try {
    await api("/api/bookings/cancel", {
      method: "POST",
      body: JSON.stringify({ bookingId }),
    });
    showToast(`Seat ${seatId} cancelled`, "info");
    await refreshSeats();
  } catch (err) {
    showToast(err.message || "Could not cancel booking", "error");
  }
}

// ─── Render: Navbar ───────────────────────────────────────────────────────────

function renderNavbar() {
  const el = document.getElementById("nav-auth");
  if (!el) return;
  if (state.user) {
    el.innerHTML = `
      <span style="font-size:14px;color:var(--muted);">Welcome, <strong style="color:var(--text);font-weight:500;">${escHtml(state.user.name)}</strong></span>
      <button class="btn-ghost" onclick="logout()">Sign out</button>`;
  } else {
    el.innerHTML = `<button class="btn-nav" onclick="openAuthModal()">Sign In</button>`;
  }
}

// ─── Render: Featured movie ───────────────────────────────────────────────────

function renderFeaturedMovie() {
  const movie =
    state.movies.find((m) => m.id === state.featuredId) || state.movies[0];
  if (!movie) return;
  state.featuredId = movie.id;

  const titleEl = document.getElementById("featured-title");
  const metaEl = document.getElementById("featured-meta");
  const subEl = document.getElementById("featured-sub");

  if (titleEl) titleEl.textContent = movie.title;
  if (subEl) subEl.textContent = "Now showing at ChaiCode Cinema";
  if (metaEl) {
    metaEl.innerHTML = `
      <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;font-size:12px;font-weight:500;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);color:var(--amber);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
        ${movie.duration} min
      </span>
      <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;font-size:12px;background:rgba(255,255,255,0.05);border:1px solid var(--border);color:var(--muted);">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        ${escHtml(movie.language)}
      </span>
      <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 12px;border-radius:99px;font-size:12px;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.25);color:#6ee7b7;">
        <svg width="8" height="8" viewBox="0 0 24 24" fill="var(--emerald)" stroke="none"><circle cx="12" cy="12" r="12"/></svg>
        Now Showing
      </span>`;
  }
}

// ─── Render: Seat grid ────────────────────────────────────────────────────────

function renderSeats() {
  const grid = document.getElementById("seat-grid");
  const caption = document.getElementById("seat-caption");
  if (!grid) return;

  const seats = state.seats;
  const total = seats.length;

  if (total === 0) {
    grid.innerHTML = `<p style="color:var(--muted);font-size:14px;grid-column:1/-1;text-align:center;padding:40px 0;">No seats available</p>`;
    if (caption) caption.textContent = "";
    return;
  }

  const available = seats.filter(
    (s) => !s.isBooked && !state.myBookings[s.id],
  ).length;
  const mine = Object.keys(state.myBookings).length;
  if (caption)
    caption.textContent = `${available} of ${total} seats available${mine ? ` · You have ${mine} seat${mine !== 1 ? "s" : ""}` : ""}`;

  grid.innerHTML = seats
    .map((seat) => {
      const isMine = state.myBookings[seat.id] !== undefined;
      const isBooked = !isMine && seat.isBooked === 1;
      const tierKey = getTier(seat.id, total);

      const tierClass = `seat--${tierKey}`;
      const stateClass = isBooked
        ? "seat--booked"
        : isMine
          ? "seat--mine"
          : "seat--available";

      // Enhanced tooltip: show who booked it if booked by someone else
      let tip;
      if (isBooked) {
        const bookedByName =
          seat.name || (seat.user && seat.user.name) || "Another User";
        tip = `Booked by: ${bookedByName}`;
      } else if (isMine) tip = "Your seat — click to cancel";
      else tip = "Available — click to book";

      return `<div
      class="seat ${tierClass} ${stateClass}"
      data-id="${seat.id}"
      data-tip="${escHtml(tip)}"
      role="button"
      tabindex="${isBooked ? -1 : 0}"
      aria-label="Seat ${seat.id}: ${escHtml(tip)}"
      onclick="handleSeatClick(state.seats.find(s=>s.id===${seat.id}))"
      onkeydown="if(event.key==='Enter'||event.key===' ')handleSeatClick(state.seats.find(s=>s.id===${seat.id}))"
    >${seat.id}</div>`;
    })
    .join("");
}

// ─── Render: Ticket stubs ─────────────────────────────────────────────────────

function renderTickets() {
  const section = document.getElementById("tickets-section");
  const list = document.getElementById("tickets-list");
  const countEl = document.getElementById("ticket-count");
  if (!section || !list) return;

  const myEntries = Object.entries(state.myBookings); // [[seatId, bookingId], ...]

  if (!state.user || myEntries.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  if (countEl)
    countEl.textContent = `${myEntries.length} ticket${myEntries.length !== 1 ? "s" : ""}`;

  const total = state.seats.length;
  const movieTitle =
    state.movies.find((m) => m.id === state.featuredId)?.title ||
    "Featured Movie";

  list.innerHTML = myEntries
    .map(([seatId]) => {
      const id = parseInt(seatId, 10);
      const tierKey = getTier(id, total);
      const tier = TIER_CONFIG[tierKey];

      return `
      <div class="ticket">
        <div class="ticket__main">
          <p style="font-size:10px;letter-spacing:0.15em;color:var(--muted);font-weight:500;margin-bottom:8px;text-transform:uppercase;">Admit One</p>
          <p class="font-display" style="font-size:16px;font-weight:700;line-height:1.2;margin-bottom:10px;">${escHtml(movieTitle)}</p>
          <div style="display:flex;gap:20px;flex-wrap:wrap;">
            <div>
              <p style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">Seat</p>
              <p style="font-size:20px;font-weight:700;color:var(--amber);font-family:'Syne',sans-serif;">#${id}</p>
            </div>
            <div>
              <p style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">Tier</p>
              <p style="font-size:14px;font-weight:500;color:${tier.color};">${tier.label}</p>
            </div>
            <div>
              <p style="font-size:10px;color:var(--muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:2px;">Price</p>
              <p style="font-size:14px;font-weight:500;color:var(--text);">$${tier.price}</p>
            </div>
          </div>
        </div>
        <div class="ticket__stub">
          <div class="ticket__barcode"></div>
          <p style="font-size:9px;color:var(--muted);letter-spacing:0.1em;text-align:center;line-height:1.4;">#${String(id).padStart(3, "0")}<br>STELLAR</p>
        </div>
      </div>
    `;
    })
    .join("");
}

// ─── Render: More movies ──────────────────────────────────────────────────────

function renderMovies() {
  const list = document.getElementById("movies-list");
  if (!list || !state.movies.length) return;

  const others = state.movies.filter((m) => m.id !== state.featuredId);
  if (!others.length) {
    list.innerHTML = `<p style="color:var(--muted);font-size:14px;padding:20px 0;">More movies coming soon.</p>`;
    return;
  }

  list.innerHTML = others
    .map(
      (movie) => `
    <div class="movie-card">
      <div style="height:270px;background:var(--surface2);display:flex;align-items:center;justify-content:center;font-size:44px;overflow:hidden;">
        ${movie.posterUrl ? `<img src="${escHtml(movie.posterUrl)}" alt="${escHtml(movie.title)}" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;" onerror="this.parentElement.innerHTML='🎬'">` : "🎬"}
      </div>
      <div style="padding:14px;">
        <h3 style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;line-height:1.3;margin-bottom:8px;">${escHtml(movie.title)}</h3>
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:6px;">
          <span style="font-size:11px;color:var(--muted);">${escHtml(movie.language)} · ${movie.duration}m</span>
          <span style="font-size:10px;padding:2px 8px;border-radius:99px;background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.25);color:var(--amber);font-weight:500;">Coming Soon</span>
        </div>
      </div>
    </div>`,
    )
    .join("");
}

// ─── Render: Skeletons ────────────────────────────────────────────────────────

function renderSkeletonSeats(count = 20) {
  const grid = document.getElementById("seat-grid");
  if (grid)
    grid.innerHTML = Array.from(
      { length: count },
      () =>
        `<div class="skeleton" style="aspect-ratio:1;border-radius:6px;"></div>`,
    ).join("");
}
function renderSkeletonMovies(count = 4) {
  const list = document.getElementById("movies-list");
  if (list)
    list.innerHTML = Array.from(
      { length: count },
      () => `
    <div style="flex:0 0 200px;border-radius:12px;overflow:hidden;border:1px solid var(--border);">
      <div class="skeleton" style="height:270px;"></div>
      <div style="padding:14px;background:var(--surface);">
        <div class="skeleton" style="height:14px;margin-bottom:8px;"></div>
        <div class="skeleton" style="height:12px;width:60%;"></div>
      </div>
    </div>`,
    ).join("");
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function openAuthModal() {
  document.getElementById("auth-modal")?.classList.add("open");
  setTimeout(() => document.getElementById("login-email")?.focus(), 100);
}
function closeAuthModal() {
  document.getElementById("auth-modal")?.classList.remove("open");
}

function switchTab(tab) {
  const isLogin = tab === "login";
  document.getElementById("form-login").style.display = isLogin
    ? "flex"
    : "none";
  document.getElementById("form-register").style.display = isLogin
    ? "none"
    : "flex";
  document.getElementById("tab-login").classList.toggle("active", isLogin);
  document.getElementById("tab-register").classList.toggle("active", !isLogin);
  setTimeout(
    () =>
      document.getElementById(isLogin ? "login-email" : "reg-name")?.focus(),
    50,
  );
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const icons = {
    success: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    error: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`,
    info: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
  };
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.innerHTML = `${icons[type] || icons.info}<span>${escHtml(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = "toast-out 0.3s ease forwards";
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

// Close modals on backdrop click
document.getElementById("auth-modal")?.addEventListener("click", function (e) {
  if (e.target === this) closeAuthModal();
});
document
  .getElementById("confirm-modal")
  ?.addEventListener("click", function (e) {
    if (e.target === this) closeConfirmModal();
  });

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeAuthModal();
    closeConfirmModal();
  }
});

// ─── Utility ──────────────────────────────────────────────────────────────────

function escHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Init ─────────────────────────────────────────────────────────────────────

async function init() {
  renderNavbar();
  renderSkeletonSeats(20);
  renderSkeletonMovies(4);
  // If the API takes more than 3 seconds, Render is waking up!
  const wakeUpWarning = setTimeout(() => {
    showToast(
      "Server is waking up from sleep mode (Render Free Tier). Please wait ~50s...",
      "info",
    );
  }, 3000);

  try {
    await Promise.all([fetchMovies(), fetchSeats(), fetchMyBookings()]);
    clearTimeout(wakeUpWarning); // If it responds fast, cancel the warning

    renderFeaturedMovie();
    renderSeats();
    renderMovies();
    renderTickets();
  } catch (err) {
    clearTimeout(wakeUpWarning);
    showToast("Failed to connect to the server. Please refresh.", "error");
  }
}

document.addEventListener("DOMContentLoaded", init);
