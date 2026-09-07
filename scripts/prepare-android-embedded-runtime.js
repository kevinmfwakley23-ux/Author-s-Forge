#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const androidApp = path.join(root, "src-tauri", "gen", "android", "app");
const nodeMobileRoot = process.env.NODEJS_MOBILE_DIR ? path.resolve(process.env.NODEJS_MOBILE_DIR) : "";
const supportedAbis = ["arm64-v8a", "armeabi-v7a", "x86_64"];

function fail(message) { throw new Error(`[Forge Android embedded runtime] ${message}`); }
function ensureFile(file, label = file) { if (!fs.existsSync(file) || !fs.statSync(file).isFile()) fail(`Missing ${label}: ${file}`); return file; }
function ensureDir(dir, label = dir) { if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) fail(`Missing ${label}: ${dir}`); return dir; }
function walk(dir, predicate, results = []) { if (!fs.existsSync(dir)) return results; for (const entry of fs.readdirSync(dir, { withFileTypes: true })) { const absolute = path.join(dir, entry.name); if (entry.isDirectory()) walk(absolute, predicate, results); else if (predicate(absolute, entry.name)) results.push(absolute); } return results; }
function replaceOnce(text, oldValue, newValue, label) { const count = text.split(oldValue).length - 1; if (count !== 1) fail(`Expected exactly one ${label}; found ${count}.`); return text.replace(oldValue, newValue); }
function copyTree(source, destination) { fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.cpSync(source, destination, { recursive: true, force: true }); }
function jniEncode(identifier) { return identifier.replace(/_/g, "_1").replace(/\./g, "_"); }

ensureDir(androidApp, "generated Tauri Android app");
ensureDir(nodeMobileRoot, "NODEJS_MOBILE_DIR");
ensureDir(path.join(root, "dist"), "compiled dist directory");
ensureDir(path.join(root, "public"), "Forge public UI");
ensureFile(path.join(root, "node_modules", "jpeg-js", "package.json"), "jpeg-js runtime dependency");

const mainActivityFiles = walk(path.join(androidApp, "src", "main", "java"), (_absolute, name) => name === "MainActivity.kt");
if (mainActivityFiles.length !== 1) fail(`Expected exactly one generated MainActivity.kt; found ${mainActivityFiles.length}.`);
const mainActivityPath = mainActivityFiles[0];
const generatedMainActivity = fs.readFileSync(mainActivityPath, "utf8");
const packageName = generatedMainActivity.match(/^package\s+([A-Za-z0-9_.]+)\s*$/m)?.[1];
if (!packageName) fail("Could not determine generated Android package name.");

const nodeHeaders = walk(nodeMobileRoot, (_absolute, name) => name === "node.h");
if (!nodeHeaders.length) fail("Node.js Mobile archive contains no node.h header.");
const preferredNodeHeader = nodeHeaders.find((file) => /[/\\]include[/\\]node[/\\]node\.h$/.test(file)) || nodeHeaders[0];
const headerSourceDir = path.dirname(preferredNodeHeader);
const headerDestination = path.join(androidApp, "libnode", "include", "node");
fs.rmSync(path.join(androidApp, "libnode"), { recursive: true, force: true });
copyTree(headerSourceDir, headerDestination);
ensureFile(path.join(headerDestination, "node.h"), "copied node.h");

for (const abi of supportedAbis) {
  const candidates = walk(nodeMobileRoot, (absolute, name) => name === "libnode.so" && absolute.includes(abi));
  if (candidates.length !== 1) fail(`Expected one libnode.so for ${abi}; found ${candidates.length}.`);
  const destination = path.join(androidApp, "src", "main", "jniLibs", abi, "libnode.so");
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(candidates[0], destination);
  if (fs.statSync(destination).size < 1024 * 1024) fail(`Embedded libnode.so for ${abi} is unexpectedly small.`);
}

