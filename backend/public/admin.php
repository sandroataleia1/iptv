<?php

header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('Referrer-Policy: no-referrer');
header("Content-Security-Policy: default-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'");
header('Cache-Control: no-store');

?>
<!DOCTYPE html>
<html lang="pt-BR">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="robots" content="noindex, nofollow">
    <title>Painel IPTV Lab</title>
    <link rel="stylesheet" href="admin.css">
</head>
<body>
    <section id="login-screen" class="login-screen" hidden>
        <form id="login-form" class="login-card">
            <span class="brand-mark">IPTV LAB</span>
            <h1>Painel administrativo</h1>
            <p>Acesse para gerenciar aparelhos, vencimentos e atualizações.</p>
            <label for="login-password">Senha administrativa</label>
            <input id="login-password" type="password" autocomplete="current-password" required>
            <button class="button primary" type="submit">Entrar</button>
            <p id="login-error" class="feedback" role="status"></p>
        </form>
    </section>

    <div id="admin-app" class="admin-app" hidden>
        <aside class="sidebar">
            <a class="brand" href="#dashboard"><span class="brand-mark">IPTV</span><span>IPTV <b>LAB</b></span></a>
            <nav aria-label="Navegação administrativa">
                <button class="nav-link is-active" type="button" data-page="dashboard">Visão geral</button>
                <button class="nav-link" type="button" data-page="devices">Gerenciar apps</button>
                <button class="nav-link" type="button" data-page="expiry">Vencimentos</button>
                <button class="nav-link" type="button" data-page="release">Atualização do app</button>
                <button class="nav-link" type="button" data-page="settings">Configurações</button>
            </nav>
            <button id="logout-button" class="nav-link logout-button" type="button">Sair</button>
        </aside>

        <main class="main-content">
            <header class="page-top">
                <div>
                    <p class="eyebrow">IPTV LAB · ADMINISTRAÇÃO</p>
                    <h1 id="page-title">Visão geral</h1>
                </div>
                <span id="panel-date" class="panel-date"></span>
            </header>
            <p id="global-feedback" class="global-feedback" role="status" aria-live="polite"></p>

            <section class="page is-visible" data-view="dashboard">
                <div class="stats-grid">
                    <article class="stat-card"><span>Aplicativos cadastrados</span><strong id="stat-total">—</strong></article>
                    <article class="stat-card"><span>Ativos</span><strong id="stat-active">—</strong></article>
                    <article class="stat-card warning"><span>Vencem em até 5 dias</span><strong id="stat-expiring">—</strong></article>
                    <article class="stat-card expired"><span>Vencidos</span><strong id="stat-expired">—</strong></article>
                </div>
                <article class="card">
                    <div class="card-heading"><div><h2>Vencimentos próximos</h2><p>Aparelhos que precisam de renovação.</p></div><button class="button secondary" type="button" data-go="expiry">Ver vencimentos</button></div>
                    <div id="dashboard-expiring" class="table-wrap"></div>
                </article>
                <article class="card">
                    <div class="card-heading"><div><h2>Servidor IPTV</h2><p>O endereço padrão vale para todas as contas.</p></div><button class="button secondary" type="button" data-go="settings">Configurar</button></div>
                    <code id="dashboard-provider" class="provider-value">Não configurado</code>
                </article>
            </section>

            <section class="page" data-view="devices">
                <article class="card">
                    <div class="card-heading device-toolbar">
                        <div><h2>Aplicativos cadastrados</h2><p>Busque pelo identificador exclusivo exibido no aparelho.</p></div>
                        <button id="new-device-button" class="button primary" type="button">Adicionar app</button>
                    </div>
                    <label class="search-field" for="device-search"><span>Buscar</span><input id="device-search" type="search" placeholder="Identificador, nome ou usuário"></label>
                    <div id="devices-table" class="table-wrap"></div>
                </article>
            </section>

            <section class="page" data-view="expiry">
                <article class="card">
                    <div class="card-heading"><div><h2>Controle de vencimentos</h2><p>Edite um aparelho para renovar a data e registrar o pagamento.</p></div></div>
                    <div id="expiry-table" class="table-wrap"></div>
                </article>
                <article class="card">
                    <div class="card-heading"><div><h2>Histórico de renovações</h2><p>Últimas renovações e referências de pagamento registradas.</p></div></div>
                    <div id="renewals-table" class="table-wrap"></div>
                </article>
            </section>

            <section class="page" data-view="release">
                <article class="card form-card">
                    <h2>Publicar nova versão</h2>
                    <p>O app verificará esta versão ao iniciar e exibirá o botão de atualização nos aparelhos cadastrados.</p>
                    <div id="current-release" class="release-summary">Nenhuma versão publicada.</div>
                    <div id="public-download" class="public-download" hidden>
                        <label for="public-download-url">Link público para baixar o app</label>
                        <div class="public-download-controls">
                            <input id="public-download-url" type="url" readonly>
                            <button id="copy-public-download" class="button secondary" type="button">Copiar link</button>
                            <a id="open-public-download" class="button primary" href="public-download.php">Baixar APK</a>
                        </div>
                        <p>Qualquer pessoa com este link pode baixar a versão mais recente, sem entrar no painel.</p>
                    </div>
                    <form id="release-form" class="form-grid">
                        <label>Versão do APK<input name="version" placeholder="1.0.1" pattern="\d+\.\d+\.\d+([+-][a-zA-Z0-9.-]+)?" required></label>
                        <label class="full-width">Novidades<textarea name="notes" rows="3" maxlength="2000" placeholder="Correções e melhorias desta versão"></textarea></label>
                        <label class="full-width">Arquivo APK<input name="apk" type="file" accept=".apk,application/vnd.android.package-archive" required></label>
                        <button class="button primary full-width" type="submit">Enviar atualização</button>
                    </form>
                </article>
            </section>

            <section class="page" data-view="settings">
                <article class="card form-card">
                    <h2>Configurações gerais</h2>
                    <p>Estas informações são usadas por todos os aparelhos ativos.</p>
                    <form id="settings-form" class="form-grid">
                        <label class="full-width">URL padrão do servidor IPTV<input name="providerUrl" type="url" placeholder="https://servidor-iptv.example" required></label>
                        <label>Chave ou código Pix<input name="pixKey" maxlength="190" autocomplete="off"></label>
                        <label>WhatsApp de suporte<input name="whatsapp" type="tel" inputmode="tel" placeholder="5511999999999"></label>
                        <p class="field-hint full-width">Use o WhatsApp com código do país e DDD, somente números. O app exibirá atalhos de Pix e contato para aparelhos próximos do vencimento ou vencidos.</p>
                        <button class="button primary full-width" type="submit">Salvar configurações</button>
                    </form>
                </article>
            </section>
        </main>
    </div>

    <dialog id="device-dialog" class="device-dialog">
        <form id="device-form" class="form-grid">
            <div class="dialog-heading full-width"><div><p class="eyebrow">APARELHO</p><h2 id="device-dialog-title">Adicionar app</h2></div><button id="close-device-dialog" class="icon-button" type="button" aria-label="Fechar">×</button></div>
            <label class="full-width">Identificador exclusivo<input name="deviceId" required pattern="[0-9a-fA-F-]{36}" placeholder="UUID exibido no app" autocomplete="off"></label>
            <label>Nome do aparelho<input name="name" required maxlength="120" placeholder="Cliente / dispositivo"></label>
            <label>Usuário IPTV<input name="username" required maxlength="190" autocomplete="off"></label>
            <label class="full-width">Senha IPTV<input name="password" type="password" autocomplete="new-password"><small>Em uma edição, deixe em branco para manter a senha atual.</small></label>
            <label>Vencimento<input name="expiresOn" type="date" required></label>
            <label>Valor da renovação<input name="amount" type="number" min="0" step="0.01" placeholder="Opcional"></label>
            <label class="full-width">Referência do pagamento<input name="paymentReference" maxlength="190" placeholder="Opcional"></label>
            <label class="enabled-toggle full-width"><input name="enabled" type="checkbox" checked> Acesso liberado</label>
            <p id="device-form-error" class="form-error full-width" role="status"></p>
            <button class="button primary full-width" type="submit">Salvar aparelho</button>
        </form>
    </dialog>

    <script src="admin.js"></script>
</body>
</html>
