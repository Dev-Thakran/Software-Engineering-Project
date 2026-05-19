document.addEventListener("DOMContentLoaded", function () {
  const token = localStorage.getItem("token");
  const staffName = localStorage.getItem("name") || "Staff";

  // Staff name
  document.getElementById("staff-name").textContent = staffName.split(" ")[0];

  // Greeting based on time
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
  document.getElementById("greeting-time").textContent = greeting;

  // Date display
  const now = new Date();
  const dateOptions = { weekday: "long", day: "numeric", month: "short" };
  const formatter = new Intl.DateTimeFormat("en-GB", dateOptions);
  const parts = formatter.formatToParts(now);
  const weekday = parts.find((p) => p.type === "weekday").value;
  const day = parts.find((p) => p.type === "day").value;
  const month = parts.find((p) => p.type === "month").value;
  document.getElementById("date-display").textContent =
    `${weekday}, ${day} ${month}`;

  // Live clock
  function updateClock() {
    const timeOptions = { hour: "numeric", minute: "2-digit", hour12: true };
    document.getElementById("time-display").textContent = new Date()
      .toLocaleTimeString("en-US", timeOptions)
      .toLowerCase();
  }
  updateClock();
  setInterval(updateClock, 1000);

  // Shift countdown
  async function loadShift() {
    if (!token) return;
    try {
      const res = await fetch("/shifts/mine", {
        headers: { Authorization: "Bearer " + token },
      });
      const shifts = await res.json();
      const today = new Date().toLocaleDateString("en-CA");
      const active = shifts.find(
        (s) => s.date === today && s.status === "active",
      );

      if (!active) {
        document.getElementById("shift-type").textContent = "No active shift";
        document.getElementById("shift-countdown").textContent = "--:--:--";
        return;
      }

      document.getElementById("shift-type").textContent = active.shiftType;
      document.getElementById("shift-hours").textContent =
        " (" + active.shiftStart + " — " + active.shiftEnd + ")";

      const [endHour, endMin] = active.shiftEnd.split(":").map(Number);
      const shiftEnd = new Date();
      shiftEnd.setHours(endHour, endMin, 0, 0);
      const [startHour] = active.shiftStart.split(":").map(Number);
      if (endHour < startHour) shiftEnd.setDate(shiftEnd.getDate() + 1);

      function updateCountdown() {
        const remaining = shiftEnd - new Date();
        if (remaining <= 0) {
          document.getElementById("shift-countdown").textContent = "00:00:00";
          document.getElementById("shift-status").textContent =
            "Shift complete";
          return;
        }
        const h = Math.floor(remaining / 3600000);
        const m = Math.floor((remaining % 3600000) / 60000);
        const s = Math.floor((remaining % 60000) / 1000);
        const pad = (n) => String(n).padStart(2, "0");
        document.getElementById("shift-countdown").textContent =
          `${pad(h)}:${pad(m)}:${pad(s)}`;
        if (remaining < 1800000) {
          document.getElementById("shift-countdown").style.color = "#9A826A";
          document.getElementById("shift-status").textContent =
            "Shift ending soon";
        }
      }
      updateCountdown();
      setInterval(updateCountdown, 1000);
    } catch (err) {
      document.getElementById("shift-type").textContent =
        "Could not load shift";
    }
  }

  // Check-ins count
  async function loadCheckIns() {
    if (!token) return;
    try {
      const res = await fetch("/checkins/today", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      document.getElementById("checkins-today").textContent = data.count;
    } catch {
      document.getElementById("checkins-today").textContent = "—";
    }
  }

  // Queue — guests awaiting check-in
  async function loadQueue() {
    if (!token) return;
    try {
      const res = await fetch("/checkins/queue", {
        headers: { Authorization: "Bearer " + token },
      });
      const data = await res.json();
      document.getElementById("queue-count").textContent = data.count;

      const list = document.getElementById("queue-list");
      if (data.bookings.length === 0) {
        list.innerHTML = `<p class="text-sm" style="color:#8B7355;">No guests awaiting check-in.</p>`;
        return;
      }

      list.innerHTML = data.bookings
        .map(
          (b) => `
                    <div class="guest-row">
                        <div>
                            <p class="meta-label">Checked in</p>
                            <!-- Split on "T" to get just the date part from ISO timestamp -->
                            <p class="meta-value">${c.checkInTime.split("T")[0]}</p>
                        </div>
                        <div>
                            <p class="meta-label">Depart</p>
                            <p class="meta-value">${c.checkOutDate}</p>
                        </div>

                        <div class="text-right">
                            <button onclick="checkIn('${b.id}')" class="btn-primary" style="padding:10px 20px; font-size:10px;">
                                Check In
                            </button>
                        </div>
                    </div>
                `,
        )
        .join("");
    } catch {
      document.getElementById("queue-list").innerHTML =
        `<p class="text-sm" style="color:#8B7355;">Could not load queue.</p>`;
    }
  }

  // Currently in residence
  async function loadResidence() {
    if (!token) return;
    try {
      const res = await fetch("/checkins/residence", {
        headers: { Authorization: "Bearer " + token },
      });
      const checkins = await res.json();
      const list = document.getElementById("residence-list");

      if (checkins.length === 0) {
        list.innerHTML = `<p class="text-sm" style="color:#8B7355;">No guests currently in residence.</p>`;
        return;
      }

      list.innerHTML = checkins
        .map(
          (c) => `
                    <div class="residence-row">
                        <div>
                            <p class="meta-label">Attending</p>
                            <!-- Show attending staff name or dash if unassigned -->
                            <p class="meta-value">${c.attendingStaff || "—"}</p>
                        </div>
                    </div>
                `,
        )
        .join("");
    } catch {
      document.getElementById("residence-list").innerHTML =
        `<p class="text-sm" style="color:#8B7355;">Could not load residence.</p>`;
    }
  }

  // Check in action
  async function checkIn(bookingId) {
    if (!confirm("Confirm check-in for this guest?")) return;
    try {
      await fetch(`/bookings/${bookingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ status: "confirmed" }),
      });
      loadQueue();
      loadCheckIns();
    } catch {
      alert("Could not complete check-in.");
    }
  }

  // Check out action
  async function checkOut(checkinId) {
    if (!confirm("Confirm check-out for this guest?")) return;
    try {
      await fetch(`/bookings/${checkinId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + token,
        },
        body: JSON.stringify({ status: "checked-out" }),
      });
      loadResidence();
    } catch {
      alert("Could not complete check-out.");
    }
  }

  // Make functions global for onclick handlers
  window.checkIn = checkIn;
  window.checkOut = checkOut;

  // Load everything
  loadShift();
  loadCheckIns();
  loadQueue();
  loadResidence();
});
