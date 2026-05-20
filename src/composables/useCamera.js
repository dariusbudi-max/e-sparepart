export const useCamera = (videoRef) => {
    let stream = null;

    const startCamera = async () => {
        stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        if (videoRef.value) {
            videoRef.value.srcObject = stream;

            await new Promise(resolve => {
                videoRef.value.onloadedmetadata = () => {
                    resolve();
                };
            });

            await videoRef.value.play();
        }

        const track = stream.getVideoTracks()[0];
        const caps = track.getCapabilities?.();

        if (caps?.focusMode?.includes("continuous")) {
            await track.applyConstraints({
                advanced: [{ focusMode: "continuous" }]
            });
        }
    };

    const stopCamera = () => {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
            stream = null;
        }
        if (videoRef.value) {
            videoRef.value.pause();
            videoRef.value.srcObject = null;
        }
    };

    const takeSnapshot = () => {
        const video = videoRef.value;

        if (!video) {
            return null;
        }

        if (video.videoWidth === 0 || video.videoHeight === 0) {
            return null;
        }

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

        return canvas.toDataURL("image/jpeg", 0.8).split(",")[1];
    };

    return { startCamera, stopCamera, takeSnapshot };
};