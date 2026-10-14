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

    function bindEditButtons(container) {
        Array.prototype.forEach.call(container.querySelectorAll("[data-edit-device]"), function (button) {
            button.addEventListener("click", function () {
                editDevice(button.getAttribute("data-edit-device"));
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
            } else {
                document.getElementById("current-release").textContent = "Nenhuma versão publicada.";
            }
        }).catch(showError);
    }

    function loadDevices(search) {
        request("admin_devices", { search: search || "" }).then(function (result) {
            devicesCache = result.devices || [];
            var devicesContainer = document.getElementById("devices-table");
            var expiringContainer = document.getElementById("dashboard-expiring");
            var expiryContainer = document.getElementById("expiry-table");
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

    function openNewDevice() {
        editingDeviceId = "";
        deviceForm.reset();
        deviceForm.elements.deviceId.readOnly = false;
        deviceForm.elements.enabled.checked = true;
        deviceForm.elements.expiresOn.value = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
        document.getElementById("device-dialog-title").textContent = "Adicionar app";
        document.getElementById("device-form-error").textContent = "";
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
            deviceForm.elements.expiresOn.value = device.expires_on;
            deviceForm.elements.enabled.checked = Number(device.enabled) === 1;
            deviceForm.elements.amount.value = "";
            deviceForm.elements.paymentReference.value = "";
            document.getElementById("device-dialog-title").textContent = "Editar / renovar app";
            document.getElementById("device-form-error").textContent = "";
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
    document.getElementById("new-device-button").addEventListener("click", openNewDevice);
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

    document.getElementById("panel-date").textContent =
        new Intl.DateTimeFormat("pt-BR", { dateStyle: "full" }).format(new Date());
    request("admin_session").then(function (result) {
        if (!result.authenticated) {
            showLogin("");
            return;
        }
        csrfToken = result.csrfToken;
        showAdmin();
    }).catch(function (error) {
        showLogin(error.message);
    });
}());
