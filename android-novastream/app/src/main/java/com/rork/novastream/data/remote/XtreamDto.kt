package com.rork.novastream.data.remote

import kotlinx.serialization.KSerializer
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonPrimitive

/**
 * Reads a field that Xtream portals spell inconsistently.
 *
 * The same value arrives as a quoted string on one server, a bare number on the
 * next and `null` on a third. All of those become plain text here, and anything
 * missing becomes an empty string, so the models below can stay non-nullable.
 */
object LooseText : KSerializer<String> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("LooseText", PrimitiveKind.STRING)

    override fun deserialize(decoder: Decoder): String {
        val json = decoder as? JsonDecoder ?: return decoder.decodeString()
        val element = json.decodeJsonElement()
        if (element is JsonNull) return ""
        val primitive = element as? JsonPrimitive ?: return ""
        return primitive.content.takeIf { it != "null" }.orEmpty()
    }

    override fun serialize(encoder: Encoder, value: String) = encoder.encodeString(value)
}

/**
 * The handful of fields the app actually shows, decoded one record at a time.
 * Keeping these models narrow is what makes a large catalog fit in memory: the
 * raw JSON tree for the same list would be several times bigger than the
 * entries built from it.
 */
@Serializable
data class XtreamCategoryDto(
    @SerialName("category_id") @Serializable(with = LooseText::class) val id: String = "",
    @SerialName("category_name") @Serializable(with = LooseText::class) val name: String = "",
)

@Serializable
data class XtreamLiveDto(
    @SerialName("stream_id") @Serializable(with = LooseText::class) val streamId: String = "",
    @SerialName("name") @Serializable(with = LooseText::class) val name: String = "",
    @SerialName("category_id") @Serializable(with = LooseText::class) val categoryId: String = "",
    @SerialName("stream_icon") @Serializable(with = LooseText::class) val icon: String = "",
    @SerialName("epg_channel_id") @Serializable(with = LooseText::class) val epgChannelId: String = "",
    @SerialName("added") @Serializable(with = LooseText::class) val added: String = "",
)

@Serializable
data class XtreamVodDto(
    @SerialName("stream_id") @Serializable(with = LooseText::class) val streamId: String = "",
    @SerialName("name") @Serializable(with = LooseText::class) val name: String = "",
    @SerialName("category_id") @Serializable(with = LooseText::class) val categoryId: String = "",
    @SerialName("stream_icon") @Serializable(with = LooseText::class) val icon: String = "",
    @SerialName("cover") @Serializable(with = LooseText::class) val cover: String = "",
    @SerialName("container_extension") @Serializable(with = LooseText::class) val extension: String = "",
    @SerialName("added") @Serializable(with = LooseText::class) val added: String = "",
    @SerialName("plot") @Serializable(with = LooseText::class) val plot: String = "",
    @SerialName("genre") @Serializable(with = LooseText::class) val genre: String = "",
    @SerialName("quality") @Serializable(with = LooseText::class) val quality: String = "",
    @SerialName("year") @Serializable(with = LooseText::class) val year: String = "",
    @SerialName("releaseDate") @Serializable(with = LooseText::class) val releaseDate: String = "",
    @SerialName("release_date") @Serializable(with = LooseText::class) val releaseDateSnake: String = "",
)

@Serializable
data class XtreamSeriesDto(
    @SerialName("series_id") @Serializable(with = LooseText::class) val seriesId: String = "",
    @SerialName("name") @Serializable(with = LooseText::class) val name: String = "",
    @SerialName("category_id") @Serializable(with = LooseText::class) val categoryId: String = "",
    @SerialName("cover") @Serializable(with = LooseText::class) val cover: String = "",
    @SerialName("stream_icon") @Serializable(with = LooseText::class) val icon: String = "",
    @SerialName("last_modified") @Serializable(with = LooseText::class) val lastModified: String = "",
    @SerialName("plot") @Serializable(with = LooseText::class) val plot: String = "",
    @SerialName("genre") @Serializable(with = LooseText::class) val genre: String = "",
    @SerialName("year") @Serializable(with = LooseText::class) val year: String = "",
    @SerialName("releaseDate") @Serializable(with = LooseText::class) val releaseDate: String = "",
    @SerialName("release_date") @Serializable(with = LooseText::class) val releaseDateSnake: String = "",
)
