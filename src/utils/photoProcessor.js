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
