package com.rork.novastream.data.remote

import com.rork.novastream.data.model.Episode
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.PlaylistAccount
import com.rork.novastream.data.parser.M3uParser
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.encodeURLParameter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * Minimal Xtream Codes client. Responses are read through JsonElement because
 * portals are inconsistent about number vs. string types.
 */
class XtreamClient(private val http: HttpClient) {

    private val json = Json { ignoreUnknownKeys = true; isLenient = true }

    suspend fun loadCatalog(
        account: PlaylistAccount,
        onProgress: (String) -> Unit,
    ): List<MediaEntry> = withContext(Dispatchers.IO) {
        val entries = ArrayList<MediaEntry>()

        onProgress("Recupero categorie…")
        val liveCategories = categories(account, "get_live_categories")
        val vodCategories = categories(account, "get_vod_categories")
        val seriesCategories = categories(account, "get_series_categories")

        onProgress("Recupero canali live…")
        entries += liveStreams(account, liveCategories)

        onProgress("Recupero film…")
        entries += vodStreams(account, vodCategories)

        onProgress("Recupero serie TV…")
        entries += seriesList(account, seriesCategories)

        entries
    }

    suspend fun loadEpisodes(account: PlaylistAccount, seriesId: String): List<Episode> =
        withContext(Dispatchers.IO) {
            val body = http.get(apiUrl(account, "get_series_info") + "&series_id=$seriesId").bodyAsText()
            val root = json.parseToJsonElement(body) as? JsonObject ?: return@withContext emptyList()
            val seasons = root["episodes"] as? JsonObject ?: return@withContext emptyList()

            seasons.entries.flatMap { (seasonKey, value) ->
                val seasonNumber = seasonKey.toIntOrNull() ?: 0
                (value as? JsonArray).orEmptyElements().mapNotNull { element ->
                    val obj = element as? JsonObject ?: return@mapNotNull null
                    val id = obj.str("id") ?: return@mapNotNull null
                    val extension = obj.str("container_extension") ?: "mp4"
                    val info = obj["info"] as? JsonObject
                    Episode(
                        id = id,
                        title = obj.str("title") ?: "Episodio ${obj.str("episode_num").orEmpty()}",
                        season = seasonNumber,
                        number = obj.str("episode_num")?.toIntOrNull() ?: 0,
                        streamUrl = "${base(account)}/series/${account.username.enc()}/${account.password.enc()}/$id.$extension",
                        plot = info?.str("plot"),
                        thumbUrl = info?.str("movie_image")?.takeIf { it.isNotBlank() },
                    )
                }
            }.sortedWith(compareBy({ it.season }, { it.number }))
        }

    /** Verifies the credentials before an account is saved. */
    suspend fun authenticate(account: PlaylistAccount): Result<String> = withContext(Dispatchers.IO) {
        runCatching {
            val body = http.get(apiUrl(account, "")).bodyAsText()
            val root = json.parseToJsonElement(body) as? JsonObject
                ?: throw IllegalStateException("Risposta del server non valida")
            val userInfo = root["user_info"] as? JsonObject
                ?: throw IllegalStateException("Il server non ha restituito le informazioni utente")
            val status = userInfo.str("auth")
            if (status == "0") throw IllegalStateException("Credenziali rifiutate dal server")
            userInfo.str("status") ?: "Active"
        }
    }

    private suspend fun categories(account: PlaylistAccount, action: String): Map<String, String> =
        runCatching {
            val body = http.get(apiUrl(account, action)).bodyAsText()
            (json.parseToJsonElement(body) as? JsonArray).orEmptyElements().mapNotNull { element ->
                val obj = element as? JsonObject ?: return@mapNotNull null
                val id = obj.str("category_id") ?: return@mapNotNull null
                val name = obj.str("category_name") ?: return@mapNotNull null
                id to name
            }.toMap()
        }.getOrDefault(emptyMap())

    private suspend fun liveStreams(
        account: PlaylistAccount,
        categories: Map<String, String>,
    ): List<MediaEntry> {
        val body = http.get(apiUrl(account, "get_live_streams")).bodyAsText()
        return (json.parseToJsonElement(body) as? JsonArray).orEmptyElements().mapIndexedNotNull { index, element ->
            val obj = element as? JsonObject ?: return@mapIndexedNotNull null
            val streamId = obj.str("stream_id") ?: return@mapIndexedNotNull null
            val name = obj.str("name") ?: "Canale $streamId"
            MediaEntry(
                id = "live_$streamId",
                title = name,
                kind = MediaKind.LIVE,
                group = categories[obj.str("category_id")] ?: "Senza categoria",
                logoUrl = obj.str("stream_icon")?.takeIf { it.isNotBlank() },
                streamUrl = "${base(account)}/live/${account.username.enc()}/${account.password.enc()}/$streamId.m3u8",
                providerOrder = index,
                addedEpochMs = obj.epochMs("added"),
            )
        }
    }

