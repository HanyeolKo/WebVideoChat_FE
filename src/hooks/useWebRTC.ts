import { useCallback, useEffect, useRef } from 'react'

const STUN_CONFIG: RTCConfiguration = {
  iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
}

interface UseWebRTCOptions {
  myStream: MediaStream | null
  peerVideoRef: React.RefObject<HTMLVideoElement | null>
  send: (message: object) => void
  onCallEnd: () => void
}

/**
 * RTCPeerConnection 생성 및 시그널링 메시지 처리 훅.
 * send 함수를 통해 WebSocket으로 offer/answer/candidate를 중계한다.
 */
const useWebRTC = ({ myStream, peerVideoRef, send, onCallEnd }: UseWebRTCOptions) => {
  const pcRef = useRef<RTCPeerConnection | null>(null)

  const createPeerConnection = useCallback(() => {
    const pc = new RTCPeerConnection(STUN_CONFIG)

    pc.onicecandidate = (event) => {
      send({ event: 'candidate', data: event.candidate })
    }

    pc.addEventListener('track', (event) => {
      if (peerVideoRef.current) {
        peerVideoRef.current.srcObject = event.streams[0]
      }
    })

    return pc
  }, [peerVideoRef, send])

  const initPeerConnection = useCallback(() => {
    if (pcRef.current) {
      pcRef.current.close()
    }
    pcRef.current = createPeerConnection()
    return pcRef.current
  }, [createPeerConnection])

  const addTracks = useCallback((pc: RTCPeerConnection) => {
    if (myStream) {
      myStream.getTracks().forEach((track) => pc.addTrack(track, myStream))
    }
  }, [myStream])

  const createOffer = useCallback(async () => {
    const pc = pcRef.current
    if (!pc) return
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    send({ event: 'offer', data: offer })
  }, [send])

  const handleMessage = useCallback(async (data: { event: string; data: RTCSessionDescriptionInit | RTCIceCandidateInit | null }) => {
    if (data.event === 'offer') {
      const pc = initPeerConnection()
      await pc.setRemoteDescription(data.data as RTCSessionDescriptionInit)
      addTracks(pc)
      const answer = await pc.createAnswer()
      await pc.setLocalDescription(answer)
      send({ event: 'answer', data: answer })
    } else if (data.event === 'answer') {
      await pcRef.current?.setRemoteDescription(data.data as RTCSessionDescriptionInit)
    } else if (data.event === 'candidate') {
      if (data.data) {
        await pcRef.current?.addIceCandidate(data.data as RTCIceCandidateInit)
      }
    } else if (data.event === 'closed') {
      onCallEnd()
    }
  }, [initPeerConnection, addTracks, send, onCallEnd])

  const startCall = useCallback(async () => {
    const pc = initPeerConnection()
    addTracks(pc)
    await createOffer()
  }, [initPeerConnection, addTracks, createOffer])

  const endCall = useCallback(() => {
    send({ event: 'closed' })
    pcRef.current?.close()
    pcRef.current = null
  }, [send])

  useEffect(() => {
    return () => {
      pcRef.current?.close()
    }
  }, [])

  return { startCall, endCall, handleMessage, createOffer }
}

export default useWebRTC
