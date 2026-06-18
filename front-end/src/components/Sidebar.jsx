import React from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import { MODULES_REGISTER } from '../views/index.js';
import { Terminal } from 'lucide-react';

export default function Sidebar({ activeTab, setActiveTab }) {
  const { user } = useAuth();

  const accessibleModules = MODULES_REGISTER.filter(module => 
    module.allowedRoles.includes(user?.role)
  );

  return (
    <aside className="w-64 bg-slate-900 text-slate-400 border-r border-slate-800 flex flex-col h-full shrink-0">
      <div className="h-16 flex items-center gap-2 px-6 border-b border-slate-800 bg-slate-950">
        <div className="p-1.5 bg-emerald-600 text-white rounded-lg">
          <Terminal size={18} />
        </div>
        <div>
          <span className="text-sm font-black text-white tracking-wider">KETOAN ERP</span>
          <span className="text-[9px] block text-emerald-500 font-bold tracking-widest uppercase -mt-0.5">TT200 Standard</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-1">
        <div className="text-[10px] font-bold text-slate-600 uppercase tracking-widest px-3 mb-2">Phân hệ nghiệp vụ</div>
        {accessibleModules.map(mod => {
          const Icon = mod.icon;
          const isActive = activeTab === mod.id;
          return (
            <button
              key={mod.id}
              onClick={() => setActiveTab(mod.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all group ${
                isActive 
                  ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/20' 
                  : 'hover:bg-slate-800 hover:text-slate-200'
              }`}
            >
              <Icon size={16} className={isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300'} />
              <span>{mod.name}</span>
            </button>
          );
        })}
      </div>
      
      <div className="p-4 border-t border-slate-800 bg-slate-950 text-center text-[10px] text-slate-600 font-medium">
        Hệ thống lõi kế toán doanh nghiệp v1.0
      </div>
    </aside>
  );
}

// Sidebar.jsx  
