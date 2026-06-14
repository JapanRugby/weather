(() => {
  "use strict";

  const CONFIG = {
    defaultLocation: {
      id: 1856717,
      name: "Miyazaki",
      nameJa: "宮崎市",
      admin1: "Miyazaki",
      country: "Japan",
      countryCode: "JP",
      latitude: 31.9077,
      longitude: 131.4202,
      timezone: "Asia/Tokyo"
    },
    refreshMinutes: 15,
    forecastStartHour: 6,
    forecastEndHour: 20,
    geocodingEndpoint: "https://geocoding-api.open-meteo.com/v1/search",
    reverseGeocodingEndpoint: "https://geocoding-api.open-meteo.com/v1/get",
    poiSearchEndpoint: "https://nominatim.openstreetmap.org/search",
    poiSearchEnabled: true,
    poiCacheHours: 168,
    poiMinimumIntervalMs: 1100,
    forecastEndpoint: "https://api.open-meteo.com/v1/forecast"
  };

  const WEATHER_CODES = {
    0: { en: "Clear Sky", ja: "快晴", icon: "☀️" },
    1: { en: "Mainly Clear", ja: "晴れ", icon: "🌤️" },
    2: { en: "Partly Cloudy", ja: "晴れ時々曇り", icon: "⛅" },
    3: { en: "Overcast", ja: "曇り", icon: "☁️" },
    45: { en: "Fog", ja: "霧", icon: "🌫️" },
    48: { en: "Rime Fog", ja: "着氷性の霧", icon: "🌫️" },
    51: { en: "Light Drizzle", ja: "弱い霧雨", icon: "🌦️" },
    53: { en: "Drizzle", ja: "霧雨", icon: "🌦️" },
    55: { en: "Heavy Drizzle", ja: "強い霧雨", icon: "🌧️" },
    56: { en: "Freezing Drizzle", ja: "弱い着氷性霧雨", icon: "🌧️" },
    57: { en: "Heavy Freezing Drizzle", ja: "強い着氷性霧雨", icon: "🌧️" },
    61: { en: "Light Rain", ja: "弱い雨", icon: "🌦️" },
    63: { en: "Rain", ja: "雨", icon: "🌧️" },
    65: { en: "Heavy Rain", ja: "強い雨", icon: "🌧️" },
    66: { en: "Freezing Rain", ja: "弱い着氷性の雨", icon: "🌧️" },
    67: { en: "Heavy Freezing Rain", ja: "強い着氷性の雨", icon: "🌧️" },
    71: { en: "Light Snow", ja: "弱い雪", icon: "🌨️" },
    73: { en: "Snow", ja: "雪", icon: "🌨️" },
    75: { en: "Heavy Snow", ja: "強い雪", icon: "❄️" },
    77: { en: "Snow Grains", ja: "霧雪", icon: "🌨️" },
    80: { en: "Light Showers", ja: "弱いにわか雨", icon: "🌦️" },
    81: { en: "Showers", ja: "にわか雨", icon: "🌧️" },
    82: { en: "Heavy Showers", ja: "激しいにわか雨", icon: "⛈️" },
    85: { en: "Light Snow Showers", ja: "弱いにわか雪", icon: "🌨️" },
    86: { en: "Heavy Snow Showers", ja: "強いにわか雪", icon: "❄️" },
    95: { en: "Thunderstorm", ja: "雷雨", icon: "⛈️" },
    96: { en: "Thunderstorm with Hail", ja: "ひょうを伴う雷雨", icon: "⛈️" },
    99: { en: "Severe Hailstorm", ja: "激しいひょう雷雨", icon: "⛈️" }
  };

  const WIND_DIRECTIONS = [
    ["N", "北"], ["NNE", "北北東"], ["NE", "北東"], ["ENE", "東北東"],
    ["E", "東"], ["ESE", "東南東"], ["SE", "南東"], ["SSE", "南南東"],
    ["S", "南"], ["SSW", "南南西"], ["SW", "南西"], ["WSW", "西南西"],
    ["W", "西"], ["WNW", "西北西"], ["NW", "北西"], ["NNW", "北北西"]
  ];

  const state = {
    location: readLocationFromUrl() || readJson("weather.selectedLocation") || CONFIG.defaultLocation,
    mode: new URLSearchParams(location.search).get("mode") || readJson("weather.mode") || "auto",
    forecast: null,
    isSearching: false,
    searchTimer: null,
    searchSequence: 0,
    lastPoiRequestAt: 0
  };

  const el = {};
  const byId = id => document.getElementById(id);

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    [
      "location-search", "search-results", "search-button", "current-location-button", "refresh-button",
      "favorite-button", "share-button", "print-button", "saved-locations", "saved-locations-wrap",
      "status-message", "weather-report", "loading-overlay", "location-en", "location-ja", "target-date",
      "update-label", "overall-icon", "overall-en", "overall-ja", "temperature-range", "peak-wind",
      "peak-wind-direction", "precipitation-max", "temperature-chart", "wind-chart", "hourly-grid",
      "timezone-label", "issued-at", "generated-at", "source-label"
    ].forEach(id => { el[id] = byId(id); });

    bindEvents();
    updateModeButtons();
    renderFavorites();
    el["location-search"].value = displayLocationName(state.location);
    loadForecast({ announce: false });

    setInterval(() => loadForecast({ announce: false, silent: true }), CONFIG.refreshMinutes * 60 * 1000);
  }

  function bindEvents() {
    el["search-button"].addEventListener("click", () => {
      clearTimeout(state.searchTimer);
      searchLocations(el["location-search"].value, { includePlaces: true });
    });
    el["location-search"].addEventListener("input", event => {
      clearTimeout(state.searchTimer);
      const query = event.target.value.trim();
      if (query.length < 2) return hideSearchResults();
      state.searchTimer = setTimeout(() => searchLocations(query, { includePlaces: false, silent: true }), 350);
    });
    el["location-search"].addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        clearTimeout(state.searchTimer);
        searchLocations(event.currentTarget.value, { includePlaces: true });
      }
      if (event.key === "Escape") hideSearchResults();
    });
    document.addEventListener("click", event => {
      if (!event.target.closest(".search-box-wrap") && !event.target.closest("#search-button")) hideSearchResults();
    });

    document.querySelectorAll(".mode-button").forEach(button => {
      button.addEventListener("click", () => {
        state.mode = button.dataset.mode;
        localStorage.setItem("weather.mode", JSON.stringify(state.mode));
        updateModeButtons();
        updateUrl();
        loadForecast({ announce: true });
      });
    });

    el["refresh-button"].addEventListener("click", () => loadForecast({ announce: true }));
    el["current-location-button"].addEventListener("click", useCurrentLocation);
    el["favorite-button"].addEventListener("click", toggleFavorite);
    el["share-button"].addEventListener("click", shareCurrentUrl);
    el["print-button"].addEventListener("click", () => {
      if (!state.forecast) return setStatus("予報の取得後にPDF保存できます。", "error");
      window.print();
    });
  }

  async function searchLocations(query, { includePlaces = false, silent = false } = {}) {
    const cleaned = query.trim();
    if (cleaned.length < 2) {
      setStatus("地域名・施設名を2文字以上入力してください。", "error");
      return;
    }
    if (state.isSearching && includePlaces) return;
    const requestId = ++state.searchSequence;
    if (includePlaces) state.isSearching = true;
    if (!silent) setStatus(includePlaces ? "Searching locations and venues / 地域・施設を検索中…" : "Searching locations / 地域を検索中…");
    try {
      const cityPromise = searchOpenMeteoLocations(cleaned).catch(error => {
        if (!includePlaces) throw error;
        console.warn("Location search unavailable", error);
        return [];
      });
      const placePromise = includePlaces && CONFIG.poiSearchEnabled
        ? searchOpenStreetMapPlaces(cleaned).catch(error => {
            console.warn("Place search unavailable", error);
            return [];
          })
        : Promise.resolve([]);
      const [cities, places] = await Promise.all([cityPromise, placePromise]);
      if (requestId !== state.searchSequence) return;
      const combined = dedupeAndRankSearchResults([...places, ...cities], cleaned);
      renderSearchResults(combined);
      if (!silent || includePlaces) {
        const message = combined.length
          ? `${combined.length}件の候補を表示しています。${includePlaces ? " スタジアム・競技場などの施設候補を含みます。" : ""}`
          : "該当する地域・施設が見つかりませんでした。";
        setStatus(message, combined.length ? "" : "error");
      }
    } catch (error) {
      console.error(error);
      if (requestId !== state.searchSequence) return;
      if (!silent || includePlaces) setStatus("検索に失敗しました。通信状態を確認してください。", "error");
      hideSearchResults();
    } finally {
      if (includePlaces) state.isSearching = false;
    }
  }

  async function searchOpenMeteoLocations(cleaned) {
    const makeUrl = language => {
      const params = new URLSearchParams({ name: cleaned, count: "8", language, format: "json" });
      return `${CONFIG.geocodingEndpoint}?${params}`;
    };
    const [jaResponse, enResponse] = await Promise.all([
      fetch(makeUrl("ja")),
      fetch(makeUrl("en"))
    ]);
    if (!jaResponse.ok || !enResponse.ok) throw new Error(`Geocoding API ${jaResponse.status}/${enResponse.status}`);
    const [jaData, enData] = await Promise.all([jaResponse.json(), enResponse.json()]);
    const englishById = new Map((enData.results || []).map(item => [item.id, item]));
    return (jaData.results || []).map(item => ({
      ...item,
      nameJa: item.name,
      nameEn: englishById.get(item.id)?.name || item.name,
      admin1En: englishById.get(item.id)?.admin1 || item.admin1,
      countryEn: englishById.get(item.id)?.country || item.country,
      provider: "Open-Meteo",
      resultKind: "location",
      resultKindEn: "City / Area",
      resultKindJa: "地域"
    }));
  }

  async function searchOpenStreetMapPlaces(cleaned) {
    const cacheKey = `weather.poiSearch.${cleaned.toLocaleLowerCase()}`;
    const cached = readJson(cacheKey);
    const cacheMaxAge = CONFIG.poiCacheHours * 60 * 60 * 1000;
    if (cached?.savedAt && Date.now() - cached.savedAt < cacheMaxAge && Array.isArray(cached.results)) return cached.results;

    const waitMs = Math.max(0, CONFIG.poiMinimumIntervalMs - (Date.now() - state.lastPoiRequestAt));
    if (waitMs) await delay(waitMs);
    state.lastPoiRequestAt = Date.now();

    const params = new URLSearchParams({
      q: cleaned,
      format: "jsonv2",
      addressdetails: "1",
      namedetails: "1",
      limit: "10",
      dedupe: "1",
      "accept-language": "ja,en"
    });
    const response = await fetch(`${CONFIG.poiSearchEndpoint}?${params}`, {
      headers: { "Accept": "application/json" }
    });
    if (!response.ok) throw new Error(`Nominatim ${response.status}`);
    const data = await response.json();
    const results = data.map(normalizeOsmSearchResult).filter(Boolean);
    localStorage.setItem(cacheKey, JSON.stringify({ savedAt: Date.now(), results }));
    return results;
  }

  function normalizeOsmSearchResult(item) {
    const latitude = Number(item.lat);
    const longitude = Number(item.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    const names = item.namedetails || {};
    const address = item.address || {};
    const nameJa = names["name:ja"] || names.name || item.name || firstDisplayNamePart(item.display_name);
    const nameEn = names["name:en"] || names["official_name:en"] || names.name || item.name || nameJa;
    const cityJa = address.city || address.town || address.village || address.municipality || address.county || "";
    const stateJa = address.state || address.province || address.region || "";
    const countryJa = address.country || "";
    const placeType = classifyOsmPlace(item);
    return {
      id: `osm-${item.osm_type || "place"}-${item.osm_id || item.place_id}`,
      name: nameEn,
      nameEn,
      nameJa,
      admin1: [cityJa, stateJa].filter((value, index, array) => value && array.indexOf(value) === index).join(" · "),
      admin1En: [cityJa, stateJa].filter((value, index, array) => value && array.indexOf(value) === index).join(" · "),
      country: countryJa,
      countryEn: countryJa,
      country_code: String(address.country_code || "").toUpperCase(),
      latitude,
      longitude,
      timezone: "auto",
      provider: "OpenStreetMap",
      resultKind: "poi",
      resultKindEn: placeType.en,
      resultKindJa: placeType.ja,
      osmCategory: item.category || item.class || "",
      osmType: item.type || "",
      importance: Number(item.importance || 0)
    };
  }

  function classifyOsmPlace(item) {
    const haystack = `${item.category || ""} ${item.class || ""} ${item.type || ""} ${item.display_name || ""}`.toLowerCase();
    if (/stadium|競技場|スタジアム/.test(haystack)) return { en: "Stadium", ja: "スタジアム" };
    if (/arena|アリーナ/.test(haystack)) return { en: "Arena", ja: "アリーナ" };
    if (/sports_centre|sports center|sport centre|球場|運動場|体育館/.test(haystack)) return { en: "Sports Venue", ja: "スポーツ施設" };
    if (/airport|aerodrome|空港/.test(haystack)) return { en: "Airport", ja: "空港" };
    if (/station|駅/.test(haystack)) return { en: "Station", ja: "駅" };
    if (/park|公園/.test(haystack)) return { en: "Place", ja: "施設・地点" };
    return { en: "Place / Venue", ja: "施設・地点" };
  }

  function dedupeAndRankSearchResults(results, query) {
    const normalizedQuery = query.toLocaleLowerCase();
    const unique = new Map();
    results.forEach(item => {
      const key = `${Number(item.latitude).toFixed(4)},${Number(item.longitude).toFixed(4)}`;
      const existing = unique.get(key);
      if (!existing || searchResultScore(item, normalizedQuery) > searchResultScore(existing, normalizedQuery)) unique.set(key, item);
    });
    return [...unique.values()]
      .sort((a, b) => searchResultScore(b, normalizedQuery) - searchResultScore(a, normalizedQuery))
      .slice(0, 14);
  }

  function searchResultScore(item, query) {
    const names = [item.nameJa, item.nameEn, item.name].filter(Boolean).map(value => String(value).toLocaleLowerCase());
    let score = Number(item.importance || 0);
    if (names.some(name => name === query)) score += 10;
    else if (names.some(name => name.startsWith(query))) score += 6;
    else if (names.some(name => name.includes(query))) score += 3;
    if (item.resultKind === "poi") score += 1.5;
    if (/stadium|arena|sports|スタジアム|競技場|球場|アリーナ/.test(`${item.resultKindEn || ""} ${item.resultKindJa || ""}`.toLowerCase())) score += 2;
    return score;
  }

  function renderSearchResults(results) {
    el["search-results"].innerHTML = "";
    if (!results.length) return hideSearchResults();
    results.forEach(result => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "search-result";
      button.setAttribute("role", "option");
      const adminJa = [result.admin1, result.country].filter(Boolean).join(" · ");
      const adminEn = [result.admin1En, result.countryEn].filter(Boolean).join(" · ");
      const title = result.nameEn && result.nameEn !== result.nameJa
        ? `${result.nameEn} / ${result.nameJa}`
        : result.nameJa || result.name;
      const subtitle = adminEn && adminEn !== adminJa ? `${adminEn} / ${adminJa}` : (adminJa || adminEn || "—");
      const kind = [result.resultKindEn, result.resultKindJa].filter(Boolean).join(" / ") || "Location / 地域";
      const badgeClass = result.resultKind === "poi" ? "poi" : "";
      const source = result.provider || "Open-Meteo";
      button.innerHTML = `<div><strong>${escapeHtml(title)}</strong><span>${escapeHtml(subtitle)}</span><div class="search-result-meta"><em class="search-result-badge ${badgeClass}">${escapeHtml(kind)}</em><span class="search-result-source">${escapeHtml(source)}</span></div></div><small>${result.latitude.toFixed(2)}, ${result.longitude.toFixed(2)}</small>`;
      button.addEventListener("click", () => selectLocation(normalizeLocation(result)));
      el["search-results"].appendChild(button);
    });
    el["search-results"].hidden = false;
    el["location-search"].setAttribute("aria-expanded", "true");
  }

  function hideSearchResults() {
    el["search-results"].hidden = true;
    el["location-search"].setAttribute("aria-expanded", "false");
  }

  function selectLocation(locationData) {
    state.location = locationData;
    localStorage.setItem("weather.selectedLocation", JSON.stringify(state.location));
    el["location-search"].value = displayLocationName(state.location);
    hideSearchResults();
    updateUrl();
    renderFavorites();
    loadForecast({ announce: true });
  }

  async function useCurrentLocation() {
    if (!navigator.geolocation) return setStatus("このブラウザは現在地取得に対応していません。", "error");
    setStatus("Getting current location / 現在地を取得中…");
    navigator.geolocation.getCurrentPosition(async position => {
      const { latitude, longitude } = position.coords;
      try {
        const result = await reverseLookup(latitude, longitude);
        selectLocation(result || {
          id: `geo-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
          name: "Current Location",
          nameJa: "現在地",
          latitude,
          longitude,
          timezone: "auto",
          country: ""
        });
      } catch (error) {
        console.error(error);
        selectLocation({
          id: `geo-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
          name: "Current Location",
          nameJa: "現在地",
          latitude,
          longitude,
          timezone: "auto",
          country: ""
        });
      }
    }, error => {
      console.error(error);
      setStatus("現在地を取得できませんでした。ブラウザの位置情報許可を確認してください。", "error");
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  }

  async function reverseLookup(latitude, longitude) {
    // Open-Meteo's public geocoding endpoint is primarily name-search based.
    // For privacy and portability, current-location mode can work without a reverse lookup.
    return {
      id: `geo-${latitude.toFixed(4)}-${longitude.toFixed(4)}`,
      name: "Current Location",
      nameJa: "現在地",
      latitude,
      longitude,
      timezone: "auto",
      country: ""
    };
  }

  async function loadForecast({ announce = false, silent = false } = {}) {
    setLoading(true);
    if (!silent) setStatus("Loading forecast / 最新予報を取得中…");
    try {
      const params = new URLSearchParams({
        latitude: String(state.location.latitude),
        longitude: String(state.location.longitude),
        hourly: "temperature_2m,weather_code,precipitation_probability,wind_speed_10m,wind_direction_10m",
        timezone: state.location.timezone && state.location.timezone !== "auto" ? state.location.timezone : "auto",
        wind_speed_unit: "ms",
        temperature_unit: "celsius",
        precipitation_unit: "mm",
        forecast_days: "3"
      });
      const response = await fetch(`${CONFIG.forecastEndpoint}?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`Forecast API ${response.status}`);
      const data = await response.json();
      const targetDate = resolveTargetDate(data.timezone, state.mode);
      const normalized = normalizeForecast(data, targetDate);
      if (normalized.hours.length !== 15) throw new Error("Expected 15 hourly values");
      state.forecast = normalized;
      renderForecast(normalized);
      setStatus(announce ? "Forecast updated / 予報を更新しました。" : "", announce ? "success" : "");
      document.dispatchEvent(new CustomEvent("weather:ready", { detail: normalized }));
    } catch (error) {
      console.error(error);
      setStatus("予報の取得に失敗しました。時間をおいて再度お試しください。", "error");
      el["weather-report"].dataset.ready = "false";
      el["weather-report"].setAttribute("aria-busy", "false");
    } finally {
      setLoading(false);
    }
  }

  function resolveTargetDate(timezone, mode) {
    const nowParts = partsInTimezone(new Date(), timezone);
    let addDays = 0;
    if (mode === "tomorrow") addDays = 1;
    if (mode === "auto" && nowParts.hour >= 18) addDays = 1;
    return addDaysToDateString(`${nowParts.year}-${pad(nowParts.month)}-${pad(nowParts.day)}`, addDays);
  }

  function normalizeForecast(data, targetDate) {
    const hours = [];
    const hourly = data.hourly;
    hourly.time.forEach((timestamp, index) => {
      const [datePart, timePart] = timestamp.split("T");
      const hour = Number(timePart.slice(0, 2));
      if (datePart === targetDate && hour >= CONFIG.forecastStartHour && hour <= CONFIG.forecastEndHour) {
        const code = hourly.weather_code[index];
        hours.push({
          timestamp,
          time: `${pad(hour)}:00`,
          temperature: Number(hourly.temperature_2m[index]),
          code,
          weather: WEATHER_CODES[code] || { en: "Unknown", ja: "不明", icon: "❔" },
          precipitationProbability: Number(hourly.precipitation_probability[index] ?? 0),
          windSpeed: Number(hourly.wind_speed_10m[index] ?? 0),
          windDirection: Number(hourly.wind_direction_10m[index] ?? 0)
        });
      }
    });

    const generated = new Date();
    return {
      location: state.location,
      targetDate,
      timezone: data.timezone,
      timezoneAbbreviation: data.timezone_abbreviation,
      utcOffsetSeconds: data.utc_offset_seconds,
      generated,
      issued: generated,
      hours
    };
  }

  function renderForecast(forecast) {
    const { hours, location: selected, targetDate, timezone } = forecast;
    const temperatures = hours.map(hour => hour.temperature);
    const winds = hours.map(hour => hour.windSpeed);
    const precip = hours.map(hour => hour.precipitationProbability);
    const maxWind = Math.max(...winds);
    const maxWindIndex = winds.indexOf(maxWind);
    const overall = dominantWeather(hours);

    el["location-en"].textContent = selected.name || selected.nameJa || "Selected Location";
    el["location-ja"].textContent = selected.nameJa || selected.name || "選択地域";
    el["source-label"].textContent = selected.provider === "OpenStreetMap"
      ? "Open-Meteo Weather API · Location © OpenStreetMap contributors"
      : "Open-Meteo Weather API";
    el["target-date"].textContent = formatDateBilingual(targetDate, timezone);
    el["update-label"].textContent = state.mode === "auto" ? "Auto Update / 自動更新" : state.mode === "today" ? "Today / 今日" : "Tomorrow / 明日";
    el["overall-icon"].textContent = overall.icon;
    el["overall-en"].textContent = overall.en;
    el["overall-ja"].textContent = overall.ja;
    el["temperature-range"].textContent = `${Math.min(...temperatures).toFixed(1)}–${Math.max(...temperatures).toFixed(1)}°C`;
    el["peak-wind"].textContent = `${maxWind.toFixed(1)} m/s at ${hours[maxWindIndex].time}`;
    const peakDirection = directionLabel(hours[maxWindIndex].windDirection);
    el["peak-wind-direction"].textContent = `${peakDirection.en} / ${peakDirection.ja}`;
    el["precipitation-max"].textContent = `Max ${Math.max(...precip).toFixed(0)}%`;
    el["timezone-label"].textContent = timezone;
    el["issued-at"].textContent = formatDateTime(forecast.issued, timezone);
    el["generated-at"].textContent = formatDateTime(forecast.generated, timezone);

    renderLineChart(el["temperature-chart"], hours.map(h => h.time), temperatures, {
      stroke: "#f39a5c", fill: "rgba(243,154,92,.12)", decimals: 1, unit: "°"
    });
    renderLineChart(el["wind-chart"], hours.map(h => h.time), winds, {
      stroke: "#36b5d5", fill: "rgba(54,181,213,.12)", decimals: 1, unit: ""
    });
    renderHourlyCards(hours);
    updateUrl();
    el["weather-report"].dataset.ready = "true";
    el["weather-report"].setAttribute("aria-busy", "false");
    updateFavoriteButton();
  }

  function dominantWeather(hours) {
    const counts = new Map();
    hours.forEach(hour => counts.set(hour.code, (counts.get(hour.code) || 0) + 1));
    const [code] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] || [3];
    return WEATHER_CODES[code] || WEATHER_CODES[3];
  }

  function renderHourlyCards(hours) {
    el["hourly-grid"].innerHTML = "";
    hours.forEach(hour => {
      const direction = directionLabel(hour.windDirection);
      const card = document.createElement("article");
      card.className = "hour-card";
      card.innerHTML = `
        <div class="hour-card-top">
          <span class="hour-time">${hour.time}</span>
          <span class="hour-icon" aria-label="${escapeHtml(hour.weather.en)}">${hour.weather.icon}</span>
        </div>
        <div class="hour-weather">${escapeHtml(hour.weather.en)} / ${escapeHtml(hour.weather.ja)}</div>
        <div class="hour-temperature">${hour.temperature.toFixed(1)}°C</div>
        <div class="hour-details">
          <div>Rain / 降水&nbsp; <strong>${hour.precipitationProbability.toFixed(0)}%</strong></div>
          <div>Wind / 風向&nbsp; ${direction.en} / ${direction.ja}</div>
          <div>Speed / 風速&nbsp; <strong>${hour.windSpeed.toFixed(1)} m/s</strong></div>
        </div>
      `;
      el["hourly-grid"].appendChild(card);
    });
  }

  function renderLineChart(container, labels, values, options) {
    // A wide viewBox matches the A4 landscape chart area and avoids vertical squeezing in PDF output.
    const width = 700;
    const height = 140;
    const padding = { left: 34, right: 16, top: 20, bottom: 24 };
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const spread = Math.max(maxValue - minValue, 1);
    const yMin = Math.max(0, minValue - spread * .25);
    const yMax = maxValue + spread * .25;
    const x = index => padding.left + (index / (values.length - 1)) * (width - padding.left - padding.right);
    const y = value => padding.top + (1 - (value - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);
    const points = values.map((value, index) => `${x(index).toFixed(1)},${y(value).toFixed(1)}`).join(" ");
    const areaPoints = `${padding.left},${height - padding.bottom} ${points} ${width - padding.right},${height - padding.bottom}`;
    const gridLines = [0, .5, 1].map(fraction => {
      const yy = padding.top + fraction * (height - padding.top - padding.bottom);
      const labelValue = yMax - fraction * (yMax - yMin);
      return `<line x1="${padding.left}" y1="${yy}" x2="${width-padding.right}" y2="${yy}" stroke="#dce6ef" stroke-width="1"/><text x="2" y="${yy+3}" class="chart-label">${labelValue.toFixed(options.decimals)}</text>`;
    }).join("");
    const xLabels = labels.map((label, index) => index % 2 === 0 ? `<text x="${x(index)}" y="${height-7}" text-anchor="middle" class="chart-label">${label.slice(0,2)}</text>` : "").join("");
    const valuesSvg = values.map((value, index) => `<circle cx="${x(index)}" cy="${y(value)}" r="3" fill="white" stroke="${options.stroke}" stroke-width="2"/><text x="${x(index)}" y="${y(value)-8}" text-anchor="middle" class="chart-value">${value.toFixed(options.decimals)}${options.unit}</text>`).join("");

    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
        ${gridLines}
        <polygon points="${areaPoints}" fill="${options.fill}"/>
        <polyline points="${points}" fill="none" stroke="${options.stroke}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
        ${valuesSvg}
        ${xLabels}
      </svg>`;
  }

  function directionLabel(degrees) {
    const normalized = ((degrees % 360) + 360) % 360;
    const index = Math.round(normalized / 22.5) % 16;
    return { en: WIND_DIRECTIONS[index][0], ja: WIND_DIRECTIONS[index][1] };
  }

  function partsInTimezone(date, timezone) {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone || "UTC",
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
    });
    const map = {};
    formatter.formatToParts(date).forEach(part => { if (part.type !== "literal") map[part.type] = Number(part.value); });
    return map;
  }

  function formatDateBilingual(dateString) {
    const date = new Date(`${dateString}T00:00:00Z`);
    const en = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "long", year: "numeric", month: "long", day: "numeric" }).format(date);
    const ja = new Intl.DateTimeFormat("ja-JP", { timeZone: "UTC", weekday: "short", year: "numeric", month: "long", day: "numeric" }).format(date);
    return `${en} / ${ja}`;
  }

  function formatDateTime(date, timezone) {
    return new Intl.DateTimeFormat("ja-JP", {
      timeZone: timezone,
      year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23"
    }).format(date).replaceAll("/", "-");
  }

  function addDaysToDateString(dateString, days) {
    const date = new Date(`${dateString}T00:00:00Z`);
    date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }

  function normalizeLocation(result) {
    return {
      id: result.id,
      name: result.nameEn || result.name,
      nameJa: result.nameJa || result.name,
      admin1: result.admin1 || result.admin1En || "",
      country: result.country || result.countryEn || "",
      countryCode: result.country_code || "",
      latitude: result.latitude,
      longitude: result.longitude,
      timezone: result.timezone || "auto",
      provider: result.provider || "Open-Meteo",
      resultKind: result.resultKind || "location",
      resultKindEn: result.resultKindEn || "City / Area",
      resultKindJa: result.resultKindJa || "地域"
    };
  }

  function displayLocationName(locationData) {
    return [locationData.nameJa || locationData.name, locationData.admin1, locationData.country].filter(Boolean).join(" · ");
  }

  function updateModeButtons() {
    document.querySelectorAll(".mode-button").forEach(button => button.classList.toggle("active", button.dataset.mode === state.mode));
  }

  function setLoading(isLoading) {
    el["loading-overlay"].classList.toggle("hidden", !isLoading);
    el["weather-report"].setAttribute("aria-busy", String(isLoading));
  }

  function setStatus(message, type = "") {
    el["status-message"].textContent = message;
    el["status-message"].className = `status-message${type ? ` ${type}` : ""}`;
  }

  async function shareCurrentUrl() {
    updateUrl();
    const shareData = { title: document.title, text: `${displayLocationName(state.location)}の時間別天気`, url: location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(location.href);
        setStatus("共有URLをコピーしました。", "success");
      }
    } catch (error) {
      if (error.name !== "AbortError") setStatus("共有URLをコピーできませんでした。", "error");
    }
  }

  function updateUrl() {
    const params = new URLSearchParams();
    params.set("lat", state.location.latitude.toFixed(5));
    params.set("lon", state.location.longitude.toFixed(5));
    params.set("name", state.location.name || "Selected Location");
    params.set("nameJa", state.location.nameJa || state.location.name || "選択地域");
    if (state.location.admin1) params.set("admin1", state.location.admin1);
    if (state.location.country) params.set("country", state.location.country);
    if (state.location.provider) params.set("provider", state.location.provider);
    if (state.location.resultKind) params.set("kind", state.location.resultKind);
    params.set("timezone", state.forecast?.timezone || state.location.timezone || "auto");
    params.set("mode", state.mode);
    history.replaceState({}, "", `${location.pathname}?${params}${location.hash}`);
  }

  function readLocationFromUrl() {
    const params = new URLSearchParams(location.search);
    if (!params.has("lat") || !params.has("lon")) return null;
    const latitude = Number(params.get("lat"));
    const longitude = Number(params.get("lon"));
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return {
      id: `url-${latitude}-${longitude}`,
      name: params.get("name") || "Selected Location",
      nameJa: params.get("nameJa") || params.get("name") || "選択地域",
      admin1: params.get("admin1") || "",
      country: params.get("country") || "",
      latitude,
      longitude,
      timezone: params.get("timezone") || "auto",
      provider: params.get("provider") || "Open-Meteo",
      resultKind: params.get("kind") || "location"
    };
  }

  function getFavorites() { return readJson("weather.favorites") || []; }
  function locationKey(locationData) { return `${Number(locationData.latitude).toFixed(4)},${Number(locationData.longitude).toFixed(4)}`; }
  function isFavorite(locationData) { return getFavorites().some(item => locationKey(item) === locationKey(locationData)); }

  function toggleFavorite() {
    const favorites = getFavorites();
    const key = locationKey(state.location);
    const index = favorites.findIndex(item => locationKey(item) === key);
    if (index >= 0) {
      favorites.splice(index, 1);
      setStatus("お気に入りから削除しました。", "success");
    } else {
      favorites.unshift(state.location);
      favorites.splice(8);
      setStatus("お気に入りに追加しました。", "success");
    }
    localStorage.setItem("weather.favorites", JSON.stringify(favorites));
    renderFavorites();
  }

  function renderFavorites() {
    const favorites = getFavorites();
    el["saved-locations"].innerHTML = "";
    el["saved-locations-wrap"].hidden = favorites.length === 0;
    favorites.forEach(item => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "saved-location-button";
      button.textContent = item.nameJa || item.name;
      button.addEventListener("click", () => selectLocation(item));
      el["saved-locations"].appendChild(button);
    });
    updateFavoriteButton();
  }

  function updateFavoriteButton() {
    if (!el["favorite-button"]) return;
    const favorite = isFavorite(state.location);
    el["favorite-button"].textContent = favorite ? "★ Favorite / 登録済み" : "☆ Favorite / お気に入り";
  }

  function firstDisplayNamePart(displayName) {
    return String(displayName || "Selected Location").split(",")[0].trim();
  }

  function delay(milliseconds) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>'"]/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#039;", '"': "&quot;" })[character]);
  }

  function pad(number) { return String(number).padStart(2, "0"); }
})();