const nodeProject = path.join(androidApp, "src", "main", "assets", "nodejs-project");
fs.rmSync(nodeProject, { recursive: true, force: true });
fs.mkdirSync(nodeProject, { recursive: true });
copyTree(path.join(root, "dist"), path.join(nodeProject, "dist"));
copyTree(path.join(root, "public"), path.join(nodeProject, "public"));
copyTree(path.join(root, "node_modules", "jpeg-js"), path.join(nodeProject, "node_modules", "jpeg-js"));
fs.writeFileSync(path.join(nodeProject, "main.js"), `"use strict";\nconst path = require("node:path");\nconst appDataRoot = process.argv[2];\nif (!appDataRoot) throw new Error("Author's Forge Android runtime requires the private app-data root.");\nprocess.chdir(__dirname);\nprocess.env.HOST = "127.0.0.1";\nprocess.env.PORT = "4173";\nprocess.env.FORGE_DATA_DIR = path.join(appDataRoot, "forge-data");\nprocess.env.FORGE_BACKUP_DIR = path.join(appDataRoot, "forge-backups");\nrequire("./dist/studio-server.js");\n`);
ensureFile(path.join(nodeProject, "public", "index.html"), "embedded Studio UI");

const cppDir = path.join(androidApp, "src", "main", "cpp");
fs.mkdirSync(cppDir, { recursive: true });
const jniName = `Java_${jniEncode(packageName)}_MainActivity_startNodeWithArguments`;
fs.writeFileSync(path.join(cppDir, "forge_node_bridge.cpp"), `#include <jni.h>\n#include <cstdlib>\n#include <cstring>\n#include <unistd.h>\n#include <pthread.h>\n#include <android/log.h>\n#include "node.h"\n\nnamespace {\nint stdout_pipe[2];\nint stderr_pipe[2];\nconst char* LOG_TAG = "AUTHORS_FORGE_NODE";\n\nvoid* pipe_to_log(void* raw) {\n  int fd = *static_cast<int*>(raw);\n  char buffer[2048];\n  ssize_t size;\n  while ((size = read(fd, buffer, sizeof(buffer) - 1)) > 0) {\n    if (size > 0 && buffer[size - 1] == '\\n') --size;\n    buffer[size] = 0;\n    __android_log_write(ANDROID_LOG_INFO, LOG_TAG, buffer);\n  }\n  return nullptr;\n}\n\nvoid start_log_redirect() {\n  setvbuf(stdout, nullptr, _IONBF, 0);\n  setvbuf(stderr, nullptr, _IONBF, 0);\n  if (pipe(stdout_pipe) == 0) {\n    dup2(stdout_pipe[1], STDOUT_FILENO);\n    pthread_t thread;\n    pthread_create(&thread, nullptr, pipe_to_log, &stdout_pipe[0]);\n    pthread_detach(thread);\n  }\n  if (pipe(stderr_pipe) == 0) {\n    dup2(stderr_pipe[1], STDERR_FILENO);\n    pthread_t thread;\n    pthread_create(&thread, nullptr, pipe_to_log, &stderr_pipe[0]);\n    pthread_detach(thread);\n  }\n}\n}\n\nextern "C" JNIEXPORT jint JNICALL\n${jniName}(JNIEnv* env, jobject, jobjectArray arguments) {\n  const jsize count = env->GetArrayLength(arguments);\n  size_t total = 0;\n  for (jsize i = 0; i < count; ++i) {\n    auto value = static_cast<jstring>(env->GetObjectArrayElement(arguments, i));\n    const char* text = env->GetStringUTFChars(value, nullptr);\n    total += std::strlen(text) + 1;\n    env->ReleaseStringUTFChars(value, text);\n    env->DeleteLocalRef(value);\n  }\n  char* storage = static_cast<char*>(std::calloc(total, 1));\n  if (!storage) return -1;\n  char** argv = static_cast<char**>(std::calloc(count, sizeof(char*)));\n  if (!argv) { std::free(storage); return -1; }\n  char* cursor = storage;\n  for (jsize i = 0; i < count; ++i) {\n    auto value = static_cast<jstring>(env->GetObjectArrayElement(arguments, i));\n    const char* text = env->GetStringUTFChars(value, nullptr);\n    const size_t length = std::strlen(text);\n    std::memcpy(cursor, text, length);\n    argv[i] = cursor;\n    cursor += length + 1;\n    env->ReleaseStringUTFChars(value, text);\n    env->DeleteLocalRef(value);\n  }\n  start_log_redirect();\n  const int result = node::Start(static_cast<int>(count), argv);\n  std::free(argv);\n  std::free(storage);\n  return result;\n}\n`);

