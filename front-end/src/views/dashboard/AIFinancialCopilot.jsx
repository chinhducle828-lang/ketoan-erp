/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 * 
 * AIFinancialCopilot - Giao diện hỏi đáp tài chính bằng AI
 */

import React, { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, Loader2, Lightbulb } from 'lucide-react';
import api from '../../utils/api.js';

export default function AIFinancialCopilot({ companyId }) {
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: 'ai',
      content: 'Xin chào! Tôi là AI Copilot của bạn. Bạn có thể hỏi tôi bất kỳ câu hỏi nào về tài chính kế toán. Ví dụ: "Doanh thu tháng này là bao nhiêu?" hoặc "Công nợ phải thu của khách hàng A là bao nhiêu?"',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage = {
      id: Date.now(),
      type: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await api.post('/api/ai/query', {
        question: input,
        company_id: companyId
      });

      const aiMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: response.data.answer || 'Xin lỗi, tôi không thể trả lời câu hỏi này.',
        data: response.data.data,
        sql: response.data.sql,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiMessage]);
    } catch (err) {
      const errorMessage = {
        id: Date.now() + 1,
        type: 'ai',
        content: 'Xin lỗi, đã có lỗi xảy ra. Vui lòng thử lại.',
        error: true,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatCurrency = (value) => {
    return Math.round(value || 0)?.toLocaleString('vi-VN');
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 flex flex-col h-[500px]">
      {/* Header */}
      <div className="p-4 border-b flex items-center gap-3">
        <Bot size={24} className="text-indigo-600" />
        <div>
          <h3 className="font-bold text-slate-800">AI Financial Copilot</h3>
          <p className="text-xs text-slate-500">Hỏi đáp tài chính bằng ngôn ngữ tự nhiên</p>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map(message => (
          <div key={message.id} className={`flex gap-3 ${
            message.type === 'user' ? 'justify-end' : 'justify-start'
          }`}>
            {message.type === 'ai' && (
              <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Bot size={16} className="text-indigo-600" />
              </div>
            )}
            
            <div className={`max-w-[70%] p-3 rounded-2xl ${
              message.type === 'user' 
                ? 'bg-indigo-600 text-white' 
                : message.error 
                  ? 'bg-rose-50 text-rose-700' 
                  : 'bg-slate-100 text-slate-800'
            }`}>
              <p className="text-sm">{message.content}</p>
              
              {/* Hiển thị dữ liệu nếu có */}
              {message.data && message.data.length > 0 && (
                <div className="mt-2 pt-2 border-t border-slate-200">
                  <p className="text-xs font-semibold mb-1">Kết quả:</p>
                  <div className="max-h-32 overflow-y-auto">
                    {message.data.slice(0, 5).map((row, idx) => (
                      <div key={idx} className="text-xs py-1">
                        {Object.entries(row).map(([key, value]) => (
                          <span key={key} className="mr-3">
                            <strong>{key}:</strong> {typeof value === 'number' ? formatCurrency(value) : value}
                          </span>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {message.type === 'user' && (
              <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center flex-shrink-0">
                <User size={16} className="text-slate-600" />
              </div>
            )}
          </div>
        ))}
        
        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center">
              <Bot size={16} className="text-indigo-600" />
            </div>
            <div className="bg-slate-100 p-3 rounded-2xl">
              <Loader2 size={16} className="animate-spin text-slate-600" />
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Nhập câu hỏi của bạn..."
            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={2}
            disabled={loading}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>

        {/* Suggested questions */}
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="text-xs text-slate-500 flex items-center gap-1">
            <Lightbulb size={12} /> Gợi ý:
          </span>
          {[
            'Doanh thu tháng này?',
            'Công nợ phải thu?',
            'Tiền mặt trong két?',
            'Hàng tồn kho nhiều?'
          ].map((q, idx) => (
            <button
              key={idx}
              onClick={() => setInput(q)}
              className="text-xs px-2 py-1 bg-slate-100 rounded hover:bg-slate-200"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}