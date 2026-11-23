package ai.voom.client

import android.os.Handler
import android.os.Looper
import org.json.JSONArray
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

data class NovaChatMessage(val role: String, val content: String)
data class NovaChatReply(val message: String, val provider: String, val model: String)

object NovaApi {
    private const val CONNECT_TIMEOUT_MS = 8000
    private const val READ_TIMEOUT_MS = 16000
    private const val MAX_REQUEST_BYTES = 16 * 1024
    private const val MAX_RESPONSE_BYTES = 64 * 1024
    private val mainHandler = Handler(Looper.getMainLooper())

    private fun readBoundedText(stream: InputStream?): String {
        if (stream == null) return ""
        return stream.use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            var total = 0
            while (true) {
                val count = input.read(buffer)
                if (count < 0) break
                total += count
                if (total > MAX_RESPONSE_BYTES) {
                    throw IllegalStateException("Server response exceeded the allowed size")
                }
                output.write(buffer, 0, count)
            }
            output.toString(Charsets.UTF_8.name())
        }
    }

    fun signIn(email: String, password: String, callback: (AuthSession?, String?) -> Unit) {
        requestSession("password", JSONObject().put("email", email.trim()).put("password", password), callback)
    }

    /** Exchanges a refresh token and returns the rotated session supplied by Supabase. */
    fun refreshSession(session: AuthSession, callback: (AuthSession?, String?) -> Unit) {
        requestSession("refresh_token", JSONObject().put("refresh_token", session.refreshToken), callback)
    }

    private fun requestSession(
        grantType: String,
        payload: JSONObject,
        callback: (AuthSession?, String?) -> Unit
    ) {
        Thread {
            var session: AuthSession? = null
            var error: String? = null
            var connection: HttpURLConnection? = null
            try {
                val base = BuildConfig.SUPABASE_URL.trimEnd('/')
                require(base.startsWith("https://")) { "Supabase HTTPS endpoint is not configured" }
                require(BuildConfig.SUPABASE_ANON_KEY.isNotBlank()) { "Supabase public client key is not configured" }
                connection = (URL("$base/auth/v1/token?grant_type=$grantType").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    instanceFollowRedirects = false
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doOutput = true
                    setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY)
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Accept", "application/json")
                }
                connection.outputStream.use { it.write(payload.toString().toByteArray(Charsets.UTF_8)) }
                val status = connection.responseCode
                val response = readBoundedText(if (status in 200..299) connection.inputStream else connection.errorStream)
                if (status !in 200..299) {
                    error = when (status) {
                        400, 401 -> if (grantType == "refresh_token") "Session expired or refresh token rejected. Sign in again." else "Email or password is incorrect"
                        429 -> "Supabase Auth rate limit reached. Try again later."
                        else -> "Supabase Auth returned HTTP $status"
                    }
                } else {
                    session = AuthSession.fromSupabaseResponse(JSONObject(response), System.currentTimeMillis() / 1000L)
                }
            } catch (exception: Exception) {
                error = exception.message?.take(160) ?: "Supabase Auth request failed"
            } finally {
                connection?.disconnect()
            }
            mainHandler.post { callback(session, error) }
        }.start()
    }

    fun signOut(accessToken: String, callback: (String?) -> Unit) {
        Thread {
            var error: String? = null
            try {
                val base = BuildConfig.SUPABASE_URL.trimEnd('/')
                require(base.startsWith("https://")) { "Supabase HTTPS endpoint is not configured" }
                val connection = (URL("$base/auth/v1/logout").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    instanceFollowRedirects = false
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY)
                    setRequestProperty("Authorization", "Bearer $accessToken")
                    setRequestProperty("Accept", "application/json")
                }
                try {
                    val status = connection.responseCode
                    if (status !in 200..299) error = "Supabase sign-out returned HTTP $status"
                } finally {
                    connection.disconnect()
                }
            } catch (exception: Exception) {
                error = exception.message?.take(160) ?: "Supabase sign-out request failed"
            }
            mainHandler.post { callback(error) }
        }.start()
    }

    fun sendChat(
        accessToken: String,
        messages: List<NovaChatMessage>,
        callback: (NovaChatReply?, String?) -> Unit
    ) {
        Thread {
            var reply: NovaChatReply? = null
            var error: String? = null
            try {
                require(accessToken.isNotBlank()) { "Sign in before using NOVA AI" }
                require(messages.isNotEmpty() && messages.size <= 8) { "Conversation must contain 1–8 messages" }
                require(messages.last().role == "user") { "The latest message must be from the user" }
                require(messages.all { it.role in setOf("user", "assistant") && it.content.isNotBlank() && it.content.length <= 1200 }) {
                    "Conversation contains an invalid message"
                }
                require(messages.sumOf { it.content.length } <= 8000) { "Conversation is too large" }

                val base = BuildConfig.NOVA_AI_API_BASE_URL.trimEnd('/')
                require(base.startsWith("https://")) { "NOVA AI HTTPS endpoint is not configured" }
                val payload = JSONObject().put("messages", JSONArray().apply {
                    messages.forEach { message ->
                        put(JSONObject().put("role", message.role).put("content", message.content))
                    }
                }).toString().toByteArray(Charsets.UTF_8)
                require(payload.size <= MAX_REQUEST_BYTES) {
                    "Conversation exceeds the 16 KB request limit"
                }
                val connection = (URL("$base/api/chat").openConnection() as HttpURLConnection).apply {
                    requestMethod = "POST"
                    instanceFollowRedirects = false
                    connectTimeout = CONNECT_TIMEOUT_MS
                    readTimeout = READ_TIMEOUT_MS
                    doOutput = true
                    setRequestProperty("Authorization", "Bearer $accessToken")
                    setRequestProperty("Content-Type", "application/json")
                    setRequestProperty("Accept", "application/json")
                }
                try {
                    connection.outputStream.use { it.write(payload) }
                    val status = connection.responseCode
                    val response = readBoundedText(if (status in 200..299) connection.inputStream else connection.errorStream)
                    if (status !in 200..299) {
                        error = when (status) {
                            401 -> "Session expired. Sign in again."
                            403 -> "This account is not authorized for NOVA AI."
                            503 -> "NOVA AI is temporarily unavailable."
                            else -> "NOVA AI returned HTTP $status"
                        }
                    } else {
                        val json = JSONObject(response)
                        val message = json.optString("message").trim()
                        if (message.isBlank()) {
                            error = "NOVA AI returned an invalid response"
                        } else {
                            reply = NovaChatReply(
                                message = message,
                                provider = json.optString("provider", "NOVA AI"),
                                model = json.optString("model", "Research")
                            )
                        }
                    }
                } finally {
                    connection.disconnect()
                }
            } catch (exception: Exception) {
                error = exception.message?.take(160) ?: "NOVA AI request failed"
            }
            mainHandler.post { callback(reply, error) }
        }.start()
    }
}
