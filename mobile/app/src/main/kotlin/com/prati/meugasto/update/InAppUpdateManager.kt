package com.prati.meugasto.update

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.client.statement.readBytes
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File

data class UpdateInfo(
    val hasUpdate: Boolean,
    val latestVersion: String,
    val downloadUrl: String? = null,
    val releaseNotes: String? = null
)

class InAppUpdateManager(private val context: Context) {

    private val client by lazy { HttpClient(OkHttp) }
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun checkForUpdates(currentVersionName: String): Result<UpdateInfo> = withContext(Dispatchers.IO) {
        try {
            val response = client.get("https://api.github.com/repos/bashln/MeuGasto/releases/latest")
            val body = response.bodyAsText()
            val releaseObj = json.parseToJsonElement(body).jsonObject

            val tagName = releaseObj["tag_name"]?.jsonPrimitive?.content ?: ""
            val bodyNotes = releaseObj["body"]?.jsonPrimitive?.content ?: ""

            // Tag esperada: vX.Y.Z.W
            val latestVersion = if (tagName.startsWith("v")) tagName.substring(1) else tagName

            if (latestVersion.isBlank() || latestVersion == currentVersionName) {
                return@withContext Result.success(UpdateInfo(hasUpdate = false, latestVersion = currentVersionName))
            }

            // Procurar asset APK
            var apkUrl: String? = null
            val assets = releaseObj["assets"]?.jsonArray
            if (assets != null) {
                for (asset in assets) {
                    val name = asset.jsonObject["name"]?.jsonPrimitive?.content ?: ""
                    if (name.endsWith(".apk")) {
                        apkUrl = asset.jsonObject["browser_download_url"]?.jsonPrimitive?.content
                        break
                    }
                }
            }

            val isNewer = compareVersions(latestVersion, currentVersionName) > 0

            Result.success(
                UpdateInfo(
                    hasUpdate = isNewer && apkUrl != null,
                    latestVersion = latestVersion,
                    downloadUrl = apkUrl,
                    releaseNotes = bodyNotes
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun downloadAndInstallApk(downloadUrl: String): Result<Unit> = withContext(Dispatchers.IO) {
        try {
            val bytes = client.get(downloadUrl).readBytes()
            val apkFile = File(context.cacheDir, "update.apk")
            apkFile.writeBytes(bytes)

            val uri = FileProvider.getUriForFile(
                context,
                "${context.packageName}.fileprovider",
                apkFile
            )

            val intent = Intent(Intent.ACTION_VIEW).apply {
                setDataAndType(uri, "application/vnd.android.package-archive")
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_GRANT_READ_URI_PERMISSION
            }
            context.startActivity(intent)
            Result.success(Unit)
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    private fun compareVersions(v1: String, v2: String): Int {
        val parts1 = v1.split(".").mapNotNull { it.toIntOrNull() }
        val parts2 = v2.split(".").mapNotNull { it.toIntOrNull() }
        val maxLen = maxOf(parts1.size, parts2.size)

        for (i in 0 until maxLen) {
            val p1 = parts1.getOrElse(i) { 0 }
            val p2 = parts2.getOrElse(i) { 0 }
            if (p1 != p2) return p1.compareTo(p2)
        }
        return 0
    }
}

