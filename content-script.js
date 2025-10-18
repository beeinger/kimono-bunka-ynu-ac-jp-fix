(function () {
  /**
   * Build the absolute WMV URL:
   *   page: https://kimono-bunka.ynu.ac.jp/nuikata_en/05/12.html
   *   embed src: move/017.asx
   *   -> https://kimono-bunka.ynu.ac.jp/nuikata_en/05/move/017.wmv
   */
  function toWmvUrlFromEmbedSrc(embedSrc) {
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
   * Create a <video> replacement with controls and a fallback link.
   * Width/height preserved from the original <embed> when present.
   */
  function buildVideoElement(wmvUrl, width, height) {
    const container = document.createElement("div");
    container.style.display = "inline-block";
    container.style.font = "14px/1.4 system-ui, sans-serif";

    // feature-detect WMV support
    const canPlayWmv = !!document
      .createElement("video")
      .canPlayType("video/x-ms-wmv");

    // video (we’ll hide it if unsupported)
    const video = document.createElement("video");
    video.setAttribute("controls", "controls");
    if (width) video.width = parseInt(width, 10) || undefined;
    if (height) video.height = parseInt(height, 10) || undefined;

    const source = document.createElement("source");
    source.src = wmvUrl;
    source.type = "video/x-ms-wmv";
    video.appendChild(source);

    // link row
    const tools = document.createElement("p");
    tools.style.margin = "6px 0";

    const a = document.createElement("a");
    a.href = wmvUrl;
    a.textContent = "Open / download WMV";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.setAttribute("download", ""); // hint the browser to download
    tools.appendChild(a);

    // copy button
    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy URL";
    copyBtn.style.marginLeft = "8px";
    copyBtn.style.padding = "2px 6px";
    copyBtn.style.cursor = "pointer";
    copyBtn.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(wmvUrl);
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy URL"), 1200);
      } catch {}
    });
    tools.appendChild(copyBtn);

    // notice when unsupported
    const note = document.createElement("div");
    note.style.marginTop = "4px";
    note.style.color = "#555";
    note.textContent =
      "Your browser can’t play WMV. Use the link above, then play in VLC / mpv or convert to MP4.";

    if (!canPlayWmv) {
      video.style.display = "none"; // hide broken player
      note.style.display = "block";
    } else {
      note.style.display = "none";
    }

    container.appendChild(video);
    container.appendChild(tools);
    container.appendChild(note);
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

      const wmvUrl = toWmvUrlFromEmbedSrc(asxPath);
      if (!wmvUrl) continue;

      const videoEl = buildVideoElement(wmvUrl, w, h);
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
            const wmvUrl = toWmvUrlFromEmbedSrc(asx);
            if (wmvUrl) {
              const w = node.getAttribute("width");
              const h = node.getAttribute("height");
              node.replaceWith(buildVideoElement(wmvUrl, w, h));
            }
          }
        } else {
          // Or scan within it
          node.querySelectorAll?.("embed").forEach((e) => {
            const asx = getAsxFromEmbed(e);
            if (!asx) return;
            const wmvUrl = toWmvUrlFromEmbedSrc(asx);
            if (!wmvUrl) return;
            const w = e.getAttribute("width");
            const h = e.getAttribute("height");
            e.replaceWith(buildVideoElement(wmvUrl, w, h));
          });
        }
      }
    }
  });

  mo.observe(document.documentElement, { childList: true, subtree: true });
})();
