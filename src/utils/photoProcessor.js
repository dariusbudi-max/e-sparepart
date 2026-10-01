export const createWatermarkedImage = (source, kodeBarang = "NO-KODE") => {
    return new Promise((resolve, reject) => {
        try {
            const width = source.videoWidth || source.naturalWidth || source.width;
            const height = source.videoHeight || source.naturalHeight || source.height;

            if (!width || !height) return reject(new Error("Ukuran gambar tidak valid."));

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            ctx.drawImage(source, 0, 0, width, height);

            const diagonal = Math.sqrt(width * width + height * height);
            const wmSize = Math.max(46, Math.round(diagonal / 20));

            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(-Math.PI / 4);

            ctx.font = `bold ${wmSize}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";

            ctx.lineWidth = Math.max(2, wmSize * 0.04);
            ctx.strokeStyle = "rgba(255,255,255,0.18)";
            ctx.strokeText("VicKey Sparepart", 0, 0);

            ctx.shadowColor = "rgba(0,0,0,0.45)";
            ctx.shadowBlur = 10;
            ctx.fillStyle = "rgba(190,190,190,0.28)";
            ctx.fillText("VicKey Sparepart", 0, 0);

            ctx.restore();

            const fontSize = Math.max(18, Math.round(width * 0.024));
            const padding = Math.round(fontSize * 0.7);
            const boxHeight = fontSize * 2;

            ctx.font = `bold ${fontSize}px Arial`;

            const now = new Date();
            const tanggal = now.toLocaleDateString("id-ID");
            const waktu = now.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });

            const textKode = `Kode : ${kodeBarang}`;
            const textTanggal = `${tanggal} ${waktu}`;

            const boxKodeWidth = ctx.measureText(textKode).width + padding * 2;
            const boxTanggalWidth = ctx.measureText(textTanggal).width + padding * 2;
            const bottom = height - padding;

            ctx.fillStyle = "rgba(0,0,0,0.70)";
            ctx.fillRect(padding, bottom - boxHeight, boxKodeWidth, boxHeight);
            ctx.fillStyle = "#FFFFFF";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(textKode, padding * 2, bottom - boxHeight / 2);

            ctx.fillStyle = "rgba(0,0,0,0.70)";
            ctx.fillRect(width - boxTanggalWidth - padding, bottom - boxHeight, boxTanggalWidth, boxHeight);
            ctx.fillStyle = "#FFFFFF";
            ctx.textAlign = "left";
            ctx.fillText(textTanggal, width - boxTanggalWidth, bottom - boxHeight / 2);

            resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch (err) {
            reject(err);
        }
    });
};

export const createMonitoringWatermarkedImage = (source, coordinates, capturedAt = new Date()) => {
    return new Promise((resolve, reject) => {
        try {
            if (!coordinates || !Number.isFinite(Number(coordinates.latitude)) || !Number.isFinite(Number(coordinates.longitude))) {
                reject(new Error("Foto monitoring wajib memiliki koordinat GPS."));
                return;
            }

            const width = source.videoWidth || source.naturalWidth || source.width;
            const height = source.videoHeight || source.naturalHeight || source.height;

            if (!width || !height) {
                reject(new Error("Ukuran gambar tidak valid."));
                return;
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Canvas tidak dapat digunakan."));
                return;
            }

            ctx.drawImage(source, 0, 0, width, height);

            const diagonal = Math.sqrt(width * width + height * height);
            const wmSize = Math.max(46, Math.round(diagonal / 20));

            ctx.save();
            ctx.translate(width / 2, height / 2);
            ctx.rotate(-Math.PI / 4);
            ctx.font = `bold ${wmSize}px Arial`;
            ctx.textAlign = "center";
            ctx.textBaseline = "middle";
            ctx.lineWidth = Math.max(2, wmSize * 0.04);
            ctx.strokeStyle = "rgba(255,255,255,0.15)";
            ctx.strokeText("VicKey Sparepart", 0, 0);

            ctx.shadowColor = "rgba(0,0,0,0.45)";
            ctx.shadowBlur = 10;
            ctx.fillStyle = "rgba(190,190,190,0.25)";
            ctx.fillText("VicKey Sparepart", 0, 0);
            ctx.restore();

            const fontSize = Math.max(18, Math.round(width * 0.024));
            const padding = Math.round(fontSize * 0.7);
            const lineHeight = Math.round(fontSize * 1.35);
            const boxHeight = lineHeight + padding * 2;

            ctx.font = `bold ${fontSize}px Arial`;

            const date = new Date(capturedAt);
            const tanggal = date.toLocaleDateString("id-ID");
            const waktu = date.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
            const textTanggal = `${tanggal} ${waktu}`;

            const latitude = Number(coordinates.latitude).toFixed(6);
            const longitude = Number(coordinates.longitude).toFixed(6);
            const accuracy = Number.isFinite(Number(coordinates.accuracy)) ? Math.round(Number(coordinates.accuracy)) : null;

            const textKoordinat = `${latitude}, ${longitude}`;
            const textAccuracy = accuracy !== null ? `Akurasi: ±${accuracy} m` : null;

            const tanggalWidth = ctx.measureText(textTanggal).width;
            const koordinatWidth = ctx.measureText(textKoordinat).width;
            const accuracyWidth = textAccuracy ? ctx.measureText(textAccuracy).width : 0;

            const gpsTextWidth = Math.max(koordinatWidth, accuracyWidth);
            const tanggalBoxWidth = tanggalWidth + padding * 2;
            const koordinatBoxWidth = gpsTextWidth + padding * 2;
            const bottom = height - padding;

            ctx.fillStyle = "rgba(0,0,0,0.72)";
            ctx.fillRect(padding, bottom - boxHeight, tanggalBoxWidth, boxHeight);

            ctx.fillStyle = "#FFFFFF";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";
            ctx.fillText(textTanggal, padding * 2, bottom - boxHeight / 2);

            ctx.fillStyle = "rgba(0,0,0,0.72)";
            ctx.fillRect(width - koordinatBoxWidth - padding, bottom - boxHeight * 2, koordinatBoxWidth, boxHeight * 2);

            ctx.fillStyle = "#FFFFFF";
            ctx.fillText(textKoordinat, width - koordinatBoxWidth + padding, bottom - boxHeight * 1.5);

            if (textAccuracy) {
                ctx.font = `${Math.max(14, Math.round(fontSize * 0.8))}px Arial`;
                ctx.fillText(textAccuracy, width - koordinatBoxWidth + padding, bottom - boxHeight * 0.7);
            }

            resolve(canvas.toDataURL("image/jpeg", 0.92));
        } catch (err) {
            reject(err);
        }
    });
};

export const getCurrentLocation = (options = {}) => {
    return new Promise((resolve, reject) => {
        if (!window.isSecureContext) {
            const error = new Error("Lokasi GPS membutuhkan koneksi HTTPS. Buka aplikasi melalui HTTPS atau localhost.");
            error.code = "INSECURE_CONTEXT";
            reject(error);
            return;
        }

        if (!navigator.geolocation) {
            const error = new Error("Browser/perangkat tidak mendukung layanan lokasi GPS.");
            error.code = "NOT_SUPPORTED";
            reject(error);
            return;
        }

        const defaultOptions = { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 };

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const { latitude, longitude, accuracy } = position.coords;
                if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
                    const error = new Error("Koordinat GPS yang diterima tidak valid.");
                    error.code = "INVALID_COORDINATES";
                    reject(error);
                    return;
                }
                resolve({ latitude, longitude, accuracy });
            },
            (error) => {
                let message;
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        message = "Izin lokasi ditolak. Aktifkan izin Lokasi untuk situs ini di browser, lalu pilih foto kembali.";
                        break;
                    case error.POSITION_UNAVAILABLE:
                        message = "Lokasi GPS tidak tersedia. Aktifkan GPS/Lokasi perangkat dan pastikan Anda berada di area dengan sinyal lokasi.";
                        break;
                    case error.TIMEOUT:
                        message = "Pengambilan lokasi GPS terlalu lama. Pastikan GPS aktif dan coba ambil foto kembali.";
                        break;
                    default:
                        message = "Gagal mendapatkan lokasi GPS. Silakan coba kembali.";
                }
                const gpsError = new Error(message);
                gpsError.code = error.code;
                reject(gpsError);
            },
            { ...defaultOptions, ...options }
        );
    });
};