fs.writeFileSync(path.join(androidApp, "CMakeLists.txt"), `cmake_minimum_required(VERSION 3.22.1)\nproject(authors_forge_embedded_node)\nset(CMAKE_CXX_STANDARD 17)\nset(CMAKE_CXX_STANDARD_REQUIRED ON)\nadd_library(node SHARED IMPORTED)\nset_target_properties(node PROPERTIES IMPORTED_LOCATION "${'${CMAKE_SOURCE_DIR}'}/src/main/jniLibs/${'${ANDROID_ABI}'}/libnode.so")\nadd_library(forge_node_bridge SHARED src/main/cpp/forge_node_bridge.cpp)\ntarget_include_directories(forge_node_bridge PRIVATE "${'${CMAKE_SOURCE_DIR}'}/libnode/include/node")\nfind_library(log-lib log)\ntarget_link_libraries(forge_node_bridge node ${'${log-lib}'})\n`);

const gradlePath = path.join(androidApp, "build.gradle.kts");
let gradle = fs.readFileSync(ensureFile(gradlePath, "generated app/build.gradle.kts"), "utf8");
const gradleMarker = "// AUTHORS FORGE EMBEDDED NODE RUNTIME";
if (!gradle.includes(gradleMarker)) {
  gradle += `\n\n${gradleMarker}\nandroid {\n    externalNativeBuild {\n        cmake {\n            path = file("CMakeLists.txt")\n            version = "3.22.1"\n        }\n    }\n}\n`;
}
fs.writeFileSync(gradlePath, gradle);

const kotlin = `package ${packageName}\n\nimport android.content.Context\nimport android.content.res.AssetManager\nimport android.os.Bundle\nimport android.util.Log\nimport android.webkit.WebView\nimport java.io.File\nimport java.io.FileOutputStream\nimport java.net.HttpURLConnection\nimport java.net.URL\nimport java.util.concurrent.atomic.AtomicBoolean\n\nclass MainActivity : TauriActivity() {\n    companion object {\n        private const val TAG = "AuthorsForgeNative"\n        private const val RUNTIME_PREFS = "AUTHORS_FORGE_NATIVE_RUNTIME"\n        private const val RUNTIME_VERSION_KEY = "lastUpdateTime"\n        private const val STUDIO_URL = "http://127.0.0.1:4173/"\n        private const val HEALTH_URL = "http://127.0.0.1:4173/api/health"\n        private val nodeStarted = AtomicBoolean(false)\n\n        init {\n            System.loadLibrary("node")\n            System.loadLibrary("forge_node_bridge")\n        }\n    }\n\n    external fun startNodeWithArguments(arguments: Array<String>): Int\n\n    override fun onCreate(savedInstanceState: Bundle?) {\n        startEmbeddedForge()\n        super.onCreate(savedInstanceState)\n    }\n\n    override fun onWebViewCreate(webView: WebView) {\n        Thread {\n            val deadline = System.currentTimeMillis() + 45_000L\n            var lastError = "Embedded Forge did not become ready."\n            while (System.currentTimeMillis() < deadline) {\n                try {\n                    val connection = URL(HEALTH_URL).openConnection() as HttpURLConnection\n                    connection.connectTimeout = 700\n                    connection.readTimeout = 700\n                    connection.requestMethod = "GET"\n                    val ready = connection.responseCode in 200..299\n                    connection.disconnect()\n                    if (ready) {\n                        runOnUiThread { webView.loadUrl(STUDIO_URL) }\n                        return@Thread\n                    }\n                } catch (error: Exception) {\n                    lastError = error.message ?: error.javaClass.simpleName\n                }\n                Thread.sleep(150L)\n            }\n            val safe = lastError.replace("\\", "\\\\").replace("'", "\\'").replace("\\n", " ")\n            runOnUiThread {\n                webView.evaluateJavascript("window.__forgeNativeBootFailed && window.__forgeNativeBootFailed('Forge Core startup failed: $safe');", null)\n            }\n        }.start()\n    }\n\n    private fun startEmbeddedForge() {\n        if (!nodeStarted.compareAndSet(false, true)) return\n        Thread {\n            try {\n                val nodeDir = File(filesDir, "nodejs-project")\n                if (runtimeNeedsRefresh(nodeDir)) {\n                    if (nodeDir.exists()) nodeDir.deleteRecursively()\n                    copyAssetFolder(assets, "nodejs-project", nodeDir)\n                    saveRuntimeVersion()\n                }\n                val mainScript = File(nodeDir, "main.js")\n                check(mainScript.isFile) { "Embedded Forge main.js is missing." }\n                val result = startNodeWithArguments(arrayOf("node", mainScript.absolutePath, filesDir.absolutePath))\n                Log.e(TAG, "Embedded Node runtime exited with code $result")\n            } catch (error: Throwable) {\n                Log.e(TAG, "Embedded Forge runtime failed", error)\n                nodeStarted.set(false)\n            }\n        }.start()\n    }\n\n    private fun runtimeNeedsRefresh(nodeDir: File): Boolean {\n        if (!File(nodeDir, "main.js").isFile) return true\n        val installed = getSharedPreferences(RUNTIME_PREFS, Context.MODE_PRIVATE).getLong(RUNTIME_VERSION_KEY, -1L)\n        val current = packageManager.getPackageInfo(packageName, 0).lastUpdateTime\n        return installed != current\n    }\n\n    private fun saveRuntimeVersion() {\n        val current = packageManager.getPackageInfo(packageName, 0).lastUpdateTime\n        getSharedPreferences(RUNTIME_PREFS, Context.MODE_PRIVATE).edit().putLong(RUNTIME_VERSION_KEY, current).apply()\n    }\n\n    private fun copyAssetFolder(assetManager: AssetManager, assetPath: String, destination: File) {\n        val children = assetManager.list(assetPath) ?: emptyArray()\n        if (children.isEmpty()) {\n            destination.parentFile?.mkdirs()\n            assetManager.open(assetPath).use { input ->\n                FileOutputStream(destination).use { output -> input.copyTo(output) }\n            }\n            return\n        }\n        destination.mkdirs()\n        for (child in children) {\n            copyAssetFolder(assetManager, "$assetPath/$child", File(destination, child))\n        }\n    }\n}\n`;
fs.writeFileSync(mainActivityPath, kotlin);

