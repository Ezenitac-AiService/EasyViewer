use std::io::Read;

use serde::Serialize;

use crate::commands::files::resolve_scope_and_whitelist;
use crate::security::path_guard::{resolve_validated_book_path, user_home_dir};

pub const MAX_METADATA_ENTRY_BYTES: u64 = 16 * 1024 * 1024;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExtractedEpubMetadataPayload {
    pub title: Option<String>,
    pub author: Option<String>,
    pub cover_bytes: Option<Vec<u8>>,
    pub cover_mime: Option<String>,
}

fn read_bounded_zip_entry<R: Read + std::io::Seek>(
    archive: &mut zip::ZipArchive<R>,
    name: &str,
    max_bytes: u64,
) -> Result<Vec<u8>, String> {
    let entry = archive
        .by_name(name)
        .map_err(|e| format!("EPUB_META_ENTRY_MISSING: {name}: {e}"))?;
    if entry.size() > max_bytes {
        return Err(format!(
            "ZIP_BOMB_GUARD: 엔트리({name}) 해독 크기가 상한({max_bytes} bytes)을 초과했습니다."
        ));
    }
    let mut limited = entry.take(max_bytes + 1);
    let mut buf = Vec::new();
    limited
        .read_to_end(&mut buf)
        .map_err(|e| format!("EPUB_META_READ_ERROR: {e}"))?;
    if buf.len() as u64 > max_bytes {
        return Err(format!(
            "ZIP_BOMB_GUARD: 엔트리({name}) 실제 해독 크기가 상한({max_bytes} bytes)을 초과했습니다."
        ));
    }
    Ok(buf)
}

fn extract_tag_text(xml: &str, local_tag: &str) -> Option<String> {
    let lower = xml.to_ascii_lowercase();
    let needle_gt = format!("{local_tag}>");
    let needle_sp = format!("{local_tag} ");
    let open_end = lower
        .find(&needle_gt)
        .map(|idx| idx + needle_gt.len() - 1)
        .or_else(|| {
            let start = lower.find(&needle_sp)?;
            lower[start..].find('>').map(|off| start + off)
        })?;
    let content_start = open_end + 1;
    let close_needle = format!("</{local_tag}>");
    let close_colon = format!(":{local_tag}>");
    let end = lower[content_start..]
        .find(&close_needle)
        .or_else(|| {
            let colon_pos = lower[content_start..].find(&close_colon)?;
            lower[content_start..content_start + colon_pos].rfind("</")
        })?;
    let val = xml[content_start..content_start + end].trim();
    if val.is_empty() {
        None
    } else {
        Some(val.to_string())
    }
}

fn extract_attr(tag_snippet: &str, attr_name: &str) -> Option<String> {
    for quote in ['"', '\''] {
        let pattern = format!("{attr_name}={quote}");
        if let Some(idx) = tag_snippet.find(&pattern) {
            let rest = &tag_snippet[idx + pattern.len()..];
            if let Some(end) = rest.find(quote) {
                return Some(rest[..end].to_string());
            }
        }
    }
    None
}

pub fn extract_epub_metadata_from_reader<R: Read + std::io::Seek>(
    reader: R,
    max_entry_bytes: u64,
) -> Result<ExtractedEpubMetadataPayload, String> {
    let mut archive = zip::ZipArchive::new(reader).map_err(|e| format!("EPUB_ZIP_ERROR: {e}"))?;
    let container_bytes =
        read_bounded_zip_entry(&mut archive, "META-INF/container.xml", max_entry_bytes)?;
    let container_xml = String::from_utf8_lossy(&container_bytes);
    let opf_path = extract_attr(&container_xml, "full-path")
        .ok_or_else(|| "EPUB_META_ERROR: container.xml에 full-path가 없습니다.".to_string())?;

    let opf_bytes = read_bounded_zip_entry(&mut archive, &opf_path, max_entry_bytes)?;
    let opf_xml = String::from_utf8_lossy(&opf_bytes);
    let title = extract_tag_text(&opf_xml, "title");
    let author = extract_tag_text(&opf_xml, "creator");

    let opf_dir = opf_path
        .rsplit_once('/')
        .map(|(dir, _)| format!("{dir}/"))
        .unwrap_or_default();

    let mut cover_href: Option<String> = None;
    let mut cover_mime: Option<String> = None;
    for chunk in opf_xml.split('<') {
        let lower = chunk.to_ascii_lowercase();
        if lower.starts_with("item ") && lower.contains("cover-image") {
            cover_href = extract_attr(chunk, "href");
            cover_mime = extract_attr(chunk, "media-type");
            break;
        }
    }

    let cover_bytes = match cover_href {
        Some(href) => {
            let full_cover = format!("{opf_dir}{href}");
            read_bounded_zip_entry(&mut archive, &full_cover, max_entry_bytes).ok()
        }
        None => None,
    };

    Ok(ExtractedEpubMetadataPayload {
        title,
        author,
        cover_bytes,
        cover_mime,
    })
}

#[tauri::command]
pub fn extract_epub_metadata_from_path(
    app: tauri::AppHandle,
    path: String,
) -> Result<ExtractedEpubMetadataPayload, String> {
    let (dirs, drops, fs_scope_allowed) = resolve_scope_and_whitelist(&app, &path)?;
    let canonical = resolve_validated_book_path(
        &path,
        &dirs,
        &drops,
        fs_scope_allowed,
        user_home_dir().as_deref(),
    )?;
    let file = std::fs::File::open(&canonical).map_err(|e| format!("FILE_READ_FAILED: {e}"))?;
    extract_epub_metadata_from_reader(file, MAX_METADATA_ENTRY_BYTES)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::{Cursor, Write};
    use zip::write::SimpleFileOptions;

    #[test]
    fn extracts_metadata_selectively_and_blocks_zip_bomb_entry_t018() {
        let mut cursor = Cursor::new(Vec::new());
        {
            let mut zw = zip::ZipWriter::new(&mut cursor);
            let opts = SimpleFileOptions::default();
            zw.start_file("META-INF/container.xml", opts).unwrap();
            zw.write_all(b"<container><rootfiles><rootfile full-path=\"OEBPS/content.opf\"/></rootfiles></container>").unwrap();
            zw.start_file("OEBPS/content.opf", opts).unwrap();
            zw.write_all(b"<package><metadata><dc:title>Rust Stream EPUB</dc:title><dc:creator>Edith</dc:creator></metadata><manifest><item id=\"c\" href=\"cover.png\" media-type=\"image/png\" properties=\"cover-image\"/></manifest></package>").unwrap();
            zw.start_file("OEBPS/cover.png", opts).unwrap();
            zw.write_all(&[137, 80, 78, 71]).unwrap();
            zw.finish().unwrap();
        }
        cursor.set_position(0);
        let parsed = extract_epub_metadata_from_reader(cursor.clone(), MAX_METADATA_ENTRY_BYTES).unwrap();
        assert_eq!(parsed.title.as_deref(), Some("Rust Stream EPUB"));
        assert_eq!(parsed.author.as_deref(), Some("Edith"));
        assert_eq!(parsed.cover_bytes.as_deref(), Some(&[137, 80, 78, 71][..]));

        cursor.set_position(0);
        let err = extract_epub_metadata_from_reader(cursor, 10).unwrap_err();
        assert!(err.contains("ZIP_BOMB_GUARD"));
    }
}
