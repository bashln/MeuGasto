package com.prati.meugasto.data.remote.sync

import com.prati.meugasto.data.local.preferences.UserPreferences
import io.ktor.client.HttpClient
import io.ktor.client.engine.okhttp.OkHttp
import io.ktor.client.request.header
import io.ktor.client.request.put
import io.ktor.client.request.setBody
import io.ktor.client.statement.HttpResponse
import io.ktor.http.HttpStatusCode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.util.Base64

interface SyncProvider {
    suspend fun uploadBackup(data: ByteArray, filename: String): Result<Boolean>
    suspend fun downloadBackup(filename: String): Result<ByteArray>
}

class WebDavSyncProvider(
    private val preferences: UserPreferences
) : SyncProvider {

    private val client by lazy { HttpClient(OkHttp) }

    override suspend fun uploadBackup(data: ByteArray, filename: String): Result<Boolean> = withContext(Dispatchers.IO) {
        val serverUrl = preferences.getWebDavUrl()
            ?: return@withContext Result.failure(IllegalStateException("URL do WebDAV não configurada."))
        val username = preferences.getWebDavUser() ?: ""
        val password = preferences.getWebDavPass() ?: ""

        try {
            val endpoint = if (serverUrl.endsWith("/")) "$serverUrl$filename" else "$serverUrl/$filename"
            val authHeader = "Basic " + Base64.getEncoder().encodeToString("$username:$password".toByteArray())

            val response: HttpResponse = client.put(endpoint) {
                header("Authorization", authHeader)
                header("Content-Type", "application/octet-stream")
                setBody(data)
            }

            if (response.status == HttpStatusCode.Created || response.status == HttpStatusCode.OK || response.status == HttpStatusCode.NoContent) {
                Result.success(true)
            } else {
                Result.failure(Exception("WebDAV retornou status ${response.status.value}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    override suspend fun downloadBackup(filename: String): Result<ByteArray> = withContext(Dispatchers.IO) {
        // Implementação para restauração de backup via WebDAV
        Result.failure(NotImplementedError("Download WebDAV será executado sob demanda"))
    }
}

