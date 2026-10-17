(function () {
    "use strict";

    var apiUrl = "api.php";
    var csrfToken = "";
    var devicesCache = [];
    var activePage = "dashboard";
    var pageTitles = {
        dashboard: "Visão geral",
        devices: "Gerenciar apps",
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
        if (page === "devices") {
            loadDevices(document.getElementById("device-search").value);
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
        if (Number(device.enabled) !== 1) {
            return { label: "Bloqueado", className: "blocked" };
        }
        return { label: "Ativo", className: "" };
    }

    function makeTable(devices) {
        var html = '<table><thead><tr><th>Identificador</th><th>Nome</th><th>Usuário</th><th>Status</th><th>Ação</th></tr></thead><tbody>';
        var index;
        var device;
        var status;
        if (!devices.length) {
            return '<div class="empty-state">Nenhum aparelho para exibir.</div>';
        }
        for (index = 0; index < devices.length; index += 1) {
            device = devices[index];
            status = getDeviceStatus(device);
            html += "<tr><td><span class=\"device-id\">" + escapeText(device.device_id) + "</span></td>" +
                "<td>" + escapeText(device.display_name) + "</td>" +
                "<td>" + escapeText(device.username) + "</td>" +
                "<td><span class=\"status-pill " + status.className + "\">" + status.label + "</span></td>" +
                "<td><button class=\"table-action\" type=\"button\" data-edit-device=\"" +
                escapeText(device.device_id) + "\">Configurar</button> " +
                "<button class=\"table-action danger\" type=\"button\" data-delete-device=\"" +
                escapeText(device.device_id) + "\" data-delete-pending=\"false\">Excluir</button></td></tr>";
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
                escapeText(device.device_id) + "\">Configurar app</button> " +
                "<button class=\"table-action danger\" type=\"button\" data-delete-device=\"" +
                escapeText(device.device_id) + "\" data-delete-pending=\"true\">Excluir</button></td></tr>";
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

    function bindDeleteButtons(container) {
        Array.prototype.forEach.call(container.querySelectorAll("[data-delete-device]"), function (button) {
            button.addEventListener("click", function () {
                var deviceId = button.getAttribute("data-delete-device");
                var isPending = button.getAttribute("data-delete-pending") === "true";
                var message = isPending ?
                    "Excluir o registro pendente deste app? Ele será removido da lista de novos apps." :
                    "Excluir este aparelho e apagar sua configuração, credenciais e histórico de renovações?";
                if (!window.confirm(message)) {
                    return;
                }
                request("admin_device_delete", { deviceId: deviceId }).then(function () {
                    notify("Registro excluído. Se o app voltar a se conectar, poderá aparecer novamente como pendente.");
                    loadDevices(document.getElementById("device-search").value);
                    loadDashboard();
                }).catch(showError);
            });
        });
    }

    function loadDashboard() {
        request("admin_dashboard").then(function (result) {
            setText("stat-total", result.counts.total);
            setText("stat-active", result.counts.active);
            setText("stat-blocked", result.counts.blocked);
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
            pendingContainer.innerHTML = makePendingTable(result.pendingDevices || []);
            bindPendingButtons(pendingContainer);
            bindDeleteButtons(pendingContainer);
            devicesContainer.innerHTML = makeTable(devicesCache);
            bindEditButtons(devicesContainer);
            bindDeleteButtons(devicesContainer);
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
        deviceForm.dataset.hasPassword = "false";
        document.getElementById("device-dialog-title").textContent = deviceId ? "Configurar novo app" : "Adicionar app";
        document.getElementById("device-form-error").textContent = "";
        deviceForm.elements.username.required = true;
        deviceForm.elements.password.required = true;
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
            deviceForm.elements.providerUrl.value = device.provider_url || "";
            deviceFormHasPassword = !!device.has_password;
            deviceForm.dataset.hasPassword = deviceFormHasPassword ? "true" : "false";
            deviceForm.elements.enabled.checked = Number(device.enabled) === 1;
            document.getElementById("device-dialog-title").textContent = "Configurar app";
            document.getElementById("device-form-error").textContent = "";
            deviceForm.elements.username.required = true;
            deviceForm.elements.password.required = !deviceFormHasPassword;
            deviceDialog.showModal();
        }).catch(showError);
    }

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
    document.getElementById("close-device-dialog").addEventListener("click", function () {
        deviceDialog.close();
    });

    deviceForm.addEventListener("submit", function (event) {
        event.preventDefault();
        var formData = new FormData(deviceForm);
        var payload = {
            deviceId: String(formData.get("deviceId") || "").trim(),
            name: String(formData.get("name") || "").trim(),
            username: String(formData.get("username") || "").trim(),
            password: String(formData.get("password") || ""),
            providerUrl: String(formData.get("providerUrl") || "").trim(),
            enabled: deviceForm.elements.enabled.checked
        };
        document.getElementById("device-form-error").textContent = "";
        request("admin_device_save", payload).then(function () {
            deviceDialog.close();
            notify(editingDeviceId ? "Aparelho atualizado." : "Aparelho cadastrado.");
            loadDevices(activePage === "devices" ? document.getElementById("device-search").value : "");
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
