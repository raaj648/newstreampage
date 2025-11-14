document.addEventListener("DOMContentLoaded", () => {
  // --- CONFIGURATION ---
  const API_URL = "https://topembed.pw/api.php?format=json";
  const DISCORD_SERVER_ID = "1422384816472457288";
  const CACHE_KEY = 'apiDataCache';
  const CACHE_DURATION_MINUTES = 5;

  // --- PAGE ELEMENTS ---
  const pageTitle = document.querySelector("title"),
        streamPlayer = document.getElementById("stream-player"),
        playerContainer = document.querySelector(".video-player-container"),
        matchTitleEl = document.getElementById("match-title"),
        matchTournamentEl = document.getElementById("match-tournament"),
        matchStatusBadge = document.getElementById("match-status-badge"),
        countdownContainer = document.getElementById("countdown-container"),
        matchStartTimeEl = document.getElementById("match-start-time"),
        streamLinksGrid = document.getElementById("stream-links-grid"),
        closeAdBtn = document.getElementById("close-ad"),
        stickyAd = document.getElementById("sticky-footer-ad");

  let countdownInterval;

  // --- CORE FUNCTIONS (No changes in this section) ---

  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get('id');
    const streamUrl = params.get('stream');
    if (!matchId || !streamUrl) {
      displayError("Invalid URL", "Match ID or Stream URL is missing from the address.");
      throw new Error("Invalid URL parameters.");
    }
    return { matchId, streamUrl };
  }

  async function fetchAndCacheApiData() {
    const cachedData = sessionStorage.getItem(CACHE_KEY);
    const now = new Date().getTime();
    if (cachedData) {
      const { timestamp, data } = JSON.parse(cachedData);
      if (now - timestamp < CACHE_DURATION_MINUTES * 60 * 1000) return data;
    }
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`API request failed with status ${response.status}`);
      const data = await response.json();
      const cachePayload = { timestamp: now, data: data };
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(cachePayload));
      return data;
    } catch (error) {
      displayError("API Error", "Could not fetch match data from the server.");
      throw error;
    }
  }

  function findMatchById(apiData, matchId) {
    if (!apiData || !apiData.events) return null;
    for (const date in apiData.events) {
      const eventsForDay = Array.isArray(apiData.events[date]) ? apiData.events[date] : [apiData.events[date]];
      for (const event of eventsForDay) {
        if (event.sport && event.match && event.unix_timestamp) {
          const uniqueString = `${event.unix_timestamp}_${event.sport}_${event.match}`;
          const uniqueId = btoa(unescape(encodeURIComponent(uniqueString)));
          if (uniqueId === matchId) return event;
        }
      }
    }
    return null;
  }
  
  function updatePageInfo(match) {
    const title = `${match.match} - Live Stream`;
    pageTitle.textContent = title;
    matchTitleEl.textContent = match.match;
    matchTournamentEl.textContent = match.tournament;
    const startTime = new Date(parseInt(match.unix_timestamp, 10) * 1000);
    matchStartTimeEl.textContent = startTime.toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: 'numeric', hour12: true });
  }

  function updateMatchStatus(match) {
    const now = Math.floor(Date.now() / 1000);
    const startTime = parseInt(match.unix_timestamp, 10);
    if (isNaN(startTime)) {
      matchStatusBadge.textContent = "Error";
      matchStatusBadge.className = "status-badge finished";
      return;
    }
    const timeDiffMinutes = (now - startTime) / 60;
    if (timeDiffMinutes >= 0 && timeDiffMinutes < 150) { 
      matchStatusBadge.textContent = "Live";
      matchStatusBadge.className = "status-badge live";
      countdownContainer.style.display = "none";
    } else if (timeDiffMinutes < 0) {
      matchStatusBadge.textContent = "Upcoming";
      matchStatusBadge.className = "status-badge upcoming";
      startCountdown(startTime);
    } else {
      matchStatusBadge.textContent = "Finished";
      matchStatusBadge.className = "status-badge finished";
      countdownContainer.style.display = "none";
    }
  }

  function startCountdown(targetTimestamp) {
    countdownContainer.style.display = "block";
    clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = targetTimestamp - now;
      if (diff <= 0) {
        clearInterval(countdownInterval);
        location.reload();
        return;
      }
      document.getElementById("days").textContent = Math.floor(diff / (3600 * 24)).toString().padStart(2, '0');
      document.getElementById("hours").textContent = Math.floor((diff % (3600 * 24)) / 3600).toString().padStart(2, '0');
      document.getElementById("minutes").textContent = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
      document.getElementById("seconds").textContent = Math.floor(diff % 60).toString().padStart(2, '0');
    }, 1000);
  }

  function getChannelName(url, index) {
    try {
      const lastPart = url.substring(url.lastIndexOf('/') + 1);
      const isGeneric = /^(ex)?\d{3,}$/.test(lastPart);
      if (isGeneric || !lastPart) return `Channel ${index + 1}`;
      return decodeURIComponent(lastPart);
    } catch (e) {
      return `Channel ${index + 1}`;
    }
  }
  
  function renderChannelList(channels, currentStreamUrl, matchId) {
    streamLinksGrid.innerHTML = "";
    if (!channels || channels.length === 0) {
      streamLinksGrid.innerHTML = "<p>No other stream channels are available for this match.</p>";
      return;
    }

    const channelUrls = channels.map(c => typeof c === 'object' ? c.channel : c).filter(Boolean);

    channelUrls.forEach((channelUrl, index) => {
      const channelName = getChannelName(channelUrl, index);
      const link = document.createElement("a");

      link.className = "stream-link";
      link.target = "_blank";
      link.rel = "noopener noreferrer";

      // ⭐ FIXED — absolute URL
      link.href = `${window.location.origin}${window.location.pathname}?id=${matchId}&stream=${encodeURIComponent(channelUrl)}`;

      const newTabIcon = `<svg class="new-tab-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/></svg>`;

      let buttonText = "Switch";
      if (channelUrl === currentStreamUrl) {
        link.classList.add("active");
        buttonText = "▶ Running";
      }

      link.innerHTML = `
        <div class="stream-link-content">
          <span class="stream-info">${channelName} ${newTabIcon}</span>
          <span class="watch-now-btn">${buttonText}</span>
        </div>
      `;

      streamLinksGrid.appendChild(link);
    });
}


  function displayError(title, message) {
    matchTitleEl.textContent = title;
    matchTournamentEl.textContent = message;
    matchStatusBadge.textContent = "Error";
    matchStatusBadge.className = "status-badge finished";
    playerContainer.style.display = 'none';
    countdownContainer.style.display = 'none';
    streamLinksGrid.innerHTML = `<p style="text-align: center; color: #ff8c00;">${message}. Please select another match.</p>`;
  }

  async function loadDiscordWidget() {
    if (!DISCORD_SERVER_ID) return;
    try {
      const response = await fetch(`https://discord.com/api/guilds/${DISCORD_SERVER_ID}/widget.json`);
      if (!response.ok) throw new Error('Failed to fetch Discord widget data');
      const data = await response.json();
      document.getElementById("discord-online-count").textContent = data.presence_count || '0';
      if (data.instant_invite) document.getElementById("discord-join-button").href = data.instant_invite;
      const membersListEl = document.getElementById("discord-members-list");
      membersListEl.innerHTML = '';
      if (data.members && data.members.length > 0) {
        data.members.slice(0, 3).forEach(member => {
          const li = document.createElement('li');
          li.innerHTML = `<div class="member-avatar"><img src="${member.avatar_url}" alt="${member.username}"><span class="online-indicator"></span></div><span class="member-name">${member.username}</span>`;
          membersListEl.appendChild(li);
        });
        if (data.instant_invite && data.members.length > 3) {
            const moreLi = document.createElement('li');
            moreLi.className = 'more-members-link';
            moreLi.innerHTML = `<p>and ${data.members.length - 3} more in our <a href="${data.instant_invite}" target="_blank" rel="noopener noreferrer nofollow">Discord!</a></p>`;
            membersListEl.appendChild(moreLi);
        }
      } else {
         membersListEl.innerHTML = '<li>No members to display.</li>';
      }
    } catch (error) {
      console.error("Error loading Discord widget:", error);
      const discordWidget = document.getElementById("discord-widget-container");
      if (discordWidget) discordWidget.style.display = 'none';
    }
  }

  // --- REFACTORED AND FIXED FEATURE: FLOATING VIDEO PLAYER ---
  // --- REFACTORED AND FIXED FEATURE: FLOATING VIDEO PLAYER ---
  function setupFloatingPlayer() {
    if (!playerContainer) return;

    let isFloatingDisabled = false;
    let header, closeBtn;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const shouldFloat = !isFloatingDisabled && !entry.isIntersecting && entry.boundingClientRect.top < 0;
        playerContainer.classList.toggle("floating-player", shouldFloat);

        if (shouldFloat) {
          attachFloatingUI();
        } else {
          removeFloatingUI();
        }
      },
      { threshold: 0 }
    );

    observer.observe(playerContainer);

    function attachFloatingUI() {
      if (playerContainer.querySelector('.floating-player-header')) return;

      header = document.createElement('div');
      header.className = 'floating-player-header';
      header.textContent = 'Drag to Move';

      closeBtn = document.createElement('div');
      closeBtn.className = 'floating-player-close';
      closeBtn.innerHTML = `<svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`;

      closeBtn.addEventListener('click', () => {
        isFloatingDisabled = true;
        playerContainer.classList.remove("floating-player");
        removeFloatingUI();
      });

      playerContainer.appendChild(header);
      playerContainer.appendChild(closeBtn);

      header.addEventListener('pointerdown', dragPointerDown);
      header.addEventListener('pointercancel', cleanupPointer);
    }

    function removeFloatingUI() {
      playerContainer.style.left = '';
      playerContainer.style.top = '';
      playerContainer.style.right = '';
      playerContainer.style.bottom = '';
      playerContainer.style.width = '';
      playerContainer.style.height = '';

      const existingHeader = playerContainer.querySelector('.floating-player-header');
      if (existingHeader) existingHeader.remove();
      const existingCloseBtn = playerContainer.querySelector('.floating-player-close');
      if (existingCloseBtn) existingCloseBtn.remove();
      
      cleanupPointer();
    }

    let dragging = false;
    let isTouchDrag = false;
    let startX = 0, startY = 0;
    let initialLeft = 0, initialTop = 0;
    let didDrag = false; // **NEW**: Flag to track if a drag has actually occurred

    function dragPointerDown(e) {
      if (!playerContainer.classList.contains('floating-player')) return;
      
      const pType = e.pointerType || 'mouse';
      const rect = playerContainer.getBoundingClientRect();

      startX = e.clientX;
      startY = e.clientY;
      initialLeft = rect.left;
      initialTop = rect.top;
      
      if (pType === 'mouse') e.preventDefault();
      
      if (e.pointerId && header.setPointerCapture) {
        try { header.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }

      dragging = true;
      isTouchDrag = (pType === 'touch');
      didDrag = false; // **MODIFIED**: Reset on new pointer down

      document.addEventListener('pointermove', dragPointerMove, { passive: false });
      document.addEventListener('pointerup', dragPointerUp, { once: true });
    }

    function dragPointerMove(e) {
      if (!dragging) return;

      const dx = e.clientX - startX;
      const dy = e.clientY - startY;

      // **MODIFIED**: Check if this is the first move and determine intent
      if (!didDrag) {
        // If vertical movement is greater, assume it's a scroll and do nothing.
        if (isTouchDrag && Math.abs(dy) > Math.abs(dx)) {
          cleanupPointer(); // Abort the drag
          return;
        }
      }
      
      // If we are here, it's a confirmed drag, so prevent default behavior.
      e.preventDefault();
      didDrag = true;

      const rect = playerContainer.getBoundingClientRect();
      const newLeft = Math.max(0, Math.min(initialLeft + dx, window.innerWidth - rect.width));
      const newTop  = Math.max(0, Math.min(initialTop + dy, window.innerHeight - rect.height));
      
      playerContainer.style.left = `${newLeft}px`;
      playerContainer.style.top = `${newTop}px`;
      playerContainer.style.right = 'auto';
      playerContainer.style.bottom = 'auto';
      playerContainer.style.position = 'fixed';
    }

    function dragPointerUp(e) {
      if (e.pointerId && header.releasePointerCapture) {
        try { header.releasePointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      }
      cleanupPointer();
    }

    function cleanupPointer() {
      dragging = false;
      isTouchDrag = false;
      document.removeEventListener('pointermove', dragPointerMove);
      document.removeEventListener('pointerup', dragPointerUp);
    }
  }


  async function initializePage() {
    try {
      const { matchId, streamUrl } = getUrlParams();
      streamPlayer.src = streamUrl;

      const [apiData] = await Promise.all([
        fetchAndCacheApiData(),
        loadDiscordWidget() 
      ]);

      const match = findMatchById(apiData, matchId);
      if (match) {
        updatePageInfo(match);
        updateMatchStatus(match);
        const channelData = match.channels.channel || match.channels || [];
        renderChannelList(channelData, streamUrl, matchId);
        setupFloatingPlayer();
      } else {
        displayError("Match Not Found", "The requested match could not be found in the schedule.");
      }
    } catch (error) {
      console.error("Page initialization failed:", error);
    }
  }

  if (closeAdBtn && stickyAd) {
    closeAdBtn.addEventListener("click", () => { 
      stickyAd.style.display = "none"; 
    });
  }

  initializePage();
});
