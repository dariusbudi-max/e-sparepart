const { ref } = Vue;

export const useScanner = (readerId, onScan, scannerConfig = {}) => {
    let scanner = null;
    const active = ref(false);
    const starting = ref(false);
    const lastScanMap = new Map();
    let audioCtx = null;

    const config = {
        fps: scannerConfig.fps || 10,
        qrbox: scannerConfig.qrbox || { width: 300, height: 150 },
        aspectRatio: scannerConfig.aspectRatio || 1.777778,
        formatsToSupport: scannerConfig.formatsToSupport
    };

    const initAudio = async () => {
        try {
            if (!audioCtx) {
                const AudioContext = window.AudioContext || window.webkitAudioContext;
                if (!AudioContext) return;
                audioCtx = new AudioContext();
            }
            if (audioCtx.state === "suspended") await audioCtx.resume();
        } catch (err) {
            console.warn("Audio init error:", err);
        }
    };

    const playBeep = () => {
        if (!audioCtx) return;
        try {
            const oscillator = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            oscillator.type = "sine";
            oscillator.frequency.value = 880;
            gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            oscillator.connect(gain);
            gain.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
        } catch (err) {
            console.warn("Beep error:", err);
        }
    };

    const start = async () => {
        if (starting.value || active.value) return;
        if (!window.Html5Qrcode) throw new Error("Library Html5Qrcode belum tersedia");

        const el = document.getElementById(readerId);
        if (!el) throw new Error(`Element #${readerId} tidak ditemukan`);

        starting.value = true;
        try {
            if (scanner) {
                try {
                    if (scanner.isScanning) await scanner.stop();
                } catch (err) {
                    console.warn("Stop old scanner:", err);
                }
                try {
                    await scanner.clear();
                } catch (err) {
                    console.warn("Clear old scanner:", err);
                }
                scanner = null;
            }
            scanner = new window.Html5Qrcode(readerId);
            await initAudio();
            let callbackProcessing = false;

            await scanner.start(
                { facingMode: "environment" },
                config,
                async (decodedText) => {
                    if (!decodedText) return;

                    const txt = String(decodedText)
                        .replace(/\r/g, "")
                        .replace(/\n/g, "")
                        .trim();

                    if (!txt) return;

                    if (callbackProcessing) return;

                    const now = Date.now();
                    const lastTime = lastScanMap.get(txt) || 0;

                    if (now - lastTime < 1500) {
                        return;
                    }

                    lastScanMap.set(txt, now);
                    callbackProcessing = true;

                    playBeep();

                    try {
                        await onScan(txt);
                    } catch (err) {
                        console.error(
                            `Scanner callback error #${readerId}:`,
                            err
                        );
                    } finally {
                        callbackProcessing = false;
                    }
                },
                () => { }
            );
            active.value = true;
        } catch (err) {
            console.error(`Camera start error #${readerId}:`, err);
            scanner = null;
            active.value = false;
            throw err;
        } finally {
            starting.value = false;
        }
    };

    const stop = async () => {
        if (starting.value) return;
        const currentScanner = scanner;
        scanner = null;
        active.value = false;
        if (!currentScanner) {
            lastScanMap.clear();
            return;
        }
        try {
            if (currentScanner.isScanning) await currentScanner.stop();
        } catch (err) {
            console.warn(`Scanner stop error #${readerId}:`, err);
        }
        try {
            await currentScanner.clear();
        } catch (err) {
            console.warn(`Scanner clear error #${readerId}:`, err);
        }
        lastScanMap.clear();
    };

    return { start, stop, active, starting };
};