const manifestFiles = walk(path.join(androidApp, "src", "main"), (_absolute, name) => name === "AndroidManifest.xml");
if (manifestFiles.length !== 1) fail(`Expected one AndroidManifest.xml; found ${manifestFiles.length}.`);
const manifestPath = manifestFiles[0];
let manifest = fs.readFileSync(manifestPath, "utf8");
if (!manifest.includes("android.permission.INTERNET")) manifest = replaceOnce(manifest, "<application", '    <uses-permission android:name="android.permission.INTERNET" />\n    <application', "Android application opening tag");
if (!manifest.includes("android:networkSecurityConfig")) manifest = replaceOnce(manifest, "<application", '<application android:networkSecurityConfig="@xml/forge_network_security_config"', "Android application opening tag");
fs.writeFileSync(manifestPath, manifest);
const xmlDir = path.join(androidApp, "src", "main", "res", "xml");
fs.mkdirSync(xmlDir, { recursive: true });
fs.writeFileSync(path.join(xmlDir, "forge_network_security_config.xml"), `<?xml version="1.0" encoding="utf-8"?>\n<network-security-config>\n  <base-config cleartextTrafficPermitted="false" />\n  <domain-config cleartextTrafficPermitted="true">\n    <domain includeSubdomains="false">127.0.0.1</domain>\n    <domain includeSubdomains="false">localhost</domain>\n  </domain-config>\n</network-security-config>\n`);

console.log(`[Forge Android embedded runtime] Prepared standalone Studio runtime for ${packageName}.`);
console.log(`[Forge Android embedded runtime] Embedded ABIs: ${supportedAbis.join(", ")}.`);
console.log(`[Forge Android embedded runtime] MainActivity: ${path.relative(root, mainActivityPath)}.`);
