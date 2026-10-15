(function () {
    "use strict";

    var channels = [];
    var channelGroups = [];
    var liveChannels = [];
    var liveChannelGroups = [];
    var managedAccount = null;
    var liveSelectedGroupIndex = 0;
    var catalogMode = "live";
    var seriesReturnState = null;
    var vodDetailsOpen = false;
    var activeDetailItem = null;
    var activeDetailType = "";
    var activeSeriesSeasons = [];
    var selectedSeasonIndex = 0;
    var vodBaseChannels = [];
    var vodCategories = [];
    var vodAccount = null;
    var vodBaseType = "";
    var currentPlaybackItem = null;
    var currentPlaybackKey = "";
    var lastProgressSave = 0;
    var playerControlsTimer = null;
    var focusedIndex = 0;
    var dashboardFocusedIndex = 0;
    var deviceSettingsFocusedIndex = 0;
    var categoryFocusIndex = 0;
    var selectedGroupIndex = 0;
    var liveFocusPane = "categories";
    var previewedChannelIndex = null;
    var previousFocusedElement = null;
    var channelsOpen = false;
    var deviceSettingsOpen = false;
    var appAccessAllowed = false;
    var deviceIdentifier = "";
    var pendingRelease = null;
    var dashboardFeedbackTimer = null;
    var channelList = document.getElementById("channel-list");
    var channelsTitle = document.getElementById("channels-title");
    var homeDashboard = document.getElementById("home-dashboard");
    var deviceSettingsScreen = document.getElementById("device-settings-screen");
    var deviceSettingsBackButton = document.getElementById("device-settings-back");
    var channelSection = document.getElementById("channel-section");
    var dashboardFeedback = document.getElementById("dashboard-feedback");
    var statusElement = document.getElementById("connection-status");
    var categoryListElement = document.getElementById("category-list");
    var selectedGroupTitle = document.getElementById("selected-group-title");
    var channelCountElement = document.getElementById("channel-count");
    var catalogSearch = document.getElementById("catalog-search");
    var catalogLoading = document.getElementById("catalog-loading");
    var catalogLoadingLabel = document.getElementById("catalog-loading-label");
    var miniVideo = document.getElementById("mini-video");
    var miniPlayerButton = document.getElementById("mini-player-button");
    var miniPlayerStage = document.getElementsByClassName("mini-player-stage")[0];
    var miniPlayerEmpty = document.getElementById("mini-player-empty");
    var miniNowPlaying = document.getElementById("mini-now-playing");
    var clockLabel = document.getElementById("clock-label");
    var dateLabel = document.getElementById("date-label");
    var accountNameLabel = document.getElementById("account-name");
    var accountInitial = document.getElementById("account-initial");
    var playerScreen = document.getElementById("player-screen");
    var videoPlayer = document.getElementById("video-player");
    var nowPlaying = document.getElementById("now-playing");
    var playerMessage = document.getElementById("player-message");
    var closeButton = document.getElementById("close-player");
    var backHomeButton = document.getElementById("back-home");
    var deviceStatusCard = document.getElementById("device-status-card");
    var deviceStatusTitle = document.getElementById("device-status-title");
    var deviceStatusMessage = document.getElementById("device-status-message");
    var listExpiryStatus = document.getElementById("list-expiry-status");
    var deviceIdLabel = document.getElementById("device-id-label");
    var appReleaseLabel = document.getElementById("app-release-label");
    var copyDeviceIdButton = document.getElementById("copy-device-id");
    var refreshChannelsButton = document.getElementById("refresh-channels-button");
    var updateAppButton = document.getElementById("update-app-button");
    var updateAppLabel = document.getElementById("update-app-label");
    var updateAppIndicator = document.getElementById("update-app-indicator");
    var retryDeviceCheckButton = document.getElementById("retry-device-check");
    var vodDetailScreen = document.getElementById("vod-detail-screen");
    var vodDetailBackButton = document.getElementById("vod-detail-back");
    var vodDetailPageTitle = document.getElementById("vod-detail-page-title");
    var movieDetailView = document.getElementById("movie-detail-view");
    var movieDetailImage = document.getElementById("movie-detail-image");
    var moviePosterFallback = document.getElementById("movie-poster-fallback");
    var movieDetailTitle = document.getElementById("movie-detail-title");
    var movieDetailRating = document.getElementById("movie-detail-rating");
    var movieDetailSynopsis = document.getElementById("movie-detail-synopsis");
    var movieWatchButton = document.getElementById("movie-watch-button");
    var seriesDetailView = document.getElementById("series-detail-view");
    var seriesDetailImage = document.getElementById("series-detail-image");
    var seriesPosterFallback = document.getElementById("series-poster-fallback");
    var seriesDetailTitle = document.getElementById("series-detail-title");
    var seriesDetailRating = document.getElementById("series-detail-rating");
    var seriesDetailSynopsis = document.getElementById("series-detail-synopsis");
    var seriesContinueButton = document.getElementById("series-continue-button");
    var seriesContinueItem = null;
    var seriesSeasonList = document.getElementById("series-season-list");
    var seriesEpisodeList = document.getElementById("series-episode-list");

    function getDashboardTiles() {
        return homeDashboard.querySelectorAll(".dashboard-tile, .dashboard-focus-target");
    }

    function getDeviceSettingsControls() {
        return deviceSettingsScreen.querySelectorAll("button:not([hidden]):not(:disabled)");
    }

    function getCategoryButtons() {
        return categoryListElement.getElementsByTagName("button");
    }

    function setCatalogLoading(isLoading, message) {
        catalogLoading.hidden = !isLoading;
        if (message) {
            catalogLoadingLabel.textContent = message;
        }
        channelSection.setAttribute("aria-busy", isLoading ? "true" : "false");
    }

    function showPlayerControls() {
        if (playerScreen.className.indexOf("is-visible") === -1) {
            return;
        }
        playerScreen.className = playerScreen.className.replace(" controls-hidden", "");
        if (playerControlsTimer) {
            window.clearTimeout(playerControlsTimer);
        }
        playerControlsTimer = window.setTimeout(function () {
            if (playerScreen.className.indexOf("is-visible") !== -1) {
                playerScreen.className += " controls-hidden";
            }
        }, 4000);
    }

    function focusCategory(index) {
        var buttons = getCategoryButtons();
        if (index < 0 || index >= buttons.length) {
            return;
        }
        categoryFocusIndex = index;
        liveFocusPane = "categories";
        buttons[index].focus();
        updateFocusedStyle();
    }

    function focusSearch() {
        liveFocusPane = "search";
        catalogSearch.focus();
    }

    function selectGroup(index) {
        if (index < 0 || index >= channelGroups.length) {
            return;
        }
        if (previewedChannelIndex !== null && channelGroups[index].channelIndexes.indexOf(previewedChannelIndex) === -1) {
            clearPreview();
        }
        selectedGroupIndex = index;
        focusedIndex = 0;
        catalogSearch.value = "";
        renderChannels();
        updateFocusedStyle();
    }

    function focusDashboardTile(index) {
        var tiles = getDashboardTiles();
        if (index < 0 || index >= tiles.length) {
            return;
        }
        dashboardFocusedIndex = index;
        tiles[index].focus();
    }

    function focusDeviceSettingsControl(index) {
        var controls = getDeviceSettingsControls();
        if (index < 0 || index >= controls.length) {
            return;
        }
        deviceSettingsFocusedIndex = index;
        controls[index].focus();
    }

    function moveDeviceSettingsFocus(keyCode) {
        var controls = getDeviceSettingsControls();
        var direction = (keyCode === 37 || keyCode === 38) ? -1 : 1;
        if (!controls.length) {
            return;
        }
        deviceSettingsFocusedIndex = (deviceSettingsFocusedIndex + direction + controls.length) % controls.length;
        focusDeviceSettingsControl(deviceSettingsFocusedIndex);
    }

    function setAccountName(username) {
        var name = username || "Modo demo";
        accountNameLabel.textContent = name;
        accountInitial.textContent = username ? username.charAt(0).toUpperCase() : "T";
    }

    function readWatchHistory() {
        var savedHistory;
        try {
            savedHistory = JSON.parse(window.localStorage.getItem("iptvLabWatchHistory") || "[]");
            return savedHistory && typeof savedHistory.length === "number" ? savedHistory : [];
        } catch (error) {
            return [];
        }
    }

    function getPlaybackKey(item) {
        if (!item || item.streamId === undefined) {
            return "";
        }
        if (item.mediaType === "movie") {
            return "movie:" + item.streamId;
        }
        if (item.mediaType === "episode" && item.seriesId !== undefined) {
            return "series:" + item.seriesId + ":" + item.streamId;
        }
        return "";
    }

    function getContinueItems(catalogType, savedAccount) {
        var history = readWatchHistory();
        var continueItems = [];
        var index;
        var entry;
        var isMovie;
        var isEpisode;
        var route;

        for (index = 0; index < history.length; index += 1) {
            entry = history[index];
            isMovie = catalogType === "movies" && entry.mediaType === "movie";
            isEpisode = catalogType === "series" && entry.mediaType === "episode";
            if ((!isMovie && !isEpisode) || entry.streamId === undefined || !(entry.position > 0)) {
                continue;
            }
            route = isMovie ? "movie" : "series";
            continueItems.push({
                name: entry.name,
                categoryId: "__continue_watching__",
                categoryName: "Continuar assistindo",
                logo: isEpisode ? (entry.seriesLogo || "") : (entry.logo || ""),
                rating: entry.rating || 0,
                ratingScale: entry.ratingScale || 10,
                mediaType: entry.mediaType,
                seriesId: entry.seriesId,
                seriesName: entry.seriesName,
                streamId: entry.streamId,
                containerExtension: entry.containerExtension || "mp4",
                resumePosition: entry.position || 0,
                duration: entry.duration || 0,
                updatedAt: entry.updatedAt || 0,
                url: savedAccount.server + "/" + route + "/" + encodeURIComponent(savedAccount.username) + "/" +
                    encodeURIComponent(savedAccount.password) + "/" + encodeURIComponent(entry.streamId) + "." +
                    (entry.containerExtension || "mp4")
            });
        }
        continueItems.sort(function (first, second) {
            return (second.updatedAt || 0) - (first.updatedAt || 0);
        });
        return continueItems;
    }

    function findSeriesContinueItem(seriesId, savedAccount) {
        var continueItems;
        var index;
        if (seriesId === undefined || seriesId === null || !savedAccount || !savedAccount.server ||
                !savedAccount.username || !savedAccount.password) {
            return null;
        }
        continueItems = getContinueItems("series", savedAccount);
        for (index = 0; index < continueItems.length; index += 1) {
            if (String(continueItems[index].seriesId) === String(seriesId)) {
                return continueItems[index];
            }
        }
        return null;
    }

    function refreshSeriesContinueButton() {
        if (activeDetailType !== "series" || !activeDetailItem) {
            return;
        }
        seriesContinueItem = findSeriesContinueItem(activeDetailItem.seriesId, readSavedSettings());
        seriesContinueButton.hidden = !seriesContinueItem;
    }

    function composeVodCatalog(catalogType, baseChannels, categories, savedAccount) {
        var continueItems = getContinueItems(catalogType, savedAccount);
        channels = continueItems.concat(baseChannels);
        selectedGroupIndex = 0;
        catalogMode = catalogType;
        buildChannelGroups(categories);
        channelsTitle.textContent = catalogType === "series" ? "Séries" : "Filmes";
        focusCategory(0);
    }

    function refreshVodCatalog() {
        if ((catalogMode === "movies" || catalogMode === "series") && vodBaseChannels.length && vodAccount) {
            composeVodCatalog(vodBaseType, vodBaseChannels, vodCategories, vodAccount);
        }
    }

    function savePlaybackProgress(forceSave) {
        var history;
        var currentTime = videoPlayer.currentTime;
        var duration = videoPlayer.duration;
        var index;
        var entry;

        if (!currentPlaybackKey || !currentPlaybackItem || !isFinite(currentTime) || currentTime < 5) {
            return;
        }
        if (!forceSave && currentTime - lastProgressSave < 5) {
            return;
        }
        lastProgressSave = currentTime;
        history = readWatchHistory();

        if (isFinite(duration) && duration > 0 && duration - currentTime < 30) {
            for (index = history.length - 1; index >= 0; index -= 1) {
                if (getPlaybackKey(history[index]) === currentPlaybackKey) {
                    history.splice(index, 1);
                }
            }
            try {
                window.localStorage.setItem("iptvLabWatchHistory", JSON.stringify(history));
            } catch (error) {
                return;
            }
            return;
        }

        entry = {
            mediaType: currentPlaybackItem.mediaType,
            streamId: currentPlaybackItem.streamId,
            seriesId: currentPlaybackItem.seriesId,
            seriesName: currentPlaybackItem.seriesName,
            name: currentPlaybackItem.name,
            logo: currentPlaybackItem.logo,
            seriesLogo: currentPlaybackItem.seriesLogo,
            rating: currentPlaybackItem.rating || 0,
            ratingScale: currentPlaybackItem.ratingScale || 10,
            containerExtension: currentPlaybackItem.containerExtension || "mp4",
            categoryId: currentPlaybackItem.categoryId,
            categoryName: currentPlaybackItem.categoryName,
            position: currentTime,
            duration: isFinite(duration) ? duration : 0,
            updatedAt: new Date().getTime()
        };
        for (index = history.length - 1; index >= 0; index -= 1) {
            if (getPlaybackKey(history[index]) === currentPlaybackKey) {
                history.splice(index, 1);
            }
        }
        history.unshift(entry);
        if (history.length > 100) {
            history.length = 100;
        }
        try {
            window.localStorage.setItem("iptvLabWatchHistory", JSON.stringify(history));
        } catch (error) {
            return;
        }
    }

    function restorePlaybackPosition() {
        var history = readWatchHistory();
        var index;
        if (!currentPlaybackKey) {
            return;
        }
        for (index = 0; index < history.length; index += 1) {
            if (getPlaybackKey(history[index]) === currentPlaybackKey && history[index].position > 0 &&
                    history[index].position < videoPlayer.duration - 5) {
                videoPlayer.currentTime = history[index].position;
                break;
            }
        }
    }

    function updateClock() {
        var current = new Date();
        var days = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
        var months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
        var hours = current.getHours();
        var minutes = current.getMinutes();
        clockLabel.textContent = (hours < 10 ? "0" : "") + hours + ":" +
            (minutes < 10 ? "0" : "") + minutes;
        dateLabel.textContent = days[current.getDay()] + ", " + current.getDate() + " " +
            months[current.getMonth()] + " " + current.getFullYear();
    }

    function setAppOrientation(orientation) {
        if (window.IPTVAndroid && window.IPTVAndroid.setScreenOrientation) {
            window.IPTVAndroid.setScreenOrientation(orientation);
        }
    }

    function showDashboard() {
        setAppOrientation("portrait");
        channelsOpen = false;
        deviceSettingsOpen = false;
        setCatalogLoading(false);
        clearPreview();
        document.body.className = "";
        homeDashboard.className = "home-dashboard";
        homeDashboard.setAttribute("aria-hidden", "false");
        deviceSettingsScreen.className = "device-settings-screen";
        deviceSettingsScreen.setAttribute("aria-hidden", "true");
        channelSection.className = "channel-section";
        channelSection.setAttribute("aria-hidden", "true");
        focusDashboardTile(dashboardFocusedIndex);
    }

    function openDeviceSettings() {
        setAppOrientation("landscape");
        channelsOpen = false;
        deviceSettingsOpen = true;
        setCatalogLoading(false);
        clearPreview();
        document.body.className = "";
        homeDashboard.className = "home-dashboard is-hidden";
        homeDashboard.setAttribute("aria-hidden", "true");
        deviceSettingsScreen.className = "device-settings-screen is-visible";
        deviceSettingsScreen.setAttribute("aria-hidden", "false");
        channelSection.className = "channel-section";
        channelSection.setAttribute("aria-hidden", "true");
        focusDeviceSettingsControl(0);
    }

    function openChannels() {
        if (!appAccessAllowed) {
            showDashboardNotice("device-inactive");
            focusDashboardTile(dashboardFocusedIndex);
            return;
        }
        setAppOrientation("landscape");
        if (catalogMode !== "live") {
            channels = liveChannels;
            channelGroups = liveChannelGroups;
            selectedGroupIndex = liveSelectedGroupIndex;
            catalogMode = "live";
            channelsTitle.textContent = "Live TV";
            renderCategories();
            renderChannels();
        }
        channelsOpen = true;
        deviceSettingsOpen = false;
        document.body.className = "live-mode";
        homeDashboard.className = "home-dashboard is-hidden";
        homeDashboard.setAttribute("aria-hidden", "true");
        deviceSettingsScreen.className = "device-settings-screen";
        deviceSettingsScreen.setAttribute("aria-hidden", "true");
        channelSection.className = "channel-section is-visible";
        channelSection.setAttribute("aria-hidden", "false");
        if (channelGroups.length) {
            focusCategory(selectedGroupIndex);
        } else {
            statusElement.textContent = "Carregando grupos de canais...";
        }
    }

    function showDashboardNotice(action) {
        var messages = {
            "device-inactive": "Este aparelho está bloqueado pelo administrador.",
            "movies-account": "Este aparelho não está autorizado a carregar filmes.",
            "series-account": "Este aparelho não está autorizado a carregar séries.",
            "empty-movies": "Nenhum filme foi encontrado nesta conta.",
            "empty-series": "Nenhuma série foi encontrada nesta conta.",
            "catalog-error": "Não foi possível carregar o catálogo. Verifique a conexão.",
            "update-unavailable": "O link para baixar o aplicativo não está configurado.",
            "cache-error": "Lista atualizada, mas o cache não pôde ser salvo neste aparelho."
        };
        if (deviceSettingsOpen && messages[action]) {
            deviceStatusMessage.textContent = messages[action];
            return;
        }
        dashboardFeedback.textContent = messages[action] || "Seção indisponível.";
        if (dashboardFeedbackTimer) {
            window.clearTimeout(dashboardFeedbackTimer);
        }
        dashboardFeedbackTimer = window.setTimeout(function () {
            dashboardFeedback.textContent = "";
        }, 5000);
    }

    function moveDashboardFocus(keyCode) {
        var tiles = getDashboardTiles();
        var currentRect = tiles[dashboardFocusedIndex].getBoundingClientRect();
        var currentX = currentRect.left + currentRect.width / 2;
        var currentY = currentRect.top + currentRect.height / 2;
        var bestIndex = dashboardFocusedIndex;
        var bestScore = Infinity;
        var index;
        var rect;
        var centerX;
        var centerY;
        var primaryDistance;
        var secondaryDistance;
        var score;
        var inDirection;

        for (index = 0; index < tiles.length; index += 1) {
            if (index === dashboardFocusedIndex) {
                continue;
            }
            rect = tiles[index].getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
            inDirection = (keyCode === 37 && centerX < currentX) ||
                (keyCode === 39 && centerX > currentX) ||
                (keyCode === 38 && centerY < currentY) ||
                (keyCode === 40 && centerY > currentY);
            if (!inDirection) {
                continue;
            }

            if (keyCode === 37 || keyCode === 39) {
                primaryDistance = Math.abs(centerX - currentX);
                secondaryDistance = Math.abs(centerY - currentY);
            } else {
                primaryDistance = Math.abs(centerY - currentY);
                secondaryDistance = Math.abs(centerX - currentX);
            }
            score = primaryDistance + secondaryDistance * 1.8;
            if (score < bestScore) {
                bestScore = score;
                bestIndex = index;
            }
        }
        focusDashboardTile(bestIndex);
    }

    function bindDashboardTiles() {
        var tiles = getDashboardTiles();
        var index;
        for (index = 0; index < tiles.length; index += 1) {
            tiles[index].onfocus = (function (tileIndex) {
                return function () {
                    dashboardFocusedIndex = tileIndex;
                };
            }(index));
            tiles[index].onclick = (function (tile) {
                return function () {
                    var action = tile.getAttribute("data-action");
                    if (action === "channels") {
                        openChannels();
                    } else if (action === "movies") {
                        loadVodCatalog("movies");
                    } else if (action === "series") {
                        loadVodCatalog("series");
                    } else if (action === "configuration") {
                        openDeviceSettings();
                    } else if (action === "refresh") {
                        window.location.reload();
                    }
                };
            }(tiles[index]));
        }
    }

    function readSavedSettings() {
        return managedAccount;
    }

    function fetchProviderAction(server, username, password, action, callback, extraParameters) {
        var request = new XMLHttpRequest();
        var completed = false;

        function finish(categoryData) {
            if (completed) {
                return;
            }
            completed = true;
            callback(categoryData);
        }

        request.onreadystatechange = function () {
            var response = null;
            if (request.readyState !== 4) {
                return;
            }
            if (request.status >= 200 && request.status < 300) {
                try {
                    response = JSON.parse(request.responseText);
                } catch (error) {
                    response = null;
                }
            }
            finish(response);
        };
        request.onerror = function () {
            finish([]);
        };
        request.ontimeout = function () {
            finish([]);
        };
        request.open("GET", server + "/player_api.php?username=" + encodeURIComponent(username) +
            "&password=" + encodeURIComponent(password) + "&action=" + encodeURIComponent(action) +
            (extraParameters ? "&" + extraParameters : ""), true);
        request.send(null);
    }

    function fetchProviderCategories(server, username, password, callback) {
        fetchProviderAction(server, username, password, "get_live_categories", callback);
    }

    function buildChannelGroups(categoryData) {
        var categoryNames = {};
        var groupLookup = {};
        var categoryIndex;
        var channelIndex;
        var categoryId;
        var groupKey;
        var groupName;
        var group;
        var groupIndex;
        var remainingGroups = [];
        var continueGroup = null;
        var mostWatchedGroup = null;
        var normalizedGroupName;

        if (categoryData && typeof categoryData.length === "number") {
            for (categoryIndex = 0; categoryIndex < categoryData.length; categoryIndex += 1) {
                if (categoryData[categoryIndex].category_id === undefined) {
                    continue;
                }
                categoryNames["id:" + categoryData[categoryIndex].category_id] =
                    categoryData[categoryIndex].category_name || "Grupo " + categoryData[categoryIndex].category_id;
            }
        }

        channelGroups = [];
        for (channelIndex = 0; channelIndex < channels.length; channelIndex += 1) {
            categoryId = channels[channelIndex].categoryId;
            groupKey = categoryId === undefined || categoryId === null || categoryId === "" ?
                "other" : String(categoryId);
            groupName = channels[channelIndex].categoryName || categoryNames["id:" + groupKey] ||
                (groupKey === "other" ? "Outros" : "Grupo " + groupKey);
            if (!groupLookup[groupKey]) {
                group = {
                    id: groupKey,
                    name: groupName,
                    channelIndexes: []
                };
                groupLookup[groupKey] = group;
                channelGroups.push(group);
            }
            groupLookup[groupKey].channelIndexes.push(channelIndex);
        }

        for (groupIndex = 0; groupIndex < channelGroups.length; groupIndex += 1) {
            group = channelGroups[groupIndex];
            normalizedGroupName = group.name.toLowerCase();
            if (group.id === "__continue_watching__" || normalizedGroupName.indexOf("continuar assistindo") !== -1) {
                continueGroup = group;
            } else if (normalizedGroupName.indexOf("mais assistidos") !== -1 ||
                    normalizedGroupName.indexOf("most watched") !== -1 ||
                    normalizedGroupName.indexOf("most viewed") !== -1) {
                mostWatchedGroup = group;
            } else {
                remainingGroups.push(group);
            }
        }

        channelGroups = [];
        if (catalogMode === "series" && continueGroup) {
            channelGroups.push(continueGroup);
        }
        if (mostWatchedGroup) {
            channelGroups.push(mostWatchedGroup);
        }
        if (continueGroup && catalogMode !== "series") {
            channelGroups.push(continueGroup);
        }
        for (groupIndex = 0; groupIndex < remainingGroups.length; groupIndex += 1) {
            channelGroups.push(remainingGroups[groupIndex]);
        }

        if (selectedGroupIndex >= channelGroups.length) {
            selectedGroupIndex = 0;
        }
        renderCategories();
        renderChannels();
    }

    function rememberLivePlaylist() {
        liveChannels = channels.slice(0);
        liveChannelGroups = channelGroups;
        liveSelectedGroupIndex = selectedGroupIndex;
    }

    function showCatalogView(title) {
        setAppOrientation("landscape");
        channelsOpen = true;
        document.body.className = "live-mode vod-mode";
        homeDashboard.className = "home-dashboard is-hidden";
        homeDashboard.setAttribute("aria-hidden", "true");
        channelSection.className = "channel-section is-visible";
        channelSection.setAttribute("aria-hidden", "false");
        channelsTitle.textContent = title;
    }

    function loadVodCatalog(catalogType) {
        var savedAccount = readSavedSettings();
        var isSeries = catalogType === "series";
        var categoriesAction = isSeries ? "get_series_categories" : "get_vod_categories";
        var streamsAction = isSeries ? "get_series" : "get_vod_streams";
        var title = isSeries ? "Séries" : "Filmes";

        if (!appAccessAllowed || !savedAccount || !savedAccount.server || !savedAccount.username || !savedAccount.password) {
            showDashboardNotice(isSeries ? "series-account" : "movies-account");
            return;
        }

        if (catalogMode === "live") {
            rememberLivePlaylist();
        }
        catalogMode = catalogType;
        channels = [];
        channelGroups = [];
        selectedGroupIndex = 0;
        focusedIndex = 0;
        previewedChannelIndex = null;
        showCatalogView(title);
        catalogSearch.value = "";
        setCatalogLoading(true, "Carregando " + title.toLowerCase() + "...");
        statusElement.textContent = "Carregando " + title.toLowerCase() + "...";
        categoryListElement.innerHTML = "";
        channelList.innerHTML = "";
        selectedGroupTitle.textContent = title;
        channelCountElement.textContent = "";

        fetchProviderAction(savedAccount.server, savedAccount.username, savedAccount.password,
            categoriesAction, function (categories) {
                fetchProviderAction(savedAccount.server, savedAccount.username, savedAccount.password,
                    streamsAction, function (response) {
                        var loadedCatalog = [];
                        var index;
                        var item;
                        var streamId;
                        var extension;

                        if (!response || typeof response.length !== "number") {
                            response = [];
                        }

                        for (index = 0; index < response.length; index += 1) {
                            item = response[index];
                            streamId = isSeries ? item.series_id : item.stream_id;
                            if (streamId === undefined || !item.name) {
                                continue;
                            }
                            extension = item.container_extension || "mp4";
                            if (!/^[a-z0-9]{1,8}$/i.test(extension)) {
                                extension = "mp4";
                            }
                            loadedCatalog.push({
                                name: item.name,
                                categoryId: item.category_id,
                                categoryName: "",
                                logo: isSeries ? (item.cover || "") : (item.stream_icon || ""),
                                rating: item.rating_5based || item.rating || 0,
                                ratingScale: item.rating_5based ? 5 : 10,
                                mediaType: isSeries ? "series" : "movie",
                                seriesId: isSeries ? streamId : undefined,
                                streamId: streamId,
                                containerExtension: extension,
                                url: isSeries ? "" : savedAccount.server + "/movie/" +
                                    encodeURIComponent(savedAccount.username) + "/" +
                                    encodeURIComponent(savedAccount.password) + "/" +
                                    encodeURIComponent(streamId) + "." + extension
                            });
                        }

                        if (!loadedCatalog.length) {
                            setCatalogLoading(false);
                            showDashboard();
                            showDashboardNotice(isSeries ? "empty-series" : "empty-movies");
                            return;
                        }

                        vodBaseType = catalogType;
                        vodBaseChannels = loadedCatalog.slice(0);
                        vodCategories = categories || [];
                        vodAccount = savedAccount;
                        composeVodCatalog(catalogType, vodBaseChannels, vodCategories, vodAccount);
                        setCatalogLoading(false);
                        channelsTitle.textContent = title;
                        statusElement.textContent = "Catálogo pronto";
                    });
            });
    }

    function showVodDetailScreen(type, item) {
        vodDetailsOpen = true;
        activeDetailType = type;
        activeDetailItem = item;
        vodDetailScreen.className = "vod-detail-screen is-visible";
        vodDetailScreen.setAttribute("aria-hidden", "false");
        movieDetailView.hidden = type !== "movie";
        seriesDetailView.hidden = type !== "series";
        vodDetailPageTitle.textContent = type === "movie" ? "Filme" : "Série";
    }

    function moveDetailFocus(keyCode) {
        var buttons = vodDetailScreen.querySelectorAll("button:not([disabled])");
        var activeIndex = -1;
        var activeRect;
        var activeX;
        var activeY;
        var bestIndex = -1;
        var bestScore = Infinity;
        var index;
        var rect;
        var centerX;
        var centerY;
        var primaryDistance;
        var secondaryDistance;
        var inDirection;
        var score;

        for (index = 0; index < buttons.length; index += 1) {
            if (buttons[index].getClientRects().length && buttons[index] === document.activeElement) {
                activeIndex = index;
                break;
            }
        }
        if (activeIndex === -1) {
            for (index = 0; index < buttons.length; index += 1) {
                if (buttons[index].getClientRects().length) {
                    buttons[index].focus();
                    return;
                }
            }
            return;
        }

        activeRect = buttons[activeIndex].getBoundingClientRect();
        activeX = activeRect.left + activeRect.width / 2;
        activeY = activeRect.top + activeRect.height / 2;
        for (index = 0; index < buttons.length; index += 1) {
            if (index === activeIndex || !buttons[index].getClientRects().length) {
                continue;
            }
            rect = buttons[index].getBoundingClientRect();
            centerX = rect.left + rect.width / 2;
            centerY = rect.top + rect.height / 2;
            inDirection = (keyCode === 37 && centerX < activeX) ||
                (keyCode === 39 && centerX > activeX) ||
                (keyCode === 38 && centerY < activeY) ||
                (keyCode === 40 && centerY > activeY);
            if (!inDirection) {
                continue;
            }
            primaryDistance = keyCode === 37 || keyCode === 39 ?
                Math.abs(centerX - activeX) : Math.abs(centerY - activeY);
            secondaryDistance = keyCode === 37 || keyCode === 39 ?
                Math.abs(centerY - activeY) : Math.abs(centerX - activeX);
            score = primaryDistance + secondaryDistance * 1.5;
            if (score < bestScore) {
                bestIndex = index;
                bestScore = score;
            }
        }
        if (bestIndex !== -1) {
            buttons[bestIndex].focus();
        }
    }

    function setDetailPoster(image, fallback, url, title) {
        image.style.display = "none";
        image.removeAttribute("src");
        fallback.textContent = (title || "").substring(0, 2);
        if (!/^https?:\/\//i.test(url || "")) {
            return;
        }
        image.onload = function () {
            this.style.display = "block";
        };
        image.onerror = function () {
            this.style.display = "none";
        };
        image.src = url;
    }

    function renderDetailRating(element, item) {
        var score = parseFloat(item.rating);
        var starCount;
        var index;
        var stars = "";
        var starsElement;
        var valueElement;

        element.innerHTML = "";
        if (isNaN(score) || score <= 0) {
            return;
        }
        if (item.ratingScale !== 5) {
            score /= 2;
        }
        score = Math.max(0, Math.min(5, score));
        starCount = Math.round(score);
        for (index = 0; index < 5; index += 1) {
            stars += index < starCount ? "★" : "☆";
        }
        starsElement = document.createElement("span");
        starsElement.className = "rating-stars";
        starsElement.textContent = stars;
        starsElement.setAttribute("aria-label", starCount + " de 5 estrelas");
        valueElement = document.createElement("span");
        valueElement.textContent = score.toFixed(1);
        element.appendChild(starsElement);
        element.appendChild(valueElement);
    }

    function openMovieDetails(movie) {
        var savedAccount = readSavedSettings();
        showVodDetailScreen("movie", movie);
        movieDetailTitle.textContent = movie.name;
        movieDetailSynopsis.textContent = movie.plot || "Carregando sinopse...";
        setDetailPoster(movieDetailImage, moviePosterFallback, movie.logo, movie.name);
        renderDetailRating(movieDetailRating, movie);
        setCatalogLoading(true, "Carregando detalhes do filme...");

        if (!savedAccount) {
            setCatalogLoading(false);
            movieDetailSynopsis.textContent = movie.plot || "Sinopse indisponível.";
            movieWatchButton.focus();
            return;
        }

        fetchProviderAction(savedAccount.server, savedAccount.username, savedAccount.password,
            "get_vod_info", function (response) {
                var info = response && response.info ? response.info : {};
                var cover = info.cover_big || info.movie_image || movie.logo;
                if (info.name) {
                    movie.name = info.name;
                }
                movie.plot = info.plot || info.description || movie.plot || "Sinopse indisponível.";
                movie.logo = cover || "";
                movie.rating = info.rating_5based || info.rating || movie.rating || 0;
                movie.ratingScale = info.rating_5based ? 5 : (info.rating ? 10 : movie.ratingScale);
                movieDetailTitle.textContent = movie.name;
                movieDetailSynopsis.textContent = movie.plot;
                setDetailPoster(movieDetailImage, moviePosterFallback, movie.logo, movie.name);
                renderDetailRating(movieDetailRating, movie);
                setCatalogLoading(false);
                movieWatchButton.focus();
            }, "vod_id=" + encodeURIComponent(movie.streamId));
    }

    function renderSeriesEpisodes(seasonIndex) {
        var episodes = activeSeriesSeasons[seasonIndex].episodes;
        var index;
        var episode;
        var button;
        var thumb;
        var fallback;
        var image;
        var title;

        selectedSeasonIndex = seasonIndex;
        seriesEpisodeList.innerHTML = "";
        for (index = 0; index < activeSeriesSeasons.length; index += 1) {
            seriesSeasonList.getElementsByTagName("button")[index].className =
                index === seasonIndex ? "season-button selected" : "season-button";
        }

        for (index = 0; index < episodes.length; index += 1) {
            episode = episodes[index];
            button = document.createElement("button");
            button.type = "button";
            button.className = "episode-card";
            button.setAttribute("aria-label", "Assistir " + episode.name);
            thumb = document.createElement("span");
            thumb.className = "episode-thumb";
            fallback = document.createElement("span");
            fallback.className = "episode-thumb-fallback";
            fallback.textContent = "EP " + (index + 1);
            thumb.appendChild(fallback);
            if (/^https?:\/\//i.test(episode.logo || "")) {
                image = document.createElement("img");
                image.src = episode.logo;
                image.alt = "";
                image.onerror = function () {
                    this.style.display = "none";
                };
                thumb.appendChild(image);
            }
            title = document.createElement("span");
            title.className = "episode-title";
            title.textContent = episode.name;
            button.appendChild(thumb);
            button.appendChild(title);
            button.onclick = (function (episodeItem) {
                return function () {
                    playMediaItem(episodeItem);
                };
            }(episode));
            seriesEpisodeList.appendChild(button);
        }
    }

    function renderSeriesSeasons() {
        var index;
        var button;
        seriesSeasonList.innerHTML = "";
        for (index = 0; index < activeSeriesSeasons.length; index += 1) {
            button = document.createElement("button");
            button.type = "button";
            button.className = index === 0 ? "season-button selected" : "season-button";
            button.textContent = activeSeriesSeasons[index].name;
            button.onclick = (function (seasonIndex) {
                return function () {
                    renderSeriesEpisodes(seasonIndex);
                };
            }(index));
            seriesSeasonList.appendChild(button);
        }
        if (activeSeriesSeasons.length) {
            renderSeriesEpisodes(0);
            seriesSeasonList.getElementsByTagName("button")[0].focus();
        } else {
            seriesEpisodeList.textContent = "Nenhum episódio encontrado.";
        }
    }

    function openSeriesDetails(series) {
        var savedAccount = readSavedSettings();
        showVodDetailScreen("series", series);
        seriesDetailTitle.textContent = series.name;
        seriesDetailSynopsis.textContent = series.plot || "Carregando sinopse...";
        setDetailPoster(seriesDetailImage, seriesPosterFallback, series.logo, series.name);
        renderDetailRating(seriesDetailRating, series);
        seriesSeasonList.innerHTML = "";
        seriesEpisodeList.innerHTML = "";
        seriesContinueItem = findSeriesContinueItem(series.seriesId, savedAccount);
        seriesContinueButton.hidden = !seriesContinueItem;
        setCatalogLoading(true, "Carregando temporadas e episódios...");

        if (!savedAccount) {
            setCatalogLoading(false);
            seriesDetailSynopsis.textContent = series.plot || "Sinopse indisponível.";
            return;
        }

        fetchProviderAction(savedAccount.server, savedAccount.username, savedAccount.password,
            "get_series_info", function (response) {
                var info = response && response.info ? response.info : {};
                var episodeData = response && response.episodes ? response.episodes : {};
                var seasonNumber;
                var seasonEpisodes;
                var episodeIndex;
                var episode;
                var episodeId;
                var extension;
                var episodeNumber;
                var season;

                series.plot = info.plot || info.description || series.plot || "Sinopse indisponível.";
                series.logo = info.cover_big || info.cover || series.logo || "";
                series.rating = info.rating_5based || info.rating || series.rating || 0;
                series.ratingScale = info.rating_5based ? 5 : (info.rating ? 10 : series.ratingScale);
                series.name = info.name || series.name;
                seriesDetailTitle.textContent = series.name;
                seriesDetailSynopsis.textContent = series.plot;
                setDetailPoster(seriesDetailImage, seriesPosterFallback, series.logo, series.name);
                renderDetailRating(seriesDetailRating, series);

                activeSeriesSeasons = [];
                for (seasonNumber in episodeData) {
                    if (!Object.prototype.hasOwnProperty.call(episodeData, seasonNumber)) {
                        continue;
                    }
                    seasonEpisodes = episodeData[seasonNumber];
                    if (!seasonEpisodes || typeof seasonEpisodes.length !== "number") {
                        continue;
                    }
                    season = { name: "Temporada " + seasonNumber, episodes: [] };
                    for (episodeIndex = 0; episodeIndex < seasonEpisodes.length; episodeIndex += 1) {
                        episode = seasonEpisodes[episodeIndex];
                        episodeId = episode.id !== undefined ? episode.id : episode.stream_id;
                        if (episodeId === undefined) {
                            continue;
                        }
                        extension = episode.container_extension || "mp4";
                        if (!/^[a-z0-9]{1,8}$/i.test(extension)) {
                            extension = "mp4";
                        }
                        episodeNumber = episode.episode_num || (episodeIndex + 1);
                        season.episodes.push({
                            name: "Episódio " + episodeNumber + " · " + (episode.title || episode.name || ""),
                            mediaType: "episode",
                            streamId: episodeId,
                            seriesId: series.seriesId,
                            seriesName: series.name,
                            seriesLogo: series.logo,
                            logo: episode.info && episode.info.movie_image ? episode.info.movie_image : "",
                            rating: episode.rating_5based || episode.rating || series.rating || 0,
                            ratingScale: episode.rating_5based ? 5 : series.ratingScale,
                            containerExtension: extension,
                            url: savedAccount.server + "/series/" + encodeURIComponent(savedAccount.username) + "/" +
                                encodeURIComponent(savedAccount.password) + "/" + encodeURIComponent(episodeId) + "." + extension
                        });
                    }
                    if (season.episodes.length) {
                        activeSeriesSeasons.push(season);
                    }
                }

                setCatalogLoading(false);
                renderSeriesSeasons();
            }, "series_id=" + encodeURIComponent(series.seriesId));
    }

    function closeVodDetails() {
        vodDetailsOpen = false;
        activeDetailItem = null;
        activeDetailType = "";
        activeSeriesSeasons = [];
        vodDetailScreen.className = "vod-detail-screen";
        vodDetailScreen.setAttribute("aria-hidden", "true");
        setCatalogLoading(false);
        if (vodBaseChannels.length && vodAccount) {
            composeVodCatalog(vodBaseType, vodBaseChannels, vodCategories, vodAccount);
        } else {
            focusCategory(selectedGroupIndex);
        }
    }

    function getDeviceIdentifier() {
        var identifier = "";
        var bytes = new Uint8Array(16);
        var index;
        var hex = "";

        try {
            identifier = window.localStorage.getItem("iptvLabDeviceId") || "";
        } catch (error) {
            identifier = "";
        }
        if (/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(identifier)) {
            return identifier;
        }
        if (window.crypto && window.crypto.getRandomValues) {
            window.crypto.getRandomValues(bytes);
        } else {
            for (index = 0; index < bytes.length; index += 1) {
                bytes[index] = Math.floor(Math.random() * 256);
            }
        }
        bytes[6] = (bytes[6] & 15) | 64;
        bytes[8] = (bytes[8] & 63) | 128;
        for (index = 0; index < bytes.length; index += 1) {
            hex += (bytes[index] + 256).toString(16).slice(1);
        }
        identifier = hex.slice(0, 8) + "-" + hex.slice(8, 12) + "-" + hex.slice(12, 16) +
            "-" + hex.slice(16, 20) + "-" + hex.slice(20);
        try {
            window.localStorage.setItem("iptvLabDeviceId", identifier);
        } catch (error) {
            showDeviceStatus("Identificador não salvo", "Ative o armazenamento do aplicativo e tente novamente.", "is-error");
        }
        return identifier;
    }

    function showDeviceStatus(title, message, stateClass) {
        deviceStatusTitle.textContent = title;
        deviceStatusMessage.textContent = message;
        deviceStatusCard.className = "device-status-card" + (stateClass ? " " + stateClass : "");
    }

    function saveManagedAccount(account) {
        managedAccount = account;
        setAccountName(account.username);
    }

    function updateListExpiryStatus(message, stateClass) {
        listExpiryStatus.textContent = message;
        listExpiryStatus.className = "list-expiry-status" + (stateClass ? " " + stateClass : "");
    }

    function checkProviderExpiry(account) {
        var request = new XMLHttpRequest();
        var expiryValue;
        var expiryTimestamp;
        var expiryDate;
        var expiryLabel;

        updateListExpiryStatus("Consultando validade da lista no provedor...", "is-pending");
        request.onreadystatechange = function () {
            var response;
            var userInfo;
            var statusText;
            var auth;
            if (request.readyState !== 4) {
                return;
            }
            if (request.status < 200 || request.status >= 300) {
                updateListExpiryStatus("Não foi possível consultar a validade da lista no provedor.", "is-unknown");
                return;
            }
            try {
                response = JSON.parse(request.responseText);
            } catch (error) {
                updateListExpiryStatus("O provedor retornou uma resposta inválida para a validade da lista.", "is-unknown");
                return;
            }
            userInfo = response && response.user_info;
            if (!userInfo || typeof userInfo !== "object") {
                updateListExpiryStatus("O provedor não informou a validade desta lista.", "is-unknown");
                return;
            }

            statusText = String(userInfo.status || "").toLowerCase();
            auth = userInfo.auth;
            if (statusText.indexOf("expir") !== -1 || statusText.indexOf("venc") !== -1) {
                updateListExpiryStatus("A conta IPTV está vencida segundo o provedor.", "is-expired");
                return;
            }
            if (auth === 0 || auth === "0" || auth === false || statusText.indexOf("disabled") !== -1 ||
                    statusText.indexOf("banned") !== -1 || statusText.indexOf("desativ") !== -1) {
                updateListExpiryStatus("A conta IPTV está inválida ou desativada no provedor.", "is-error");
                return;
            }

            expiryValue = userInfo.exp_date;
            expiryTimestamp = Number(expiryValue);
            if (expiryValue !== null && expiryValue !== undefined && expiryValue !== "" &&
                    expiryValue !== "0" && expiryTimestamp > 0 && isFinite(expiryTimestamp)) {
                expiryDate = new Date(expiryTimestamp * 1000);
                if (!isFinite(expiryDate.getTime())) {
                    updateListExpiryStatus("O provedor informou uma data de vencimento inválida.", "is-unknown");
                    return;
                }
                expiryLabel = new Intl.DateTimeFormat("pt-BR").format(expiryDate);
                if (expiryTimestamp <= Math.floor(new Date().getTime() / 1000)) {
                    updateListExpiryStatus("Lista IPTV vencida em " + expiryLabel + ".", "is-expired");
                } else {
                    updateListExpiryStatus("Lista IPTV válida até " + expiryLabel + ".", "is-active");
                }
                return;
            }

            updateListExpiryStatus("O provedor não informou uma data de vencimento.", "is-unknown");
        };
        request.onerror = function () {
            updateListExpiryStatus("Não foi possível acessar o provedor para consultar a validade da lista.", "is-unknown");
        };
        request.ontimeout = function () {
            updateListExpiryStatus("O provedor demorou para informar a validade da lista.", "is-unknown");
        };
        request.open("GET", account.server + "/player_api.php?username=" +
            encodeURIComponent(account.username) + "&password=" +
            encodeURIComponent(account.password), true);
        request.timeout = 15000;
        request.send(null);
    }

    function copyDeviceText(text, message) {
        var temporaryInput;
        var copied = false;
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(text).then(function () {
                showDashboardNotice(message);
            }, function () {
                showDashboardNotice("Não foi possível copiar o texto.");
            });
            return;
        }
        temporaryInput = document.createElement("textarea");
        temporaryInput.value = text;
        temporaryInput.style.position = "fixed";
        temporaryInput.style.opacity = "0";
        document.body.appendChild(temporaryInput);
        temporaryInput.select();
        try {
            copied = document.execCommand("copy");
        } catch (error) {
            copied = false;
        }
        document.body.removeChild(temporaryInput);
        showDashboardNotice(copied ? message : "Não foi possível copiar o texto.");
    }

    function showAppRelease(release) {
        var latestVersion = release && release.version;
        var installedVersion = (window.IPTV_APP_CONFIG || {}).version || latestVersion;
        pendingRelease = release && release.available ? release : null;
        updateAppButton.hidden = false;
        var appIsUpdated = !!release && !release.available;
        updateAppButton.disabled = appIsUpdated;
        updateAppButton.classList.toggle("is-updated", appIsUpdated);
        updateAppIndicator.classList.toggle("is-confirmed", appIsUpdated);
        if (pendingRelease) {
            appReleaseLabel.hidden = false;
            appReleaseLabel.textContent = "Nova versão disponível: " + latestVersion +
                (release.notes ? " · " + release.notes : "");
            updateAppLabel.textContent = "Atualizar para " + latestVersion;
            updateAppIndicator.textContent = "";
            updateAppButton.setAttribute("aria-label", "Atualizar o app para a versão " + latestVersion);
        } else if (latestVersion) {
            appReleaseLabel.hidden = false;
            appReleaseLabel.textContent = "App atualizado: " + installedVersion;
            updateAppLabel.textContent = "Atualizado";
            updateAppIndicator.textContent = "✓";
            updateAppButton.setAttribute("aria-label", "App atualizado na versão " + installedVersion);
        } else {
            appReleaseLabel.hidden = true;
            updateAppLabel.textContent = "Baixar / atualizar app";
            updateAppIndicator.textContent = "";
            updateAppButton.setAttribute("aria-label", "Baixar ou atualizar o app");
        }
    }

    function renderDeviceStatus(data) {
        var stateClass = "";
        var title = "Aplicativo não cadastrado";
        var message = "Copie o identificador e cadastre este aparelho no painel administrativo.";
        var account;

        deviceIdentifier = data.deviceId || deviceIdentifier;
        deviceIdLabel.textContent = "ID: " + deviceIdentifier;
        appAccessAllowed = data.status === "active";
        copyDeviceIdButton.hidden = data.status === "active";

        if (data.status === "active") {
            title = "Acesso ativo";
            message = "Aparelho ativo no painel. Consultando a conta IPTV e atualizando os canais...";
            stateClass = "is-active";
            account = {
                server: (data.providerUrl || "").replace(/\/+$/, ""),
                username: data.account ? data.account.username : "",
                password: data.account ? data.account.password : ""
            };
            if (account.server && account.username && account.password) {
                refreshChannelsButton.hidden = false;
                saveManagedAccount(account);
                checkProviderExpiry(account);
                loadManagedPlaylist(account);
            } else {
                appAccessAllowed = false;
                refreshChannelsButton.hidden = true;
                setRefreshChannelsLoading(false);
                message = "O cadastro está ativo, mas falta configurar o servidor ou a lista no painel.";
                stateClass = "is-error";
                updateListExpiryStatus("Configure servidor, usuário e senha para consultar a validade da lista.", "is-unknown");
            }
        } else {
            refreshChannelsButton.hidden = true;
            setRefreshChannelsLoading(false);
            setAccountName("");
            managedAccount = null;
            updateListExpiryStatus("A validade da lista será consultada após configurar o aparelho.", "");
            if (data.status === "blocked") {
                title = "Aparelho bloqueado";
                message = data.message || "O acesso foi bloqueado pelo administrador.";
                stateClass = "is-error";
            } else {
                title = "Aguardando ativação";
                message = "Este app foi instalado e aguarda configuração pelo administrador. O identificador foi enviado ao painel.";
                stateClass = "is-unregistered";
            }
        }

        showDeviceStatus(title, message, stateClass);
        showAppRelease(data.release);
    }

    function setRefreshChannelsLoading(isLoading) {
        refreshChannelsButton.disabled = isLoading;
        refreshChannelsButton.textContent = isLoading ? "Atualizando..." : "Atualizar canais";
    }

    function checkManagedDevice() {
        var request = new XMLHttpRequest();
        var configuration = window.IPTV_APP_CONFIG || {};
        deviceIdentifier = deviceIdentifier || getDeviceIdentifier();
        appAccessAllowed = false;
        managedAccount = null;
        deviceIdLabel.textContent = "ID: " + deviceIdentifier;
        retryDeviceCheckButton.hidden = true;
        setRefreshChannelsLoading(true);
        updateListExpiryStatus("Aguardando consulta ao provedor...", "is-pending");
        showDeviceStatus("Verificando aplicativo...", "Conectando ao painel e atualizando a lista.", "");

        if (!configuration.apiUrl || !/^https:\/\//i.test(configuration.apiUrl)) {
            showDeviceStatus("Painel não configurado", "Instale a versão do app preparada para o domínio de gerenciamento.", "is-error");
            retryDeviceCheckButton.hidden = false;
            setRefreshChannelsLoading(false);
            return;
        }
        request.onreadystatechange = function () {
            var response;
            if (request.readyState !== 4) {
                return;
            }
            if (request.status < 200 || request.status >= 300) {
                showDeviceStatus("Não foi possível verificar o aparelho", "Confira a internet e tente novamente. O acesso fica indisponível até validar o cadastro.", "is-error");
                retryDeviceCheckButton.hidden = false;
                setRefreshChannelsLoading(false);
                return;
            }
            try {
                response = JSON.parse(request.responseText);
            } catch (error) {
                showDeviceStatus("Resposta inválida do painel", "Tente novamente mais tarde ou entre em contato com o suporte.", "is-error");
                retryDeviceCheckButton.hidden = false;
                setRefreshChannelsLoading(false);
                return;
            }
            renderDeviceStatus(response);
        };
        request.onerror = function () {
            showDeviceStatus("Sem conexão com o painel", "Conecte-se à internet e tente verificar novamente.", "is-error");
            retryDeviceCheckButton.hidden = false;
            setRefreshChannelsLoading(false);
        };
        request.ontimeout = function () {
            showDeviceStatus("Painel demorou para responder", "Verifique a internet e tente novamente.", "is-error");
            retryDeviceCheckButton.hidden = false;
            setRefreshChannelsLoading(false);
        };
        request.open("GET", configuration.apiUrl + "?action=status&deviceId=" +
            encodeURIComponent(deviceIdentifier) + "&appVersion=" +
            encodeURIComponent(configuration.version || "1.0.0"), true);
        request.timeout = 15000;
        request.send(null);
    }

    function loadManagedPlaylist(account) {
        var request = new XMLHttpRequest();
        var response;
        var loadedChannels = [];
        var index;
        var streamId;
        var server = account.server ? account.server.replace(/\/+$/, "") : "";

        statusElement.textContent = "Atualizando canais...";
        request.onreadystatechange = function () {
            if (request.readyState !== 4) {
                return;
            }
            if (request.status < 200 || request.status >= 300) {
                statusElement.textContent = "Painel conectado, mas o servidor IPTV não respondeu.";
                deviceStatusMessage.textContent = statusElement.textContent;
                setRefreshChannelsLoading(false);
                showDashboardNotice("catalog-error");
                return;
            }
            try {
                response = JSON.parse(request.responseText);
            } catch (error) {
                statusElement.textContent = "O servidor IPTV retornou uma resposta inválida.";
                deviceStatusMessage.textContent = statusElement.textContent;
                setRefreshChannelsLoading(false);
                showDashboardNotice("catalog-error");
                return;
            }
            if (!response || typeof response.length !== "number") {
                statusElement.textContent = "O servidor não retornou uma lista de canais ao vivo.";
                deviceStatusMessage.textContent = statusElement.textContent;
                setRefreshChannelsLoading(false);
                showDashboardNotice("catalog-error");
                return;
            }
            for (index = 0; index < response.length; index += 1) {
                streamId = response[index].stream_id;
                if (streamId === undefined || !response[index].name) {
                    continue;
                }
                loadedChannels.push({
                    name: response[index].name,
                    streamId: streamId,
                    categoryId: response[index].category_id,
                    categoryName: response[index].category_name || "",
                    logo: response[index].stream_icon || "",
                    url: server + "/live/" + encodeURIComponent(account.username) + "/" +
                        encodeURIComponent(account.password) + "/" + encodeURIComponent(streamId) + ".m3u8"
                });
            }
            if (!loadedChannels.length) {
                statusElement.textContent = "Nenhum canal ao vivo encontrado para esta conta.";
                deviceStatusMessage.textContent = statusElement.textContent;
                setRefreshChannelsLoading(false);
                showDashboardNotice("catalog-error");
                return;
            }
            fetchProviderCategories(server, account.username, account.password, function (categoryData) {
                channels = loadedChannels;
                catalogMode = "live";
                buildChannelGroups(categoryData);
                rememberLivePlaylist();
                channelsTitle.textContent = "Live TV";
                statusElement.textContent = "Lista atualizada pelo painel";
                deviceStatusMessage.textContent = "Canais da conta IPTV atualizados.";
                setRefreshChannelsLoading(false);
                renderCategories();
                renderChannels();
            });
        };
        request.onerror = function () {
            statusElement.textContent = "Não foi possível acessar o servidor IPTV.";
            deviceStatusMessage.textContent = statusElement.textContent;
            setRefreshChannelsLoading(false);
            showDashboardNotice("catalog-error");
        };
        request.open("GET", server + "/player_api.php?username=" + encodeURIComponent(account.username) +
            "&password=" + encodeURIComponent(account.password) + "&action=get_live_streams", true);
        request.timeout = 20000;
        request.ontimeout = function () {
            statusElement.textContent = "O servidor IPTV demorou para responder. Tente atualizar novamente.";
            deviceStatusMessage.textContent = statusElement.textContent;
            setRefreshChannelsLoading(false);
            showDashboardNotice("catalog-error");
        };
        request.send(null);
    }

    function renderCategories() {
        var index;
        var button;
        var name;
        categoryListElement.innerHTML = "";

        for (index = 0; index < channelGroups.length; index += 1) {
            button = document.createElement("button");
            button.type = "button";
            button.className = "category-button";
            button.setAttribute("data-category-index", index);
            button.setAttribute("aria-label", channelGroups[index].name);

            name = document.createElement("span");
            name.className = "category-name";
            name.textContent = channelGroups[index].name;
            button.appendChild(name);
            button.onclick = (function (groupIndex) {
                return function () {
                    categoryFocusIndex = groupIndex;
                    selectGroup(groupIndex);
                    focusCategory(groupIndex);
                };
            }(index));
            button.onfocus = (function (groupIndex) {
                return function () {
                    categoryFocusIndex = groupIndex;
                    liveFocusPane = "categories";
                    updateFocusedStyle();
                };
            }(index));
            categoryListElement.appendChild(button);
        }
        updateFocusedStyle();
    }

    function bindChannelButton(button, visibleIndex, sourceIndex) {
        button.onclick = function () {
            focusChannel(visibleIndex);
            if (channels[sourceIndex].mediaType === "series") {
                openSeriesDetails(channels[sourceIndex]);
            } else if (channels[sourceIndex].mediaType === "movie") {
                openMovieDetails(channels[sourceIndex]);
            } else if (catalogMode === "live") {
                activateChannel(sourceIndex);
            } else {
                playChannel(sourceIndex);
            }
        };
        button.onfocus = function () {
            focusedIndex = visibleIndex;
            liveFocusPane = "channels";
            updateFocusedStyle();
        };
    }

    function renderVodCard(channelIndex, visibleIndex) {
        var item = channels[channelIndex];
        var button = document.createElement("button");
        var cover = document.createElement("span");
        var fallback = document.createElement("span");
        var title = document.createElement("span");
        var logo;
        var progress;
        var progressFill;
        var progressPercent;
        var ratingScore = parseFloat(item.rating);
        var starCount;
        var starIndex;
        var starText = "";
        var ratingRow;
        var ratingStars;
        var ratingLabel;

        button.type = "button";
        button.className = "vod-card";
        button.setAttribute("aria-label", item.name + (item.resumePosition ? ", continuar assistindo" : ""));
        cover.className = "vod-cover";
        fallback.className = "vod-cover-fallback";
        fallback.textContent = item.name.substring(0, 2);
        cover.appendChild(fallback);

        if (/^https?:\/\//i.test(item.logo || "")) {
            logo = document.createElement("img");
            logo.className = "vod-cover-image";
            logo.src = item.logo;
            logo.alt = "";
            logo.onerror = function () {
                this.style.display = "none";
            };
            cover.appendChild(logo);
        }

        title.className = "vod-card-title";
        title.textContent = item.name;
        button.appendChild(cover);
        button.appendChild(title);

        if (!isNaN(ratingScore) && ratingScore > 0) {
            if (item.ratingScale !== 5) {
                ratingScore /= 2;
            }
            ratingScore = Math.max(0, Math.min(5, ratingScore));
            starCount = Math.round(ratingScore);
            for (starIndex = 0; starIndex < 5; starIndex += 1) {
                starText += starIndex < starCount ? "★" : "☆";
            }
            ratingRow = document.createElement("span");
            ratingRow.className = "vod-rating";
            ratingStars = document.createElement("span");
            ratingStars.className = "rating-stars";
            ratingStars.textContent = starText;
            ratingStars.setAttribute("aria-label", starCount + " de 5 estrelas");
            ratingLabel = document.createElement("span");
            ratingLabel.textContent = ratingScore.toFixed(1);
            ratingRow.appendChild(ratingStars);
            ratingRow.appendChild(ratingLabel);
            button.appendChild(ratingRow);
        }

        if (item.resumePosition > 0) {
            progress = document.createElement("span");
            progress.className = "vod-progress";
            progressPercent = item.duration > 0 ? Math.min(100, (item.resumePosition / item.duration) * 100) : 4;
            progressFill = document.createElement("span");
            progressFill.className = "vod-progress-fill";
            progressFill.style.width = progressPercent + "%";
            progress.appendChild(progressFill);
            button.appendChild(progress);
        }

        bindChannelButton(button, visibleIndex, channelIndex);
        return button;
    }

    function getVisibleChannelIndexes(group) {
        var searchText = catalogSearch.value.replace(/^\s+|\s+$/g, "").toLowerCase();
        var visibleIndexes = [];
        var index;
        var channelIndex;

        if (!searchText) {
            return group.channelIndexes.slice(0);
        }
        for (index = 0; index < channels.length; index += 1) {
            if (channels[index].name.toLowerCase().indexOf(searchText) !== -1) {
                visibleIndexes.push(index);
            }
        }
        return visibleIndexes;
    }

    function renderChannels() {
        var group = channelGroups[selectedGroupIndex];
        var visibleIndexes;
        var searchText = catalogSearch.value.replace(/^\s+|\s+$/g, "");
        var index;
        var channelIndex;
        var button;
        var logo;
        var logoFallback;
        var logoImage;
        var name;

        channelList.innerHTML = "";
        channelList.className = catalogMode === "live" ? "channel-grid" : "channel-grid vod-grid";
        if (!group) {
            selectedGroupTitle.textContent = searchText ? "Nenhum resultado" : "Nenhum grupo disponível";
            channelCountElement.textContent = "0 canais";
            return;
        }

        visibleIndexes = getVisibleChannelIndexes(group);
        selectedGroupTitle.textContent = searchText ?
            (visibleIndexes.length ? "Resultados da busca" : "Nenhum resultado") : group.name;
        channelCountElement.textContent = "";
        for (index = 0; index < visibleIndexes.length; index += 1) {
            channelIndex = visibleIndexes[index];
            if (catalogMode !== "live") {
                channelList.appendChild(renderVodCard(channelIndex, index));
                continue;
            }
            button = document.createElement("button");
            button.type = "button";
            button.className = "channel-button";
            button.setAttribute("data-channel-index", channelIndex);
            button.setAttribute("aria-label", "Pré-visualizar " + channels[channelIndex].name);

            logo = document.createElement("span");
            logo.className = "channel-logo";
            logoFallback = document.createElement("span");
            logoFallback.className = "channel-logo-fallback";
            logoFallback.textContent = channels[channelIndex].name.substring(0, 2);
            logo.appendChild(logoFallback);

            if (/^https?:\/\//i.test(channels[channelIndex].logo || "")) {
                logoImage = document.createElement("img");
                logoImage.className = "channel-logo-image";
                logoImage.src = channels[channelIndex].logo;
                logoImage.alt = "";
                logoImage.onerror = function () {
                    this.style.display = "none";
                };
                logo.appendChild(logoImage);
            }

            name = document.createElement("span");
            name.className = "channel-name";
            name.textContent = channels[channelIndex].name;
            button.appendChild(logo);
            button.appendChild(name);
            bindChannelButton(button, index, channelIndex);
            channelList.appendChild(button);
        }
        updateFocusedStyle();
    }

    function getChannelButtons() {
        return channelList.getElementsByTagName("button");
    }

    function focusChannel(index) {
        var buttons = getChannelButtons();
        if (index < 0 || index >= buttons.length) {
            return;
        }
        focusedIndex = index;
        liveFocusPane = "channels";
        buttons[index].focus();
        updateFocusedStyle();
    }

    function updateFocusedStyle() {
        var buttons = getChannelButtons();
        var categoryButtons = getCategoryButtons();
        var index;
        for (index = 0; index < buttons.length; index += 1) {
            if (catalogMode === "live") {
                buttons[index].className = liveFocusPane === "channels" && index === focusedIndex ?
                    "channel-button focused" : "channel-button";
            } else {
                buttons[index].className = liveFocusPane === "channels" && index === focusedIndex ?
                    "vod-card focused" : "vod-card";
            }
        }
        for (index = 0; index < categoryButtons.length; index += 1) {
            categoryButtons[index].className = "category-button";
            if (index === selectedGroupIndex) {
                categoryButtons[index].className += " selected";
            }
            if (liveFocusPane === "categories" && index === categoryFocusIndex) {
                categoryButtons[index].className += " focused";
            }
        }
        miniPlayerButton.className = liveFocusPane === "preview" ?
            "mini-player-button focused" : "mini-player-button";
    }

    function focusMiniPlayer() {
        if (previewedChannelIndex === null) {
            return;
        }
        liveFocusPane = "preview";
        miniPlayerButton.focus();
        updateFocusedStyle();
    }

    function clearPreview() {
        miniVideo.pause();
        miniVideo.removeAttribute("src");
        miniVideo.load();
        previewedChannelIndex = null;
        miniPlayerStage.className = "mini-player-stage";
        miniPlayerEmpty.textContent = "Selecione um canal";
        miniNowPlaying.textContent = "Nenhum canal selecionado";
    }

    function previewChannel(index) {
        var playResult;
        if (!channels[index]) {
            return;
        }
        previewedChannelIndex = index;
        miniNowPlaying.textContent = channels[index].name;
        miniPlayerEmpty.textContent = "";
        miniPlayerStage.className = "mini-player-stage has-preview is-loading";
        miniVideo.src = channels[index].url;
        miniVideo.load();
        playResult = miniVideo.play();
        if (playResult && typeof playResult.catch === "function") {
            playResult.catch(function () {
                if (previewedChannelIndex === index) {
                    miniPlayerEmpty.textContent = "Prévia indisponível";
                    miniPlayerStage.className = "mini-player-stage";
                }
            });
        }
    }

    function activateChannel(index) {
        if (!channels[index]) {
            return;
        }
        if (previewedChannelIndex === index) {
            playChannel(index);
        } else {
            previewChannel(index);
        }
    }

    function playMediaItem(item) {
        if (!item || !item.url) {
            return;
        }

        previousFocusedElement = document.activeElement;
        currentPlaybackItem = item;
        currentPlaybackKey = getPlaybackKey(currentPlaybackItem);
        lastProgressSave = 0;
        miniVideo.pause();
        nowPlaying.textContent = item.name;
        playerMessage.innerHTML = "";
        playerScreen.className = "player-screen is-visible";
        playerScreen.setAttribute("aria-hidden", "false");
        videoPlayer.src = item.url;
        videoPlayer.load();
        showPlayerControls();

        var playResult = videoPlayer.play();
        if (playResult && typeof playResult.catch === "function") {
            playResult.catch(function () {
                playerMessage.innerHTML = "Não foi possível iniciar o stream. Verifique a conexão ou pressione Voltar.";
            });
        }

        closeButton.focus();
    }

    function playChannel(index) {
        playMediaItem(channels[index]);
    }

    function closePlayer() {
        var refreshCatalog;
        if (playerScreen.className.indexOf("is-visible") === -1) {
            return;
        }

        savePlaybackProgress(true);
        refreshCatalog = catalogMode === "movies" && !vodDetailsOpen;
        if (playerControlsTimer) {
            window.clearTimeout(playerControlsTimer);
            playerControlsTimer = null;
        }
        videoPlayer.pause();
        videoPlayer.removeAttribute("src");
        videoPlayer.load();
        playerScreen.className = "player-screen";
        playerScreen.setAttribute("aria-hidden", "true");
        playerMessage.innerHTML = "";

        if (refreshCatalog) {
            refreshVodCatalog();
        } else if (previousFocusedElement && typeof previousFocusedElement.focus === "function") {
            previousFocusedElement.focus();
        } else {
            focusMiniPlayer();
        }
        refreshSeriesContinueButton();
        if (previewedChannelIndex !== null) {
            miniVideo.play();
        }
    }

    function moveFocus(keyCode) {
        var categoryButtons = getCategoryButtons();
        var channelButtons = getChannelButtons();

        if (liveFocusPane === "categories") {
            if (keyCode === 38 && categoryFocusIndex > 0) {
                focusCategory(categoryFocusIndex - 1);
            } else if (keyCode === 40 && categoryFocusIndex < categoryButtons.length - 1) {
                focusCategory(categoryFocusIndex + 1);
            } else if (keyCode === 39 && channelButtons.length) {
                focusChannel(Math.min(focusedIndex, channelButtons.length - 1));
            }
        } else if (liveFocusPane === "channels") {
            if (keyCode === 38 && focusedIndex > 0) {
                focusChannel(focusedIndex - 1);
            } else if (keyCode === 38) {
                focusSearch();
            } else if (keyCode === 40 && focusedIndex < channelButtons.length - 1) {
                focusChannel(focusedIndex + 1);
            } else if (keyCode === 37) {
                focusCategory(selectedGroupIndex);
            } else if (keyCode === 39 && previewedChannelIndex !== null) {
                focusMiniPlayer();
            }
        } else if (liveFocusPane === "preview" && keyCode === 37 && channelButtons.length) {
            focusChannel(focusedIndex);
        } else if (liveFocusPane === "search") {
            if (keyCode === 38) {
                focusCategory(selectedGroupIndex);
            } else if (keyCode === 40 && channelButtons.length) {
                focusChannel(0);
            }
        }
    }

    // webOS LG Back is keyCode 461; Escape is included for browser-based testing.
    document.addEventListener("keydown", function (event) {
        var keyCode = event.keyCode || event.which;
        var playerIsOpen = playerScreen.className.indexOf("is-visible") !== -1;
        var sourceChannelIndex;

        if (keyCode === 461 || keyCode === 27) {
            if (playerIsOpen) {
                event.preventDefault();
                closePlayer();
            } else if (vodDetailsOpen) {
                event.preventDefault();
                closeVodDetails();
            } else if (channelsOpen) {
                event.preventDefault();
                showDashboard();
            } else if (deviceSettingsOpen) {
                event.preventDefault();
                showDashboard();
            }
            return;
        }

        if (playerIsOpen) {
            showPlayerControls();
            return;
        }

        if (vodDetailsOpen) {
            if (keyCode >= 37 && keyCode <= 40) {
                event.preventDefault();
                moveDetailFocus(keyCode);
            }
            return;
        }

        if (deviceSettingsOpen) {
            if (keyCode >= 37 && keyCode <= 40) {
                event.preventDefault();
                moveDeviceSettingsFocus(keyCode);
            } else if (keyCode === 13) {
                event.preventDefault();
                getDeviceSettingsControls()[deviceSettingsFocusedIndex].click();
            }
            return;
        }

        if (channelsOpen && event.target === catalogSearch) {
            if (keyCode === 38) {
                event.preventDefault();
                focusCategory(selectedGroupIndex);
            } else if (keyCode === 40 && getChannelButtons().length) {
                event.preventDefault();
                focusChannel(0);
            }
            return;
        }

        if (keyCode >= 37 && keyCode <= 40 && channelsOpen) {
            event.preventDefault();
            moveFocus(keyCode);
        } else if (keyCode >= 37 && keyCode <= 40) {
            event.preventDefault();
            moveDashboardFocus(keyCode);
        } else if (keyCode === 13) {
            event.preventDefault();
            if (channelsOpen) {
                if (liveFocusPane === "categories") {
                    selectGroup(categoryFocusIndex);
                    if (getChannelButtons().length) {
                        focusChannel(0);
                    }
                } else if (liveFocusPane === "channels") {
                    if (channelGroups[selectedGroupIndex]) {
                        sourceChannelIndex = channelGroups[selectedGroupIndex].channelIndexes[focusedIndex];
                        if (channels[sourceChannelIndex] && channels[sourceChannelIndex].mediaType === "series") {
                            openSeriesDetails(channels[sourceChannelIndex]);
                        } else if (channels[sourceChannelIndex] && channels[sourceChannelIndex].mediaType === "movie") {
                            openMovieDetails(channels[sourceChannelIndex]);
                        } else {
                            activateChannel(sourceChannelIndex);
                        }
                    }
                } else if (previewedChannelIndex !== null) {
                    playChannel(previewedChannelIndex);
                }
            } else {
                getDashboardTiles()[dashboardFocusedIndex].click();
            }
        }
    });

    vodDetailBackButton.onclick = closeVodDetails;
    movieWatchButton.onclick = function () {
        playMediaItem(activeDetailItem);
    };
    seriesContinueButton.onclick = function () {
        if (seriesContinueItem) {
            playMediaItem(seriesContinueItem);
        }
    };
    backHomeButton.onclick = showDashboard;
    deviceSettingsBackButton.onclick = showDashboard;
    (function bindDeviceSettingsFocus() {
        var controls = deviceSettingsScreen.getElementsByTagName("button");
        var index;
        for (index = 0; index < controls.length; index += 1) {
            controls[index].onfocus = (function (controlIndex) {
                return function () {
                    var visibleControls = getDeviceSettingsControls();
                    var visibleIndex = Array.prototype.indexOf.call(visibleControls, controls[controlIndex]);
                    if (visibleIndex !== -1) {
                        deviceSettingsFocusedIndex = visibleIndex;
                    }
                };
            }(index));
        }
    }());
    copyDeviceIdButton.onclick = function () {
        copyDeviceText(deviceIdentifier, "Identificador do app copiado.");
    };
    retryDeviceCheckButton.onclick = checkManagedDevice;
    refreshChannelsButton.onclick = checkManagedDevice;
    updateAppButton.onclick = function () {
        if (updateAppButton.disabled) {
            return;
        }
        var configuration = window.IPTV_APP_CONFIG || {};
        var downloadUrl = pendingRelease && pendingRelease.downloadUrl ?
            pendingRelease.downloadUrl : configuration.publicDownloadUrl;
        if (!downloadUrl || !/^https:\/\//i.test(downloadUrl)) {
            showDashboardNotice("update-unavailable");
            return;
        }
        if (window.IPTVAndroid && window.IPTVAndroid.updateApk) {
            window.IPTVAndroid.updateApk(downloadUrl);
        } else {
            window.location.href = downloadUrl;
        }
    };
    miniPlayerButton.onclick = function () {
        if (previewedChannelIndex !== null) {
            playChannel(previewedChannelIndex);
        }
    };
    document.getElementById("refresh-app-page").onclick = function () {
        window.location.reload();
    };
    miniPlayerButton.onfocus = function () {
        liveFocusPane = "preview";
        updateFocusedStyle();
    };
    closeButton.onclick = closePlayer;
    closeButton.onkeydown = function (event) {
        var keyCode = event.keyCode || event.which;
        if (keyCode === 13) {
            event.preventDefault();
            event.stopPropagation();
            closePlayer();
        }
    };
    catalogSearch.onfocus = function () {
        liveFocusPane = "search";
    };
    catalogSearch.oninput = function () {
        focusedIndex = 0;
        renderChannels();
    };
    miniVideo.onplaying = function () {
        if (previewedChannelIndex !== null) {
            miniPlayerStage.className = "mini-player-stage has-preview";
        }
    };
    miniVideo.onerror = function () {
        if (previewedChannelIndex !== null) {
            miniPlayerEmpty.textContent = "Prévia indisponível";
            miniPlayerStage.className = "mini-player-stage";
        }
    };
    videoPlayer.onloadedmetadata = restorePlaybackPosition;
    videoPlayer.ontimeupdate = function () {
        savePlaybackProgress(false);
    };
    videoPlayer.onpause = function () {
        savePlaybackProgress(true);
        refreshSeriesContinueButton();
    };
    videoPlayer.onended = function () {
        savePlaybackProgress(true);
        refreshSeriesContinueButton();
        if (catalogMode === "movies") {
            refreshVodCatalog();
        }
    };
    playerScreen.onmousemove = showPlayerControls;
    playerScreen.onclick = showPlayerControls;
    playerScreen.ontouchstart = showPlayerControls;

    bindDashboardTiles();
    updateClock();
    window.setInterval(updateClock, 60000);
    deviceIdentifier = getDeviceIdentifier();
    deviceIdLabel.textContent = "ID: " + deviceIdentifier;
    setAppOrientation("portrait");
    setAccountName("");
    try {
        window.localStorage.removeItem("iptvLabAccount");
    } catch (error) {
        showDashboardNotice("cache-error");
    }
    checkManagedDevice();
}());