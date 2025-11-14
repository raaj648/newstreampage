document.addEventListener("DOMContentLoaded", () => {
  // --- CONFIGURATION ---
  const API_URL = "https://topembed.pw/api.php?format=json";
  const DISCORD_SERVER_ID = "1422384816472457288"; 

  // --- PAGE ELEMENTS ---
  const pageTitle = document.querySelector("title"),
        streamPlayer = document.getElementById("stream-player"),
        matchTitleEl = document.getElementById("match-title"),
        matchTournamentEl = document.getElementById("match-tournament"),
        matchStatusBadge = document.getElementById("match-status-badge"),
        countdownContainer = document.getElementById("countdown-container"),
        matchStartTimeEl = document.getElementById("match-start-time"),
        streamLinksGrid = document.getElementById("stream-links-grid"),
        closeAdBtn = document.getElementById("close-ad"),
        stickyAd = document.getElementById("sticky-footer-ad");

  let countdownInterval;

  // --- CORE FUNCTIONS ---
  function getUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const matchId = params.get('id');
    const streamUrl = params.get('stream');
    if (!matchId || !streamUrl) {
      displayError("Invalid URL", "Match ID or Stream URL is missing.");
      throw new Error("Invalid URL parameters.");
    }
    return { matchId, streamUrl };
  }

  async function fetchApiData() {
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error("API request failed");
      return await response.json();
    } catch (error) {
      displayError("API Error", "Could not fetch data from the server.");
      throw error;
    }
  }

  function findMatchById(apiData, matchId) {
    for (const date in apiData.events) {
      for (const [index, event] of apiData.events[date].entries()) {
        const constructedId = `${event.unix_timestamp}_${index}`;
        if (constructedId === matchId) return event;
      }
    }
    return null;
  }
  
  function updatePageInfo(match) {
    const title = `${match.match} - Live Stream`;
    pageTitle.textContent = title;
    matchTitleEl.textContent = match.match;
    matchTournamentEl.textContent = match.tournament;
    const startTime = new Date(match.unix_timestamp * 1000);
    // Corrected to explicitly use 12-hour format
    matchStartTimeEl.textContent = startTime.toLocaleString('en-US', { dateStyle: 'medium', hour: 'numeric', minute: 'numeric', hour12: true });
  }

  function updateMatchStatus(match) {
    const now = Math.floor(Date.now() / 1000);
    const startTime = match.unix_timestamp;
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
    countdownInterval = setInterval(() => {
      const now = Math.floor(Date.now() / 1000);
      const diff = targetTimestamp - now;
      if (diff <= 0) {
        clearInterval(countdownInterval);
        location.reload();
        return;
      }
      const d=Math.floor(diff/(3600*24)),h=Math.floor(diff%(3600*24)/3600),m=Math.floor(diff%3600/60),s=Math.floor(diff%60);
      ["days", "hours", "minutes", "seconds"].forEach(id => document.getElementById(id).textContent = eval(id.charAt(0)).toString().padStart(2, '0'));
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
  
  /**
   * REVISED function to render futuristic channel links.
   */
  function renderChannelList(channels, currentStreamUrl, matchId) {
    streamLinksGrid.innerHTML = ""; // Clear placeholders
    if (!channels || channels.length === 0) {
      streamLinksGrid.innerHTML = "<p>No other channels available for this match.</p>";
      return;
    }
    channels.forEach((channelObj, index) => {
      const channelUrl = typeof channelObj === 'object' ? channelObj.channel : channelObj;
      if (!channelUrl) return;

      const channelName = getChannelName(channelUrl, index);
      const link = document.createElement("a");
      link.className = "stream-link";
      link.href = `?id=${matchId}&stream=${encodeURIComponent(channelUrl)}`;

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
        </div>`;
      streamLinksGrid.appendChild(link);
    });
  }

  function displayError(title, message) {
    matchTitleEl.textContent = title;
    matchTournamentEl.textContent = message;
    document.querySelector('.stream-main-content').innerHTML = `<h1 style="text-align:center;">${title}</h1><p style="text-align: center;">${message}</p>`;
  }

  /**
   * RESTORED Discord widget logic.
   */
  async function loadDiscordWidget() {
    if (!DISCORD_SERVER_ID) return;
    const apiUrl = `https://discord.com/api/guilds/${DISCORD_SERVER_ID}/widget.json`;
    const onlineCountEl = document.getElementById("discord-online-count");
    const membersListEl = document.getElementById("discord-members-list");
    const joinButton = document.getElementById("discord-join-button");

    try {
      const response = await fetch(apiUrl);
      if (!response.ok) throw new Error('Failed to fetch Discord data');
      const data = await response.json();

      if (onlineCountEl) onlineCountEl.textContent = data.presence_count || '0';
      if (joinButton && data.instant_invite) joinButton.href = data.instant_invite;
      
      if (membersListEl) {
        membersListEl.innerHTML = ''; 
        const fragment = document.createDocumentFragment();
        if (data.members && data.members.length > 0) {
          data.members.slice(0, 5).forEach(member => {
            const li = document.createElement('li');
            li.innerHTML = `<div class="member-avatar"><img src="${member.avatar_url}" alt="${member.username}"><span class="online-indicator"></span></div><span class="member-name">${member.username}</span>`;
            fragment.appendChild(li);
          });
        }
        
        if (data.instant_invite) {
            const moreLi = document.createElement('li');
            moreLi.className = 'more-members-link';
            moreLi.innerHTML = `<p>and more in our <a href="${data.instant_invite}" target="_blank" rel="noopener noreferrer nofollow">Discord!</a></p>`;
            fragment.appendChild(moreLi);
        }
        
        membersListEl.appendChild(fragment);
      }
    } catch (error) {
      console.error("Error loading Discord widget:", error);
      const widgetContainer = document.getElementById("discord-widget-container");
      if (widgetContainer) widgetContainer.innerHTML = '<p>Could not load Discord widget.</p>';
    }
  }

  // --- INITIALIZATION ---
  async function initializePage() {
    try {
      const { matchId, streamUrl } = getUrlParams();
      streamPlayer.src = streamUrl;
      const apiData = await fetchApiData();
      const match = findMatchById(apiData, matchId);
      if (match) {
        updatePageInfo(match);
        updateMatchStatus(match);
        renderChannelList((match.channels || []), streamUrl, matchId);
      } else {
        displayError("Match Not Found", "The requested match could not be found.");
      }
      loadDiscordWidget();
    } catch (error) {
      console.error("Page initialization failed:", error);
    }
  }

  if (closeAdBtn && stickyAd) {
    closeAdBtn.addEventListener("click", () => { stickyAd.style.display = "none"; });
  }

  initializePage();
});