import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import VideoControls from '../components/VideoControls'
import useMediaDevices from '../hooks/useMediaDevices'
import useWebRTC from '../hooks/useWebRTC'
import useWebSocket from '../hooks/useWebSocket'
import useRoomStore from '../store/roomStore'
import useStreamStore from '../store/streamStore'
import '../styles/chatRoom.css'

const ChatRoomPage = () => {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const { roomName, participantCount, clearRoom } = useRoomStore()
  const { myStream, muted, cameraOff, setMyStream } = useStreamStore()

  const myVideoRef = useRef<HTMLVideoElement>(null)
  const peerVideoRef = useRef<HTMLVideoElement>(null)

  const [toast, setToast] = useState<string | null>(null)

  const { videoDevices, audioDevices, getMedia } = useMediaDevices(myVideoRef)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const handleCallEnd = useCallback(() => {
    clearRoom()
    navigate('/')
  }, [clearRoom, navigate])

  // 통화 시작은 "미디어 준비 + 소켓 OPEN"이 모두 충족된 시점에 1회만 수행한다.
  const mediaReadyRef = useRef<MediaStream | null>(null)
  const socketOpenRef = useRef(false)
  const startedRef = useRef(false)
  const tryStartRef = useRef<() => void>(() => {})

  const { send } = useWebSocket(
    roomId ?? null,
    (data) => {
      handleMessage(data as Parameters<typeof handleMessage>[0])
    },
    () => {
      socketOpenRef.current = true
      tryStartRef.current()
    },
  )

  const { startCall, endCall, handleMessage, createOffer } = useWebRTC({
    myStream,
    peerVideoRef,
    send,
    onCallEnd: handleCallEnd,
  })

  const tryStart = useCallback(() => {
    if (startedRef.current) return
    if (!mediaReadyRef.current || !socketOpenRef.current) return
    startedRef.current = true
    void startCall(mediaReadyRef.current)
  }, [startCall])

  useEffect(() => {
    tryStartRef.current = tryStart
  }, [tryStart])

  // 최초 진입: 미디어 획득 → (소켓 OPEN과 함께) offer 전송 트리거
  useEffect(() => {
    const init = async () => {
      const stream = await getMedia()
      if (stream) {
        mediaReadyRef.current = stream
        setMyStream(stream)
        tryStart()
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 음소거 상태 동기화
  useEffect(() => {
    if (!myStream) return
    myStream.getAudioTracks().forEach((track) => { track.enabled = !muted })
  }, [muted, myStream])

  // 카메라 상태 동기화
  useEffect(() => {
    if (!myStream) return
    myStream.getVideoTracks().forEach((track) => { track.enabled = !cameraOff })
  }, [cameraOff, myStream])

  const handleDeviceChange = async (cameraId: string, audioId: string) => {
    const stream = await getMedia(cameraId, audioId)
    if (stream) {
      setMyStream(stream)
      await createOffer()
    }
  }

  const handleEndCall = () => {
    endCall()
    showToast('통화 종료')
    handleCallEnd()
  }

  return (
    <div className="chatroom-page">
      {toast && (
        <div id="toast" style={{ display: 'block', opacity: 1 }}>
          {toast}
        </div>
      )}

      <h2>{roomName}</h2>
      <p id="participantCount">{participantCount}명 참여 중</p>

      <div id="videoContainer">
        <video ref={peerVideoRef} id="peerFace" playsInline autoPlay width={300} height={300} />
        <video ref={myVideoRef} id="myFace" playsInline autoPlay width={300} height={300} muted />
      </div>

      <VideoControls
        onEndCall={handleEndCall}
        audioDevices={audioDevices}
        videoDevices={videoDevices}
        onDeviceChange={handleDeviceChange}
      />
    </div>
  )
}

export default ChatRoomPage
