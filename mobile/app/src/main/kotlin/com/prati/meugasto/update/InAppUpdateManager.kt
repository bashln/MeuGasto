package com.prati.meugasto.update

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.get
import io.ktor.client.request.prepareGet
import io.ktor.client.statement.bodyAsChannel
import io.ktor.client.statement.bodyAsText
import io.ktor.http.HttpHeaders
import io.ktor.utils.io.readAvailable
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import java.net.URI

data class UpdateInfo(
    val hasUpdate: Boolean,
    val latestVersion: String,
    val downloadUrl: String? = null,
    val releaseNotes: String? = null
)

class InAppUpdateManager internal constructor(
    private val cacheDirProvider: () -> File,
    private val client: HttpClient,
    private val installApkFile: (File) -> Unit
) {

    constructor(context: Context) : this(
        cacheDirProvider = { context.cacheDir },
        client = HttpClient(OkHttp) {
            followRedirects = false
        },
        installApkFile = { apkFile ->
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
        }
    )

    private val json = Json { ignoreUnknownKeys = true }

    suspend fun checkForUpdates(currentVersionName: String): Result<UpdateInfo> = withContext(Dispatchers.IO) {
        try {
            val response = client.get(GITHUB_LATEST_RELEASE_URL)
            if (response.status.value !in 200..299) {
                throw IllegalStateException("Falha ao consultar atualizações (HTTP ${response.status.value}).")
            }

            val body = response.bodyAsText()
            val releaseObj = json.parseToJsonElement(body).jsonObject

            val tagName = releaseObj["tag_name"]?.jsonPrimitive?.content ?: ""
            val bodyNotes = releaseObj["body"]?.jsonPrimitive?.content ?: ""

            val latestVersion = if (tagName.startsWith("v")) tagName.substring(1) else tagName

            if (latestVersion.isBlank() || latestVersion == currentVersionName) {
                return@withContext Result.success(
                    UpdateInfo(hasUpdate = false, latestVersion = currentVersionName)
                )
            }

            var apkUrl: String? = null
            val assets = releaseObj["assets"]?.jsonArray
            if (assets != null) {
                for (asset in assets) {
                    val name = asset.jsonObject["name"]?.jsonPrimitive?.content ?: ""
                    val candidateUrl = asset.jsonObject["browser_download_url"]?.jsonPrimitive?.content
                    if (name.endsWith(".apk", ignoreCase = true) &&
                        candidateUrl != null &&
                        isAllowedApkDownloadUrl(candidateUrl, requireReleasePathOnGitHub = true)
                    ) {
                        apkUrl = candidateUrl
                        break
                    }
                }
            }

            val isNewer = compareVersions(latestVersion, currentVersionName) > 0

            Result.success(
                UpdateInfo(
                    hasUpdate = isNewer && apkUrl != null,
                    latestVersion = latestVersion,
                    downloadUrl = if (isNewer) apkUrl else null,
                    releaseNotes = bodyNotes
                )
            )
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun downloadAndInstallApk(downloadUrl: String): Result<Unit> = withContext(Dispatchers.IO) {
        var tempFile: File? = null
        try {
            if (!isAllowedApkDownloadUrl(downloadUrl, requireReleasePathOnGitHub = true)) {
                throw SecurityException("URL de atualização não autorizada.")
            }

            val updatesDir = File(cacheDirProvider(), "updates").apply { mkdirs() }
            tempFile = File(updatesDir, "update.apk.part")
            val finalFile = File(updatesDir, "update.apk")

            var currentUrl = downloadUrl
            var redirectCount = 0
            var downloaded = false

            while (!downloaded) {
                var nextRedirectUrl: String? = null
                client.prepareGet(currentUrl).execute { response ->
                    val status = response.status.value
                    if (status in 300..399) {
                        if (redirectCount >= MAX_REDIRECTS) {
                            throw IllegalStateException("Excesso de redirecionamentos ao baixar atualização.")
                        }
                        val location = response.headers[HttpHeaders.Location]
                            ?: throw IllegalStateException("Redirecionamento sem destino ao baixar atualização.")
                        val resolved = URI(currentUrl).resolve(location).toString()
                        if (!isAllowedApkDownloadUrl(resolved, requireReleasePathOnGitHub = false)) {
                            throw SecurityException("Redirecionamento para host não autorizado.")
                        }
                        nextRedirectUrl = resolved
                        redirectCount++
                    } else if (status in 200..299) {
                        val channel = response.bodyAsChannel()
                        val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
                        var totalBytes = 0L
                        val headerBytes = ByteArray(4)
                        var headerRead = 0

                        tempFile.outputStream().buffered().use { out ->
                            while (!channel.isClosedForRead) {
                                val read = channel.readAvailable(buffer, 0, buffer.size)
                                if (read <= 0) continue
                                if (headerRead < 4) {
                                    val toCopy = minOf(4 - headerRead, read)
                                    System.arraycopy(buffer, 0, headerBytes, headerRead, toCopy)
                                    headerRead += toCopy
                                }
                                totalBytes += read
                                if (totalBytes > MAX_APK_BYTES) {
                                    throw IllegalStateException("Arquivo de atualização excede o limite permitido.")
                                }
                                out.write(buffer, 0, read)
                            }
                        }

                        if (totalBytes < MIN_APK_BYTES || !hasZipMagicHeader(headerBytes, headerRead)) {
                            throw IllegalStateException("Arquivo baixado não é um pacote APK válido.")
                        }
                        downloaded = true
                    } else {
                        throw IllegalStateException("Falha ao baixar atualização (HTTP $status).")
                    }
                }
                if (nextRedirectUrl != null) {
                    currentUrl = nextRedirectUrl!!
                }
            }

            if (finalFile.exists() && !finalFile.delete()) {
                throw IllegalStateException("Não foi possível substituir o pacote de atualização anterior.")
            }
            if (!tempFile.renameTo(finalFile)) {
                tempFile.copyTo(finalFile, overwrite = true)
                tempFile.delete()
            }

            installApkFile(finalFile)
            Result.success(Unit)
        } catch (e: Exception) {
            tempFile?.delete()
            Result.failure(e)
        }
    }

    internal companion object {
        private const val GITHUB_LATEST_RELEASE_URL =
            "https://api.github.com/repos/bashln/MeuGasto/releases/latest"
        private const val GITHUB_RELEASE_PATH_PREFIX = "/bashln/meugasto/releases/download/"
        private const val MAX_REDIRECTS = 5
        private const val MIN_APK_BYTES = 1024L
        private const val MAX_APK_BYTES = 150L * 1024L * 1024L

        private val ALLOWED_DOWNLOAD_HOSTS = setOf(
            "github.com",
            "objects.githubusercontent.com",
            "release-assets.githubusercontent.com"
        )

        internal fun isAllowedApkDownloadUrl(
            rawUrl: String,
            requireReleasePathOnGitHub: Boolean
        ): Boolean {
            val uri = runCatching { URI(rawUrl.trim()) }.getOrNull() ?: return false
            if (!uri.scheme.equals("https", ignoreCase = true)) return false
            if (uri.userInfo != null) return false
            val host = uri.host?.lowercase() ?: return false
            if (host !in ALLOWED_DOWNLOAD_HOSTS) return false
            if (requireReleasePathOnGitHub && host == "github.com") {
                val path = uri.path?.lowercase() ?: return false
                if (!path.startsWith(GITHUB_RELEASE_PATH_PREFIX)) return false
            }
            return true
        }

        private fun hasZipMagicHeader(bytes: ByteArray, length: Int): Boolean {
            return length >= 4 &&
                bytes[0] == 0x50.toByte() &&
                bytes[1] == 0x4B.toByte() &&
                bytes[2] == 0x03.toByte() &&
                bytes[3] == 0x04.toByte()
        }

        internal fun compareVersions(v1: String, v2: String): Int {
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
}
