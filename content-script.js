(function () {
  // GitHub repository base URL for raw content
  const GITHUB_RAW_BASE =
    "https://raw.githubusercontent.com/beeinger/kimono-bunka-ynu-ac-jp-fix/main/mp4/";

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
    if (width) video.width = parseInt(width, 10) || undefined;
    if (height) video.height = parseInt(height, 10) || undefined;

    // MP4 source
    const source = document.createElement("source");
    source.src = mp4Url;
    source.type = "video/mp4";
    video.appendChild(source);

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
    mp4Link.style.marginRight = "12px";
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
      wmvLink.style.marginRight = "12px";
      wmvLink.style.color = "#666";
      tools.appendChild(wmvLink);
    }

    // copy button
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy MP4 URL";
    copyBtn.style.padding = "2px 6px";
    copyBtn.style.cursor = "pointer";
    copyBtn.style.border = "1px solid #ccc";
    copyBtn.style.borderRadius = "3px";
    copyBtn.style.background = "#f5f5f5";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(mp4Url);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy MP4 URL"), 1200);
      } catch {}
    });
    tools.appendChild(copyBtn);

    // video info
    const videoInfo = document.createElement("div");
    videoInfo.style.marginTop = "4px";
    videoInfo.style.color = "#555";
    videoInfo.style.fontSize = "12px";
    videoInfo.innerHTML =
      "🎬 Optimized MP4 video with embedded Japanese & English subtitles";

    container.appendChild(video);
    container.appendChild(tools);
    container.appendChild(videoInfo);
    return container;
  }

  /**
   * Try to extract an ASX path from:
   *  - <embed src="...asx">
   *  - sibling/child <param name="URL" value="...asx"> (older pattern)
   */
  function getAsxFromEmbed(embed) {
    // 1) direct src
    let asx = embed.getAttribute("src") || embed.getAttribute("data");
    if (asx && /\.asx(\b|$)/i.test(asx)) return asx;

    // 2) <param name="URL" value="...asx">
    const params = embed.parentElement
      ? embed.parentElement.querySelectorAll(
          'param[name="URL"], param[name="Url"], param[name="url"]'
        )
      : embed.querySelectorAll?.(
          'param[name="URL"], param[name="Url"], param[name="url"]'
        );

    for (const p of params || []) {
      const v = p.getAttribute("value");
      if (v && /\.asx(\b|$)/i.test(v)) return v;
    }
    return null;
  }

  function replaceEmbeds() {
    const embeds = Array.from(document.querySelectorAll("embed"));

    for (const embed of embeds) {
      const asxPath = getAsxFromEmbed(embed);
      if (!asxPath) continue;

      const w = embed.getAttribute("width");
      const h = embed.getAttribute("height");

      const mp4Url = toMp4UrlFromEmbedSrc(asxPath);
      if (!mp4Url) continue;

      const videoEl = buildVideoElement(mp4Url, asxPath, w, h);
      embed.replaceWith(videoEl);
    }
  }

  // Run once on load; also try again if late-loaded markup appears.
  replaceEmbeds();

  // MutationObserver for any dynamically injected <embed> tags
  const mo = new MutationObserver((muts) => {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.tagName?.toLowerCase() === "embed") {
          // Just process this one
          const asx = getAsxFromEmbed(node);
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
          node.querySelectorAll?.("embed").forEach((e) => {
            const asx = getAsxFromEmbed(e);
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
