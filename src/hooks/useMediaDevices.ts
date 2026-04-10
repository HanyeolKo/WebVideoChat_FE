import { useEffect, useState } from 'react'

export interface MediaDeviceOption {
  deviceId: string
  label: string
}

/**
 * 카메라/마이크 목록 열거 및 미디어 스트림 획득 훅.
 * 카메라가 없을 경우 더미 비디오 트랙을 생성해 오디오 스트림에 합성한다.
 */
const useMediaDevices = (myVideoRef: React.RefObject<HTMLVideoElement | null>) => {
  const [videoDevices, setVideoDevices] = useState<MediaDeviceOption[]>([])
  const [audioDevices, setAudioDevices] = useState<MediaDeviceOption[]>([])
  const [myStream, setMyStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    enumerateDevices()
  }, [])

  const enumerateDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      setVideoDevices(
        devices.filter((d) => d.kind === 'videoinput').map((d) => ({ deviceId: d.deviceId, label: d.label })),
      )
      setAudioDevices(
        devices.filter((d) => d.kind === 'audioinput').map((d) => ({ deviceId: d.deviceId, label: d.label })),
      )
    } catch (e) {
      console.error('[MediaDevices] 장치 열거 실패', e)
    }
  }

  const getMedia = async (cameraId?: string, audioId?: string): Promise<MediaStream | null> => {
    const constraints: MediaStreamConstraints = cameraId || audioId
      ? {
          video: { deviceId: { exact: cameraId } },
          audio: { deviceId: { exact: audioId } },
        }
      : { video: true, audio: true }

    try {
      let stream = await navigator.mediaDevices.getUserMedia(constraints).catch(async () => {
        // 카메라 없는 경우 오디오 + 더미 비디오로 대체
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioStream.addTrack(createDummyVideoTrack())
        return audioStream
      })

      if (myVideoRef.current) {
        myVideoRef.current.srcObject = stream
      }
      setMyStream(stream)
      return stream
    } catch (e) {
      console.error('[MediaDevices] 미디어 획득 실패', e)
      return null
    }
  }

  return { videoDevices, audioDevices, myStream, getMedia }
}

const createDummyVideoTrack = (): MediaStreamTrack => {
  const canvas = document.createElement('canvas')
  canvas.width = 1280
  canvas.height = 720
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'gray'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas.captureStream(60).getVideoTracks()[0]
}

export default useMediaDevices
