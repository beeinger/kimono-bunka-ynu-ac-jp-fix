(function () {
  // GitHub repository base URL for raw content
  const GITHUB_RAW_BASE =
    "https://github.com/beeinger/kimono-bunka-ynu-ac-jp-fix/raw/refs/heads/main/mp4/";

  // Build extension URL for packaged VTT files
  function vttUrlInExtension(path) {
    // Works in Chrome/Firefox MV3
    return chrome.runtime.getURL(`vtt/${path}`);
  }

  /**
   * Extract video number from filename (e.g., "001.asx" -> "001")
   */
  function getVideoNumber(filename) {
    if (!filename) return null;
    const match = filename.match(/(\d{3})/);
    return match ? match[1] : null;
  }

  /**
   * Load VTT tracks by fetching from extension and creating Blob URLs to avoid CORS issues
   */
  async function attachVttTracks(video, videoNumber) {
    try {
      // Fetch Japanese VTT from extension
      const jpResponse = await fetch(
        vttUrlInExtension(`jp/${videoNumber}.vtt`)
      );
      if (jpResponse.ok) {
        const jpContent = await jpResponse.text();
        const jpBlob = new Blob([jpContent], { type: "text/vtt" });
        const jpBlobUrl = URL.createObjectURL(jpBlob);

        const jpTrack = document.createElement("track");
        jpTrack.kind = "subtitles";
        jpTrack.src = jpBlobUrl;
        jpTrack.srclang = "ja";
        jpTrack.label = "Japanese";
        jpTrack.default = true; // Enable Japanese by default
        video.appendChild(jpTrack);
      }
    } catch (error) {
      console.warn("Failed to load Japanese subtitles:", error);
    }

    try {
      // Fetch English VTT from extension
      const enResponse = await fetch(
        vttUrlInExtension(`en/${videoNumber}.vtt`)
      );
      if (enResponse.ok) {
        const enContent = await enResponse.text();
        const enBlob = new Blob([enContent], { type: "text/vtt" });
        const enBlobUrl = URL.createObjectURL(enBlob);

        const enTrack = document.createElement("track");
        enTrack.kind = "subtitles";
        enTrack.src = enBlobUrl;
        enTrack.srclang = "en";
        enTrack.label = "English";
        video.appendChild(enTrack);
      }
    } catch (error) {
      console.warn("Failed to load English subtitles:", error);
    }
  }

  /**
   * Convert ASX/WMV path to GitHub MP4 URL
   * Simply replaces the file extension with .mp4
   */
  function toMp4UrlFromEmbedSrc(embedSrc) {
    if (!embedSrc) return null;

    // Extract the filename from the path
    const filename = embedSrc.split("/").pop();

    // Replace .asx or .wmv with .mp4
    const mp4Filename = filename.replace(/\.(asx|wmv)$/i, ".mp4");

    // Return the GitHub raw URL for the MP4 file
    return GITHUB_RAW_BASE + mp4Filename;
  }

  /**
   * Get the original WMV URL from the ASX path
   * Converts ASX to WMV URL for downloading the original file
   */
  function getOriginalWmvUrl(embedSrc) {
    if (!embedSrc) return null;

    // Drop the filename from the current page URL to get the directory
    // e.g. https://.../nuikata_en/05/
    const pageDir = location.href.replace(/[^/]+$/, "");

    // Resolve the (possibly relative) .asx to an absolute URL in that directory
    // Then just swap the extension to .wmv
    try {
      const abs = new URL(embedSrc, pageDir).href;
      return abs.replace(/\.asx(\b|$)/i, ".wmv");
    } catch {
      return null;
    }
  }

  /**
   * Create a <video> replacement with controls and download options.
   * Width/height preserved from the original <embed> when present.
   */
  function buildVideoElement(mp4Url, originalAsxPath, width, height) {
    const container = document.createElement("div");
    container.style.display = "inline-block";
    container.style.font = "14px/1.4 system-ui, sans-serif";

    // video element with modern MP4 support
    const video = document.createElement("video");
    video.setAttribute("controls", "controls");
    // Make video bigger to match content width - use original width if available, otherwise default to 480px
    let videoWidth, videoHeight;
    if (width) {
      const originalWidth = parseInt(width, 10);
      // Scale up smaller videos to be more prominent
      videoWidth =
        originalWidth < 400
          ? Math.max(480, originalWidth * 1.5)
          : originalWidth;
    } else {
      videoWidth = 480; // Default larger size
    }

    // Calculate height to prevent jumping - use original height if available, otherwise calculate from width
    if (height) {
      const originalHeight = parseInt(height, 10);
      const originalWidth = parseInt(width, 10) || 320;
      // Scale height proportionally with width
      videoHeight = Math.round((originalHeight / originalWidth) * videoWidth);
    } else {
      // Default 16:9 aspect ratio for unknown dimensions
      videoHeight = Math.round((videoWidth * 9) / 16);
    }

    video.width = videoWidth;
    video.height = videoHeight;

    // MP4 source
    const source = document.createElement("source");
    source.src = mp4Url;
    source.type = "video/mp4";
    video.appendChild(source);

    // Add external VTT subtitle tracks
    const filename = originalAsxPath.split("/").pop();
    const videoNumber = getVideoNumber(filename);

    if (videoNumber) {
      attachVttTracks(video, videoNumber);
    }

    // download links row
    const tools = document.createElement("p");
    tools.style.margin = "6px 0";

    // MP4 download link
    const mp4Link = document.createElement("a");
    mp4Link.href = mp4Url;
    mp4Link.textContent = "Download MP4";
    mp4Link.target = "_blank";
    mp4Link.rel = "noopener noreferrer";
    mp4Link.setAttribute("download", "");
    mp4Link.style.marginRight = "8px";
    mp4Link.style.color = "#0066cc";
    tools.appendChild(mp4Link);

    // Original WMV download link
    const wmvUrl = getOriginalWmvUrl(originalAsxPath);
    if (wmvUrl) {
      const wmvLink = document.createElement("a");
      wmvLink.href = wmvUrl;
      wmvLink.textContent = "Download original WMV";
      wmvLink.target = "_blank";
      wmvLink.rel = "noopener noreferrer";
      wmvLink.setAttribute("download", "");
      wmvLink.style.marginRight = "8px";
      wmvLink.style.color = "#666";
      tools.appendChild(wmvLink);
    }

    // video info
    const videoInfo = document.createElement("div");
    videoInfo.style.marginTop = "4px";
    videoInfo.style.color = "#555";
    videoInfo.style.fontSize = "12px";
    videoInfo.innerHTML =
      "🎬 Optimized MP4 video with Japanese & English subtitles";

    container.appendChild(video);
    container.appendChild(tools);
    container.appendChild(videoInfo);
    return container;
  }

  /**
   * Try to extract an ASX path from:
   *  - <embed src="...asx">
   *  - <object> with <param name="URL" value="...asx">
   *  - sibling/child <param name="URL" value="...asx"> (older pattern)
   */
  function getAsxFromElement(element) {
    // 1) direct src (for embed tags)
    let asx = element.getAttribute("src") || element.getAttribute("data");
    if (asx && /\.asx(\b|$)/i.test(asx)) return asx;

    // 2) <param name="URL" value="...asx"> (for object tags)
    const params =
      element.querySelectorAll?.(
        'param[name="URL"], param[name="Url"], param[name="url"]'
      ) || [];

    for (const p of params) {
      const v = p.getAttribute("value");
      if (v && /\.asx(\b|$)/i.test(v)) return v;
    }

    // 3) Check parent element for params (fallback)
    const parentParams = element.parentElement
      ? element.parentElement.querySelectorAll(
          'param[name="URL"], param[name="Url"], param[name="url"]'
        )
      : [];

    for (const p of parentParams) {
      const v = p.getAttribute("value");
      if (v && /\.asx(\b|$)/i.test(v)) return v;
    }

    return null;
  }

  function replaceMediaElements() {
    // Handle both <object> and <embed> tags
    const elements = Array.from(document.querySelectorAll("object, embed"));

    for (const element of elements) {
      const asxPath = getAsxFromElement(element);
      if (!asxPath) continue;

      const w = element.getAttribute("width");
      const h = element.getAttribute("height");

      const mp4Url = toMp4UrlFromEmbedSrc(asxPath);
      if (!mp4Url) continue;

      const videoEl = buildVideoElement(mp4Url, asxPath, w, h);
      element.replaceWith(videoEl);
    }
  }

  // Run immediately to prevent ASX downloads
  replaceMediaElements();

  // MutationObserver for any dynamically injected <object> and <embed> tags
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (
          node.tagName?.toLowerCase() === "embed" ||
          node.tagName?.toLowerCase() === "object"
        ) {
          // Just process this one
          const asx = getAsxFromElement(node);
          if (asx) {
            const mp4Url = toMp4UrlFromEmbedSrc(asx);
            if (mp4Url) {
              const w = node.getAttribute("width");
              const h = node.getAttribute("height");
              node.replaceWith(buildVideoElement(mp4Url, asx, w, h));
            }
          }
        } else {
          // Or scan within it
          node.querySelectorAll?.("object, embed").forEach((e) => {
            const asx = getAsxFromElement(e);
            if (!asx) return;
            const mp4Url = toMp4UrlFromEmbedSrc(asx);
            if (!mp4Url) return;
            const w = e.getAttribute("width");
            const h = e.getAttribute("height");
            e.replaceWith(buildVideoElement(mp4Url, asx, w, h));
          });
        }
      }
    }
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
