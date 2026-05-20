const PLACEHOLDER = "https://placehold.co/400x400?text=No+Image";

export const compressImage = (file, { maxSize = 1280, quality = 0.8, mimeType = "image/jpeg" } = {}) => {
    return new Promise((resolve, reject) => {
        if (!file) { reject(new Error("File kosong")); return; }
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                let width = img.width, height = img.height;
                if (width > height && width > maxSize) { height *= maxSize / width; width = maxSize; }
                else if (height > maxSize) { width *= maxSize / height; height = maxSize; }
                const canvas = document.createElement("canvas");
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(img, 0, 0, width, height);
                const base64 = canvas.toDataURL(mimeType, quality).split(",")[1];
                resolve(base64);
                canvas.width = 0; canvas.height = 0;
            };
            img.onerror = reject;
            img.src = e.target.result;
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};

export const fixDriveUrl = (url) => {
    if (!url || url === "null") return PLACEHOLDER;
    try {
        const match = url.match(/[-\w]{25,}/);
        if (match?.[0]) {
            const fileId = match[0];
            return `https://lh3.googleusercontent.com/d/${fileId}=w600`;
        }
        return url;
    } catch {
        return PLACEHOLDER;
    }
};