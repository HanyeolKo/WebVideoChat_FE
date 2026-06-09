import useStreamStore from '../store/streamStore'

interface VideoControlsProps {
  onEndCall: () => void
  audioDevices: { deviceId: string; label: string }[]
  videoDevices: { deviceId: string; label: string }[]
  onDeviceChange: (cameraId: string, audioId: string) => void
}

// 이미지 파일이 없는 경우를 대비한 텍스트 폴백
const ImgOrFallback = ({ src, alt, fallback }: { src: string; alt: string; fallback: string }) => (
  <img
    src={src}
    alt={alt}
    onError={(e) => {
      const target = e.currentTarget
      target.style.display = 'none'
      const span = document.createElement('span')
      span.textContent = fallback
      target.parentNode?.insertBefore(span, target.nextSibling)
    }}
    style={{ width: 50, height: 50 }}
  />
)

const VideoControls = ({ onEndCall, audioDevices, videoDevices, onDeviceChange }: VideoControlsProps) => {
  const { muted, cameraOff, toggleMute, toggleCamera } = useStreamStore()

  const handleAudioChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const audioId = e.target.value
    const videoSelect = document.getElementById('videoTrack') as HTMLSelectElement
    onDeviceChange(videoSelect?.value ?? '', audioId)
  }

  const handleVideoChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const cameraId = e.target.value
    const audioSelect = document.getElementById('audioTrack') as HTMLSelectElement
    onDeviceChange(cameraId, audioSelect?.value ?? '')
  }

  return (
    <div id="controls">
      <div
        className={`control-btn${muted ? ' is-active' : ''}`}
        onClick={toggleMute}
        title={muted ? '음소거 해제' : '음소거'}
      >
        <ImgOrFallback
          src={muted ? '/img/unmuted.png' : '/img/muted.png'}
          alt="음소거"
          fallback={muted ? '🔊' : '🔇'}
        />
      </div>
      <div
        className={`control-btn${cameraOff ? ' is-active' : ''}`}
        onClick={toggleCamera}
        title={cameraOff ? '카메라 켜기' : '카메라 끄기'}
      >
        <ImgOrFallback
          src={cameraOff ? '/img/cameraOn.png' : '/img/cameraOff.png'}
          alt="카메라"
          fallback={cameraOff ? '📷' : '🚫'}
        />
      </div>
      <div className="control-btn is-danger" onClick={onEndCall} title="통화 종료">
        <ImgOrFallback src="/img/callEnd.png" alt="통화종료" fallback="📵" />
      </div>
      <div className="trackChoose">
        <select id="audioTrack" onChange={handleAudioChange}>
          {audioDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </select>
        <select id="videoTrack" onChange={handleVideoChange}>
          {videoDevices.map((d) => (
            <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default VideoControls
