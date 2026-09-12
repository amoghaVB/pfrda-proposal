export async function assembleFile(meta, fetcher = fetch, onProgress = () => {}) {
  if (!meta || !Number.isSafeInteger(meta.bytes) || meta.bytes <= 0 || !Array.isArray(meta.parts) || !meta.parts.length) throw new Error('This document is unavailable.');
  const buffers = [];
  let completed = 0;
  for (const part of meta.parts) {
    if (!/^downloads\/[a-f0-9]{20}\/part-\d{3}\.bin$/.test(part.url) || !Number.isSafeInteger(part.bytes) || part.bytes <= 0 || part.bytes > 20 * 1024 * 1024) throw new Error('This document has an invalid download link.');
    const response = await fetcher(part.url, {credentials:'same-origin'});
    if (!response.ok) throw new Error('The download was interrupted. Please try again.');
    const data = await response.arrayBuffer();
    if (data.byteLength !== part.bytes) throw new Error('The download was incomplete. Please try again.');
    buffers.push(data);
    completed += data.byteLength;
    onProgress(completed, meta.bytes);
  }
  if (completed !== meta.bytes) throw new Error('The download was incomplete. Please try again.');
  return new Blob(buffers, {type:meta.type});
}

async function openDocument() {
  const title = document.getElementById('title');
  const status = document.getElementById('status');
  const progress = document.getElementById('progress');
  const detail = document.getElementById('detail');
  const retry = document.getElementById('retry');
  retry.addEventListener('click', () => location.reload());
  try {
    const id = new URLSearchParams(location.search).get('file');
    const response = await fetch('download-manifest.json', {credentials:'same-origin'});
    if (!response.ok) throw new Error('Document details could not be loaded. Please try again.');
    const files = await response.json();
    const meta = /^[a-f0-9]{20}$/.test(id || '') && Object.hasOwn(files, id) ? files[id] : null;
    if (!meta) throw new Error('This document is unavailable. Return to the proposal and choose a file.');
    title.textContent = meta.name.replace(/\.(pdf|pptx)$/i, '');
    document.title = title.textContent + ' | PFRDA';
    const size = (meta.bytes / 1048576).toFixed(1) + ' MB';
    status.textContent = 'Loading the original document (' + size + ')…';
    const blob = await assembleFile(meta, fetch, (done, total) => {
      const percent = Math.round(done / total * 100);
      progress.value = percent;
      status.textContent = 'Loading document: ' + percent + '% of ' + size;
    });
    const url = URL.createObjectURL(blob);
    const save = document.getElementById('save');
    save.href = url;
    save.download = meta.name;
    save.hidden = false;
    progress.hidden = true;
    detail.textContent = 'Original file • ' + size;
    if (meta.type === 'application/pdf') {
      const preview = document.getElementById('preview');
      preview.src = url;
      preview.hidden = false;
      status.textContent = 'Your PDF is ready. You can view it below or download it.';
    } else {
      save.click();
      status.textContent = 'Your PowerPoint is ready. If the download does not start, select Download original file.';
    }
    addEventListener('pagehide', () => URL.revokeObjectURL(url), {once:true});
  } catch (error) {
    progress.hidden = true;
    status.textContent = error.message || 'The document could not be loaded. Please try again.';
    detail.textContent = 'Your proposal is still available from the link above.';
    retry.hidden = false;
  }
}
if (typeof document !== 'undefined') openDocument();
