document.addEventListener("DOMContentLoaded", () => {
  // --- CONFIGURATION ---
  const API_URL = "https://topembed.pw/api.php?format=json";
  const DISCORD_SERVER_ID = "1422384816472457288";
  const CACHE_KEY = 'apiDataCache';
  const CACHE_DURATION_MINUTES = 5;

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
      if (now - timestamp < CACHE_DURATION_MINUTES * 60 * 1000) {
        return data;
      }
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

  /**
   * --- THIS IS THE MODIFIED FUNCTION ---
   * It now correctly finds the match using the new stable, Base64-encoded ID.
   */
  function findMatchById(apiData, matchId) {
    if (!apiData || !apiData.events) return null;
    
    for (const date in apiData.events) {
      const eventsForDay = Array.isArray(apiData.events[date]) ? apiData.events[date] : [apiData.events[date]];
      
      for (const event of eventsForDay) {
        if (event.sport && event.match && event.unix_timestamp) {
          const uniqueString = `${event.unix_timestamp}_${event.sport}_${event.match}`;
          // Must use the exact same encoding method as the previous pages
          const uniqueId = btoa(unescape(encodeURIComponent(uniqueString)));

          if (uniqueId === matchId) {
            return event; // Found the match
          }
        }
      }
    }
    return null; // Match not found
  }
  
  function updatePageInfo(match) {
    const title = `${match.match} - Live Stream`;
    pageTitle.textContent = title;
    matchTitleEl.textContent = match.match;
    matchTournamentEl.textContent = match.tournament;
    
    const startTime = new Date(parseInt(match.unix_timestamp, 10) * 1000);
    matchStartTimeEl.textContent = startTime.toLocaleString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        hour12: true
    });
  }

  function updateMatchStatus(match) {
    const now = Math.floor(Date.now() / 1000);
    const startTime = parseInt(match.unix_timestamp, 10);

    if (isNaN(startTime)) {
        console.error("Invalid start time for match:", match);
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

    // This handles both arrays of strings and arrays of objects from the API
    const channelUrls = channels.map(c => typeof c === 'object' ? c.channel : c).filter(Boolean);

    channelUrls.forEach((channelUrl, index) => {
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
    matchStatusBadge.textContent = "Error";
    matchStatusBadge.className = "status-badge finished";
    document.querySelector('.video-player-container').style.display = 'none';
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
      if (data.instant_invite) {
        document.getElementById("discord-join-button").href = data.instant_invite;
      }
      
      const membersListEl = document.getElementById("discord-members-list");
      membersListEl.innerHTML = '';
      if (data.members && data.members.length > 0) {
        data.members.slice(0, 5).forEach(member => {
          const li = document.createElement('li');
          li.innerHTML = `<div class="member-avatar"><img src="${member.avatar_url}" alt="${member.username}"><span class="online-indicator"></span></div><span class="member-name">${member.username}</span>`;
          membersListEl.appendChild(li);
        });
        if (data.instant_invite && data.members.length > 5) {
            const moreLi = document.createElement('li');
            moreLi.className = 'more-members-link';
            moreLi.innerHTML = `<p>and ${data.members.length - 5} more in our <a href="${data.instant_invite}" target="_blank" rel="noopener noreferrer nofollow">Discord!</a></p>`;
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
        // This makes the channel data more robust, handling different API response structures
        const channelData = match.channels.channel || match.channels || [];
        renderChannelList(channelData, streamUrl, matchId);
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
