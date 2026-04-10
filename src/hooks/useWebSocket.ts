import { useCallback, useEffect, useRef } from 'react'

type MessageHandler = (data: unknown) => void

/**
 * WebSocket 연결 및 메시지 송수신 훅.
 * roomId가 변경되면 기존 소켓을 닫고 새로 연결한다.
 */
const useWebSocket = (roomId: string | null, onMessage: MessageHandler) => {
  const socketRef = useRef<WebSocket | null>(null)

  const send = useCallback((message: object) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify(message))
    }
  }, [])

  useEffect(() => {
    if (!roomId) return

    const wsBase = import.meta.env.VITE_WS_BASE_URL || ''
    const ws = new WebSocket(`${wsBase}/socket/${roomId}`)
    socketRef.current = ws

    ws.onopen = () => console.log('[WS] 연결됨')
    ws.onclose = () => console.log('[WS] 닫힘')
    ws.onerror = (e) => console.error('[WS] 에러', e)
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        onMessage(data)
      } catch {
        console.error('[WS] 메시지 파싱 실패', event.data)
      }
    }

    return () => {
      ws.close()
    }
  }, [roomId, onMessage])

  return { send }
}

export default useWebSocket
