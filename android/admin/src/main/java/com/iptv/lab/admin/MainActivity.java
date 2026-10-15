package com.iptv.lab.admin;

import android.app.Activity;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.JavascriptInterface;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import com.google.zxing.integration.android.IntentIntegrator;
import com.google.zxing.integration.android.IntentResult;

import org.json.JSONObject;

public class MainActivity extends Activity {
    private static final String ADMIN_URL = "https://iptv.esis.com.br/admin.php";
    private static final String ADMIN_HOST = "iptv.esis.com.br";
    private WebView webView;

    private final class AdminBridge {
        @JavascriptInterface
        public void scanQr() {
            runOnUiThread(() -> {
                IntentIntegrator integrator = new IntentIntegrator(MainActivity.this);
                integrator.setDesiredBarcodeFormats(IntentIntegrator.QR_CODE);
                integrator.setPrompt("Escaneie o QR code da conta IPTV");
                integrator.setBeepEnabled(false);
                integrator.setOrientationLocked(false);
                integrator.initiateScan();
            });
        }
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setStatusBarColor(Color.rgb(7, 16, 29));
        getWindow().setNavigationBarColor(Color.rgb(7, 16, 29));

        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(7, 16, 29));
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setAllowFileAccess(false);
        webView.getSettings().setAllowContentAccess(false);
        webView.setWebChromeClient(new WebChromeClient());
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri uri = Uri.parse(url);
                if ("https".equalsIgnoreCase(uri.getScheme()) &&
                        ADMIN_HOST.equalsIgnoreCase(uri.getHost())) {
                    return false;
                }
                Toast.makeText(MainActivity.this, "Este endereço não é permitido no painel.", Toast.LENGTH_LONG).show();
                return true;
            }
        });
        webView.addJavascriptInterface(new AdminBridge(), "IPTVAdmin");
        setContentView(webView);
        webView.loadUrl(ADMIN_URL);
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, android.content.Intent data) {
        IntentResult result = IntentIntegrator.parseActivityResult(requestCode, resultCode, data);
        if (result != null) {
            if (result.getContents() != null && webView != null) {
                String scannedValue = JSONObject.quote(result.getContents());
                webView.evaluateJavascript("window.onQrScanned(" + scannedValue + ");", null);
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
