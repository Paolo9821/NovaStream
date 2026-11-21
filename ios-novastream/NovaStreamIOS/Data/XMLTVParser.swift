import Foundation

/// XMLTV guide parser. Only programmes inside the requested window are kept.
nonisolated final class XMLTVParser: NSObject, XMLParserDelegate {
    static func normalizeName(_ value: String) -> String {
        var s = value.lowercased()
        s = s.replacingOccurrences(of: #"\(.*?\)"#, with: " ", options: .regularExpression)
        s = s.replacingOccurrences(of: #"\b(hd|fhd|uhd|4k|sd|full ?hd)\b"#, with: " ", options: .regularExpression)
        return s.filter { ("a"..."z").contains($0) || ("0"..."9").contains($0) }
    }

    static func parse(data raw: Data, sourceUrl: String, from: Double, to: Double) -> EpgGuide {
        let data = Gzip.isGzipped(raw) ? (Gzip.decompress(raw) ?? raw) : raw
        let delegate = XMLTVParser(from: from, to: to)
        let parser = XMLParser(data: data)
        parser.delegate = delegate
        parser.parse()
        let sorted = delegate.programmes.mapValues { $0.sorted { $0.start < $1.start } }
        return EpgGuide(sourceUrl: sourceUrl, updated: Date(), byChannel: sorted, nameIndex: delegate.nameIndex)
    }

    private let windowStart: Double
    private let windowEnd: Double
    var programmes: [String: [Programme]] = [:]
    var nameIndex: [String: String] = [:]

    private var channelId: String?
    private var progChannel: String?
    private var progStart: Double?
    private var progStop: Double?
    private var title = ""
    private var desc: String?
    private var category: String?
    private var text = ""
    private var inProgramme = false

    private static let withZone: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyyMMddHHmmss Z"; return f
    }()
    private static let withoutZone: DateFormatter = {
        let f = DateFormatter(); f.locale = Locale(identifier: "en_US_POSIX"); f.dateFormat = "yyyyMMddHHmmss"; f.timeZone = .current; return f
    }()

    init(from: Double, to: Double) {
        windowStart = from
        windowEnd = to
    }

    func parser(_ parser: XMLParser, didStartElement name: String, namespaceURI: String?, qualifiedName: String?, attributes: [String: String] = [:]) {
        text = ""
        switch name.lowercased() {
        case "channel":
            channelId = attributes["id"]?.lowercased()
            if let id = channelId { nameIndex[Self.normalizeName(id)] = nameIndex[Self.normalizeName(id)] ?? id }
        case "programme":
            inProgramme = true
            progChannel = attributes["channel"]?.lowercased()
            progStart = Self.time(attributes["start"])
            progStop = Self.time(attributes["stop"])
            title = ""; desc = nil; category = nil
        default: break
        }
    }

    func parser(_ parser: XMLParser, foundCharacters string: String) {
        text += string
    }

    func parser(_ parser: XMLParser, didEndElement name: String, namespaceURI: String?, qualifiedName: String?) {
        let value = text.trimmed
        switch name.lowercased() {
        case "display-name":
            if let id = channelId, !inProgramme {
                let key = Self.normalizeName(value)
                if !key.isEmpty, nameIndex[key] == nil { nameIndex[key] = id }
            }
        case "channel":
            channelId = nil
        case "title" where inProgramme:
            if title.isEmpty { title = value }
        case "desc" where inProgramme:
            if desc == nil, !value.isEmpty { desc = value }
        case "category" where inProgramme:
            if category == nil, !value.isEmpty { category = value }
        case "programme":
            inProgramme = false
            if let ch = progChannel, !ch.isEmpty, let start = progStart, !title.isEmpty {
                let stop = progStop ?? start + 3600
                if stop >= windowStart, start <= windowEnd {
                    programmes[ch, default: []].append(Programme(title: title, start: start, stop: stop, desc: desc, category: category))
                }
            }
        default: break
        }
        text = ""
    }

    private static func time(_ raw: String?) -> Double? {
        guard let value = raw?.trimmed, !value.isEmpty else { return nil }
        let date = value.count > 14 ? withZone.date(from: value) : withoutZone.date(from: value)
        return date?.timeIntervalSince1970
    }
}

/// Minimal gzip reader: strips the gzip header and inflates the raw deflate body.
nonisolated enum Gzip {
    static func isGzipped(_ data: Data) -> Bool {
        data.count > 18 && data[data.startIndex] == 0x1f && data[data.startIndex + 1] == 0x8b
    }

    static func decompress(_ data: Data) -> Data? {
        let bytes = [UInt8](data)
        guard bytes.count > 18, bytes[2] == 8 else { return nil }
        let flags = bytes[3]
        var index = 10
        if flags & 0x04 != 0 { // FEXTRA
            guard index + 2 <= bytes.count else { return nil }
            index += 2 + Int(bytes[index]) + Int(bytes[index + 1]) << 8
        }
        if flags & 0x08 != 0 { while index < bytes.count, bytes[index] != 0 { index += 1 }; index += 1 } // FNAME
        if flags & 0x10 != 0 { while index < bytes.count, bytes[index] != 0 { index += 1 }; index += 1 } // FCOMMENT
        if flags & 0x02 != 0 { index += 2 } // FHCRC
        guard index < bytes.count - 8 else { return nil }
        let body = Data(bytes[index..<(bytes.count - 8)])
        return try? (body as NSData).decompressed(using: .zlib) as Data
    }
}
