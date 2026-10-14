package com.iptv.lab;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.graphics.Color;
import android.content.Intent;
import android.content.IntentFilter;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final int INSTALL_PERMISSION_REQUEST = 3041;
    private WebView webView;
    private long pendingDownloadId = -1;
    private DownloadManager downloadManager;
    private BroadcastReceiver downloadReceiver;

    private final class AppBridge {
        @JavascriptInterface
        public void openSupport(String url) {
            runOnUiThread(() -> openSupportLink(url));
        }

        @JavascriptInterface
        public void updateApk(String url) {
            runOnUiThread(() -> startApkDownload(url));
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        getWindow().setStatusBarColor(Color.rgb(3, 9, 22));
        getWindow().setNavigationBarColor(Color.rgb(3, 9, 22));
        downloadManager = (DownloadManager) getSystemService(DOWNLOAD_SERVICE);
        registerUpdateReceiver();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(3, 9, 22));

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient());
        webView.addJavascriptInterface(new AppBridge(), "IPTVAndroid");
        setContentView(webView);
        webView.loadUrl("file:///android_asset/www/index.html");
    }

    private void openSupportLink(String url) {
        Uri uri = Uri.parse(url);
        String host = uri.getHost();
        if (!"https".equalsIgnoreCase(uri.getScheme()) ||
                host == null ||
                !("wa.me".equalsIgnoreCase(host) || host.endsWith(".whatsapp.com") ||
                        "whatsapp.com".equalsIgnoreCase(host))) {
            Toast.makeText(this, "Endereço de suporte inválido.", Toast.LENGTH_LONG).show();
            return;
        }

        try {
            startActivity(new Intent(Intent.ACTION_VIEW, uri));
        } catch (RuntimeException error) {
            Toast.makeText(this, "Não foi possível abrir o WhatsApp.", Toast.LENGTH_LONG).show();
        }
    }

    private void registerUpdateReceiver() {
        downloadReceiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context context, Intent intent) {
                long downloadId = intent.getLongExtra(DownloadManager.EXTRA_DOWNLOAD_ID, -1);
                if (downloadId == pendingDownloadId) {
                    installDownloadedApk(downloadId);
                }
            }
        };

        IntentFilter filter = new IntentFilter(DownloadManager.ACTION_DOWNLOAD_COMPLETE);
        if (Build.VERSION.SDK_INT >= 33) {
            registerReceiver(downloadReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            registerReceiver(downloadReceiver, filter);
        }
    }

    private void startApkDownload(String url) {
        Uri uri = Uri.parse(url);
        if (!"https".equalsIgnoreCase(uri.getScheme()) ||
                !"iptv.esis.com.br".equalsIgnoreCase(uri.getHost()) ||
                !"/download.php".equals(uri.getPath())) {
            Toast.makeText(this, "Endereço de atualização inválido.", Toast.LENGTH_LONG).show();
            return;
        }

        try {
            DownloadManager.Request request = new DownloadManager.Request(uri);
            request.setMimeType("application/vnd.android.package-archive");
            request.setTitle("Atualização IPTV Lab");
            request.setDescription("Baixando o novo aplicativo");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setAllowedOverMetered(true);
            request.setAllowedOverRoaming(false);
            request.setDestinationInExternalFilesDir(
                    this, Environment.DIRECTORY_DOWNLOADS, "iptv-lab-update.apk");
            pendingDownloadId = downloadManager.enqueue(request);
            Toast.makeText(this, "Baixando atualização. Você receberá uma notificação.", Toast.LENGTH_LONG).show();
        } catch (RuntimeException error) {
            Toast.makeText(this, "Não foi possível iniciar o download da atualização.", Toast.LENGTH_LONG).show();
        }
    }

    private void installDownloadedApk(long downloadId) {
        if (downloadManager == null) {
            Toast.makeText(this, "Gerenciador de downloads indisponível.", Toast.LENGTH_LONG).show();
            return;
        }

        DownloadManager.Query query = new DownloadManager.Query().setFilterById(downloadId);
        android.database.Cursor cursor = downloadManager.query(query);
        if (cursor == null) {
            Toast.makeText(this, "Não foi possível verificar o arquivo baixado.", Toast.LENGTH_LONG).show();
            return;
        }

        boolean successful = false;
        try {
            successful = cursor.moveToFirst() &&
                    cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS)) ==
                            DownloadManager.STATUS_SUCCESSFUL;
        } finally {
            cursor.close();
        }
        if (!successful) {
            Toast.makeText(this, "O download falhou. Tente novamente.", Toast.LENGTH_LONG).show();
            return;
        }

        if (Build.VERSION.SDK_INT >= 26 && !getPackageManager().canRequestPackageInstalls()) {
            Intent permissionIntent = new Intent(
                    Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                    Uri.parse("package:" + getPackageName()));
            startActivityForResult(permissionIntent, INSTALL_PERMISSION_REQUEST);
            Toast.makeText(this, "Permita instalar atualizações desta origem para continuar.", Toast.LENGTH_LONG).show();
            return;
        }
        openDownloadedApk(downloadId);
    }

    private void openDownloadedApk(long downloadId) {
        Uri apkUri = downloadManager.getUriForDownloadedFile(downloadId);
        if (apkUri == null) {
            Toast.makeText(this, "O arquivo de atualização não está disponível.", Toast.LENGTH_LONG).show();
            return;
        }

        Intent installIntent = new Intent(Intent.ACTION_VIEW);
        installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
        installIntent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        try {
            startActivity(installIntent);
        } catch (RuntimeException error) {
            Toast.makeText(this, "Não foi possível abrir o instalador do Android.", Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == INSTALL_PERMISSION_REQUEST && pendingDownloadId >= 0) {
            if (Build.VERSION.SDK_INT < 26 || getPackageManager().canRequestPackageInstalls()) {
                openDownloadedApk(pendingDownloadId);
            } else {
                Toast.makeText(this, "A permissão é necessária para instalar a atualização.", Toast.LENGTH_LONG).show();
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }

        String backAction = "(function(){"
                + "var active=document.querySelector('#vod-detail-screen.is-visible,#player-screen.is-visible');"
                + "var inLive=document.body.classList.contains('live-mode');"
                + "if(active||inLive){document.dispatchEvent(new KeyboardEvent('keydown',"
                + "{key:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true}));return true;}"
                + "return false;"
                + "})();";
        webView.evaluateJavascript(backAction, result -> {
            if ("false".equals(result)) {
                MainActivity.super.onBackPressed();
            }
        });
    }

    @Override
    protected void onDestroy() {
        if (downloadReceiver != null) {
            unregisterReceiver(downloadReceiver);
            downloadReceiver = null;
        }
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
