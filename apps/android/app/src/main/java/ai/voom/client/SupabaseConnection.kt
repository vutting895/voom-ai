package ai.voom.client

import android.os.Handler
import android.os.Looper
import java.net.HttpURLConnection
import java.net.URL

object SupabaseConnection {
    fun check(onResult: (String) -> Unit) {
        Thread {
            val result = try {
                if (BuildConfig.SUPABASE_URL.isBlank() || BuildConfig.SUPABASE_ANON_KEY.isBlank()) {
                    "Not configured"
                } else {
                    val endpoint = BuildConfig.SUPABASE_URL.trimEnd('/') + "/auth/v1/health"
                    val connection = (URL(endpoint).openConnection() as HttpURLConnection).apply {
                        requestMethod = "GET"
                        connectTimeout = 8000
                        readTimeout = 8000
                        setRequestProperty("apikey", BuildConfig.SUPABASE_ANON_KEY)
                        setRequestProperty("Accept", "application/json")
                    }
                    try {
                        val code = connection.responseCode
                        if (code in 200..299) "Connected (HTTP $code)" else "HTTP $code"
                    } finally {
                        connection.disconnect()
                    }
                }
            } catch (error: Exception) {
                "Connection failed: ${error.javaClass.simpleName}"
            }
            Handler(Looper.getMainLooper()).post { onResult(result) }
        }.start()
    }
}
