// ============================================================
//  chat.js - The AI assistant widget
//  Loaded on every page by header.js. Adds a round button in the
//  bottom-right corner that opens a chat panel. Talks to the
//  server's /ai routes; the server decides what the assistant can
//  do based on who is signed in.
//  Voice uses the browser's built-in speech recognition and
//  speech synthesis (Chrome, Edge and Safari).
// ============================================================

(function () {
	if (window.__aiChatLoaded) return;
	window.__aiChatLoaded = true;

	const ICONS = {
		chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20.5l1.4-4.9A8 8 0 1 1 21 12z"/></svg>',
		close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
		refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5"/></svg>',
		speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>',
		mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
		send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12l16-8-6 16-2.5-6.5L4 12z"/></svg>',
	};

	// localStorage can be blocked (private mode, site settings)
	function readStorage(key) {
		try {
			return localStorage.getItem(key);
		} catch {
			return null;
		}
	}
	function writeStorage(key, value) {
		try {
			localStorage.setItem(key, value);
		} catch {
			/* ignore */
		}
	}

	function escapeHtml(value) {
		return String(value ?? "").replace(/[&<>"']/g, (ch) => ({
			"&": "&amp;",
			"<": "&lt;",
			">": "&gt;",
			'"': "&quot;",
			"'": "&#39;",
		})[ch]);
	}

	// Escapes the text, then allows only **bold** and "- " bullet lists
	function formatText(text) {
		const lines = escapeHtml(text).split("\n");
		let html = "";
		let inList = false;
		for (const line of lines) {
			const bullet = line.match(/^\s*[-•*]\s+(.*)$/);
			if (bullet && !inList) html += "<ul>";
			if (!bullet && inList) html += "</ul>";
			inList = !!bullet;
			html += bullet ? `<li>${bullet[1]}</li>` : `${line}<br>`;
		}
		if (inList) html += "</ul>";
		return html
			.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
			.replace(/(<br>)+$/, "");
	}

	function plainText(text) {
		return String(text).replace(/\*\*/g, "").replace(/^\s*[-•*]\s+/gm, "");
	}

	// ---------- Build the widget ----------
	const stylesheet = document.createElement("link");
	stylesheet.rel = "stylesheet";
	stylesheet.href = "/css/chat.css";
	document.head.appendChild(stylesheet);

	const launcher = document.createElement("button");
	launcher.className = "ai-launcher";
	launcher.type = "button";
	launcher.setAttribute("aria-label", "Open the hotel assistant");
	launcher.setAttribute("aria-expanded", "false");
	launcher.innerHTML = ICONS.chat;

	const panel = document.createElement("section");
	panel.className = "ai-panel";
	panel.setAttribute("role", "dialog");
	panel.setAttribute("aria-label", "Hotel assistant");
	panel.innerHTML = `
		<div class="ai-header">
			<div class="ai-header-title">
				<div class="ai-header-name">Assistant</div>
				<div class="ai-header-sub">La Extravaganza</div>
			</div>
			<button type="button" class="ai-icon-btn" data-speak aria-pressed="false" aria-label="Read replies aloud" title="Read replies aloud">${ICONS.speaker}</button>
			<button type="button" class="ai-icon-btn" data-reset aria-label="Start a new conversation" title="New conversation">${ICONS.refresh}</button>
			<button type="button" class="ai-icon-btn" data-close aria-label="Close" title="Close">${ICONS.close}</button>
		</div>
		<div class="ai-messages" aria-live="polite"></div>
		<form class="ai-input-row">
			<textarea class="ai-input" rows="1" maxlength="1000" placeholder="Type a message…" aria-label="Message"></textarea>
			<button type="button" class="ai-round-btn mic" data-mic aria-label="Speak your message" title="Speak">${ICONS.mic}</button>
			<button type="submit" class="ai-round-btn" data-send aria-label="Send">${ICONS.send}</button>
		</form>`;

	document.body.append(panel, launcher);

	const nameEl = panel.querySelector(".ai-header-name");
	const messagesEl = panel.querySelector(".ai-messages");
	const form = panel.querySelector(".ai-input-row");
	const input = panel.querySelector(".ai-input");
	const sendBtn = panel.querySelector("[data-send]");
	const micBtn = panel.querySelector("[data-mic]");
	const speakBtn = panel.querySelector("[data-speak]");

	let started = false;
	let busy = false;
	let speakReplies = readStorage("ai-speak") === "on";
	speakBtn.setAttribute("aria-pressed", String(speakReplies));

	// ---------- Server calls ----------
	async function api(path, options = {}) {
		const res = await fetch(path, {
			...options,
			headers: {
				"Content-Type": "application/json",
				Authorization: "Bearer " + readStorage("token"),
			},
		});
		const data = await res.json().catch(() => ({}));
		if (res.status === 401) {
			showSignedOut();
			throw new Error("signed-out");
		}
		if (!res.ok) {
			const error = new Error(data.error || "Something went wrong.");
			error.retryAfter = data.retryAfter; // set when Aria needs a break
			throw error;
		}
		return data;
	}

	// ---------- Rendering ----------
	function scrollDown() {
		messagesEl.scrollTop = messagesEl.scrollHeight;
	}

	function addMessage(kind, text) {
		const el = document.createElement("div");
		el.className = `ai-msg ${kind}`;
		el.innerHTML = kind === "user" ? escapeHtml(text) : formatText(text);
		messagesEl.appendChild(el);
		scrollDown();
		if (kind === "bot") speak(text);
		return el;
	}

	// Guest suggestions that fit the page being viewed, e.g. on a room page
	// "Is Room 301 free next weekend?"
	function pageSuggestions() {
		const role = localStorage.getItem("role");
		if (role === "staff" || role === "manager") return [];
		const page = location.pathname.toLowerCase();
		const room = new URLSearchParams(location.search).get("room");
		if (page.endsWith("/room.html") && room)
			return [`Is Room ${room} free next weekend?`, `What's included in Room ${room}?`];
		if (page.endsWith("/browserooms.html")) return ["Which rooms are free this weekend for two?", "What's the difference between the floors?"];
		if (page.endsWith("/floormap.html")) return ["Which floor is quietest?", "What's free tonight?"];
		if (page.endsWith("/mybooking.html")) return ["When is my next stay?", "How do I cancel a booking?"];
		if (page.endsWith("/bookingform.html")) return ["What's the cancellation policy?", "What time can I check in?"];
		if (page.endsWith("/contact.html")) return ["Where is the hotel?", "When is reception open?"];
		return [];
	}

	function addChips(suggestions) {
		// Page-specific ideas first, topped up with the usual ones
		suggestions = [...new Set([...pageSuggestions(), ...(suggestions || [])])].slice(0, 3);
		if (!suggestions?.length) return;
		const wrap = document.createElement("div");
		wrap.className = "ai-chips";
		for (const s of suggestions) {
			const chip = document.createElement("button");
			chip.type = "button";
			chip.className = "ai-chip";
			chip.textContent = s;
			chip.addEventListener("click", () => {
				wrap.remove();
				send(s);
			});
			wrap.appendChild(chip);
		}
		messagesEl.appendChild(wrap);
		scrollDown();
	}

	function addActionCard(action) {
		const card = document.createElement("div");
		card.className = "ai-card";
		card.innerHTML = `
			<div class="ai-card-title">${escapeHtml(action.title)}</div>
			${(action.lines || []).map((l) => `<div class="ai-card-line">${escapeHtml(l)}</div>`).join("")}
			<div class="ai-card-buttons">
				<button type="button" class="ai-btn" data-confirm>${escapeHtml(action.confirmLabel || "Confirm")}</button>
				${action.done ? "" : '<button type="button" class="ai-btn secondary" data-cancel>Cancel</button>'}
			</div>`;
		const buttons = card.querySelector(".ai-card-buttons");
		const finish = (message, isError) => {
			const result = document.createElement("div");
			result.className = "ai-card-result" + (isError ? " error" : "");
			result.textContent = message;
			buttons.replaceWith(result);
		};
		card.querySelector("[data-confirm]").addEventListener("click", async (e) => {
			buttons.querySelectorAll("button").forEach((b) => (b.disabled = true));
			e.target.textContent = "Working…";
			try {
				const result = await api(`/ai/actions/${action.id}/confirm`, { method: "POST" });
				finish(result.message);
				speak(result.message);
				if (result.refresh) window.dispatchEvent(new CustomEvent("ai:data-changed"));
				if (result.redirect) setTimeout(() => (window.location.href = result.redirect), 900);
			} catch (err) {
				if (err.message !== "signed-out") finish(err.message, true);
			}
		});
		card.querySelector("[data-cancel]")?.addEventListener("click", async () => {
			buttons.querySelectorAll("button").forEach((b) => (b.disabled = true));
			try {
				await api(`/ai/actions/${action.id}/cancel`, { method: "POST" });
			} catch {
				/* the card is closed either way */
			}
			finish("Cancelled.");
		});
		messagesEl.appendChild(card);
		scrollDown();
	}

	function showTyping() {
		const el = document.createElement("div");
		el.className = "ai-typing";
		el.innerHTML = "<span></span><span></span><span></span>";
		messagesEl.appendChild(el);
		scrollDown();
		return el;
	}

	function setBusy(value) {
		busy = value;
		sendBtn.disabled = value;
		input.disabled = value;
	}

	function showSignedOut() {
		started = false;
		messagesEl.innerHTML = `
			<div class="ai-signed-out">
				<p>Sign in to chat with our hotel assistant.</p>
				<a class="ai-btn" href="/pages/Login.html?redirect=${encodeURIComponent(window.location.href)}">Sign in</a>
			</div>`;
		form.style.display = "none";
	}

	// Shown when no AI model is set up on the server yet
	function showSetup(message) {
		started = false;
		messagesEl.innerHTML = `
			<div class="ai-setup">
				<div class="ai-card-title">Aria isn't set up yet</div>
				<p>${escapeHtml(message)}</p>
				<p>Free keys take about two minutes to create:</p>
				<p>
					<a href="https://console.groq.com/keys" target="_blank" rel="noopener">Get a Groq key</a>
					&middot;
					<a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Get a Gemini key</a>
				</p>
			</div>`;
		form.style.display = "none";
	}

	// ---------- Conversation ----------
	async function start() {
		if (started) return;
		if (!readStorage("token")) return showSignedOut();
		started = true;
		form.style.display = "";
		messagesEl.innerHTML = "";
		const typing = showTyping();
		try {
			const greeting = await api("/ai/greeting");
			nameEl.textContent = greeting.name;
			if (greeting.voice) voiceSettings = greeting.voice;
			if (greeting.ready === false) {
				typing.remove();
				return showSetup(greeting.setup);
			}
			launcher.setAttribute("aria-label", `Chat with ${greeting.name}`);
			if (greeting.backMessage) backMessage = greeting.backMessage;
			typing.remove();
			addMessage("bot", greeting.text);
			greeting.actions.forEach(addActionCard);
			if (loadPending()) continueBreakAfterRefresh();
			else addChips(greeting.suggestions);
		} catch (err) {
			typing.remove();
			if (err.message !== "signed-out") {
				started = false;
				addMessage("error", err.message);
			}
		}
	}

	// Sends a message. `resend` answers a message already shown in the chat
	// (one that was waiting while Aria was on a break).
	async function send(text, { resend = false } = {}) {
		text = text.trim();
		if (!text || (busy && !resend)) return;
		if (!resend) {
			messagesEl.querySelectorAll(".ai-chips").forEach((c) => c.remove());
			addMessage("user", text);
			input.value = "";
			resizeInput();
		}
		setBusy(true);
		const typing = showTyping();
		let onBreak = false;
		try {
			const result = await api("/ai/chat", {
				method: "POST",
				body: JSON.stringify({ message: text }),
			});
			typing.remove();
			addMessage("bot", result.reply);
			result.actions.forEach(addActionCard);
			// Aria changed something (e.g. checked a guest in): refresh the page's lists
			if (result.refresh) window.dispatchEvent(new CustomEvent("ai:data-changed"));
		} catch (err) {
			typing.remove();
			if (err.retryAfter) {
				onBreak = true;
				// Say so once; if a retry hits a limit again, wait quietly
				if (!resend) addMessage("bot", err.message);
				startBreak(text, err.message, err.retryAfter);
			} else if (err.message !== "signed-out") addMessage("error", err.message);
		} finally {
			if (!onBreak) {
				setBusy(false);
				input.focus();
			}
		}
	}

	// ---------- Breaks ----------
	// When every AI service has hit its free limit, the input pauses and the
	// unanswered message is kept (in sessionStorage, so it survives a page
	// refresh). As soon as the server says a service is free again, Aria says
	// she's back and answers that message.
	const PENDING_KEY = "ai-pending";
	const normalPlaceholder = input.placeholder;
	let backMessage = "Sorry about that! I'm back now.";
	let breakTimer = null;

	function loadPending() {
		try {
			const pending = JSON.parse(sessionStorage.getItem(PENDING_KEY));
			// Only for the same signed-in user
			return pending && pending.owner === readStorage("name") ? pending : null;
		} catch {
			return null;
		}
	}
	function savePending(pending) {
		try {
			sessionStorage.setItem(PENDING_KEY, JSON.stringify(pending));
		} catch {
			/* the break still works, it just won't survive a refresh */
		}
	}
	function clearPending() {
		try {
			sessionStorage.removeItem(PENDING_KEY);
		} catch {
			/* nothing to clear */
		}
	}

	function startBreak(text, awayText, seconds) {
		savePending({
			text,
			awayText,
			owner: readStorage("name"),
			resumeAt: Date.now() + seconds * 1000,
		});
		pauseInput();
		scheduleCheck(seconds);
	}

	function pauseInput() {
		setBusy(true);
		input.placeholder = "Aria is on a short break…";
	}

	function scheduleCheck(seconds) {
		clearTimeout(breakTimer);
		breakTimer = setTimeout(checkBack, Math.max(1, seconds) * 1000 + 250);
	}

	// Asks the server whether a service is free yet; if so, Aria comes back
	async function checkBack() {
		const pending = loadPending();
		if (!pending) return resumeInput();
		let status;
		try {
			status = await api("/ai/status");
		} catch (err) {
			if (err.message === "signed-out") return clearPending();
			return scheduleCheck(15); // server unreachable; try again shortly
		}
		if (status.ready === false) {
			clearPending();
			return resumeInput();
		}
		if (status.availableIn > 0) return scheduleCheck(status.availableIn);

		clearPending();
		resumeInput();
		addMessage("bot", backMessage);
		await send(pending.text, { resend: true });
	}

	function resumeInput() {
		input.placeholder = normalPlaceholder;
		setBusy(false);
	}

	// After a page refresh during a break: show the waiting message again and
	// keep waiting for Aria to come back
	function continueBreakAfterRefresh() {
		const pending = loadPending();
		if (!pending) return;
		addMessage("user", pending.text);
		addMessage("bot", pending.awayText);
		pauseInput();
		scheduleCheck(Math.max(0, (pending.resumeAt - Date.now()) / 1000));
	}

	// ---------- Opening and closing ----------
	function open() {
		panel.classList.add("open");
		launcher.setAttribute("aria-expanded", "true");
		resizeInput(); // can only be measured once the panel is visible
		start();
		setTimeout(() => input.focus(), 50);
	}
	function close() {
		panel.classList.remove("open");
		launcher.setAttribute("aria-expanded", "false");
		stopListening();
		if (window.speechSynthesis) speechSynthesis.cancel();
		launcher.focus();
	}

	launcher.addEventListener("click", () =>
		panel.classList.contains("open") ? close() : open(),
	);
	panel.querySelector("[data-close]").addEventListener("click", close);
	panel.addEventListener("keydown", (e) => {
		if (e.key === "Escape") close();
	});
	panel.querySelector("[data-reset]").addEventListener("click", async () => {
		if (busy) return;
		try {
			await api("/ai/conversation", { method: "DELETE" });
		} catch {
			/* start fresh anyway */
		}
		started = false;
		start();
	});

	// ---------- Typing ----------
	// Grows the box with its text. The borders are added because the site
	// sizes boxes including their border; without them a scrollbar appears.
	const MAX_INPUT_HEIGHT = 110;
	function resizeInput() {
		input.style.height = "auto";
		const borders = input.offsetHeight - input.clientHeight;
		const height = input.scrollHeight + borders;
		input.style.height = Math.min(height, MAX_INPUT_HEIGHT) + "px";
		input.style.overflowY = height > MAX_INPUT_HEIGHT ? "auto" : "hidden";
	}
	input.addEventListener("input", resizeInput);
	input.addEventListener("keydown", (e) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			send(input.value);
		}
	});
	form.addEventListener("submit", (e) => {
		e.preventDefault();
		send(input.value);
	});

	// ---------- Voice: replies read aloud ----------
	// Voice settings come from the server (assistant.config.js)
	let voiceSettings = { preferred: [], rate: 1, pitch: 1 };

	// The first available voice from the preferred list, if any
	function pickVoice() {
		const voices = speechSynthesis.getVoices();
		for (const wanted of voiceSettings.preferred) {
			const match = voices.find((v) =>
				v.name.toLowerCase().includes(wanted.toLowerCase()),
			);
			if (match) return match;
		}
		return null;
	}

	function speak(text) {
		if (!speakReplies || !window.speechSynthesis) return;
		speechSynthesis.cancel();
		const utterance = new SpeechSynthesisUtterance(plainText(text));
		const voice = pickVoice();
		if (voice) {
			utterance.voice = voice;
			utterance.lang = voice.lang;
		}
		utterance.rate = voiceSettings.rate || 1;
		utterance.pitch = voiceSettings.pitch || 1;
		speechSynthesis.speak(utterance);
	}

	// Browsers load their voice list in the background; asking for it early
	// makes sure it's ready by the first reply
	if (window.speechSynthesis) speechSynthesis.getVoices();

	if (!window.speechSynthesis) speakBtn.hidden = true;
	speakBtn.addEventListener("click", () => {
		speakReplies = !speakReplies;
		speakBtn.setAttribute("aria-pressed", String(speakReplies));
		writeStorage("ai-speak", speakReplies ? "on" : "off");
		if (!speakReplies) speechSynthesis.cancel();
	});

	// ---------- Voice: speaking to the assistant ----------
	const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
	let recognition = null;
	let listening = false;

	function stopListening() {
		if (recognition && listening) recognition.stop();
	}

	if (!SpeechRecognition) {
		micBtn.hidden = true;
	} else {
		recognition = new SpeechRecognition();
		recognition.lang = navigator.language || "en-NZ";
		recognition.interimResults = true;

		let heard = "";
		recognition.addEventListener("result", (e) => {
			heard = Array.from(e.results)
				.map((r) => r[0].transcript)
				.join("");
			input.value = heard;
			resizeInput();
		});
		recognition.addEventListener("end", () => {
			listening = false;
			micBtn.classList.remove("listening");
			micBtn.setAttribute("aria-label", "Speak your message");
			if (heard.trim()) send(heard);
			heard = "";
		});
		recognition.addEventListener("error", (e) => {
			if (e.error === "not-allowed")
				addMessage("error", "Microphone access was blocked. Allow it in the browser to use voice.");
		});

		micBtn.addEventListener("click", () => {
			if (busy) return;
			if (listening) return stopListening();
			if (window.speechSynthesis) speechSynthesis.cancel();
			heard = "";
			listening = true;
			micBtn.classList.add("listening");
			micBtn.setAttribute("aria-label", "Stop listening");
			recognition.start();
		});
	}

	// A message was waiting for Aria when the page was refreshed: reopen the
	// chat so the user sees her come back and answer it
	if (loadPending()) open();
})();
