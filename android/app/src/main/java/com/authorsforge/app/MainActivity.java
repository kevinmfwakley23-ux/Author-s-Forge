package com.authorsforge.app;

import android.Manifest;
import android.app.Activity;
import android.app.DownloadManager;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.Settings;
import android.view.Gravity;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.DownloadListener;
import android.webkit.SslErrorHandler;
import android.webkit.URLUtil;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.TextView;
import android.widget.Toast;

public final class MainActivity extends Activity {
    private static final String PREFS = "authors-forge";
    private static final String PREF_ORIGIN = "forge-origin";
    private static final int FILE_CHOOSER_REQUEST = 5101;
    private static final int STORAGE_PERMISSION_REQUEST = 5102;

    private SharedPreferences preferences;
    private WebView webView;
    private ValueCallback<Uri[]> fileCallback;
    private PendingDownload pendingDownload;
    private Uri configuredOrigin;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        preferences = getSharedPreferences(PREFS, MODE_PRIVATE);
        String initial = preferences.getString(PREF_ORIGIN, "");
        if ((initial == null || initial.isBlank()) && !BuildConfig.FORGE_DEFAULT_URL.isBlank()) initial = BuildConfig.FORGE_DEFAULT_URL;
        if (initial != null && !initial.isBlank()) {
            try {
                configureAndLoad(initial);
                return;
            } catch (IllegalArgumentException ignored) {
                preferences.edit().remove(PREF_ORIGIN).apply();
            }
        }
        showServerSetup(null);
    }

    private void showServerSetup(String error) {
        if (webView != null) {
            webView.destroy();
            webView = null;
        }
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setGravity(Gravity.CENTER_HORIZONTAL);
        root.setPadding(dp(28), dp(48), dp(28), dp(24));
        root.setBackgroundColor(Color.rgb(247, 245, 239));

        TextView crown = new TextView(this);
        crown.setText("♛");
        crown.setTextSize(46);
        crown.setTextColor(Color.rgb(170, 132, 26));
        crown.setGravity(Gravity.CENTER);
        root.addView(crown, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView title = new TextView(this);
        title.setText("Author's Forge");
        title.setTextSize(28);
        title.setTextColor(Color.rgb(18, 18, 18));
        title.setGravity(Gravity.CENTER);
        title.setPadding(0, dp(4), 0, dp(12));
        root.addView(title, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        TextView explanation = new TextView(this);
        explanation.setText("Enter the HTTPS address of your hosted Forge once. The app remembers it, so normal use never requires localhost, Termux, Node, or another launcher on this phone. You may paste a one-time ?access= bootstrap URL; the token is used for that load but is not stored by the native app.");
        explanation.setTextSize(16);
        explanation.setTextColor(Color.rgb(55, 55, 55));
        explanation.setPadding(0, 0, 0, dp(18));
        root.addView(explanation, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        if (error != null && !error.isBlank()) {
            TextView errorView = new TextView(this);
            errorView.setText(error);
            errorView.setTextColor(Color.rgb(150, 25, 25));
            errorView.setPadding(0, 0, 0, dp(12));
            root.addView(errorView, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));
        }

        EditText url = new EditText(this);
        url.setSingleLine(true);
        url.setHint("https://your-forge.example.com/");
        url.setInputType(android.text.InputType.TYPE_CLASS_TEXT | android.text.InputType.TYPE_TEXT_VARIATION_URI);
        root.addView(url, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)));

        Button connect = new Button(this);
        connect.setText("Open Forge");
        LinearLayout.LayoutParams buttonParams = new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54));
        buttonParams.topMargin = dp(14);
        root.addView(connect, buttonParams);
        connect.setOnClickListener(view -> {
            try {
                configureAndLoad(url.getText().toString());
            } catch (IllegalArgumentException exception) {
                showServerSetup(exception.getMessage());
            }
        });

        TextView security = new TextView(this);
        security.setText("Production builds accept HTTPS only. Provider keys, GitHub credentials, and sandbox secrets remain on the Forge server—not in this APK.");
        security.setTextSize(13);
        security.setTextColor(Color.DKGRAY);
        security.setPadding(0, dp(18), 0, 0);
        root.addView(security, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT));

        setContentView(root);
    }

    private void configureAndLoad(String suppliedUrl) {
        Uri supplied = parseAllowedServer(suppliedUrl);
        configuredOrigin = originOf(supplied);
        preferences.edit().putString(PREF_ORIGIN, configuredOrigin.toString()).apply();
        showWebView(supplied);
    }

    private void showWebView(Uri firstLoad) {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.rgb(247, 245, 239));
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setSupportMultipleWindows(false);
        settings.setMediaPlaybackRequiresUserGesture(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUserAgentString(settings.getUserAgentString() + " AuthorsForgeAndroid/0.1");
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) WebView.startSafeBrowsing(this, null);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);

        CookieManager cookies = CookieManager.getInstance();
        cookies.setAcceptCookie(true);
        cookies.setAcceptThirdPartyCookies(webView, false);

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleNavigation(request.getUrl());
            }

            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                return handleNavigation(Uri.parse(url));
            }

            @Override
            public void onReceivedSslError(WebView view, SslErrorHandler handler, SslError error) {
                handler.cancel();
                Toast.makeText(MainActivity.this, "Forge refused an invalid HTTPS certificate.", Toast.LENGTH_LONG).show();
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                Intent intent;
                try {
                    intent = params.createIntent();
                } catch (RuntimeException exception) {
                    fileCallback = null;
                    return false;
                }
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                    return true;
                } catch (ActivityNotFoundException exception) {
                    fileCallback = null;
                    Toast.makeText(MainActivity.this, "No file picker is available on this device.", Toast.LENGTH_LONG).show();
                    return false;
                }
            }
        });

        webView.setDownloadListener(new ForgeDownloadListener());
        setContentView(webView);
        webView.loadUrl(firstLoad.toString());
    }

    private boolean handleNavigation(Uri uri) {
        if (sameOrigin(uri, configuredOrigin)) return false;
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (scheme.equals("https") || scheme.equals("http")) {
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri));
            } catch (ActivityNotFoundException exception) {
                Toast.makeText(this, "No browser is available for this external link.", Toast.LENGTH_LONG).show();
            }
        }
        return true;
    }

    private final class ForgeDownloadListener implements DownloadListener {
        @Override
        public void onDownloadStart(String url, String userAgent, String contentDisposition, String mimeType, long contentLength) {
            Uri uri = Uri.parse(url);
            if (!sameOrigin(uri, configuredOrigin)) {
                Toast.makeText(MainActivity.this, "Blocked download from an untrusted origin.", Toast.LENGTH_LONG).show();
                return;
            }
            PendingDownload download = new PendingDownload(url, userAgent, contentDisposition, mimeType);
            if (Build.VERSION.SDK_INT <= Build.VERSION_CODES.P && checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                pendingDownload = download;
                requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, STORAGE_PERMISSION_REQUEST);
                return;
            }
            enqueueDownload(download);
        }
    }

    private void enqueueDownload(PendingDownload download) {
        try {
            Uri uri = Uri.parse(download.url);
            DownloadManager.Request request = new DownloadManager.Request(uri);
            String cookie = CookieManager.getInstance().getCookie(download.url);
            if (cookie != null && !cookie.isBlank()) request.addRequestHeader("Cookie", cookie);
            if (download.userAgent != null && !download.userAgent.isBlank()) request.addRequestHeader("User-Agent", download.userAgent);
            if (download.mimeType != null && !download.mimeType.isBlank()) request.setMimeType(download.mimeType);
            String filename = URLUtil.guessFileName(download.url, download.contentDisposition, download.mimeType);
            request.setTitle(filename);
            request.setDescription("Author's Forge export");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, filename);
            DownloadManager manager = (DownloadManager) getSystemService(Context.DOWNLOAD_SERVICE);
            manager.enqueue(request);
            Toast.makeText(this, "Forge export is downloading.", Toast.LENGTH_SHORT).show();
        } catch (RuntimeException exception) {
            Toast.makeText(this, "Download failed: " + exception.getMessage(), Toast.LENGTH_LONG).show();
        }
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != FILE_CHOOSER_REQUEST || fileCallback == null) return;
        Uri[] result = WebChromeClient.FileChooserParams.parseResult(resultCode, data);
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != STORAGE_PERMISSION_REQUEST || pendingDownload == null) return;
        PendingDownload download = pendingDownload;
        pendingDownload = null;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) enqueueDownload(download);
        else Toast.makeText(this, "Storage permission is required to save Forge exports on this Android version.", Toast.LENGTH_LONG).show();
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) webView.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        if (fileCallback != null) {
            fileCallback.onReceiveValue(null);
            fileCallback = null;
        }
        if (webView != null) {
            webView.stopLoading();
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }

    private Uri parseAllowedServer(String raw) {
        String value = raw == null ? "" : raw.trim();
        if (value.isEmpty()) throw new IllegalArgumentException("Enter your hosted Forge HTTPS address.");
        Uri uri = Uri.parse(value);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        String host = uri.getHost();
        if (host == null || host.isBlank()) throw new IllegalArgumentException("Forge server URL must include a valid host.");
        if (!scheme.equals("https")) {
            if (!(BuildConfig.DEBUG && scheme.equals("http") && isPrivateDevelopmentHost(host))) {
                throw new IllegalArgumentException("Production Author's Forge requires HTTPS. Cleartext HTTP is permitted only in debug builds on loopback/private development hosts.");
            }
        }
        if (uri.getUserInfo() != null) throw new IllegalArgumentException("Do not place usernames or passwords in the Forge server URL.");
        return uri;
    }

    private static Uri originOf(Uri uri) {
        Uri.Builder builder = new Uri.Builder().scheme(uri.getScheme()).encodedAuthority(uri.getEncodedAuthority());
        return builder.build();
    }

    private static boolean sameOrigin(Uri candidate, Uri origin) {
        if (candidate == null || origin == null) return false;
        return safeEquals(candidate.getScheme(), origin.getScheme()) && safeEquals(candidate.getHost(), origin.getHost()) && effectivePort(candidate) == effectivePort(origin);
    }

    private static int effectivePort(Uri uri) {
        if (uri.getPort() >= 0) return uri.getPort();
        return "https".equalsIgnoreCase(uri.getScheme()) ? 443 : "http".equalsIgnoreCase(uri.getScheme()) ? 80 : -1;
    }

    private static boolean safeEquals(String left, String right) {
        return left != null && right != null && left.equalsIgnoreCase(right);
    }

    private static boolean isPrivateDevelopmentHost(String host) {
        String normalized = host.toLowerCase();
        if (normalized.equals("localhost") || normalized.equals("127.0.0.1") || normalized.equals("::1")) return true;
        if (normalized.startsWith("10.")) return true;
        if (normalized.startsWith("192.168.")) return true;
        if (normalized.startsWith("172.")) {
            String[] parts = normalized.split("\\.");
            if (parts.length > 1) {
                try {
                    int second = Integer.parseInt(parts[1]);
                    return second >= 16 && second <= 31;
                } catch (NumberFormatException ignored) {}
            }
        }
        return false;
    }

    private int dp(int value) {
        return Math.round(value * getResources().getDisplayMetrics().density);
    }

    private static final class PendingDownload {
        final String url;
        final String userAgent;
        final String contentDisposition;
        final String mimeType;

        PendingDownload(String url, String userAgent, String contentDisposition, String mimeType) {
            this.url = url;
            this.userAgent = userAgent;
            this.contentDisposition = contentDisposition;
            this.mimeType = mimeType;
        }
    }
}
