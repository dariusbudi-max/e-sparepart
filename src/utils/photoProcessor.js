export const createWatermarkedImage = (source, kodeBarang = "NO-KODE") => {
    return new Promise((resolve, reject) => {
        try {
            const width = source.videoWidth || source.width;
            const height = source.videoHeight || source.height;

            if (!width || !height) {
                return reject(new Error("Ukuran gambar tidak valid."));
            }

            const size = Math.min(width, height);
            const canvas = document.createElement("canvas");
            canvas.width = size;
            canvas.height = size;

            const ctx = canvas.getContext("2d");
            const sx = (width - size) / 2;
            const sy = (height - size) / 2;

            ctx.drawImage(source, sx, sy, size, size, 0, 0, size, size);

            const text = `Kode: ${kodeBarang}`;
            ctx.font = "bold 20px Arial";
            ctx.textAlign = "left";
            ctx.textBaseline = "middle";

            const textWidth = ctx.measureText(text).width;
            const paddingX = 15;
            const boxWidth = textWidth + (paddingX * 2);
            const boxHeight = 45;
            const boxX = 10;
            const boxY = size - boxHeight - 15;

            ctx.fillStyle = "rgba(0,0,0,0.65)";
            ctx.fillRect(boxX, boxY, boxWidth, boxHeight);

            ctx.fillStyle = "#FFFFFF";
            ctx.fillText(text, boxX + paddingX, boxY + (boxHeight / 2));

            resolve(canvas.toDataURL("image/jpeg", 0.95));
        } catch (err) {
            reject(err);
        }
    });
};