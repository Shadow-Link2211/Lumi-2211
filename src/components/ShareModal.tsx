import React, { useState } from 'react';
import { Copy, MessageCircle, Send, Mail, Share2, QrCode, X } from 'lucide-react';
import { Modal } from './Modal';
import { useToast } from '../lib/toast';

interface ShareModalProps {
  open: boolean;
  onClose: () => void;
  url: string;
  text: string;
}

export const ShareModal: React.FC<ShareModalProps> = ({ open, onClose, url, text }) => {
  const { showToast } = useToast();
  const [qr, setQr] = useState('');

  const copyLink = () => {
    navigator.clipboard.writeText(url).then(
      () => showToast('Link copied to clipboard'),
      () => showToast('Could not copy link'),
    );
  };

  const shareWhatsApp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank');
  };

  const shareTelegram = () => {
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareEmail = () => {
    window.open(`mailto:?subject=Check this out on Lumi&body=${encodeURIComponent(`${text}\n\n${url}`)}`, '_blank');
  };

  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lumi', text, url });
        showToast('Shared successfully');
      } catch {
        // user cancelled — no toast
      }
    } else {
      copyLink();
    }
  };

  const generateQR = () => {
    setQr(`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(url)}`);
  };

  return (
    <Modal open={open} onClose={onClose} title="Share">
      <div className="share-options">
        <div className="share-option" onClick={copyLink}>
          <div className="icon-circle" style={{ background: 'var(--accent)' }}><Copy size={20} /></div>
          <span>Copy Link</span>
        </div>
        <div className="share-option" onClick={shareWhatsApp}>
          <div className="icon-circle" style={{ background: '#25D366' }}><MessageCircle size={20} /></div>
          <span>WhatsApp</span>
        </div>
        <div className="share-option" onClick={shareTelegram}>
          <div className="icon-circle" style={{ background: '#0088cc' }}><Send size={20} /></div>
          <span>Telegram</span>
        </div>
        <div className="share-option" onClick={shareEmail}>
          <div className="icon-circle" style={{ background: '#EA4335' }}><Mail size={20} /></div>
          <span>Email</span>
        </div>
        <div className="share-option" onClick={nativeShare}>
          <div className="icon-circle" style={{ background: 'var(--secondary)' }}><Share2 size={20} /></div>
          <span>More</span>
        </div>
        <div className="share-option" onClick={generateQR}>
          <div className="icon-circle" style={{ background: 'var(--neutral-700)' }}><QrCode size={20} /></div>
          <span>QR Code</span>
        </div>
      </div>
      {qr && (
        <div className="qr-container">
          <img src={qr} alt="QR Code" style={{ width: 200, height: 200, borderRadius: 'var(--radius-md)' }} />
          <p className="text-sm text-muted">Scan to open this post</p>
        </div>
      )}
      <div style={{ marginTop: 'var(--space-4)' }}>
        <div className="label">Post Link</div>
        <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
          <input className="input" readOnly value={url} />
          <button className="btn btn-primary btn-sm" onClick={copyLink}><Copy size={14} /></button>
        </div>
      </div>
    </Modal>
  );
};
