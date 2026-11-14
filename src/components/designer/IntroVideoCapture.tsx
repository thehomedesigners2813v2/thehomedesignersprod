import { useEffect, useRef, useState } from 'react';

const MAX_SECONDS = 60;

const recorderType = () => {
  if (typeof MediaRecorder === 'undefined') return null;
  const candidates = ['video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) || null;
};

const uploadType = (recordedType: string) => recordedType.startsWith('video/mp4') ? 'video/mp4' : 'video/webm';

export default function IntroVideoCapture({
  disabled,
  onPicked,
  onRecorded
}: {
  disabled: boolean;
  onPicked: (file: File) => void;
  onRecorded: (file: File, durationSeconds: number) => void;
}) {
  const previewRef = useRef<HTMLVideoElement>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const discardRef = useRef(false);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (previewRef.current) previewRef.current.srcObject = null;
  };

  useEffect(() => {
    discardRef.current = false;
    return () => {
      discardRef.current = true;
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const finishRecording = () => {
    const recorder = recorderRef.current;
    if (!recorder || recorder.state === 'inactive') return;
    if (recorder.state === 'recording') recorder.requestData();
    recorder.stop();
  };

  const startRecording = async () => {
    setCameraError(null);
    const type = recorderType();
    if (!type || !navigator.mediaDevices?.getUserMedia) {
      setCameraError('This browser cannot record video. Choose a video file instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: true });
      streamRef.current = stream;
      if (previewRef.current) {
        previewRef.current.srcObject = stream;
        await previewRef.current.play();
      }
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream, { mimeType: type });
      recorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const duration = Math.min(MAX_SECONDS, Math.max(0, (Date.now() - startedAtRef.current) / 1000));
        const fileType = uploadType(type);
        const extension = fileType === 'video/mp4' ? 'mp4' : 'webm';
        const file = new File(chunksRef.current, `introduction.${extension}`, { type: fileType });
        const discarded = discardRef.current;
        stopTracks();
        recorderRef.current = null;
        setRecording(false);
        setElapsed(0);
        if (discarded) return;
        if (duration < 1 || file.size < 1) {
          setCameraError('The recording was too short. Record at least one second.');
          return;
        }
        onRecorded(file, duration);
      };
      startedAtRef.current = Date.now();
      recorder.start(1000);
      setRecording(true);
    } catch {
      stopTracks();
      setCameraError('Allow the camera and microphone to record an introduction.');
    }
  };

  useEffect(() => {
    if (!recording) return;
    const timer = window.setInterval(() => {
      const seconds = (Date.now() - startedAtRef.current) / 1000;
      setElapsed(seconds);
      if (seconds >= MAX_SECONDS) finishRecording();
    }, 200);
    return () => window.clearInterval(timer);
  }, [recording]);

  const remaining = Math.max(0, MAX_SECONDS - elapsed);
  const clock = `${String(Math.floor(remaining / 60))}:${String(Math.ceil(remaining % 60)).padStart(2, '0')}`;

  return (
    <div className="mt-4 space-y-3">
      <label className="block text-sm">Choose file
        <input
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          disabled={disabled || recording}
          className="mt-2 block"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = '';
            if (file) onPicked(file);
          }}
        />
      </label>
      <div>
        <button
          type="button"
          disabled={disabled || recording}
          onClick={() => void startRecording()}
          className="rounded-lg border border-[#172B45] px-4 py-2 text-sm font-semibold disabled:opacity-60"
        >
          Record introduction
        </button>
        <p className="mt-2 text-sm text-gray-600">Record with your camera for up to 1 minute. Recording stops automatically at 1:00.</p>
      </div>
      <video ref={previewRef} muted playsInline className={recording ? 'aspect-video w-full max-w-md rounded-2xl bg-black' : 'hidden'} />
      {recording && (
        <div>
          <p className="text-sm font-semibold">{clock} remaining</p>
          <button type="button" onClick={finishRecording} className="mt-2 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">Stop and use recording</button>
        </div>
      )}
      {cameraError && <p className="text-sm text-red-700">{cameraError}</p>}
    </div>
  );
}
