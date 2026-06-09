import { useEffect } from 'react'
import '../styles/modal.css'

interface ModalProps {
  onClose: () => void
  children: React.ReactNode
}

/** 재사용 모달: 반투명 백드롭 + 중앙 카드. 백드롭/Esc로 닫고, 카드 내부 클릭은 전파 차단. */
const Modal = ({ onClose, children }: ModalProps) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="닫기">
          X
        </button>
        {children}
      </div>
    </div>
  )
}

export default Modal
