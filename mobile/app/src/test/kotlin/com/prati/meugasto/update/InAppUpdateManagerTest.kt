package com.prati.meugasto.update

import io.ktor.client.HttpClient
import io.ktor.client.engine.mock.MockEngine
import io.ktor.client.engine.mock.respond
import io.ktor.http.HttpHeaders
import io.ktor.http.HttpStatusCode
import io.ktor.http.headersOf
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TemporaryFolder
import java.io.File

class InAppUpdateManagerTest {

    @get:Rule
    val tempFolder = TemporaryFolder()

    @Test
    fun `checkForUpdates fails on non-2xx GitHub API status`() = runTest {
        val client = HttpClient(MockEngine) {
            followRedirects = false
            engine {
                addHandler {
                    respond("rate limit", HttpStatusCode.Forbidden)
                }
            }
        }
        val manager = InAppUpdateManager(
            cacheDirProvider = { tempFolder.root },
            client = client,
            installApkFile = {}
        )

        val result = manager.checkForUpdates("0.5.4.0")

        assertTrue(result.isFailure)
    }

    @Test
    fun `checkForUpdates rejects untrusted asset download host`() = runTest {
        val client = HttpClient(MockEngine) {
            followRedirects = false
            engine {
                addHandler {
                    respond(
                        content = """
                            {
                              "tag_name": "v0.5.5.0",
                              "body": "Correcao",
                              "assets": [
                                {
                                  "name": "meugastov0.5.5.0.apk",
                                  "browser_download_url": "https://evil.example.com/meugastov0.5.5.0.apk"
                                }
                              ]
                            }
                        """.trimIndent(),
                        status = HttpStatusCode.OK
                    )
                }
            }
        }
        val manager = InAppUpdateManager(
            cacheDirProvider = { tempFolder.root },
            client = client,
            installApkFile = {}
        )

        val info = manager.checkForUpdates("0.5.4.0").getOrThrow()

        assertFalse(info.hasUpdate)
        assertNull(info.downloadUrl)
    }

    @Test
    fun `downloadAndInstallApk follows trusted GitHub redirect and streams into updates subdir`() = runTest {
        val validApkPayload = ByteArray(2048).apply {
            this[0] = 0x50
            this[1] = 0x4B
            this[2] = 0x03
            this[3] = 0x04
        }
        var installedFile: File? = null

        val client = HttpClient(MockEngine) {
            followRedirects = false
            engine {
                addHandler { request ->
                    when (request.url.host) {
                        "github.com" -> respond(
                            content = "",
                            status = HttpStatusCode.Found,
                            headers = headersOf(
                                HttpHeaders.Location,
                                "https://objects.githubusercontent.com/github-production-release-asset/meugasto.apk"
                            )
                        )
                        "objects.githubusercontent.com" -> respond(
                            content = validApkPayload,
                            status = HttpStatusCode.OK
                        )
                        else -> error("Unexpected host ${request.url.host}")
                    }
                }
            }
        }
        val manager = InAppUpdateManager(
            cacheDirProvider = { tempFolder.root },
            client = client,
            installApkFile = { installedFile = it }
        )

        val result = manager.downloadAndInstallApk(
            "https://github.com/bashln/MeuGasto/releases/download/v0.5.5.0/meugastov0.5.5.0.apk"
        )

        assertTrue(result.isSuccess)
        assertNotNull(installedFile)
        assertEquals("updates", installedFile?.parentFile?.name)
        assertEquals(2048L, installedFile?.length())
    }

    @Test
    fun `downloadAndInstallApk blocks redirect to untrusted host and HTML error payloads`() = runTest {
        val redirectClient = HttpClient(MockEngine) {
            followRedirects = false
            engine {
                addHandler {
                    respond(
                        content = "",
                        status = HttpStatusCode.Found,
                        headers = headersOf(HttpHeaders.Location, "https://attacker.invalid/evil.apk")
                    )
                }
            }
        }
        val redirectManager = InAppUpdateManager(
            cacheDirProvider = { tempFolder.root },
            client = redirectClient,
            installApkFile = {}
        )
        assertTrue(
            redirectManager.downloadAndInstallApk(
                "https://github.com/bashln/MeuGasto/releases/download/v0.5.5.0/meugastov0.5.5.0.apk"
            ).isFailure
        )

        val htmlClient = HttpClient(MockEngine) {
            followRedirects = false
            engine {
                addHandler {
                    respond(
                        content = "<html><body>Not an APK</body></html>".repeat(60),
                        status = HttpStatusCode.OK
                    )
                }
            }
        }
        val htmlManager = InAppUpdateManager(
            cacheDirProvider = { tempFolder.root },
            client = htmlClient,
            installApkFile = {}
        )
        assertTrue(
            htmlManager.downloadAndInstallApk(
                "https://github.com/bashln/MeuGasto/releases/download/v0.5.5.0/meugastov0.5.5.0.apk"
            ).isFailure
        )
    }
}
