(function () {
    "use strict";

    var apiUrl = "api.php";
    var csrfToken = "";
    var devicesCache = [];
    var activePage = "dashboard";
    var pageTitles = {
        dashboard: "Visão geral",
        devices: "Gerenciar apps",
        expiry: "Vencimentos",
        release: "Atualização do app",
        settings: "Configurações"
    };
    var loginScreen = document.getElementById("login-screen");
    var adminApp = document.getElementById("admin-app");
    var globalFeedback = document.getElementById("global-feedback");
    var deviceDialog = document.getElementById("device-dialog");
    var deviceForm = document.getElementById("device-form");
    var editingDeviceId = "";
    var feedbackTimer = null;
    var deviceFormHasPassword = false;

    function request(action, data) {
        var body = data || {};
        if (action !== "admin_session" && action !== "admin_login") {
            body.csrfToken = csrfToken;
        }
        return fetch(apiUrl + "?action=" + encodeURIComponent(action), {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }).then(function (response) {
            return response.json().catch(function () {
                throw new Error("Resposta inválida do servidor.");
            }).then(function (result) {
                if (!response.ok) {
                    if (response.status === 401 && action !== "admin_login") {
                        showLogin();
                    }
                    throw new Error(result.error || "Não foi possível concluir a solicitação.");
                }
                return result;
            });
        });
    }

    function showLogin(message) {
        loginScreen.hidden = false;
        adminApp.hidden = true;
        document.getElementById("login-error").textContent = message || "";
    }

    function showAdmin() {
        loginScreen.hidden = true;
        adminApp.hidden = false;
        document.getElementById("panel-date").textContent =
            new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
        loadDashboard();
        loadDevices("");
    }

    function notify(message, isError) {
        globalFeedback.textContent = message || "";
        globalFeedback.className = "global-feedback" + (isError ? " is-error" : "");
        if (feedbackTimer) {
            window.clearTimeout(feedbackTimer);
        }
        if (message) {
            feedbackTimer = window.setTimeout(function () {
                globalFeedback.textContent = "";
                globalFeedback.className = "global-feedback";
            }, 6000);
        }
    }

    function switchPage(page) {
        if (!pageTitles[page]) {
            return;
        }
        activePage = page;
        document.getElementById("page-title").textContent = pageTitles[page];
        Array.prototype.forEach.call(document.querySelectorAll("[data-view]"), function (view) {
            view.classList.toggle("is-visible", view.getAttribute("data-view") === page);
        });
        Array.prototype.forEach.call(document.querySelectorAll(".nav-link[data-page]"), function (link) {
            link.classList.toggle("is-active", link.getAttribute("data-page") === page);
        });
        if (page === "devices" || page === "expiry") {
            loadDevices(page === "expiry" ? "" : document.getElementById("device-search").value);
        }
        if (page === "expiry") {
            loadRenewals();
        }
        if (page === "settings") {
            loadSettings();
        }
    }

    function setText(id, value) {
        document.getElementById(id).textContent = value === null || value === undefined || value === "" ? "—" : value;
    }

    function escapeText(value) {
        return String(value === null || value === undefined ? "" : value).replace(/[&<>"']/g, function (character) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                "\"": "&quot;",
                "'": "&#39;"
            }[character];
        });
    }

    function getDeviceStatus(device) {
        var today = new Date();
        var expiry = new Date(device.expires_on + "T23:59:59");
        var days = Math.ceil((expiry.getTime() - today.getTime()) / 86400000);
        if (Number(device.enabled) !== 1) {
            return { label: "Bloqueado", className: "blocked", days: days };
        }
        if (days < 0) {
            return { label: "Vencido", className: "expired", days: days };
        }
        if (days <= 5) {
            return { label: days === 0 ? "Vence hoje" : "Vence em " + days + " dia(s)", className: "warning", days: days };
        }
        return { label: "Ativo", className: "", days: days };
    }

    function makeTable(devices, expiryOnly) {
        var filtered = devices.slice();
        var html = '<table><thead><tr><th>Identificador</th><th>Nome</th><th>Usuário</th><th>Vencimento</th><th>Status</th><th>Ação</th></tr></thead><tbody>';
        var index;
        var device;
        var status;
        if (expiryOnly) {
            filtered = filtered.filter(function (entry) {
                var daysRemaining = getDeviceStatus(entry).days;
                return daysRemaining >= 0 && daysRemaining <= 5;
            });
        }
        if (!filtered.length) {
            return '<div class="empty-state">Nenhum aparelho para exibir.</div>';
        }
        for (index = 0; index < filtered.length; index += 1) {
            device = filtered[index];
            status = getDeviceStatus(device);
            html += "<tr><td><span class=\"device-id\">" + escapeText(device.device_id) + "</span></td>" +
                "<td>" + escapeText(device.display_name) + "</td>" +
                "<td>" + escapeText(device.username) + "</td>" +
                "<td>" + escapeText(device.expires_on) + "</td>" +
                "<td><span class=\"status-pill " + status.className + "\">" + status.label + "</span></td>" +
                "<td><button class=\"table-action\" type=\"button\" data-edit-device=\"" +
                escapeText(device.device_id) + "\">Editar / renovar</button></td></tr>";
        }
        return html + "</tbody></table>";
    }

    function makePendingTable(devices) {
        var html = '<table><thead><tr><th>Identificador</th><th>Versão do app</th><th>Primeiro contato</th><th>Último contato</th><th>Ação</th></tr></thead><tbody>';
        var index;
        var device;
        if (!devices.length) {
            return '<div class="empty-state">Nenhum app novo aguardando configuração.</div>';
        }
        for (index = 0; index < devices.length; index += 1) {
            device = devices[index];
            html += "<tr><td><span class=\"device-id\">" + escapeText(device.device_id) + "</span></td>" +
                "<td>" + escapeText(device.app_version || "—") + "</td>" +
                "<td>" + escapeText(device.first_seen || "—") + "</td>" +
                "<td>" + escapeText(device.last_seen || "—") + "</td>" +
                "<td><button class=\"table-action\" type=\"button\" data-configure-device=\"" +
                escapeText(device.device_id) + "\">Configurar app</button></td></tr>";
        }
        return html + "</tbody></table>";
    }

    function bindEditButtons(container) {
        Array.prototype.forEach.call(container.querySelectorAll("[data-edit-device]"), function (button) {
            button.addEventListener("click", function () {
                editDevice(button.getAttribute("data-edit-device"));
            });
        });
    }

    function bindPendingButtons(container) {
        Array.prototype.forEach.call(container.querySelectorAll("[data-configure-device]"), function (button) {
            button.addEventListener("click", function () {
                openNewDevice(button.getAttribute("data-configure-device"));
            });
        });
    }

    function loadDashboard() {
        request("admin_dashboard").then(function (result) {
            setText("stat-total", result.counts.total);
            setText("stat-active", result.counts.active);
            setText("stat-expiring", result.counts.expiring);
            setText("stat-expired", result.counts.expired);
            setText("dashboard-provider", result.settings.providerUrl || "Não configurado");
            if (result.release) {
                document.getElementById("current-release").textContent =
                    "Versão atual: " + result.release.version + " · Enviada em " + result.release.created_at +
                    (result.release.release_notes ? " · " + result.release.release_notes : "");
                var downloadUrl = new URL("public-download.php", window.location.href).href;
                document.getElementById("public-download").hidden = false;
                document.getElementById("public-download-url").value = downloadUrl;
                document.getElementById("open-public-download").href = downloadUrl;
            } else {
                document.getElementById("current-release").textContent = "Nenhuma versão publicada.";
                document.getElementById("public-download").hidden = true;
            }
        }).catch(showError);
    }

    function loadDevices(search) {
        request("admin_devices", { search: search || "" }).then(function (result) {
            devicesCache = result.devices || [];
            var devicesContainer = document.getElementById("devices-table");
            var pendingContainer = document.getElementById("pending-devices-table");
            var expiringContainer = document.getElementById("dashboard-expiring");
            var expiryContainer = document.getElementById("expiry-table");
            pendingContainer.innerHTML = makePendingTable(result.pendingDevices || []);
            bindPendingButtons(pendingContainer);
            devicesContainer.innerHTML = makeTable(devicesCache, false);
            expiringContainer.innerHTML = makeTable(devicesCache, true);
            expiryContainer.innerHTML = makeTable(devicesCache, false);
            bindEditButtons(devicesContainer);
            bindEditButtons(expiringContainer);
            bindEditButtons(expiryContainer);
        }).catch(showError);
    }

    function loadRenewals() {
        request("admin_renewals").then(function (result) {
            var container = document.getElementById("renewals-table");
            var entries = result.renewals || [];
            var html = '<table><thead><tr><th>Aparelho</th><th>Identificador</th><th>Vencimento anterior</th><th>Novo vencimento</th><th>Valor</th><th>Pagamento</th><th>Data do registro</th></tr></thead><tbody>';
            var index;
            var entry;
            var amount;
            if (!entries.length) {
                container.innerHTML = '<div class="empty-state">Nenhuma renovação registrada ainda.</div>';
                return;
            }
            for (index = 0; index < entries.length; index += 1) {
                entry = entries[index];
                amount = entry.amount === null ? "—" :
                    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(entry.amount));
                html += "<tr><td>" + escapeText(entry.display_name) + "</td>" +
                    "<td><span class=\"device-id\">" + escapeText(entry.device_id) + "</span></td>" +
                    "<td>" + escapeText(entry.previous_expiry) + "</td>" +
                    "<td>" + escapeText(entry.new_expiry) + "</td>" +
                    "<td>" + escapeText(amount) + "</td>" +
                    "<td>" + escapeText(entry.payment_reference || "—") + "</td>" +
                    "<td>" + escapeText(entry.created_at) + "</td></tr>";
            }
            container.innerHTML = html + "</tbody></table>";
        }).catch(showError);
    }

    function loadSettings() {
        request("admin_dashboard").then(function (result) {
            var form = document.getElementById("settings-form");
            form.elements.providerUrl.value = result.settings.providerUrl || "";
            form.elements.pixKey.value = result.settings.pixKey || "";
            form.elements.whatsapp.value = result.settings.whatsapp || "";
        }).catch(showError);
    }

    function showError(error) {
        notify(error.message || "Erro ao acessar o painel.", true);
    }

    function openNewDevice(deviceId) {
        deviceId = deviceId || "";
        editingDeviceId = "";
        deviceFormHasPassword = false;
        deviceForm.reset();
        deviceForm.elements.deviceId.value = deviceId || "";
        deviceForm.elements.deviceId.readOnly = !!deviceId;
        deviceForm.elements.name.value = deviceId ? "Novo aparelho " + deviceId.slice(0, 8) : "";
        deviceForm.elements.enabled.checked = true;
        deviceForm.elements.expiresOn.value = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        deviceForm.dataset.hasPassword = "false";
        document.getElementById("device-dialog-title").textContent = deviceId ? "Configurar novo app" : "Adicionar app";
        document.getElementById("device-form-error").textContent = "";
        document.getElementById("qr-scan-message").textContent =
            "O QR code deve conter uma URL M3U ou URL do servidor, usuário e senha.";
        updateSetupFields();
        deviceDialog.showModal();
    }

    function editDevice(deviceId) {
        request("admin_device", { deviceId: deviceId }).then(function (result) {
            var device = result.device;
            editingDeviceId = device.device_id;
            deviceForm.reset();
            deviceForm.elements.deviceId.value = device.device_id;
            deviceForm.elements.deviceId.readOnly = true;
            deviceForm.elements.name.value = device.display_name;
            deviceForm.elements.username.value = device.username;
            deviceForm.elements.password.value = "";
            deviceForm.elements.playlistUrl.value = device.playlist_url || "";
            deviceForm.elements.providerUrl.value = device.provider_url || "";
            deviceForm.elements.setupMethod.value = device.configuration_type === "m3u" ? "m3u" : "credentials";
            deviceFormHasPassword = !!device.has_password;
            deviceForm.dataset.hasPassword = deviceFormHasPassword ? "true" : "false";
            deviceForm.elements.expiresOn.value = device.expires_on;
            deviceForm.elements.enabled.checked = Number(device.enabled) === 1;
            deviceForm.elements.amount.value = "";
            deviceForm.elements.paymentReference.value = "";
            document.getElementById("device-dialog-title").textContent = "Editar / renovar app";
            document.getElementById("device-form-error").textContent = "";
            updateSetupFields();
            deviceDialog.showModal();
        }).catch(showError);
    }

    function updateSetupFields() {
        var method = deviceForm.elements.setupMethod.value;
        var credentials = method === "credentials";
        document.getElementById("qr-setup-fields").hidden = method !== "qr";
        document.getElementById("credentials-setup-fields").hidden = !credentials;
        document.getElementById("m3u-setup-fields").hidden = method !== "m3u";
        if (!credentials) {
            deviceForm.elements.providerUrl.value = "";
        }
        if (method !== "m3u") {
            deviceForm.elements.playlistUrl.value = "";
        }
        deviceForm.elements.username.required = credentials;
        deviceForm.elements.password.required = credentials && !deviceFormHasPassword;
        deviceForm.elements.playlistUrl.required = method === "m3u";
    }

    function applyQrConfiguration(rawValue) {
        var configuration = null;
        var qrText = String(rawValue || "").trim();
        var url;
        var username;
        var password;
        var playlistUrl;
        var server;
        try {
            configuration = JSON.parse(qrText);
        } catch (error) {
            configuration = null;
        }
        if (configuration && typeof configuration === "object") {
            playlistUrl = configuration.playlistUrl || configuration.playlist_url ||
                configuration.m3u || configuration.url || "";
            username = configuration.username || configuration.user || "";
            password = configuration.password || configuration.pass || "";
            server = configuration.server || configuration.serverUrl || configuration.server_url ||
                configuration.providerUrl || configuration.host || "";
            if (server) {
                try {
                    server = new URL(server).origin;
                } catch (error) {
                    server = "";
                }
            }
            if (!server && playlistUrl && username && password) {
                try {
                    server = new URL(playlistUrl).origin;
                } catch (error) {
                    server = "";
                }
            }
            if (playlistUrl && (!username || !password ||
                    /\.m3u8?(?:$|[?#])/i.test(playlistUrl) || configuration.type === "m3u")) {
                deviceForm.elements.playlistUrl.value = playlistUrl;
                deviceForm.elements.setupMethod.value = "m3u";
            } else if (username && password && server) {
                deviceForm.elements.username.value = username;
                deviceForm.elements.password.value = password;
                deviceForm.elements.providerUrl.value = server;
                deviceForm.elements.setupMethod.value = "credentials";
                deviceFormHasPassword = false;
            } else {
                showQrScanMessage("O QR code não contém um link M3U ou servidor, usuário e senha reconhecidos.", true);
                return;
            }
        } else {
            try {
                url = new URL(qrText);
            } catch (error) {
                showQrScanMessage("O QR code não contém uma URL válida.", true);
                return;
            }
            if (url.protocol !== "https:" && url.protocol !== "http:") {
                showQrScanMessage("Use um QR code com endereço http:// ou https://.", true);
                return;
            }
            username = url.searchParams.get("username") || url.searchParams.get("user") || "";
            password = url.searchParams.get("password") || url.searchParams.get("pass") || "";
            if (/\.m3u8?(?:$|[?#])/i.test(url.pathname) ||
                    (url.pathname.toLowerCase().indexOf("get.php") !== -1 && url.searchParams.has("type"))) {
                deviceForm.elements.playlistUrl.value = url.href;
                deviceForm.elements.setupMethod.value = "m3u";
            } else if (username && password) {
                deviceForm.elements.username.value = username;
                deviceForm.elements.password.value = password;
                deviceForm.elements.providerUrl.value = url.origin;
                deviceForm.elements.setupMethod.value = "credentials";
                deviceFormHasPassword = false;
            } else {
                showQrScanMessage("O QR code precisa conter o link M3U ou servidor, usuário e senha IPTV.", true);
                return;
            }
        }
        updateSetupFields();
        showQrScanMessage("QR code lido. Confira os dados e salve para configurar o aparelho.", false);
    }

    function showQrScanMessage(message, isError) {
        var label = document.getElementById("qr-scan-message");
        label.textContent = message;
        label.className = "field-hint" + (isError ? " form-error" : "");
    }

    window.onQrScanned = function (value) {
        applyQrConfiguration(value);
    };

    document.getElementById("login-form").addEventListener("submit", function (event) {
        event.preventDefault();
        request("admin_login", { password: document.getElementById("login-password").value }).then(function (result) {
            csrfToken = result.csrfToken;
            document.getElementById("login-password").value = "";
            showAdmin();
        }).catch(function (error) {
            document.getElementById("login-error").textContent = error.message;
        });
    });

    document.getElementById("logout-button").addEventListener("click", function () {
        request("admin_logout").then(function () {
            csrfToken = "";
            showLogin("");
        }).catch(showError);
    });

    Array.prototype.forEach.call(document.querySelectorAll(".nav-link[data-page]"), function (button) {
        button.addEventListener("click", function () {
            switchPage(button.getAttribute("data-page"));
        });
    });

    Array.prototype.forEach.call(document.querySelectorAll("[data-go]"), function (button) {
        button.addEventListener("click", function () {
            switchPage(button.getAttribute("data-go"));
        });
    });

    document.getElementById("device-search").addEventListener("input", function () {
        if (activePage === "devices") {
            loadDevices(document.getElementById("device-search").value);
        }
    });
    document.getElementById("new-device-button").addEventListener("click", function () {
        openNewDevice("");
    });
    deviceForm.elements.setupMethod.addEventListener("change", updateSetupFields);
    document.getElementById("scan-qr-button").addEventListener("click", function () {
        if (!window.IPTVAdmin || !window.IPTVAdmin.scanQr) {
            showQrScanMessage("A leitura por câmera está disponível no app Android de administração.", true);
            return;
        }
        showQrScanMessage("Aponte a câmera para o QR code da conta IPTV.", false);
        window.IPTVAdmin.scanQr();
    });
    document.getElementById("close-device-dialog").addEventListener("click", function () {
        deviceDialog.close();
    });

    deviceForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var formData = new FormData(deviceForm);
        var setupMethod = String(formData.get("setupMethod") || "");
        if (setupMethod === "qr") {
            document.getElementById("device-form-error").textContent = "Leia um QR code antes de salvar.";
            return;
        }
        var payload = {
            deviceId: String(formData.get("deviceId") || "").trim(),
            name: String(formData.get("name") || "").trim(),
            configurationType: setupMethod === "m3u" ? "m3u" : "xtream",
            username: String(formData.get("username") || "").trim(),
            password: String(formData.get("password") || ""),
            providerUrl: String(formData.get("providerUrl") || "").trim(),
            playlistUrl: String(formData.get("playlistUrl") || "").trim(),
            expiresOn: String(formData.get("expiresOn") || ""),
            enabled: deviceForm.elements.enabled.checked,
            amount: String(formData.get("amount") || ""),
            paymentReference: String(formData.get("paymentReference") || "")
        };
        document.getElementById("device-form-error").textContent = "";
        request("admin_device_save", payload).then(function () {
            deviceDialog.close();
            notify(editingDeviceId ? "Aparelho atualizado. Se a data foi prorrogada, a renovação foi registrada." : "Aparelho cadastrado.");
            loadDevices(activePage === "devices" ? document.getElementById("device-search").value : "");
            if (activePage === "expiry") {
                loadRenewals();
            }
            loadDashboard();
        }).catch(function (error) {
            document.getElementById("device-form-error").textContent = error.message;
        });
    });

    document.getElementById("settings-form").addEventListener("submit", function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        request("admin_settings_save", {
            providerUrl: form.elements.providerUrl.value,
            pixKey: form.elements.pixKey.value,
            whatsapp: form.elements.whatsapp.value
        }).then(function () {
            notify("Configurações salvas para todos os aparelhos.");
            loadDashboard();
        }).catch(showError);
    });

    document.getElementById("release-form").addEventListener("submit", function (event) {
        event.preventDefault();
        var form = event.currentTarget;
        var payload = new FormData(form);
        payload.append("csrfToken", csrfToken);
        fetch(apiUrl + "?action=admin_release_upload", {
            method: "POST",
            credentials: "same-origin",
            body: payload
        }).then(function (response) {
            return response.json().then(function (result) {
                if (!response.ok) {
                    throw new Error(result.error || "Não foi possível enviar o APK.");
                }
                return result;
            });
        }).then(function (result) {
            form.reset();
            notify("APK " + result.version + " publicado. O app avisará os aparelhos na próxima verificação.");
            loadDashboard();
        }).catch(showError);
    });

    document.getElementById("copy-public-download").addEventListener("click", function () {
        var downloadUrl = document.getElementById("public-download-url").value;
        if (!navigator.clipboard || !navigator.clipboard.writeText) {
            notify("Copie o link exibido no campo para compartilhar.", true);
            return;
        }
        navigator.clipboard.writeText(downloadUrl).then(function () {
            notify("Link público copiado.");
        }).catch(function () {
            notify("Não foi possível copiar automaticamente. Copie o link exibido no campo.", true);
        });
    });

    document.getElementById("panel-date").textContent =
        new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
    request("admin_session").then(function (result) {
        if (!result.authenticated) {
            showLogin("");
            return;
        }
        csrfToken = result.csrfToken;
        showAdmin();
        window.setInterval(function () {
            if (activePage === "devices") {
                loadDevices(document.getElementById("device-search").value);
            }
        }, 30000);
    }).catch(function (error) {
        showLogin(error.message);
    });
}());
