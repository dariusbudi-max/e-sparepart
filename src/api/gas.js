const GAS_URL = "https://script.google.com/macros/s/AKfycbya-cyKYGKC_qtgEN3tHE3QnS1N6th220gOrTLMF51Lw-UQybxhwtqNZrDmzcAZty7zQg/exec";

export const callAPI = async (action, payload = {}, overrideToken = null) => {
    try {
        const response = await fetch(GAS_URL, {
            method: "POST",
            headers: { "Content-Type": "text/plain;charset=utf-8" },
            body: JSON.stringify({ action, token: overrideToken || localStorage.getItem("token"), payload })
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const text = await response.text();
        let res;
        try {
            res = JSON.parse(text);
        } catch (parseError) {
            console.error("Response GAS bukan JSON:", text);
            throw new Error("Response server tidak valid.");
        }
        if (res?.status === "error" && res?.message === "INVALID_SESSION") {
            alert("Sesi Anda berakhir karena login di perangkat lain.");
            window.location.href = "/login";
            return res;
        }
        return res;
    } catch (e) {
        console.error("API Error:", e);
        return { status: "error", message: e?.message || "Koneksi ke server gagal." };
    }
};