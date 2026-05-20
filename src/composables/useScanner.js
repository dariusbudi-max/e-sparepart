const { ref } = Vue;

export const useScanner = (onScan) => {

    let scanner = null;
    const active = ref(false);
    const lastScanMap = new Map();

    let audioCtx = null;

    const initAudio = () => {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === "suspended") {
            audioCtx.resume();
        }
    };

    const playBeep = () => {
        if (!audioCtx) return;

        const oscillator = audioCtx.createOscillator();
        const gain = audioCtx.createGain();

        oscillator.connect(gain);
        gain.connect(audioCtx.destination);

        oscillator.start();
        oscillator.stop(audioCtx.currentTime + 0.1);
    };

    const start = async () => {
        if (scanner) return;

        scanner = new window.Html5Qrcode("reader");

        try {
            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: 250 },
                (txt) => {
                    if (!txt) return;

                    const now = Date.now();
                    const lastTime = lastScanMap.get(txt) || 0;

                    if (now - lastTime < 1000) return;

                    lastScanMap.set(txt, now);

                    onScan(txt);
                    playBeep();
                }
            );

            active.value = true;
            initAudio();

        } catch (err) {
            console.error("Camera start error:", err);
        }
    };

    const stop = async () => {
        if (!scanner) return;

        try {
            await scanner.stop();
            await scanner.clear();
        } catch (e) {
            console.error("Stop error:", e);
        }

        scanner = null;
        active.value = false;

        if (lastScanMap.size > 100) {
            lastScanMap.clear();
        }
    };

    return { start, stop, active };
};