/* تسجيل الصوت WAV (١٦ كيلوهرتز) عشان Gemini يسمعه */
window.mRec = (function () {
  let ac = null, src = null, proc = null, stream = null, chunks = [], rate = 48000, on = false;
  async function start() {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    ac = new (window.AudioContext || window.webkitAudioContext)(); await ac.resume(); rate = ac.sampleRate;
    src = ac.createMediaStreamSource(stream); proc = ac.createScriptProcessor(4096, 1, 1); chunks = [];
    proc.onaudioprocess = e => chunks.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    src.connect(proc); proc.connect(ac.destination); on = true;
  }
  function stop() {
    on = false;
    try { proc.disconnect(); src.disconnect(); } catch (e) {}
    try { stream.getTracks().forEach(t => t.stop()); ac.close(); } catch (e) {}
    const len = chunks.reduce((s, c) => s + c.length, 0), all = new Float32Array(len); let o = 0;
    chunks.forEach(c => { all.set(c, o); o += c.length; });
    const ratio = rate / 16000, n = Math.floor(len / ratio), pcm = new Int16Array(n);
    for (let i = 0; i < n; i++) {
      const a = Math.floor(i * ratio), b = Math.min(len, Math.floor((i + 1) * ratio)); let s = 0;
      for (let k = a; k < b; k++) s += all[k];
      const v = Math.max(-1, Math.min(1, s / Math.max(1, b - a))); pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const buf = new ArrayBuffer(44 + pcm.length * 2), dv = new DataView(buf);
    const w = (p, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(p + i, s.charCodeAt(i)); };
    w(0, "RIFF"); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, "WAVE"); w(12, "fmt "); dv.setUint32(16, 16, true);
    dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, 16000, true); dv.setUint32(28, 32000, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, "data"); dv.setUint32(40, pcm.length * 2, true);
    new Int16Array(buf, 44).set(pcm);
    let bin = ""; const u8 = new Uint8Array(buf);
    for (let i = 0; i < u8.length; i += 8192) bin += String.fromCharCode.apply(null, u8.subarray(i, i + 8192));
    return { b64: btoa(bin), secs: n / 16000 };
  }
  return { start, stop, get on() { return on; } };
})();
