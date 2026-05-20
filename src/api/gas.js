const GAS_URL = "https://script.google.com/macros/s/AKfycbzZseOoD_W66OnQEyidErLCATN3RkCJHCJHowtQ9fYFNI2OkSNUyPSN9H0XXm60zpMp/exec";

export const callAPI = async (action, payload = {}, overrideToken = null) => {
    try {
        const response = await fetch(GAS_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain'
            },
            body: JSON.stringify({
                action,
                token: overrideToken || localStorage.getItem('token'),
                payload
            })
        });

        const res = await response.json();

        if (res.status === 'error' && res.message === 'INVALID_SESSION') {
            alert("Sesi Anda berakhir karena login di perangkat lain.");
            window.location.href = '/login';
            return res;
        }

        return res;

    } catch (e) {
        console.error("API Error:", e);
        return { status: 'error', message: 'Koneksi gagal' };
    }
};