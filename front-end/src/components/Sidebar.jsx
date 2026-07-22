/**
 * @copyright [TÊN DOANH NGHIỆP] - SaaS ERP Kế toán
 */

import React, { useState, useMemo } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { MODULES_REGISTER, DEPARTMENTS } from '../views/index.js';
import { hasPermission, getAccessibleModules } from '../utils/rbac.js';
import useModuleAccess from '../hooks/useModuleAccess.js';
import { getDefaultFeatureFlags } from '../utils/featureFlags.js';
import { Terminal, ChevronDown, ChevronRight } from 'lucide-react';

export default function Sidebar({ mobileOpen, onRequestClose, isOpen = true, onToggle }) {
  const { user } = useAuth();
  const [expandedDepts, setExpandedDepts] = useState(() => {
    try {
      const saved = localStorage.getItem('sidebar_expanded_depts');
      return saved ? JSON.parse(saved) : Object.keys(DEPARTMENTS);
    } catch {
      return Object.keys(DEPARTMENTS);
    }
  });

  const toggleDept = (deptId) => {
    setExpandedDepts(prev => {
      const next = prev.includes(deptId)
        ? prev.filter(id => id !== deptId)
        : [...prev, deptId];
      localStorage.setItem('sidebar_expanded_depts', JSON.stringify(next));
      return next;
    });
  };

  const userRole = user?.roleId || user?.role;

  // Memoize empty arrays/objects to prevent infinite loop in useModuleAccess
  const enabledModules = useMemo(() => MODULES_REGISTER, []);
  const featureFlags = useMemo(() => getDefaultFeatureFlags(), []);
  
  // Enhanced RBAC: Get accessible modules with dependencies and feature flags
  const { accessibleModules } = useModuleAccess(user, enabledModules, featureFlags);

  // Group accessible modules by department
  const groupedModules = useMemo(() => {
    // Use enhanced RBAC accessible modules
    let accessible = accessibleModules;

    // Keep hardcoded security checks for backward compatibility
    // 1. Chặn bảo mật cứng cho cả phân hệ 'config' cũ và phân hệ 'users' mới
    if ((user?.roleId || user?.role) !== 'admin') {
      accessible = accessible.filter(m => m.id !== 'config' && m.id !== 'users');
    }
    
    // 2. Chỉ root admin mới xem audit logs
    if (!(user?.role === 'admin' || user?.is_root_admin === true)) {
      accessible = accessible.filter(m => m.id !== 'audit-logs');
    }

    // Group by department, sorted by department order
    const groups = {};
    const deptOrder = Object.values(DEPARTMENTS).sort((a, b) => a.order - b.order);
    
    deptOrder.forEach(dept => {
      const deptModules = accessible.filter(m => m.department === dept.id);
      if (deptModules.length > 0) {
        groups[dept.id] = {
          dept,
          modules: deptModules
        };
      }
    });

    return groups;
  }, [user, accessibleModules]);

  const getNavLinkClass = ({ isActive }) => {
    return `w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all duration-200 group ${
      isActive 
        ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/10 text-indigo-300 shadow-lg shadow-indigo-500/10 border border-indigo-500/10' 
        : 'text-slate-500 hover:bg-white/5 hover:text-slate-300'
    }`;
  };

  const renderNavItem = (mod) => {
    const Icon = mod.icon;
    const targetPath = `/${mod.id}`;

    return (
      <NavLink
        key={mod.id}
        to={targetPath}
        className={getNavLinkClass}
      >
        {({ isActive }) => (
          <>
            <Icon size={16} className={isActive ? 'text-indigo-300' : 'text-slate-600 group-hover:text-slate-300'} />
            {isOpen && <span>{mod.name}</span>}
          </>
        )}
      </NavLink>
    );
  };

  const renderSidebarContent = () => (
    <>
      <div className="h-16 flex items-center gap-2 px-4 border-b border-white/5 bg-gradient-to-r from-[#0B0F19] to-[#0F172A]">
        <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg shrink-0 shadow-lg shadow-indigo-500/20">
          <Terminal size={18} />
        </div>
        {isOpen && (
          <div className="overflow-hidden">
            <span className="text-sm font-black text-white tracking-wider whitespace-nowrap">KETOAN ERP</span>
            <span className="text-[9px] block text-indigo-400 font-bold tracking-widest uppercase -mt-0.5 whitespace-nowrap">TT200 Standard</span>
          </div>
        )}
        {onToggle && (
          <button 
            onClick={onToggle} 
            className="ml-auto p-1.5 hover:bg-white/5 rounded-lg transition-colors"
            aria-label="Toggle sidebar"
          >
            <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 7l-7 7 7 7" />
            </svg>
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {Object.values(groupedModules).map(({ dept, modules }) => {
          const DeptIcon = dept.icon;
          const isExpanded = expandedDepts.includes(dept.id);

          return (
            <div key={dept.id} className="space-y-0.5">
              {/* Department header */}
              <button
                onClick={() => toggleDept(dept.id)}
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-200 ${
                  isOpen 
                    ? 'text-slate-600 hover:text-slate-300 hover:bg-white/5' 
                    : 'justify-center text-slate-600 hover:text-slate-400'
                }`}
                title={dept.name}
              >
                <DeptIcon size={14} className="shrink-0" />
                {isOpen && (
                  <>
                    <span className="truncate flex-1 text-left">{dept.name}</span>
                    {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  </>
                )}
              </button>

              {/* Module items */}
              {(isOpen && isExpanded) && (
                <div className="space-y-0.5 pl-1">
                  {modules.map(mod => renderNavItem(mod))}
                </div>
              )}
              {(!isOpen) && (
                <div className="space-y-0.5">
                  {modules.map(mod => renderNavItem(mod))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className={`p-4 border-t border-white/5 bg-gradient-to-r from-[#0B0F19] to-[#0F172A] ${isOpen ? 'text-center' : 'text-center'}`}>
        {isOpen ? (
          <span className="text-[10px] text-slate-600 font-medium">Hệ thống lõi kế toán doanh nghiệp v1.0</span>
        ) : (
          <span className="text-[8px] text-slate-600 font-medium">v1.0</span>
        )}
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className={`hidden md:flex sticky top-0 h-screen bg-gradient-to-b from-[#0B0F19] via-[#0F172A] to-[#0B0F19] text-slate-400 border-r border-white/5 flex-col shrink-0 transition-all duration-300 ${
        isOpen ? 'w-64' : 'w-20'
      }`}>
        {renderSidebarContent()}
      </aside>

      {/* Mobile overlay sidebar */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-40 flex">
          <div className="fixed inset-0 bg-black/40" onClick={onRequestClose} />
          <div className="relative w-64 bg-gradient-to-b from-[#0B0F19] via-[#0F172A] to-[#0B0F19] text-slate-400 border-r border-white/5 flex flex-col h-full">
            <div className="h-16 flex items-center gap-2 px-4 border-b border-white/5 bg-gradient-to-r from-[#0B0F19] to-[#0F172A]">
              <div className="p-1.5 bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-lg shadow-lg shadow-indigo-500/20">
                <Terminal size={18} />
              </div>
              <div>
                <span className="text-sm font-black text-white tracking-wider">KETOAN ERP</span>
                <span className="text-[9px] block text-indigo-400 font-bold tracking-widest uppercase -mt-0.5">TT200</span>
              </div>
              <button className="ml-auto mr-1 p-2" onClick={onRequestClose} aria-label="Close menu">
                <svg className="w-5 h-5 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {Object.values(groupedModules).map(({ dept, modules }) => {
                const DeptIcon = dept.icon;
                const isExpanded = expandedDepts.includes(dept.id);

                return (
                  <div key={dept.id} className="space-y-0.5">
                    <button
                      onClick={() => toggleDept(dept.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest text-slate-600 hover:text-slate-300 hover:bg-white/5 transition-all duration-200"
                    >
                      <DeptIcon size={14} />
                      <span className="truncate flex-1 text-left">{dept.name}</span>
                      {isExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                    </button>
                    {isExpanded && (
                      <div className="space-y-0.5 pl-1">
                        {modules.map(mod => {
                          const Icon = mod.icon;
                          return (
                            <NavLink
                              key={mod.id}
                              to={`/${mod.id}`}
                              onClick={onRequestClose}
                              className={getNavLinkClass}
                            >
                              {({ isActive }) => (
                                <>
                                  <Icon size={16} className={isActive ? 'text-indigo-300' : 'text-slate-600 group-hover:text-slate-300'} />
                                  <span>{mod.name}</span>
                                </>
                              )}
                            </NavLink>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="p-4 border-t border-white/5 bg-gradient-to-r from-[#0B0F19] to-[#0F172A] text-center text-[10px] text-slate-600 font-medium">
              Hệ thống lõi kế toán doanh nghiệp v1.0
            </div>
          </div>
        </div>
      )}
    </>
  );
}