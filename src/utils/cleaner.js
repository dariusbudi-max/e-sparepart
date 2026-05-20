export const cleanKode = (val) =>
    String(val ?? "")
        .normalize("NFKC")
        .replace(/\u00A0/g, "")
        .replace(/\s+/g, "")
        .replace(/\r/g, "")
        .toUpperCase()
        .trim();

export const cleanText = (val) =>
    String(val || "")
        .replace(/\u00A0/g, " ")
        .replace(/\s+/g, " ")
        .toUpperCase()
        .trim();

export const cleanQty = (val) => {
    if (val === null || val === undefined || val === '') return 0;
    return Number(
        String(val)
            .replace(/\./g, "")
            .replace(/,/g, ".")
            .replace(/[^\d.]/g, "")
    );
};