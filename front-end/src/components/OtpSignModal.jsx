/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * OTP Sign Modal - UI Component for OTP digital signature
 * Tuân thủ Luật 108/2025/QH15
 */

import React, { useState, useEffect, useRef } from 'react';
import { X, Shield, Loader2, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { notify } from '../utils/notify.jsx';
import { requestOtpForSigning, verifyOtpAndSign, getSigningStatus, cancelSigningRequest } from '../utils/api.js';

export default function OtpSignModal({ 
  isOpen, 
  onClose, 
  voucherId, 
  voucherType, 
  onSuccess,
  onCancel 
}) {
  const { activeCompany } = useAuth();
  const [step, setStep] = useState('request'); // 'request', 'verify', 'success'
  const [loading, setLoading] = useState(false);
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [channel, setChannel] = useState(null);
  const [countdown, setCountdown] = useState(90);
  const [resendDisabled, setResendDisabled] = useState(true);
  const inputRefs = useRef([]);

  // Countdown timer
  useEffect(() => {
    if (countdown > 0 && step === 'verify') {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    } else if (countdown === 0) {
      setResendDisabled(false);
    }
  }, [countdown, step]);

  // Handle OTP input change
  const handleOtpChange = (index, value) => {
    if (value.length > 1) return; // Only allow single digit
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    
    // Auto-submit when all 6 digits filled
    if (newOtp.every(d => d !== '') && newOtp.join('').length === 6) {
      handleVerify(newOtp.join(''));
    }
  };

  // Handle paste OTP
  const handlePaste = (e) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '');
    if (pasted.length === 6) {
      const newOtp = pasted.split('');
      setOtp(newOtp);
      inputRefs.current[5]?.focus();
      handleVerify(pasted);
    }
  };

  // Request OTP
  const handleRequestOtp = async () => {
    setLoading(true);
    try {
      const result = await requestOtpForSigning({
        voucherId,
        companyId: activeCompany?.id || activeCompany
      });
      
      if (result.success) {
        setChannel(result.channel);
        setStep('verify');
        setCountdown(90);
        setResendDisabled(true);
        notify.success(result.message);
      } else {
        throw new Error(result.error || 'Không thể gửi OTP');
      }
    } catch (err) {
      notify.error(err.message || 'Lỗi gửi OTP');
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP
  const handleVerify = async (otpCode) => {
    setLoading(true);
    try {
      const result = await verifyOtpAndSign({
        voucherId,
        companyId: activeCompany?.id || activeCompany,
        otp: otpCode
      });
      
      if (result.success) {
        setStep('success');
        notify.success(result.message);
        setTimeout(() => {
          onSuccess && onSuccess(result.voucher);
          onClose();
        }, 1500);
      } else {
        throw new Error(result.error || 'Xác thực OTP thất bại');
      }
    } catch (err) {
      notify.error(err.message || 'Lỗi xác thực OTP');
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (resendDisabled) return;
    await handleRequestOtp();
  };

  // Cancel signing
  const handleCancel = async () => {
    try {
      await cancelSigningRequest({
        voucherId,
        companyId: activeCompany?.id || activeCompany
      });
      onCancel && onCancel();
      onClose();
    } catch (err) {
      notify.error('Lỗi hủy yêu cầu ký số');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 relative">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <Shield className="w-5 h-5 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">
              Ký số chứng từ {voucherType}
            </h2>
          </div>
          <button 
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Content */}
        {step === 'request' && (
          <div className="space-y-4">
            <div className="text-center py-4">
              <AlertCircle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <p className="text-slate-600">
                Chứng từ loại <strong>{voucherType}</strong> cần được ký số trước khi ghi sổ.
              </p>
              <p className="text-sm text-slate-500 mt-2">
                Mã OTP sẽ được gửi qua kênh thông báo phù hợp với tài khoản của bạn.
              </p>
            </div>
            
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-blue-700">
                <strong>Lưu ý:</strong> Mã OTP có hiệu lực trong 90 giây. Vui lòng kiểm tra và nhập mã kịp thời.
              </p>
            </div>

            <button
              onClick={handleRequestOtp}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Shield className="w-5 h-5" />}
              Gửi mã OTP
            </button>
          </div>
        )}

        {step === 'verify' && (
          <div className="space-y-4">
            <div className="text-center">
              <p className="text-slate-600 mb-2">
                Mã OTP đã được gửi qua{' '}
                <strong>
                  {channel === 'PUSH' ? 'Push Notification' : 
                   channel === 'SMS' ? 'SMS' : 'Email'}
                </strong>
              </p>
              <p className="text-sm text-slate-500">
                Mã sẽ hết hạn sau: <strong className="text-blue-600">{countdown}s</strong>
              </p>
            </div>

            {/* OTP Input */}
            <div className="flex justify-center gap-2">
              {otp.map((digit, index) => (
                <input
                  key={index}
                  ref={el => inputRefs.current[index] = el}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(index, e.target.value)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-12 h-12 border-2 border-slate-300 rounded-lg text-center text-xl font-bold focus:border-blue-500 focus:outline-none"
                />
              ))}
            </div>

            <div className="text-center">
              <button
                onClick={handleResendOtp}
                disabled={resendDisabled || loading}
                className="text-sm text-blue-600 hover:underline disabled:text-slate-400 flex items-center justify-center gap-1 mx-auto"
              >
                <RefreshCw className="w-4 h-4" />
                Gửi lại mã {resendDisabled && `(${countdown}s)`}
              </button>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold py-2.5 rounded-xl"
              >
                Hủy bỏ
              </button>
              <button
                onClick={() => handleVerify(otp.join(''))}
                disabled={loading || otp.some(d => d === '')}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 rounded-xl disabled:opacity-50"
              >
                Xác nhận
              </button>
            </div>
          </div>
        )}

        {step === 'success' && (
          <div className="text-center py-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-bold text-slate-800 mb-2">Ký số thành công!</h3>
            <p className="text-slate-600">Chứng từ đã được ký số và sẵn sàng ghi sổ.</p>
          </div>
        )}
      </div>
    </div>
  );
}