    private suspend fun vodStreams(
        account: PlaylistAccount,
        categories: Map<String, String>,
    ): List<MediaEntry> {
        val body = http.get(apiUrl(account, "get_vod_streams")).bodyAsText()
        return (json.parseToJsonElement(body) as? JsonArray).orEmptyElements().mapIndexedNotNull { index, element ->
            val obj = element as? JsonObject ?: return@mapIndexedNotNull null
            val streamId = obj.str("stream_id") ?: return@mapIndexedNotNull null
            val name = obj.str("name") ?: "Film $streamId"
            val extension = obj.str("container_extension") ?: "mp4"
            MediaEntry(
                id = "movie_$streamId",
                title = name,
                kind = MediaKind.MOVIE,
                group = categories[obj.str("category_id")] ?: "Senza categoria",
                logoUrl = (obj.str("stream_icon") ?: obj.str("cover"))?.takeIf { it.isNotBlank() },
                streamUrl = "${base(account)}/movie/${account.username.enc()}/${account.password.enc()}/$streamId.$extension",
                year = obj.year(name),
                providerOrder = index,
                addedEpochMs = obj.epochMs("added"),
                plot = obj.str("plot"),
                genres = obj.str("genre").orEmpty().split(",", "/").map { it.trim() }.filter { it.isNotEmpty() },
                quality = obj.str("quality"),
            )
        }
    }

    private suspend fun seriesList(
        account: PlaylistAccount,
        categories: Map<String, String>,
    ): List<MediaEntry> {
        val body = http.get(apiUrl(account, "get_series")).bodyAsText()
        return (json.parseToJsonElement(body) as? JsonArray).orEmptyElements().mapIndexedNotNull { index, element ->
            val obj = element as? JsonObject ?: return@mapIndexedNotNull null
            val seriesId = obj.str("series_id") ?: return@mapIndexedNotNull null
            val name = obj.str("name") ?: "Serie $seriesId"
            MediaEntry(
                id = "series_$seriesId",
                title = name,
                kind = MediaKind.SERIES,
                group = categories[obj.str("category_id")] ?: "Senza categoria",
                logoUrl = (obj.str("cover") ?: obj.str("stream_icon"))?.takeIf { it.isNotBlank() },
                streamUrl = "",
                year = obj.year(name),
                providerOrder = index,
                addedEpochMs = obj.epochMs("last_modified"),
                plot = obj.str("plot"),
                genres = obj.str("genre").orEmpty().split(",", "/").map { it.trim() }.filter { it.isNotEmpty() },
                seriesId = seriesId,
            )
        }
    }

    private fun apiUrl(account: PlaylistAccount, action: String): String {
        val suffix = if (action.isBlank()) "" else "&action=$action"
        return "${base(account)}/player_api.php?username=${account.username.enc()}&password=${account.password.enc()}$suffix"
    }

    private fun base(account: PlaylistAccount): String {
        val trimmed = account.server.trim().trimEnd('/')
        return if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) trimmed else "http://$trimmed"
    }

    private fun String.enc(): String = encodeURLParameter()

    private fun JsonObject.str(key: String): String? {
        val primitive = this[key] as? JsonPrimitive ?: return null
        val content = primitive.content
        return content.takeIf { it.isNotBlank() && it != "null" }
    }

    private fun JsonObject.epochMs(key: String): Long {
        val raw = str(key) ?: return 0L
        val seconds = raw.toLongOrNull() ?: return 0L
        return if (seconds > 100_000_000_000L) seconds else seconds * 1000L
    }

    private fun JsonObject.year(title: String): Int? {
        str("year")?.take(4)?.toIntOrNull()?.let { return it }
        str("releaseDate")?.take(4)?.toIntOrNull()?.let { return it }
        str("release_date")?.take(4)?.toIntOrNull()?.let { return it }
        return M3uParser.extractYear(title)
    }

    private fun JsonArray?.orEmptyElements(): List<JsonElement> = this ?: emptyList()
}
