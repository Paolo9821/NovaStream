package com.rork.novastream.data.remote

import com.rork.novastream.data.model.Episode
import com.rork.novastream.data.model.MediaDetails
import com.rork.novastream.data.model.MediaEntry
import com.rork.novastream.data.model.MediaKind
import com.rork.novastream.data.model.PlaylistAccount
import com.rork.novastream.data.net.downloadToFile
import com.rork.novastream.data.parser.M3uParser
import io.ktor.client.HttpClient
import io.ktor.client.request.get
import io.ktor.client.statement.bodyAsText
import io.ktor.http.encodeURLParameter
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.DeserializationStrategy
import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.json.DecodeSequenceMode
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeToSequence
import java.io.File

private const val BUFFER_BYTES = 64 * 1024

/**
 * Minimal Xtream Codes client.
 *
 * The three catalog endpoints can each return tens of megabytes. They are saved
 * to a temporary file and decoded one record at a time, so the peak memory of an
 * import depends on the number of entries kept, never on the size of the
 * response. Small endpoints are still read directly.
 */
class XtreamClient(
    private val http: HttpClient,
    private val cacheDir: File,
) {

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

        entries.trimToSize()
        entries
    }

    /**
     * Everything a provider knows about a film: plot, genres, cast, running
     * time. Catalog listings only carry a title and a poster, so this is what
     * turns a detail page into an actual description of the film.
     */
    suspend fun loadMovieDetails(account: PlaylistAccount, entryId: String, streamId: String): MediaDetails? =
        withContext(Dispatchers.IO) {
            val body = http.get(apiUrl(account, "get_vod_info") + "&vod_id=$streamId").bodyAsText()
            val root = json.parseToJsonElement(body) as? JsonObject ?: return@withContext null
            val info = root["info"] as? JsonObject
            val movie = root["movie_data"] as? JsonObject
            val details = MediaDetails(
                entryId = entryId,
                plot = info?.str("plot") ?: info?.str("description"),
                genres = (info?.str("genre")).orEmpty().splitGenres(),
                cast = (info?.str("cast") ?: info?.str("actors")).orEmpty().splitNames(),
                director = info?.str("director"),
                rating = info?.str("rating")?.takeIf { it != "0" && it != "0.0" },
                durationLabel = info?.str("duration") ?: info?.str("episode_run_time")
                    ?.let { minutes -> minutes.toIntOrNull()?.let { "$it min" } },
                releaseDate = info?.str("releasedate") ?: info?.str("releaseDate")
                    ?: movie?.str("added"),
                country = info?.str("country"),
                coverUrl = info?.str("movie_image") ?: info?.str("cover_big"),
                backdropUrl = info?.firstBackdrop(),
            )
            details.takeUnless { it.isEmpty }
        }

    /** The same for a series, read from the header of its season listing. */
    suspend fun loadSeriesDetails(account: PlaylistAccount, entryId: String, seriesId: String): MediaDetails? =
        withContext(Dispatchers.IO) {
            val body = http.get(apiUrl(account, "get_series_info") + "&series_id=$seriesId").bodyAsText()
            val root = json.parseToJsonElement(body) as? JsonObject ?: return@withContext null
            val info = root["info"] as? JsonObject ?: return@withContext null
            val details = MediaDetails(
                entryId = entryId,
                plot = info.str("plot") ?: info.str("description"),
                genres = info.str("genre").orEmpty().splitGenres(),
                cast = (info.str("cast") ?: info.str("actors")).orEmpty().splitNames(),
                director = info.str("director"),
                rating = info.str("rating")?.takeIf { it != "0" && it != "0.0" },
                durationLabel = info.str("episode_run_time")
                    ?.let { minutes -> minutes.toIntOrNull()?.let { "$it min" } },
                releaseDate = info.str("releaseDate") ?: info.str("releasedate"),
                country = info.str("country"),
                coverUrl = info.str("cover"),
                backdropUrl = info.firstBackdrop(),
            )
            details.takeUnless { it.isEmpty }
        }

    /**
     * Episodes of a series, read from `get_series_info`.
     *
     * Portals disagree on the shape of that response, which is why some series
     * used to come back "without episodes" while others listed fine on the very
     * same account. All of these are accepted here:
     * - `episodes` as an object keyed by season (`{"1": [...]}`), the documented form;
     * - `episodes` as an array of season buckets, which is what PHP produces
     *   whenever the season keys happen to run 0, 1, 2… ;
     * - `episodes` as one flat array of episodes with no season grouping;
     * - the whole document wrapped in an array.
     *
     * Season and episode numbers are taken from the episode itself when it
     * carries them and only then from the key it was filed under, and the
     * playable id is accepted under any of the three names portals use.
     */
    suspend fun loadEpisodes(account: PlaylistAccount, seriesId: String): List<Episode> =
        withContext(Dispatchers.IO) {
            val body = http.get(apiUrl(account, "get_series_info") + "&series_id=$seriesId").bodyAsText()
            val root = runCatching { json.parseToJsonElement(body) }.getOrNull()?.asObject()
                ?: return@withContext emptyList()
            val buckets = root["episodes"].seasonBuckets()

            buckets.flatMap { (seasonKey, entries) ->
                entries.mapIndexedNotNull { position, element ->
                    val obj = element as? JsonObject ?: return@mapIndexedNotNull null
                    val info = obj["info"] as? JsonObject
                    val id = obj.str("id") ?: obj.str("stream_id") ?: obj.str("episode_id")
                        ?: return@mapIndexedNotNull null
                    val extension = obj.str("container_extension")
                        ?: info?.str("container_extension")
                        ?: "mp4"
                    val number = obj.str("episode_num")?.toIntOrNull()
                        ?: info?.str("episode_num")?.toIntOrNull()
                        ?: (position + 1)
                    val season = obj.str("season")?.toIntOrNull()
                        ?: info?.str("season")?.toIntOrNull()
                        ?: seasonKey
                        ?: 1
                    Episode(
                        id = id,
                        title = obj.str("title") ?: info?.str("name") ?: "Episodio $number",
                        season = season.coerceAtLeast(0),
                        number = number,
                        streamUrl = "${base(account)}/series/${account.username.enc()}/${account.password.enc()}/$id.$extension",
                        plot = info?.str("plot") ?: info?.str("description"),
                        thumbUrl = info?.str("movie_image")?.takeIf { it.isNotBlank() },
                    )
                }
            }
                .distinctBy { it.streamUrl }
                .sortedWith(compareBy({ it.season }, { it.number }))
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

    /**
     * Downloads a JSON array to disk and folds it into the result list without
     * ever holding the parsed document in memory.
     */
    @OptIn(ExperimentalSerializationApi::class)
    private suspend fun <T, R> streamArray(
        url: String,
        tempName: String,
        deserializer: DeserializationStrategy<T>,
        transform: (Int, T) -> R?,
    ): List<R> {
        val temp = File(cacheDir, tempName)
        return try {
            http.downloadToFile(url, temp)
            temp.inputStream().buffered(BUFFER_BYTES).use { input ->
                val result = ArrayList<R>()
                var index = 0
                json.decodeToSequence(input, deserializer, DecodeSequenceMode.ARRAY_WRAPPED)
                    .forEach { item -> transform(index++, item)?.let(result::add) }
                result.trimToSize()
                result
            }
        } finally {
            temp.delete()
        }
    }

    private suspend fun categories(account: PlaylistAccount, action: String): Map<String, String> =
        runCatching {
            streamArray(
                url = apiUrl(account, action),
                tempName = "xtream-$action.json",
                deserializer = XtreamCategoryDto.serializer(),
            ) { _, dto ->
                if (dto.id.isBlank() || dto.name.isBlank()) null else dto.id to dto.name
            }.toMap()
        }.getOrDefault(emptyMap())

    private suspend fun liveStreams(
        account: PlaylistAccount,
        categories: Map<String, String>,
    ): List<MediaEntry> = streamArray(
        url = apiUrl(account, "get_live_streams"),
        tempName = "xtream-live.json",
        deserializer = XtreamLiveDto.serializer(),
    ) { index, dto ->
        val streamId = dto.streamId.ifBlank { return@streamArray null }
        MediaEntry(
            id = "live_$streamId",
            title = dto.name.ifBlank { "Canale $streamId" },
            kind = MediaKind.LIVE,
            group = categories[dto.categoryId] ?: "Senza categoria",
            logoUrl = dto.icon.takeIf { it.isNotBlank() },
            streamUrl = "${base(account)}/live/${account.username.enc()}/${account.password.enc()}/$streamId.m3u8",
            providerOrder = index,
            addedEpochMs = dto.added.epochMs(),
            tvgId = dto.epgChannelId.takeIf { it.isNotBlank() },
        )
    }

    private suspend fun vodStreams(
        account: PlaylistAccount,
        categories: Map<String, String>,
    ): List<MediaEntry> = streamArray(
        url = apiUrl(account, "get_vod_streams"),
        tempName = "xtream-vod.json",
        deserializer = XtreamVodDto.serializer(),
    ) { index, dto ->
        val streamId = dto.streamId.ifBlank { return@streamArray null }
        val name = dto.name.ifBlank { "Film $streamId" }
        MediaEntry(
            id = "movie_$streamId",
            title = name,
            kind = MediaKind.MOVIE,
            group = categories[dto.categoryId] ?: "Senza categoria",
            logoUrl = dto.icon.ifBlank { dto.cover }.takeIf { it.isNotBlank() },
            streamUrl = "${base(account)}/movie/${account.username.enc()}/${account.password.enc()}/" +
                "$streamId.${dto.extension.ifBlank { "mp4" }}",
            year = year(dto.year, dto.releaseDate, dto.releaseDateSnake, name),
            providerOrder = index,
            addedEpochMs = dto.added.epochMs(),
            plot = dto.plot.takeIf { it.isNotBlank() },
            genres = dto.genre.splitGenres(),
            quality = dto.quality.takeIf { it.isNotBlank() },
        )
    }

    private suspend fun seriesList(
        account: PlaylistAccount,
        categories: Map<String, String>,
    ): List<MediaEntry> = streamArray(
        url = apiUrl(account, "get_series"),
        tempName = "xtream-series.json",
        deserializer = XtreamSeriesDto.serializer(),
    ) { index, dto ->
        val seriesId = dto.seriesId.ifBlank { return@streamArray null }
        val name = dto.name.ifBlank { "Serie $seriesId" }
        MediaEntry(
            id = "series_$seriesId",
            title = name,
            kind = MediaKind.SERIES,
            group = categories[dto.categoryId] ?: "Senza categoria",
            logoUrl = dto.cover.ifBlank { dto.icon }.takeIf { it.isNotBlank() },
            streamUrl = "",
            year = year(dto.year, dto.releaseDate, dto.releaseDateSnake, name),
            providerOrder = index,
            addedEpochMs = dto.lastModified.epochMs(),
            plot = dto.plot.takeIf { it.isNotBlank() },
            genres = dto.genre.splitGenres(),
            seriesId = seriesId,
        )
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

    private fun String.splitGenres(): List<String> =
        split(",", "/").map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(6)

    private fun String.splitNames(): List<String> =
        split(",").map { it.trim() }.filter { it.isNotEmpty() }.distinct().take(8)

    /** Portals return the wide artwork as a one-element array of URLs. */
    private fun JsonObject.firstBackdrop(): String? {
        val array = this["backdrop_path"] as? JsonArray ?: return null
        return array.firstOrNull()
            ?.let { it as? JsonPrimitive }
            ?.content
            ?.takeIf { it.isNotBlank() && it != "null" }
    }

    private fun String.epochMs(): Long {
        val seconds = toLongOrNull() ?: return 0L
        return if (seconds > 100_000_000_000L) seconds else seconds * 1000L
    }

    private fun year(vararg candidates: String): Int? {
        val fields = candidates.dropLast(1)
        fields.forEach { field ->
            field.take(4).toIntOrNull()?.let { return it }
        }
        return M3uParser.extractYear(candidates.last())
    }

    private fun JsonObject.str(key: String): String? {
        val primitive = this[key] as? JsonPrimitive ?: return null
        val content = primitive.content
        return content.takeIf { it.isNotBlank() && it != "null" }
    }

    private fun JsonArray?.orEmptyElements(): List<JsonElement> = this ?: emptyList()

    /** The document itself, or the first object of a response wrapped in an array. */
    private fun JsonElement.asObject(): JsonObject? = when (this) {
        is JsonObject -> this
        is JsonArray -> firstOrNull() as? JsonObject
        else -> null
    }

    /**
     * The `episodes` node flattened into (season number or null, episodes)
     * pairs, whichever of the three shapes the portal used. A null season means
     * the grouping carried no number and the episodes have to speak for
     * themselves.
     */
    private fun JsonElement?.seasonBuckets(): List<Pair<Int?, List<JsonElement>>> = when (this) {
        is JsonObject -> entries.map { (key, value) ->
            key.toIntOrNull() to value.episodeElements()
        }
        is JsonArray -> when {
            // A flat list of episodes: no season grouping at all.
            firstOrNull() is JsonObject -> listOf(null to toList())
            // Season buckets that lost their keys to PHP's 0-based encoding.
            else -> mapIndexed { index, element -> index to element.episodeElements() }
        }
        else -> emptyList()
    }

    /** Episodes of one season, whether filed as an array or as a keyed object. */
    private fun JsonElement?.episodeElements(): List<JsonElement> = when (this) {
        is JsonArray -> toList()
        is JsonObject -> values.toList()
        else -> emptyList()
    }
}
