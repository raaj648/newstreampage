document.addEventListener("DOMContentLoaded", () => {
  
  // ==================================================
  // 1. ADVANCED GEO-TARGETING & AFFILIATE LOGIC
  // ==================================================

  // PART A: Base Lists per Country
  const OFFERS_BY_COUNTRY = {
    "US": [
        "https://amzn.to/44dBQJe", 
        "https://amzn.to/44dBQJe", 
        "https://amzn.to/44dBQJe"
    ],
    "GB": [
        "https://amzn.to/44dBQJe", 
        "https://amzn.to/44dBQJe"
    ],
    "CA": [
        "https://amzn.to/44dBQJe"
    ],
    "BR": [
        "https://1wksrw.com/?open=register&p=h8zt"
    ],
    // Fallback for everyone else
    "Global": [
        "https://1wksrw.com/betting?open=register&p=xctu",
        "https://1wksrw.com/?open=register&p=h8zt"
    ]
  };

  // PART B: Cross-Border Rules
  const CROSS_BORDER_RULES = {
    "https://1wksrw.com/betting?open=register&p=xctu": ["BR", "RU", "IN"], // This link also works in Brazil, Russia, India 
    "https://1wksrw.com/?open=register&p=h8zt": ["BD", "PH", "AR"],  // This link also works in Bangladesh, Philipines, Argentina
    "https://record.betsson.com/_Ipto0Q-i5zR7HLc7-ZUbAGNd7ZgqdRLk/1/": ["AR", "BR", "CO", "GR"]
  };

  // --- NEW: HIGH TRAFFIC GEO-DETECTION (CLOUDFLARE METHOD) ---
  async function getHighTrafficCountry() {
    try {
        // Method 1: Cloudflare Trace (Unlimited, Fast, Free)
        // This works because Cloudflare exposes this text file on their edge nodes.
        const response = await fetch('https://www.cloudflare.com/cdn-cgi/trace');
        const text = await response.text();
        
        // Parse the text response which looks like "h=... ip=... loc=US ..."
        const data = text.trim().split('\n').reduce(function(obj, pair) {
            const parts = pair.split('=');
            obj[parts[0]] = parts[1];
            return obj;
        }, {});

        if (data.loc) {
            return data.loc.toUpperCase(); // Returns "US", "BD", "GB" etc.
        }
    } catch (e) {
        console.warn("Cloudflare trace failed, trying backup...");
    }

    // Method 2: Backup (GeoJS - lighter weight than ipapi)
    try {
        const res = await fetch('https://get.geojs.io/v1/ip/country.json');
        const data = await res.json();
        if(data.country) return data.country.toUpperCase();
    } catch (e) {
        console.error("All Geo methods failed.");
    }

    return "Global";
  }

  async function getSmartAffiliateLink() {
    // 1. Detect Country using High-Traffic Method
    let userCountry = await getHighTrafficCountry();
    
    // console.log("Detected Country:", userCountry); // Un-comment to test

    // 2. Build the Pool of Available Links
    let linkPool = [];

    // A. Add Local Offers
    if (OFFERS_BY_COUNTRY[userCountry]) {
        linkPool = linkPool.concat(OFFERS_BY_COUNTRY[userCountry]);
    }

    // B. Check Cross-Border Rules
    for (const [linkUrl, allowedCountries] of Object.entries(CROSS_BORDER_RULES)) {
        if (allowedCountries.includes(userCountry)) {
            linkPool.push(linkUrl);
        }
    }

    // C. Fallback to Global
    if (linkPool.length === 0) {
        linkPool = OFFERS_BY_COUNTRY["Global"];
    }

    // 3. Select Random Link
    const randomIndex = Math.floor(Math.random() * linkPool.length);
    return linkPool[randomIndex];
  }

  async function updateAdLinks() {
    const finalLink = await getSmartAffiliateLink();
    window.currentAffiliateLink = finalLink; // Store for In-Feed Ad

    // Update all dynamic elements
    const adElements = document.querySelectorAll('.dynamic-affiliate-link');
    adElements.forEach(el => {
        el.href = finalLink;
    });
  }

  // Initialize Ads immediately
  updateAdLinks();
  initOverlayAd();


  // ==================================================
  // 2. EXISTING CORE FUNCTIONALITY (PRESERVED)
  // ==================================================

  const API_URL = "https://topembed.pw/api.php?format=json";
  const DISCORD_SERVER_ID = "1422384816472457288";
  const CACHE_KEY = 'apiDataCache';
  const CACHE_DURATION_MINUTES = 5;

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
        stickyAd = document.getElementById("sticky-footer-ad"),
        closeDesktopAdBtn = document.getElementById("close-desktop-ad"),
        desktopStickyAd = document.getElementById("desktop-sticky-ad");

  let countdownInterval;

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

  async function fetchAndCacheApiData() {
    const cachedData = sessionStorage.getItem(CACHE_KEY);
    const now = new Date().getTime();
    if (cachedData) {
      const { timestamp, data } = JSON.parse(cachedData);
      if (now - timestamp < CACHE_DURATION_MINUTES * 60 * 1000) return data;
    }
    try {
      const response = await fetch(API_URL);
      if (!response.ok) throw new Error(`API request failed`);
      const data = await response.json();
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, data: data }));
      return data;
    } catch (error) {
      displayError("API Error", "Could not fetch match data.");
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
    } catch (e) { return `Channel ${index + 1}`; }
  }
  
  // Create the Native In-Feed Ad
  function createInFeedAd() {
    const adDiv = document.createElement('div');
    adDiv.className = 'stream-infeed-ad';
    adDiv.innerHTML = `
        <a href="${window.currentAffiliateLink || '#'}" target="_blank" class="infeed-content dynamic-affiliate-link">
            <div class="infeed-left">
                <span class="rec-tag"><i class="fa-solid fa-star"></i> REC</span>
                <span style="font-weight:bold;">High Speed Server</span>
            </div>
            <div class="infeed-btn">Watch <i class="fa-solid fa-play"></i></div>
        </a>
    `;
    return adDiv;
  }

  function renderChannelList(channels, currentStreamUrl, matchId) {
    streamLinksGrid.innerHTML = "";
    
    // Inject Ad First
    streamLinksGrid.appendChild(createInFeedAd());

    if (!channels || channels.length === 0) {
      // Only show ad if no channels
      return;
    }

    const channelUrls = channels.map(c => typeof c === 'object' ? c.channel : c).filter(Boolean);

    channelUrls.forEach((channelUrl, index) => {

    const channelName = getChannelName(channelUrl, index);
    const link = document.createElement("a");
    link.className = "stream-link-btn";
    link.href = "#";

    // Set button text
    let buttonText = (channelUrl === currentStreamUrl) ? "Running" : "Watch";

    // Initial running state
    if (channelUrl === currentStreamUrl) {
        link.classList.add("running");
    }

    link.addEventListener("click", (e) => {
        e.preventDefault();

        document.querySelectorAll(".stream-link-btn").forEach(btn => {
            btn.classList.remove("running");
            btn.classList.remove("switching");
        });

        link.classList.add("switching");

        streamPlayer.src = channelUrl;

        streamPlayer.onload = () => {
            link.classList.remove("switching");
            link.classList.add("running");
        };
    });

    link.innerHTML = `
        <div class="stream-link-content">
          <span class="stream-info">${channelName}</span>
          <span class="watch-now-btn">${buttonText}</span>
        </div>
    `;

    streamLinksGrid.appendChild(link);
});


  function displayError(title, message) {
    matchTitleEl.textContent = title;
    matchTournamentEl.textContent = message;
    matchStatusBadge.textContent = "Error";
    matchStatusBadge.className = "status-badge finished";
    playerContainer.style.display = 'none';
    countdownContainer.style.display = 'none';
    streamLinksGrid.innerHTML = `<p style="text-align: center;">${message}</p>`;
  }

  async function loadDiscordWidget() {
    if (!DISCORD_SERVER_ID) return;
    try {
      const response = await fetch(`https://discord.com/api/guilds/${DISCORD_SERVER_ID}/widget.json`);
      if (!response.ok) throw new Error('Failed');
      const data = await response.json();
      document.getElementById("discord-online-count").textContent = data.presence_count || '0';
      if (data.instant_invite) document.getElementById("discord-join-button").href = data.instant_invite;
      
      const membersListEl = document.getElementById("discord-members-list");
      membersListEl.innerHTML = '';
      if (data.members && data.members.length > 0) {
        data.members.slice(0, 5).forEach(member => {
          const li = document.createElement('li');
          li.innerHTML = `
            <div class="member-wrapper">
                <img class="member-avatar" src="${member.avatar_url}" alt="${member.username}">
                <span class="member-status"></span>
            </div>
            <span class="member-name">${member.username}</span>
          `;
          membersListEl.appendChild(li);
        });
      }
    } catch (error) { console.log("Discord Error"); }
  }

  function initOverlayAd() {
      const overlay = document.getElementById('video-overlay-ad');
      if(overlay) {
          overlay.addEventListener('click', () => {
              window.open(window.currentAffiliateLink || '#', '_blank');
              overlay.style.opacity = '0';
              setTimeout(() => { overlay.style.display = 'none'; }, 300);
          });
      }
  }

  function setupAdEventListeners() {
    if (closeAdBtn && stickyAd) {
      closeAdBtn.addEventListener("click", () => { stickyAd.style.display = "none"; });
    }
    if (closeDesktopAdBtn && desktopStickyAd) {
      closeDesktopAdBtn.addEventListener("click", () => { desktopStickyAd.style.display = "none"; });
    }
  }

  async function initializePage() {
    try {
      setupAdEventListeners();
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
        const channelData = match.channels?.channel || match.channels || [];

        renderChannelList(channelData, streamUrl, matchId);
      } else {
        displayError("Match Not Found", "The requested match could not be found.");
      }
    } catch (error) {
      console.error("Init failed:", error);
    }
  }

  initializePage();
});





