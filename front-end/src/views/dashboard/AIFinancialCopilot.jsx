/**
 * AI Financial Copilot - Main AI Interface
 * Chat-based interface with Gemini AI integration
 */

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import {
  MessageSquare,
  Calculator,
  Workflow,
  TrendingUp,
  Send,
  Mic,
  Paperclip,
  Sparkles,
  Loader2,
  AlertCircle,
  CheckCircle2,
  XCircle,
  ChevronRight,
  Lightbulb,
  BarChart3,
  FileText,
  Download,
  Eye,
  Zap
} from 'lucide-react';

// API base URL - tự động normalize để đảm bảo có /api
const getApiBase = () => {
  const raw = import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || 'http://localhost:5000';
  return raw.endsWith('/api') ? raw : `${raw.replace(/\/$/, '')}/api`;
};
const API_BASE = getApiBase();

export default function AIFinancialCopilot() {
  const navigate = useNavigate();
  const { activeCompany } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('chat'); // chat, math, workflow, insights
  const [geminiAvailable, setGeminiAvailable] = useState(true);
  const [cooldown, setCooldown] = useState(0);
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  
  // Use actual company ID from auth context
  const companyId = activeCompany?.id;
  
  // Rate limiting: 3 seconds between requests (Gemini free tier: 5 req/min)
  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => {
        setCooldown(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation history on mount
  useEffect(() => {
    if (companyId) {
      loadConversationHistory();
      checkGeminiStatus();
    }
  }, [companyId]);

  const checkGeminiStatus = async () => {
    if (!companyId) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE}/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question: 'test', company_id: companyId })
      });
      setGeminiAvailable(response.ok);
    } catch (error) {
      setGeminiAvailable(false);
    }
  };

  const loadConversationHistory = async () => {
    if (!companyId) return;
    
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(`${API_BASE}/ai/suggested?company_id=${companyId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        if (data.success && data.data) {
          const history = data.data.map(q => ({
            id: q.id || Date.now() + Math.random(),
            role: 'user',
            content: q.question,
            timestamp: q.created_at
          }));
          setMessages(history);
        }
      }
    } catch (error) {
      console.error('Failed to load history:', error);
    }
  };

  const sendMessage = async (messageText = input) => {
    if (!messageText.trim() || loading || !companyId || cooldown > 0) return;

    const userMessage = {
      id: Date.now(),
      role: 'user',
      content: messageText,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      let result;

      if (mode === 'math') {
        result = await solveMath(messageText);
      } else if (mode === 'workflow') {
        result = await executeWorkflow(messageText);
      } else if (mode === 'insights') {
        result = await getInsights(messageText);
      } else {
        result = await askQuestion(messageText);
      }
      
      // Set cooldown after successful request
      setCooldown(3);

      const aiMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: result.answer || result.insights || result.analysis || 'Không có phản hồi',
        data: result.data,
        sql: result.sql,
        confidence: result.confidence,
        model: result.model,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);

      // Save to knowledge base
      await saveToKnowledgeBase(messageText, aiMessage.content);

    } catch (error) {
      const errorMessage = {
        id: Date.now() + 1,
        role: 'assistant',
        content: `❌ Lỗi: ${error.message}`,
        error: true,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, errorMessage]);
      
      // Set cooldown even on error to prevent spam
      setCooldown(3);
    } finally {
      setLoading(false);
    }
  };

  const askQuestion = async (question) => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE}/ai/query`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question, company_id: companyId })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      
      // Check for quota exceeded error
      if (errorData.error?.includes('quota') || errorData.error?.includes('429')) {
        throw new Error('Đã vượt quá giới hạn API. Vui lòng đợi 1-2 phút và thử lại.');
      }
      
      throw new Error(errorData.error || errorData.message || 'Failed to get AI response');
    }
    
    const data = await response.json();
    return data.data;
  };

  const solveMath = async (problem) => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE}/ai/math`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ problem, context: 'financial', company_id: companyId })
    });

    if (!response.ok) throw new Error('Failed to solve math problem');
    const data = await response.json();
    return data.data;
  };

  const executeWorkflow = async (workflowType) => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE}/ai/workflow/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ workflowType, context: { period: 'current_month' }, company_id: companyId })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error || errorData.message || `HTTP ${response.status}: Failed to execute workflow`);
    }
    const data = await response.json();
    return data.data;
  };

  const getInsights = async (question) => {
    const token = localStorage.getItem('accessToken');
    const response = await fetch(`${API_BASE}/ai/cross-module`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ question, company_id: companyId })
    });

    if (!response.ok) throw new Error('Failed to get insights');
    const data = await response.json();
    return data.data;
  };

  const saveToKnowledgeBase = async (question, answer) => {
    try {
      const token = localStorage.getItem('accessToken');
      await fetch(`${API_BASE}/ai/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ question, answer, company_id: companyId })
      });
    } catch (error) {
      console.error('Failed to save to knowledge base:', error);
    }
  };

  const handleQuickAction = (action) => {
    const actions = {
      'Doanh thu tháng này': 'Doanh thu tháng này là bao nhiêu?',
      'Tính lãi suất': 'Tính lãi suất 12% trên số tiền 100 triệu VND trong 1 năm',
      'Kết sổ kỳ': 'CLOSING',
      'Phân tích tài chính': 'Phân tích sức khỏe tài chính tổng quan của công ty',
      'Đối chiếu công nợ': 'Đối chiếu công nợ phải thu và phải trả',
      'Kiểm kê kho': 'INVENTORY_AUDIT'
    };

    const text = actions[action] || action;
    setMode(action.includes('Kết sổ') || action.includes('Kiểm kê') ? 'workflow' : 
           action.includes('Tính') ? 'math' : 
           action.includes('Phân tích') ? 'insights' : 'chat');
    sendMessage(text);
  };

  const quickActions = [
    { icon: TrendingUp, label: 'Doanh thu tháng này', color: 'blue' },
    { icon: Calculator, label: 'Tính lãi suất', color: 'green' },
    { icon: Workflow, label: 'Kết sổ kỳ', color: 'purple' },
    { icon: BarChart3, label: 'Phân tích tài chính', color: 'orange' },
    { icon: FileText, label: 'Đối chiếu công nợ', color: 'red' },
    { icon: Eye, label: 'Kiểm kê kho', color: 'cyan' }
  ];

  const suggestedQuestions = [
    'Tổng doanh thu hôm nay?',
    'Công nợ phải thu hiện tại?',
    'Tồn kho đang có bao nhiêu?',
    'Dự báo dòng tiền tháng tới?'
  ];

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">AI Financial Copilot</h1>
                <p className="text-sm text-gray-500">
                  {geminiAvailable ? '✨ Gemini 2.5 Flash đã kết nối' : '⚠️ Chế độ offline (Python service)'}
                </p>
              </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setMode('chat')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                mode === 'chat' ? 'bg-blue-100 text-blue-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => setMode('math')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                mode === 'math' ? 'bg-green-100 text-green-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Calculator className="w-4 h-4" />
              Calculator
            </button>
            <button
              onClick={() => setMode('workflow')}
              className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
                mode === 'workflow' ? 'bg-purple-100 text-purple-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Workflow className="w-4 h-4" />
              Workflow
            </button>
            <button
              onClick={() => setMode('insights')}
              className={`px-4 py-2 rounded-lg flex items gap-2 ${
                mode === 'insights' ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
              }`}
            >
              <Lightbulb className="w-4 h-4" />
              Insights
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Quick Actions */}
        <div className="w-80 bg-white border-r border-gray-200 p-4 overflow-y-auto">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Quick Actions</h2>
          <div className="space-y-2">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickAction(action.label)}
                className={`w-full p-3 rounded-lg border-2 border-${action.color}-200 hover:border-${action.color}-400 bg-${action.color}-50 hover:bg-${action.color}-100 transition-all flex items-center gap-3`}
              >
                <action.icon className={`w-5 h-5 text-${action.color}-600`} />
                <span className="text-sm font-medium text-gray-700">{action.label}</span>
                <ChevronRight className="w-4 h-4 ml-auto text-gray-400" />
              </button>
            ))}
          </div>

          <h2 className="text-sm font-semibold text-gray-700 mt-6 mb-3">Suggested Questions</h2>
          <div className="space-y-2">
            {suggestedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => sendMessage(q)}
                className="w-full p-2 text-left text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-12">
                <Sparkles className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-700 mb-2">
                  Chào mừng đến với AI Financial Copilot
                </h3>
                <p className="text-gray-500 mb-6">
                  Hỏi đáp tài chính bằng ngôn ngữ tự nhiên, giải bài toán, phân tích workflow
                </p>
                <div className="grid grid-cols-2 gap-3 max-w-2xl mx-auto">
                  {suggestedQuestions.map((q, idx) => (
                    <button
                      key={idx}
                      onClick={() => sendMessage(q)}
                      className="p-3 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-all text-sm text-left"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-lg p-4 ${
                    msg.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : msg.error
                      ? 'bg-red-50 border-2 border-red-200'
                      : 'bg-white border border-gray-200'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {msg.role === 'assistant' && (
                      <div className="p-1 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                        <Sparkles className="w-5 h-5 text-white" />
                      </div>
                    )}
                    <div className="flex-1">
                      <div className="prose prose-sm max-w-none">
                        {msg.content}
                      </div>

                      {/* SQL Query Display */}
                      {msg.sql && (
                        <div className="mt-3 p-3 bg-gray-900 text-green-400 rounded-lg font-mono text-xs overflow-x-auto">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-gray-400">SQL Query:</span>
                            <button
                              onClick={() => navigator.clipboard.writeText(msg.sql)}
                              className="text-xs text-blue-400 hover:text-blue-300"
                            >
                              Copy
                            </button>
                          </div>
                          {msg.sql}
                        </div>
                      )}

                      {/* Data Table */}
                      {msg.data && msg.data.length > 0 && (
                        <div className="mt-3 overflow-x-auto">
                          <table className="min-w-full text-xs border border-gray-200">
                            <thead className="bg-gray-50">
                              <tr>
                                {Object.keys(msg.data[0]).map(key => (
                                  <th key={key} className="px-3 py-2 text-left text-gray-700 font-medium">
                                    {key}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {msg.data.slice(0, 10).map((row, idx) => (
                                <tr key={idx} className="border-t border-gray-200">
                                  {Object.values(row).map((val, vidx) => (
                                    <td key={vidx} className="px-3 py-2 text-gray-600">
                                      {val !== null && val !== undefined ? String(val) : '-'}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                          {msg.data.length > 10 && (
                            <p className="text-xs text-gray-500 mt-2">
                              Hiển thị 10/{msg.data.length} bản ghi
                            </p>
                          )}
                        </div>
                      )}

                      {/* Confidence & Meta */}
                      <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
                        {msg.confidence && (
                          <span className="flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3" />
                            {msg.confidence}% confidence
                          </span>
                        )}
                        {msg.model && <span>Model: {msg.model}</span>}
                        <span>{new Date(msg.timestamp).toLocaleTimeString('vi-VN')}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-1 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                      <Sparkles className="w-5 h-5 text-white" />
                    </div>
                    <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                    <span className="text-gray-600">Đang suy nghĩ...</span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="bg-white border-t border-gray-200 p-4">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    placeholder={
                      mode === 'math' ? 'Nhập bài toán...' :
                      mode === 'workflow' ? 'Nhập loại workflow (CLOSING, RECONCILIATION, TAX_REPORT, INVENTORY_AUDIT)...' :
                      mode === 'insights' ? 'Nhập câu hỏi phân tích...' :
                      'Hỏi đáp tài chính...'
                    }
                    className="w-full px-4 py-3 pr-24 border-2 border-gray-200 rounded-lg focus:border-blue-500 focus:outline-none resize-none"
                    rows={1}
                    disabled={loading}
                  />
                  <div className="absolute right-2 bottom-2 flex items-center gap-1">
                    <button
                      type="button"
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                      title="Voice input (coming soon)"
                    >
                      <Mic className="w-5 h-5" />
                    </button>
                    <button
                      type="button"
                      className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                      title="Attach file (coming soon)"
                    >
                      <Paperclip className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                <button
                  onClick={() => sendMessage()}
                  disabled={!input.trim() || loading || cooldown > 0}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : cooldown > 0 ? (
                    <>
                      <span>⏱️</span>
                      {cooldown}s
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Gửi
                    </>
                  )}
                </button>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-gray-500">
                <span>Enter để gửi, Shift+Enter để xuống dòng</span>
                <div className="flex items-center gap-3">
                  {cooldown > 0 && (
                    <span className="text-orange-600 font-medium">
                      ⏱️ Vui lòng đợi {cooldown}s
                    </span>
                  )}
                  <span>{geminiAvailable ? '✨ Gemini 2.5 Flash' : '⚠️ Fallback mode'}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}