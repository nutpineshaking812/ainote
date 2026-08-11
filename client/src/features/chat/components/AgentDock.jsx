import React, { useMemo, useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, Button, Tooltip, Popover, List, Badge, theme } from 'antd';
import {
  PlusOutlined,
  CloseOutlined,
  UserAddOutlined,
  RightOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useAgentDock } from '../context/AgentDockContext';

import { useTranslation } from 'react-i18next';
import { getDisplayRole } from '../../../constants/employee';

export function AgentDock({ placement = 'right', style = {}, onSelect }) {
  const {
    allEmployees,
    dockEmployees,
    activeEmployee,
    summonEmployee,
    dismissEmployee,
    setActiveEmployee,
    unreadCounts,
  } = useAgentDock();

  const { token } = theme.useToken();
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(true);

  const wrapperRef = useRef(null);
  const collapseTimerRef = useRef(null);
  const { t } = useTranslation();

  const startCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
    }
    // Auto-collapse after 3 seconds of mouse-leave / inactivity
    collapseTimerRef.current = setTimeout(() => {
      if (!isPopoverOpen) {
        setCollapsed(true);
      }
    }, 3000);
  }, [isPopoverOpen]);

  const clearCollapseTimer = useCallback(() => {
    if (collapseTimerRef.current) {
      clearTimeout(collapseTimerRef.current);
      collapseTimerRef.current = null;
    }
  }, []);

  // Timer controls based on collapsed state changes
  useEffect(() => {
    if (!collapsed) {
      startCollapseTimer();
    } else {
      clearCollapseTimer();
    }
    return () => clearCollapseTimer();
  }, [collapsed, startCollapseTimer, clearCollapseTimer]);

  // Pause timer when popover is open
  useEffect(() => {
    if (isPopoverOpen) {
      clearCollapseTimer();
    } else if (!collapsed) {
      startCollapseTimer();
    }
  }, [isPopoverOpen, collapsed, startCollapseTimer, clearCollapseTimer]);

  // Focus-loss / Click-outside collapse effect (Capturing phase to bypass stopPropagation)
  useEffect(() => {
    if (collapsed) return;

    const handleOutsideClick = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
        // Safe check: do not collapse if click is inside active popovers, dropdowns, or tooltips
        const isPopover = event.target.closest('.ant-popover');
        const isTooltip = event.target.closest('.ant-tooltip');
        if (!isPopover && !isTooltip) {
          setCollapsed(true);
        }
      }
    };

    document.addEventListener('mousedown', handleOutsideClick, true);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
    };
  }, [collapsed]);

  const handleSelect = (employee) => {
    setActiveEmployee(employee);
    setCollapsed(true); // Collapse immediately upon selecting an employee
    if (onSelect) {
      onSelect(employee);
    }
  };

  // 筛选出不在当前工具坞中的其他可用员工
  const availableToSummon = useMemo(() => {
    return allEmployees.filter(
      (emp) => !dockEmployees.some((docked) => (docked.id || docked._id) === (emp.id || emp._id)),
    );
  }, [allEmployees, dockEmployees]);

  // 召唤数字员工的列表渲染
  const summonListContent = (
    <div style={{ width: 280, maxHeight: 350, overflowY: 'auto' }}>
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #f0f0f0',
          fontWeight: 'bold',
          fontSize: 13,
          color: '#666',
        }}
      >
        <UserAddOutlined style={{ marginRight: 6 }} /> 召唤数字员工入驻
      </div>
      {availableToSummon.length > 0 ? (
        <List
          itemLayout="horizontal"
          dataSource={availableToSummon}
          renderItem={(employee) => (
            <List.Item
              onClick={() => summonEmployee(employee)}
              style={{
                padding: '8px 12px',
                cursor: 'pointer',
                transition: 'background 0.2s',
                borderRadius: 4,
              }}
              className="summon-item-hover"
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f9f9fb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <List.Item.Meta
                avatar={
                  <Avatar
                    src={employee.avatar || undefined}
                    size={36}
                    style={{
                      backgroundColor: !employee.avatar ? token.colorPrimary : 'transparent',
                      color: '#fff',
                      fontWeight: 700,
                      fontSize: 14,
                      flexShrink: 0,
                      boxShadow: employee.avatar ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                    }}
                  >
                    {!employee.avatar && employee.name?.[0]}
                  </Avatar>
                }
                title={<span style={{ fontWeight: 600, fontSize: 13 }}>{employee.name}</span>}
                description={
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    <span
                      className="role-tag"
                      style={{
                        background: '#f0f0f6',
                        padding: '1px 4px',
                        borderRadius: 2,
                        marginRight: 4,
                        color: '#555',
                      }}
                    >
                      {getDisplayRole(employee.roleTitle, t)}
                    </span>
                    {employee.description}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      ) : (
        <div style={{ padding: '24px 12px', textAlign: 'center', color: '#999', fontSize: 12 }}>
          所有数字员工已入驻 Dock
        </div>
      )}
    </div>
  );

  const renderEmployeeAvatar = (employee, isActive) => {
    const empId = employee.id || employee._id;
    return (
      <div
        key={empId}
        style={{
          position: 'relative',
          cursor: 'pointer',
          transition: 'transform 0.2s',
        }}
        className="dock-avatar-wrapper"
        onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
      >
        {/* 头像与高亮焦圈 */}
        <Tooltip
          placement="left"
          title={
            <div style={{ padding: '2px 4px' }}>
              <div style={{ fontWeight: 'bold' }}>{employee.name}</div>
              <div style={{ fontSize: 11, color: '#ddd', marginTop: 2 }}>
                {getDisplayRole(employee.roleTitle, t)}
              </div>
              {employee.description && (
                <div
                  style={{
                    fontSize: 10,
                    color: '#bbb',
                    marginTop: 4,
                    borderTop: '1px solid rgba(255,255,255,0.15)',
                    paddingTop: 4,
                  }}
                >
                  {employee.description}
                </div>
              )}
            </div>
          }
        >
          <div
            onClick={() => handleSelect(employee)}
            className={isActive ? 'dock-avatar-active-ring' : ''}
            style={{
              padding: '3px',
              borderRadius: '50%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: isActive
                ? 'linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%)'
                : 'transparent',
              boxShadow: isActive
                ? '0 0 12px color-mix(in srgb, var(--primary-color) 50%, transparent)'
                : 'none',
              transition: 'all 0.3s ease',
            }}
          >
            <Badge count={unreadCounts?.[empId] || 0} size="small" offset={[-2, 2]}>
              <Avatar
                size={38}
                src={employee.avatar || undefined}
                style={{
                  border: '2px solid #fff',
                  backgroundColor: !employee.avatar ? token.colorPrimary : 'transparent',
                  color: '#fff',
                  fontWeight: 700,
                  fontSize: 15,
                  boxShadow: employee.avatar ? '0 2px 4px rgba(0,0,0,0.05)' : 'none',
                }}
              >
                {!employee.avatar && employee.name?.[0]}
              </Avatar>
            </Badge>
          </div>
        </Tooltip>

        {/* 鼠标悬停时可移除员工的 Dismiss 按钮 */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            dismissEmployee(empId);
          }}
          style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.9)',
            color: '#fff',
            border: 'none',
            cursor: 'pointer',
            display: 'none', // 默认隐藏，在 App.css 中通过 hover 样式展示
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '8px',
            padding: 0,
            boxShadow: '0 2px 4px rgba(0,0,0,0.15)',
          }}
          className="avatar-dismiss-btn"
        >
          <CloseOutlined />
        </button>
      </div>
    );
  };

  const renderPlusButton = () => {
    if (availableToSummon.length === 0) return null;
    return (
      <Popover
        content={summonListContent}
        trigger="click"
        placement="leftTop"
        arrow={{ pointAtCenter: true }}
        open={isPopoverOpen}
        onOpenChange={(visible) => setIsPopoverOpen(visible)}
      >
        <Button
          type="dashed"
          shape="circle"
          icon={<PlusOutlined />}
          size="middle"
          style={{
            borderColor: '#bbb',
            color: '#666',
            background: 'rgba(255, 255, 255, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#6366f1';
            e.currentTarget.style.color = '#6366f1';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = '#bbb';
            e.currentTarget.style.color = '#666';
          }}
        />
      </Popover>
    );
  };

  // Determine if it should be shown as expanded
  const isExpanded = !collapsed || isPopoverOpen;

  return (
    <div
      ref={wrapperRef}
      className={`agent-dock-wrapper ${isExpanded ? 'expanded' : 'collapsed'}`}
      style={{
        position: 'absolute',
        bottom: style.bottom | '0px',
        zIndex: 101,
        ...style,
        right: 0, // Enforce right: 0 to ensure the vertical tab is perfectly flush against the right edge
        '--primary-color': token.colorPrimary,
        '--primary-hover': token.colorPrimaryHover,
        '--primary-active': token.colorPrimaryActive,
        '--primary-bg': token.colorPrimaryBg,
      }}
    >
      <style>{`
        /* Dismiss button hover trigger */
        .dock-avatar-wrapper:hover .avatar-dismiss-btn {
          display: flex !important;
        }

        /* Base styles for the vertical tab handle */
        .agent-dock-vertical-tab {
          position: absolute;
          bottom: 0;
          right: 0;
          width: 28px;
          height: 110px;
          background: linear-gradient(135deg, var(--primary-color) 0%, var(--primary-hover) 100%);
          border-radius: 14px 0 0 14px;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          border: 1px solid rgba(255, 255, 255, 0.25);
          border-right: none;
          box-shadow: -4px 6px 18px color-mix(in srgb, var(--primary-color) 35%, transparent), 
                      inset 0 1.5px 1.5px rgba(255, 255, 255, 0.4);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          user-select: none;
          backdrop-filter: blur(8px);
        }

        .agent-dock-vertical-tab:hover {
          width: 32px;
          box-shadow: -6px 8px 24px color-mix(in srgb, var(--primary-color) 50%, transparent), 
                      inset 0 1.5px 2px rgba(255, 255, 255, 0.5);
        }

        /* Base styles for the floating detached capsule */
        .agent-dock-floating-capsule {
          position: absolute;
          bottom: 0;
          right: 20px; /* Floating detached perfectly! */
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 14px 10px;
          border-radius: 28px;
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(24px) saturate(120%);
          border: 1.5px solid rgba(255, 255, 255, 0.6);
          box-shadow: -8px 16px 40px rgba(31, 38, 135, 0.15), 
                      0 0 0 1px rgba(255, 255, 255, 0.4);
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }

        /* 🚀 State transformations via parent classes */
        
        /* When Collapsed */
        .agent-dock-wrapper.collapsed .agent-dock-vertical-tab {
          opacity: 1;
          transform: translateX(0) scale(1);
          pointer-events: auto;
        }
        
        .agent-dock-wrapper.collapsed .agent-dock-floating-capsule {
          opacity: 0;
          transform: translateX(45px) scale(0.85);
          pointer-events: none;
        }

        /* When Expanded */
        .agent-dock-wrapper.expanded .agent-dock-vertical-tab {
          opacity: 0;
          transform: translateX(28px) scale(0.8);
          pointer-events: none;
        }
        
        .agent-dock-wrapper.expanded .agent-dock-floating-capsule {
          opacity: 1;
          transform: translateX(0) scale(1);
          pointer-events: auto;
        }

        /* Custom pulsing glow on active avatar outline */
        @keyframes activeGlow {
          0% { box-shadow: 0 0 6px color-mix(in srgb, var(--primary-color) 40%, transparent); }
          50% { box-shadow: 0 0 16px color-mix(in srgb, var(--primary-hover) 75%, transparent); }
          100% { box-shadow: 0 0 6px color-mix(in srgb, var(--primary-color) 40%, transparent); }
        }
        
        .dock-avatar-active-ring {
          animation: activeGlow 3s infinite ease-in-out;
        }
      `}</style>

      {/* 🚀 Sleek vertical toggle handle on the right edge */}
      <div
        className="agent-dock-vertical-tab"
        onClick={() => {
          setCollapsed(false);
          // const target = activeEmployee || dockEmployees[0];
          // if (target) {
          //   setActiveEmployee(target);
          //   if (onSelect) {
          //     onSelect(target);
          //   }
          // }
        }}
        title="展开 AI 协同"
      >
        <ThunderboltOutlined style={{ color: '#fff', fontSize: 13, marginBottom: 6 }} />
        <div
          style={{
            color: '#fff',
            fontSize: '10px',
            fontWeight: 'bold',
            writingMode: 'vertical-rl',
            letterSpacing: '2px',
          }}
        >
          AI 协同
        </div>
      </div>

      {/* 🚀 Vertical avatar capsule stack on the left (floating detached) */}
      <div
        className="agent-dock-floating-capsule"
        onMouseEnter={clearCollapseTimer}
        onMouseLeave={startCollapseTimer}
      >
        {/* 渲染当前停靠的数字员工头像队列 */}
        {dockEmployees.map((employee) => {
          const empId = employee.id || employee._id;
          const activeId = activeEmployee ? activeEmployee.id || activeEmployee._id : null;
          const isActive = activeId === empId;
          return renderEmployeeAvatar(employee, isActive);
        })}

        {/* 召唤新员工按钮 */}
        {renderPlusButton()}
      </div>
    </div>
  );
}

export default AgentDock;
